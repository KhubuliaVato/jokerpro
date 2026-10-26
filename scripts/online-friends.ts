/**
 * Plays three friends at a table that a real browser has created: they join by code and answer with bot logic
 * on their own views. Lets the browser's lobby and game screen be checked against live opponents.
 *
 *   npm run sim:friends -- ABC123
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const code = process.argv[2];
const maxMoves = Number(process.argv[3] ?? 400);

async function login(i: number): Promise<SupabaseClient> {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: `jokerpro.sim${i}@example.com`, password: "Tst-7391-Qzx" });
  if (error) throw new Error(error.message);
  return c;
}

const decide = (v: GameState): Action =>
  v.phase === "trump"
    ? { type: "trump", suit: botChooseTrump(v.hands[0]) }
    : v.phase === "bidding"
      ? { type: "bid", bid: botBid(v, 0) }
      : { type: "play", option: botPlay(v, 0) };

async function main() {
  const friends = await Promise.all([1, 2, 3].map(login));
  let tableId = "";
  for (const [n, c] of friends.entries()) {
    await sleep(1500); // arrive one after the other, like real friends
    const { data, error } = await c.rpc("join_table", { p_code: code });
    if (error) throw new Error(`join ${n + 1}: ${error.message}`);
    tableId = data.id;
    console.log("joined as", `sim${n + 1}`);
  }
  let moves = 0;
  const last = new Map<number, number>();
  while (moves < maxMoves) {
    let acted = false;
    for (const [n, c] of friends.entries()) {
      const { data } = await c.from("table_views").select("version, view").eq("table_id", tableId).maybeSingle();
      if (!data) continue;
      const v = data.view as GameState;
      if (v.phase === "gameEnd") return console.log("game over");
      if (["trump", "bidding", "playing"].includes(v.phase) && v.turn === 0 && last.get(n) !== data.version) {
        last.set(n, data.version);
        const { error } = await c.functions.invoke("joker", { body: { action: "move", table_id: tableId, move: decide(v) } });
        if (error) console.log("move refused:", error.message);
        moves++;
        acted = true;
      }
    }
    if (!acted) {
      // Like real clients: move past finished tricks/hands, and nudge the server when somebody else is overdue
      // (a timed-out player or a seat that a bot took over).
      const { data } = await friends[0].from("table_views").select("version, view").eq("table_id", tableId).maybeSingle();
      const v = data?.view as GameState | undefined;
      if (v && (v.phase === "trickEnd" || v.phase === "handEnd")) {
        await sleep(1400);
        await friends[0].functions.invoke("joker", { body: { action: "advance", table_id: tableId, version: data!.version } });
      } else if (v) {
        await friends[0].functions.invoke("joker", { body: { action: "tick", table_id: tableId } });
      }
      await sleep(600);
    }
  }
  console.log("stopped after", moves, "moves");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
