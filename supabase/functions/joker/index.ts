// Edge Function `joker`: the referee of online tables.
//
// It owns the full game state (table_games, unreadable by clients), validates every decision with the same
// engine the browser uses, lets bots play empty/abandoned seats, and writes each player their own *view*
// (table_views) which the clients receive live through Realtime.
//
// Plays Joker, Bura and Hold'em tables (table.game); everything below dispatches on it.
// Actions (POST JSON, signed-in user): start, move, advance, tick, sync.
// Built into one file with `npm run build:functions` (esbuild), because Deno needs explicit import paths.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createGame, PLAYERS, type GameState } from "../../../lib/joker/engine";
import {
  advance,
  applyAction,
  botMove,
  isActivePhase,
  ONLINE_AFK_LIMIT,
  ONLINE_TURN_SECONDS,
  resultFor,
  settle,
  viewFor,
  type Action,
} from "../../../lib/joker/online";
import type { Rules } from "../../../lib/joker/rules";
import { act as actBura, createGame as createBura, type BuraState } from "../../../lib/bura/engine";
import * as bura from "../../../lib/bura/online";
import { act as actPoker, type PokerState } from "../../../lib/poker/engine";
import * as poker from "../../../lib/poker/online";
// Private: the rating formulas live outside the public repository (see .gitignore).
import { rateGame } from "../../../lib/secret/rating";
import { rateBura } from "../../../lib/secret/buraRating";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

class UserError extends Error {}

/** After a finished trick / hand the clients wait this long before asking the server to move on. */
const MIN_PAUSE_MS = { trickEnd: 1200, handEnd: 500, roundEnd: 3500 } as const;
/** Slack on top of the turn timer, so a player's last-second move still counts. */
const DEADLINE_GRACE_MS = 1500;

interface Seat {
  seat: number;
  user_id: string;
  bot: boolean;
  /** Said "yes" in the ready check of a table of random players. */
  accepted: boolean;
}
type AnyState = GameState | BuraState | PokerState;
interface GameRow {
  table_id: string;
  state: AnyState;
  version: number;
  afk: Record<string, number>;
  turn_deadline: string | null;
  updated_at: string;
}
interface Table {
  id: string;
  status: string;
  game: "joker" | "bura" | "poker";
  rules: Rules | bura.BuraRules | poker.PokerRules;
  /** private: friends with a code (nothing recorded). friendly / ranked: random players. */
  kind: "private" | "friendly" | "ranked";
}

async function loadTable(tableId: string, userId: string) {
  const [{ data: table }, { data: seats }] = await Promise.all([
    admin.from("game_tables").select("id, status, game, rules, kind").eq("id", tableId).maybeSingle(),
    admin.from("table_seats").select("seat, user_id, bot, accepted").eq("table_id", tableId).order("seat"),
  ]);
  if (!table) throw new UserError("table not found");
  const mine = (seats as Seat[] | null)?.find((s) => s.user_id === userId);
  if (!mine) throw new UserError("you are not seated at this table");
  return { table: table as Table, seats: seats as Seat[], me: mine };
}

const botSeat = (seats: Seat[]) => (seat: number) => seats.find((s) => s.seat === seat)?.bot ?? true;

// ---- the games behind one interface ----
const isBura = (t: Table) => t.game === "bura";
const isPoker = (t: Table) => t.game === "poker";
const capacity = (t: Table) => (isBura(t) || isPoker(t) ? (t.rules as bura.BuraRules).players : PLAYERS);
const create = (t: Table, isBot: (seat: number) => boolean): AnyState =>
  isPoker(t)
    ? poker.createPoker(t.rules as poker.PokerRules)
    : isBura(t)
      ? bura.settle(createBura((t.rules as bura.BuraRules).players), isBot)
      : settle(createGame(t.rules as Rules), isBot);
