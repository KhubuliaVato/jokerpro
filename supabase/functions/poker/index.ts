// Edge Function `poker`: the referee of online Texas Hold'em tables.
//
// The same idea as `joker` (it owns the full game state in table_games, which clients cannot read, validates every
// decision with the engine the browser uses, lets bots play abandoned seats, and writes each player their own view
// into table_views, which the clients receive live through Realtime), but only for poker: play chips between friends,
// nothing is rated and nothing is recorded. It needs none of the private rating code.
//
// Actions (POST JSON, signed-in user): start, move, advance, tick, sync.
// Built into one file with `npm run build:poker` (esbuild), because Deno needs explicit import paths.
import { createClient } from "npm:@supabase/supabase-js@2";
import { act, type PokerState } from "../../../lib/poker/engine";
import { advance, botStep, createPoker, isActivePhase, ONLINE_AFK_LIMIT, ONLINE_TURN_SECONDS, parseAction, viewFor, type PokerRules } from "../../../lib/poker/online";

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

/** After a finished hand the clients wait this long before asking the server to deal the next one. */
const HAND_END_MIN_PAUSE_MS = 500;
/** Slack on top of the turn timer, so a player's last-second move still counts. */
const DEADLINE_GRACE_MS = 1500;
/** A bot's move waits this long after the last one, however many players ask for it. */
const BOT_PACE_MS = 600;

interface Seat {
  seat: number;
  user_id: string;
  bot: boolean;
}
interface GameRow {
  table_id: string;
  state: PokerState;
  version: number;
  afk: Record<string, number>;
  turn_deadline: string | null;
  updated_at: string;
}
interface Table {
  id: string;
  status: string;
  game: string;
  rules: PokerRules;
}

async function loadTable(tableId: string, userId: string) {
  const [{ data: table }, { data: seats }] = await Promise.all([
    admin.from("game_tables").select("id, status, game, rules").eq("id", tableId).maybeSingle(),
    admin.from("table_seats").select("seat, user_id, bot").eq("table_id", tableId).order("seat"),
  ]);
  if (!table || table.game !== "poker") throw new UserError("table not found");
  const mine = (seats as Seat[] | null)?.find((s) => s.user_id === userId);
  if (!mine) throw new UserError("you are not seated at this table");
  return { table: table as Table, seats: seats as Seat[], me: mine };
}

const botSeat = (seats: Seat[]) => (seat: number) => seats.find((s) => s.seat === seat)?.bot ?? true;

/** When the player on turn must have moved, or null if nobody has to decide (bots, pauses). */
function deadlineFor(state: PokerState, seats: Seat[]): string | null {
  if (!isActivePhase(state) || botSeat(seats)(state.turn)) return null;
  return new Date(Date.now() + ONLINE_TURN_SECONDS * 1000).toISOString();
}

/** Stores a new state (only if nobody else changed the game meanwhile) and sends every player their view. */
async function save(table: Table, seats: Seat[], row: GameRow | null, state: PokerState, afk: Record<string, number>): Promise<boolean> {
  const version = (row?.version ?? 0) + 1;
  const turn_deadline = deadlineFor(state, seats);
  const record = { state, version, afk, turn_deadline, updated_at: new Date().toISOString() };

  if (row) {
    const { data } = await admin.from("table_games").update(record).eq("table_id", table.id).eq("version", row.version).select("table_id");
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

  if (state.phase === "gameEnd") await admin.from("game_tables").update({ status: "finished" }).eq("id", table.id);
  return true;
}

/** Runs `step` on the latest game state, retrying when another request changed it first. */
async function withGame(
  tableId: string,
  userId: string,
  step: (ctx: { table: Table; seats: Seat[]; me: Seat; row: GameRow }) => {
    state: PokerState;
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
  if (seats.length < table.rules.players) throw new UserError("the table is not full yet");
  // `insert` loses to a concurrent start, which is exactly what we want.
  const saved = await save(table, seats, null, createPoker(table.rules), {});
  if (saved) await admin.from("game_tables").update({ status: "playing" }).eq("id", table.id).eq("status", "waiting");
  return { ok: true };
}

async function handle(userId: string, body: Record<string, unknown>) {
  const tableId = String(body.table_id ?? "");
  switch (body.action) {
    case "start":
      return start(tableId, userId);

    case "move":
      return withGame(tableId, userId, ({ me, row }) => {
        const s = row.state;
        if (!isActivePhase(s) || s.turn !== me.seat) throw new Error("not your turn");
        return { state: act(s, parseAction(body.move)), afk: { ...row.afk, [me.seat]: 0 } };
      });

    // The clients' pause after a finished hand is over: deal the next one (the first request wins).
    case "advance":
      return withGame(tableId, userId, ({ row }) => {
        const s = row.state;
        if (s.phase !== "handEnd") return null;
        if (body.version !== row.version) return null;
        if (Date.now() - Date.parse(row.updated_at) < HAND_END_MIN_PAUSE_MS) return null;
        return { state: advance(s) };
      });

    // A timer ran out on someone's screen, or a bot is on turn: do what is due.
    case "tick":
    case "sync":
      return withGame(tableId, userId, ({ seats, row }) => {
        const s = row.state;
        if (!isActivePhase(s)) return null;
        if (botSeat(seats)(s.turn)) {
          if (Date.now() - Date.parse(row.updated_at) < BOT_PACE_MS) return null;
          return { state: botStep(s) };
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
        return { state: botStep(s), afk, kick };
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
    // Rule violations thrown by the engine ("not your turn", "illegal raise") are the player's mistake.
    return json({ error: e instanceof Error ? e.message : String(e) }, 400);
  }
});
