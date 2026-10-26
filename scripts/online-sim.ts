/**
 * End-to-end check of online play against the real Supabase project: four test accounts create a table,
 * join it, and play a whole game through the `joker` Edge Function, each acting only on their own view.
 *
 *   npm run sim:online
 *
 * Needs .env.local (URL + publishable key) and four existing users jokerpro.sim0..3@example.com.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { botBid, botChooseTrump, botPlay } from "../lib/joker/bot";
import type { GameState } from "../lib/joker/engine";
import type { Action } from "../lib/joker/online";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const FORMAT = (process.argv[2] ?? "nine") as "nine" | "full";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

interface View {
  version: number;
  seat: number;
  view: GameState;
  turn_deadline: string | null;
}

async function login(i: number): Promise<SupabaseClient> {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: `jokerpro.sim${i}@example.com`, password: "Tst-7391-Qzx" });
  if (error) throw new Error(`login ${i}: ${error.message}`);
  return c;
}

async function call(c: SupabaseClient, body: Record<string, unknown>) {
  const { data, error } = await c.functions.invoke("joker", { body });
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error(detail?.error ?? error.message);
  }
  return data as { ok?: boolean; error?: string; noop?: boolean };
}

async function myView(c: SupabaseClient, tableId: string): Promise<View | null> {
  const { data } = await c.from("table_views").select("version, seat, view, turn_deadline").eq("table_id", tableId).maybeSingle();
  return data as View | null;
}

/** What a bot would do on this player's own (rotated) view: the player is seat 0 there. */
function decide(v: GameState): Action {
  if (v.phase === "trump") return { type: "trump", suit: botChooseTrump(v.hands[0]) };
  if (v.phase === "bidding") return { type: "bid", bid: botBid(v, 0) };
  return { type: "play", option: botPlay(v, 0) };
}

async function main() {
  const clients = await Promise.all([0, 1, 2, 3].map(login));
  log("4 players signed in");

  // Optional third argument: play on an existing table (everybody is already seated), e.g. to resume or to
  // check the end of a game whose state was fast-forwarded.
  const resume = process.argv[3];
  const { data: table, error: e1 } = resume
    ? await clients[0].rpc("join_table", { p_code: resume })
    : await clients[0].rpc("create_table", { p_rules: { format: FORMAT, khishti: 200, pulkaPremium: true } });
  if (e1) throw new Error(`create_table: ${e1.message}`);
  log("table", table.code, table.id);

  // Joining: a wrong code, a duplicate join, then the three friends.
  const bad = await clients[1].rpc("join_table", { p_code: "ZZZZZZ" });
  console.assert(bad.error?.message.includes("table not found"), "wrong code must fail");
  for (const i of resume ? [] : [1, 2, 3]) {
    const { error } = await clients[i].rpc("join_table", { p_code: table.code.toLowerCase() });
    if (error) throw new Error(`join ${i}: ${error.message}`);
  }
  const again = await clients[2].rpc("join_table", { p_code: table.code });
  console.assert(!again.error, "re-joining must be harmless");
  const fifth = await createClient(URL, KEY).auth.signInWithPassword({ email: "jokerpro.sim0@example.com", password: "Tst-7391-Qzx" });
  void fifth;

  const early = await call(clients[1], { action: "start", table_id: table.id });
  log("start", JSON.stringify(early));

  // Nobody may move out of turn, and the stranger cannot even see the table.
  let moves = 0;
  let advances = 0;
  let rejected = 0;
  let leaks = 0;
  let lastVersion = -1;
  const started = Date.now();

  for (;;) {
    const views = await Promise.all(clients.map((c) => myView(c, table.id)));
    if (views.some((v) => !v)) {
      await sleep(200);
      continue;
    }
    const vs = views as View[];

    // No view may contain anybody else's real cards.
    for (const v of vs) for (let k = 1; k < 4; k++) if (v.view.hands[k].some((c) => !c.id.startsWith("hidden-"))) leaks++;

    const phase = vs[0].view.phase;
    if (phase === "gameEnd") break;
    if (vs[0].version === lastVersion) {
      await sleep(150);
      continue;
    }

    if (phase === "trickEnd" || phase === "handEnd") {
      await sleep(1300);
      const r = await call(clients[0], { action: "advance", table_id: table.id, version: vs[0].version });
      if (!r.noop) advances++;
      lastVersion = -1;
      continue;
    }

    const actor = vs.findIndex((v) => v.view.turn === 0);
    if (actor < 0) throw new Error("nobody is on turn in phase " + phase);

    // Once in a while somebody else tries to move too: must be refused.
    if (moves % 40 === 0) {
      const other = (actor + 1) % 4;
      try {
        await call(clients[other], { action: "move", table_id: table.id, move: decide({ ...vs[other].view, turn: 0 }) });
        throw new Error("out-of-turn move was accepted!");
      } catch (e) {
        if (e instanceof Error && e.message.includes("accepted")) throw e;
        rejected++;
      }
    }

    const r = await call(clients[actor], { action: "move", table_id: table.id, move: decide(vs[actor].view) });
    if (r.error) throw new Error(r.error);
    moves++;
    lastVersion = vs[0].version;
    if (moves % 50 === 0) log(`moves=${moves} advances=${advances} hand=${vs[0].view.handIndex + 1} phase=${phase}`);
  }

  const { data: res } = await clients[0].from("game_results").select("place, score, scores, players, online, format").eq("table_id", table.id);
  log(`finished in ${Math.round((Date.now() - started) / 1000)}s: moves=${moves} advances=${advances} rejectedOutOfTurn=${rejected} leaks=${leaks}`);
  log("my saved result:", JSON.stringify(res));
  const { data: t2 } = await clients[0].from("game_tables").select("status").eq("id", table.id).single();
  log("table status:", t2?.status);
  if (leaks > 0) process.exit(2);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