const viewOf = (t: Table, state: AnyState, seat: number) =>
  isPoker(t) ? poker.viewFor(state as PokerState, seat) : isBura(t) ? bura.viewFor(state as BuraState, seat) : viewFor(state as GameState, seat);
const active = (t: Table, state: AnyState) =>
  isPoker(t) ? poker.isActivePhase(state as PokerState) : isBura(t) ? bura.isActivePhase(state as BuraState) : isActivePhase(state as GameState);
// Hold'em bots move one at a time (each on its own tick), so the players can follow the betting.
const settleFor = (t: Table, state: AnyState, isBot: (seat: number) => boolean): AnyState =>
  isPoker(t) ? state : isBura(t) ? bura.settle(state as BuraState, isBot) : settle(state as GameState, isBot);
const botOnce = (t: Table, state: AnyState): AnyState =>
  isPoker(t) ? poker.botStep(state as PokerState) : isBura(t) ? bura.botStep(state as BuraState) : botMove(state as GameState);
const advanceFor = (t: Table, state: AnyState): AnyState =>
  isPoker(t) ? poker.advance(state as PokerState) : isBura(t) ? bura.advance(state as BuraState) : advance(state as GameState);
const isPause = (t: Table, state: AnyState) =>
  state.phase === "trickEnd" || (isBura(t) ? state.phase === "roundEnd" : state.phase === "handEnd");
const resultOf = (t: Table, state: AnyState, seat: number) =>
  isBura(t) ? bura.resultFor(state as BuraState, seat) : resultFor(state as GameState, seat);

/** When the player on turn must have moved, or null if nobody has to decide (bots, pauses). */
function deadlineFor(table: Table, state: AnyState, seats: Seat[]): string | null {
  if (!active(table, state) || botSeat(seats)(state.turn)) return null;
  return new Date(Date.now() + ONLINE_TURN_SECONDS * 1000).toISOString();
}

/** Stores a new state (only if nobody else changed the game meanwhile) and sends every player their view. */
async function save(
  table: Table,
  seats: Seat[],
  row: GameRow | null,
  state: AnyState,
  afk: Record<string, number>,
): Promise<boolean> {
  const version = (row?.version ?? 0) + 1;
  const turn_deadline = deadlineFor(table, state, seats);
  const record = { state, version, afk, turn_deadline, updated_at: new Date().toISOString() };

  if (row) {
    const { data } = await admin
      .from("table_games")
      .update(record)
      .eq("table_id", table.id)
      .eq("version", row.version)
      .select("table_id");
    if (!data || data.length === 0) return false; // somebody got there first
  } else {
    const { error } = await admin.from("table_games").insert({ table_id: table.id, ...record });
    if (error) return false;
  }

  await admin.from("table_views").upsert(
    seats.map((s) => ({
      table_id: table.id,
      user_id: s.user_id,
      seat: s.seat,
      version,
      view: viewOf(table, state, s.seat),
      turn_deadline,
    })),
  );

  if (state.phase === "gameEnd") await finish(table, seats, state);
  return true;
}

/**
 * The game is over. Private tables record nothing. Friendly matches record the result of everyone who stayed.
 * Ranked matches also rate everyone: players who left (a bot finished their seat) lose the full penalty.
 */
