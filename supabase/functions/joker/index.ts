// Edge Function `joker`: the referee of online tables.
//
// It owns the full game state (table_games, unreadable by clients), validates every decision with the same
// engine the browser uses, lets bots play empty/abandoned seats, and writes each player their own *view*
// (table_views) which the clients receive live through Realtime.
//
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
const MIN_PAUSE_MS = { trickEnd: 1200, handEnd: 500 } as const;
/** Slack on top of the turn timer, so a player's last-second move still counts. */
const DEADLINE_GRACE_MS = 1500;

interface Seat {
  seat: number;
  user_id: string;
  bot: boolean;
}
interface GameRow {
  table_id: string;
  state: GameState;
  version: number;
  afk: Record<string, number>;
  turn_deadline: string | null;
  updated_at: string;
}
interface Table {
  id: string;
  status: string;
  rules: Rules;
}

async function loadTable(tableId: string, userId: string) {
  const [{ data: table }, { data: seats }] = await Promise.all([
    admin.from("game_tables").select("id, status, rules").eq("id", tableId).maybeSingle(),
    admin.from("table_seats").select("seat, user_id, bot").eq("table_id", tableId).order("seat"),
  ]);
  if (!table) throw new UserError("table not found");
  const mine = (seats as Seat[] | null)?.find((s) => s.user_id === userId);
  if (!mine) throw new UserError("you are not seated at this table");
  return { table: table as Table, seats: seats as Seat[], me: mine };
}

const botSeat = (seats: Seat[]) => (seat: number) => seats.find((s) => s.seat === seat)?.bot ?? true;

/** When the player on turn must have moved, or null if nobody has to decide (bots, pauses). */
function deadlineFor(state: GameState, seats: Seat[]): string | null {
  if (!isActivePhase(state) || botSeat(seats)(state.turn)) return null;
  return new Date(Date.now() + ONLINE_TURN_SECONDS * 1000).toISOString();
}

/** Stores a new state (only if nobody else changed the game meanwhile) and sends every player their view. */
async function save(
  table: Table,
  seats: Seat[],
  row: GameRow | null,
  state: GameState,
  afk: Record<string, number>,
): Promise<boolean> {
  const version = (row?.version ?? 0) + 1;
  const turn_deadline = deadlineFor(state, seats);
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
      view: viewFor(state, s.seat),
      turn_deadline,
    })),
  );

  if (state.phase === "gameEnd") await finish(table, seats, state);
  return true;
}

/** Saves every human player's result and closes the table. */
async function finish(table: Table, seats: Seat[], state: GameState) {
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, nickname")
    .in("id", seats.map((s) => s.user_id));
  const names = (seat: number) => profiles?.find((p) => p.id === seats.find((s) => s.seat === seat)?.user_id)?.nickname ?? "მოთამაშე";

  const rows = seats
    .filter((s) => !s.bot)
    .map((s) => {
      const r = resultFor(state, s.seat);
      return {
        user_id: s.user_id,
        game: "joker",
        format: table.rules.format,
        hands: state.history.length,
        place: r.place,
        score: r.score,
        scores: r.scores,
        players: Array.from({ length: PLAYERS }, (_, k) => names((s.seat + k) % PLAYERS)),
        online: true,
        table_id: table.id,
      };
    });
  if (rows.length > 0) await admin.from("game_results").upsert(rows, { onConflict: "table_id,user_id", ignoreDuplicates: true });
  await admin.from("game_tables").update({ status: "finished" }).eq("id", table.id);
}

/** Runs `step` on the latest game state, retrying when another request changed it first. */
async function withGame(
  tableId: string,
  userId: string,
  step: (ctx: { table: Table; seats: Seat[]; me: Seat; row: GameRow }) => {
    state: GameState;
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
  if (seats.length < PLAYERS) throw new UserError("the table is not full yet");
  const state = settle(createGame(table.rules), botSeat(seats));
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
      return withGame(tableId, userId, ({ seats, me, row }) => {
        const state = settle(applyAction(row.state, me.seat, body.move as Action), botSeat(seats));
        return { state, afk: { ...row.afk, [me.seat]: 0 } };
      });

    // The clients' pause after a finished trick/hand is over: move on (the first request wins).
    case "advance":
      return withGame(tableId, userId, ({ seats, row }) => {
        const s = row.state;
        if (s.phase !== "trickEnd" && s.phase !== "handEnd") return null;
        if (body.version !== row.version) return null;
        if (Date.now() - Date.parse(row.updated_at) < MIN_PAUSE_MS[s.phase]) return null;
        return { state: settle(advance(s), botSeat(seats)) };
      });

    // A timer ran out on someone's screen, or a seat was handed to a bot: do what is due.
    case "tick":
    case "sync":
      return withGame(tableId, userId, ({ seats, row }) => {
        const s = row.state;
        if (!isActivePhase(s)) return null;
        const isBot = botSeat(seats);
        if (isBot(s.turn)) return { state: settle(s, isBot) };
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
        return { state: settle(botMove(s), botSeat(seats)), afk, kick };
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
