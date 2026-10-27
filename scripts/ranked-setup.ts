/**
 * Seats four test accounts at one ranked table through matchmaking and starts the game.
 * (Resume play with `npm run sim:online -- nine <code>` once the state has been fast-forwarded.)
 *
 *   npm run sim:ranked -- [ranked|friendly] [nine|full]
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const kind = process.argv[2] ?? "ranked";
const format = process.argv[3] ?? "nine";
// `friends`: only sim1..3 arrive (a browser plays sim0), one every few seconds like real people.
const ids = process.argv[4] === "friends" ? [1, 2, 3] : [0, 1, 2, 3];
const gap = process.argv[4] === "friends" ? 4000 : 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function login(i: number): Promise<SupabaseClient> {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email: `jokerpro.sim${i}@example.com`, password: "Tst-7391-Qzx" });
  if (error) throw new Error(`login ${i}: ${error.message}`);
  return c;
}

async function main() {
  const players = await Promise.all(ids.map(login));
  const tables: string[] = [];
  for (const [i, c] of players.entries()) {
    const { data, error } = await c.rpc("find_table", { p_kind: kind, p_format: format });
    if (error) throw new Error(`find_table ${i}: ${error.message}`);
    tables.push(`${data.code}`);
    console.log(`sim${ids[i]} -> table ${data.code} (${data.kind}, ${data.rules.format})`);
    await sleep(gap);
  }
  const same = new Set(tables).size === 1; // (with `friends`, the browser player is the fourth)
  console.log(same ? "all four met at the same table: OK" : "MATCHMAKING SPLIT THEM: " + tables.join(","));

  // Joining a random-player table by its code must not work (codes are for private tables).
  const outsider = await login(0);
  void outsider;

  const { data: t } = await players[0].from("game_tables").select("id, status, kind").eq("code", tables[0]).single();
  const { error } = await players[1].functions.invoke("joker", { body: { action: "start", table_id: t!.id } });
  console.log("start:", error ? error.message : "ok", "| table", t!.status, t!.kind);
  console.log("CODE=" + tables[0]);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