async function finish(table: Table, seats: Seat[], state: AnyState) {
  // Hold'em is for friends with play chips only: nothing is recorded.
  if (table.kind !== "private" && !isPoker(table)) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, nickname")
      .in("id", seats.map((s) => s.user_id));
    const names = (seat: number) =>
      profiles?.find((p) => p.id === seats.find((s) => s.seat === seat)?.user_id)?.nickname ?? "მოთამაშე";

    const ranked = table.kind === "ranked";
    const size = capacity(table);
    const bySeat = Array.from({ length: size }, (_, n) => seats.find((s) => s.seat === n)!);

    // Ratings before the game, then the verdict.
    const before: number[] = Array(size).fill(50);
    let verdict: { delta: number[]; detail: unknown[] } | null = null;
    const current = new Map<string, { rating: number; games: number; wins: number; peak: number }>();
    if (ranked) {
      const { data: rows } = await admin
        .from("player_ratings")
        .select("user_id, rating, games, wins, peak")
        .eq("game", table.game)
        .in("user_id", bySeat.map((s) => s.user_id));
      for (const r of rows ?? []) current.set(r.user_id, r);
      bySeat.forEach((s, i) => (before[i] = current.get(s.user_id)?.rating ?? 50));
      const quit = bySeat.map((s) => s.bot);
      verdict = isBura(table)
        ? { delta: rateBura(state as BuraState, before, quit), detail: quit.map(() => ({})) }
        : rateGame(state as GameState, before, quit);
    }

    const rows = bySeat
      // Friendly matches keep nothing about players who left; ranked ones do (they are rated).
      .filter((s) => ranked || !s.bot)
      .map((s) => {
        const r = resultOf(table, state, s.seat);
        const after = ranked ? Math.max(0, before[s.seat] + verdict!.delta[s.seat]) : null;
        return {
          user_id: s.user_id,
          game: table.game,
          format: table.rules.format,
          hands: isBura(table) ? (state as BuraState).round + 1 : (state as GameState).history.length,
          place: r.place,
          score: r.score,
          scores: r.scores,
          players: Array.from({ length: size }, (_, k) => names((s.seat + k) % size)),
          online: true,
          kind: table.kind,
          rating_before: ranked ? before[s.seat] : null,
          rating_after: after,
          table_id: table.id,
        };
      });

    // The unique (table, player) key makes saving happen once, however often the server is asked.
    const { data: inserted } = await admin
      .from("game_results")
      .upsert(rows, { onConflict: "table_id,user_id", ignoreDuplicates: true })
      .select("user_id");

    if (ranked && verdict) {
      const fresh = new Set((inserted ?? []).map((r) => r.user_id));
      for (const s of bySeat) {
        if (!fresh.has(s.user_id)) continue;
        const prev = current.get(s.user_id);
        const rating = Math.max(0, before[s.seat] + verdict.delta[s.seat]);
        const place = resultOf(table, state, s.seat).place;
        await admin.from("player_ratings").upsert({
          user_id: s.user_id,
          game: table.game,
          rating,
          games: (prev?.games ?? 0) + 1,
          wins: (prev?.wins ?? 0) + (place === 1 ? 1 : 0),
          peak: Math.max(prev?.peak ?? 50, rating),
          updated_at: new Date().toISOString(),
        });
        await admin.from("rating_log").insert({
          table_id: table.id,
          user_id: s.user_id,
          game: table.game,
          rating_before: before[s.seat],
          rating_after: rating,
          delta: verdict.delta[s.seat],
          detail: { ...verdict.detail[s.seat], quit: s.bot },
        });
      }
    }
  }
  await admin.from("game_tables").update({ status: "finished" }).eq("id", table.id);
}

/** Runs `step` on the latest game state, retrying when another request changed it first. */
async function withGame(
  tableId: string,
  userId: string,
  step: (ctx: { table: Table; seats: Seat[]; me: Seat; row: GameRow }) => {
    state: AnyState;
    afk?: Record<string, number>;
    /** Seats whose player timed out too often: a bot owns them from now on. */
    kick?: number[];
  } | null,
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const ctx = await loadTable(tableId, userId);
    const { data } = await admin.from("table_games").select("*").eq("table_id", tableId).maybeSingle();
    if (!data) throw new UserError("the game has not started");
    const row = data as GameRow;
    const out = step({ ...ctx, row });
    if (!out) return { ok: true, noop: true };
    if (await save(ctx.table, ctx.seats, row, out.state, out.afk ?? row.afk)) {
      for (const seat of out.kick ?? []) {
        await admin.from("table_seats").update({ bot: true }).eq("table_id", tableId).eq("seat", seat);
      }
      return { ok: true, version: row.version + 1 };
    }
  }
  throw new UserError("busy, try again");
}

async function start(tableId: string, userId: string) {
  const { table, seats } = await loadTable(tableId, userId);
  if (table.status !== "waiting") return { ok: true, noop: true };
  if (seats.length < capacity(table)) throw new UserError("the table is not full yet");
  if (table.kind !== "private" && !seats.every((s) => s.accepted)) throw new UserError("the match is not accepted yet");
  const state = create(table, botSeat(seats));
  // `insert` loses to a concurrent start, which is exactly what we want.
  const saved = await save(table, seats, null, state, {});
  if (saved) await admin.from("game_tables").update({ status: "playing" }).eq("id", table.id).eq("status", "waiting");
  return { ok: true };
}

async function handle(userId: string, body: Record<string, unknown>) {
  const tableId = String(body.table_id ?? "");
  switch (body.action) {
    case "start":
      return start(tableId, userId);

    case "move":
      return withGame(tableId, userId, ({ table, seats, me, row }) => {
        let next: AnyState;
        if (isPoker(table)) {
          const s = row.state as PokerState;
          if (!poker.isActivePhase(s) || s.turn !== me.seat) throw new Error("not your turn");
          next = actPoker(s, poker.parseAction(body.move));
        } else if (isBura(table)) {
          const s = row.state as BuraState;
          if (!bura.isActivePhase(s) || s.turn !== me.seat) throw new Error("not your turn");
          next = actBura(s, bura.parseAction(body.move));
        } else {
          next = applyAction(row.state as GameState, me.seat, body.move as Action);
        }
        return { state: settleFor(table, next, botSeat(seats)), afk: { ...row.afk, [me.seat]: 0 } };
      });

    // The clients' pause after a finished trick/hand is over: move on (the first request wins).
    case "advance":
      return withGame(tableId, userId, ({ table, seats, row }) => {
        const s = row.state;
        if (!isPause(table, s)) return null;
        if (body.version !== row.version) return null;
        if (Date.now() - Date.parse(row.updated_at) < MIN_PAUSE_MS[s.phase as keyof typeof MIN_PAUSE_MS]) return null;
        return { state: settleFor(table, advanceFor(table, s), botSeat(seats)) };
      });

    // A timer ran out on someone's screen, or a seat was handed to a bot: do what is due.
    case "tick":
    case "sync":
      return withGame(tableId, userId, ({ table, seats, row }) => {
        const s = row.state;
        if (!active(table, s)) return null;
        const isBot = botSeat(seats);
        if (isBot(s.turn)) {
          // A bot's move at a Hold'em table waits a moment after the last one, however many players ask.
          if (isPoker(table)) {
            if (Date.now() - Date.parse(row.updated_at) < 600) return null;
            return { state: botOnce(table, s) };
          }
          return { state: settleFor(table, s, isBot) };
        }
        const late = row.turn_deadline && Date.now() > Date.parse(row.turn_deadline) + DEADLINE_GRACE_MS;
        if (!late) return null;
        // The player ran out of time: a bot moves for them; after two in a row the seat is theirs no more.
        const missed = (row.afk[s.turn] ?? 0) + 1;
        const afk = { ...row.afk, [s.turn]: missed };
        const kick: number[] = [];
        if (missed >= ONLINE_AFK_LIMIT) {
          kick.push(s.turn);
          seats.find((x) => x.seat === s.turn)!.bot = true;
        }
        return { state: settleFor(table, botOnce(table, s), botSeat(seats)), afk, kick };
      });

    default:
      throw new UserError("unknown action");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const { data } = await admin.auth.getUser(token);
    if (!data.user) return json({ error: "not signed in" }, 401);
    const body = (await req.json()) as Record<string, unknown>;
    return json(await handle(data.user.id, body));
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    const message = e instanceof Error ? e.message : String(e);
    // Rule violations thrown by the engine ("not your turn", "illegal play") are the player's mistake.
    return json({ error: message }, 400);
  }
});
