/**
 * End-to-end check of online Bura against the real Supabase project: test accounts meet through ranked matchmaking,
 * accept the match and play a whole game through the `joker` Edge Function, each acting only on their own view.
 *
 *   npm run sim:bura -- 2      (or 4)
 *
 * Needs .env.local (URL + publishable key) and users jokerpro.sim0..3@example.com.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { botMove, STRONG_STYLE } from "../lib/bura/bot";
import type { BuraState } from "../lib/bura/engine";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const N = Number(process.argv[2] ?? 2) as 2 | 4;
const KIND = process.argv[3] ?? "ranked";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

interface View {
  version: number;
  seat: number;
  view: BuraState;
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
  return data as { ok?: boolean; noop?: boolean };
}

async function myView(c: SupabaseClient, tableId: string): Promise<View | null> {
  const { data } = await c.from("table_views").select("version, seat, view").eq("table_id", tableId).maybeSingle();
  return data as View | null;
}

async function main() {
  const clients = await Promise.all(Array.from({ length: N }, (_, i) => login(i)));
  log(N, "players signed in");

  let table: { id: string; code: string; game: string; rules: unknown } | null = null;
  for (const [i, c] of clients.entries()) {
    const { data, error } = await c.rpc("find_table", { p_kind: KIND, p_format: `p${N}`, p_game: "bura" });
    if (error) throw new Error(`find_table ${i}: ${error.message}`);
    if (table && table.id !== data.id) throw new Error("matchmaking split the players");
    table = data;
  }
  log("table", table!.code, table!.game, JSON.stringify(table!.rules));
  const tableId = table!.id;

  try {
    await call(clients[0], { action: "start", table_id: tableId });
    throw new Error("started before accepting!");
  } catch (e) {
    if (e instanceof Error && e.message.includes("started before")) throw e;
    log("start before accepting refused: OK");
  }
  for (const c of clients) await c.rpc("accept_match", { p_table_id: tableId });
  log("start", JSON.stringify(await call(clients[0], { action: "start", table_id: tableId })));

  let moves = 0;
  let rejected = 0;
  let leaks = 0;
  let lastVersion = -1;
  const started = Date.now();

  for (;;) {
    const views = await Promise.all(clients.map((c) => myView(c, tableId)));
    if (views.some((v) => !v)) {
      await sleep(200);
      continue;
    }
    const vs = views as View[];
    for (const v of vs) {
      for (let k = 1; k < N; k++) if (v.view.hands[k].some((c) => !c.id.startsWith("hidden-"))) leaks++;
      if (v.view.deck.slice(0, -1).some((c) => !c.id.startsWith("deck-"))) leaks++;
    }

    const phase = vs[0].view.phase;
    if (phase === "gameEnd") break;
    if (vs[0].version === lastVersion) {
      await sleep(150);
      continue;
    }

    if (phase === "trickEnd" || phase === "roundEnd") {
      await sleep(phase === "roundEnd" ? 3800 : 1300);
      const r = await call(clients[0], { action: "advance", table_id: tableId, version: vs[0].version });
      void r;
      lastVersion = -1;
      continue;
    }

    const actor = vs.findIndex((v) => v.view.turn === 0);
    if (actor < 0) throw new Error("nobody is on turn in phase " + phase);

    if (moves % 25 === 0) {
      // somebody else tries to move out of turn: must be refused
      const other = (actor + 1) % N;
      try {
        await call(clients[other], { action: "move", table_id: tableId, move: { ids: [vs[other].view.hands[0][0].id] } });
        throw new Error("out-of-turn move was accepted!");
      } catch (e) {
        if (e instanceof Error && e.message.includes("accepted")) throw e;
        rejected++;
      }
    }

    const ids = botMove(vs[actor].view, STRONG_STYLE);
    await call(clients[actor], { action: "move", table_id: tableId, move: { ids } });
    moves++;
    lastVersion = vs[0].version;
    if (moves % 20 === 0) log(`moves ${moves}, round ${vs[0].view.round + 1}, scores`, JSON.stringify(vs[0].view.scores));
  }

  const final = (await myView(clients[0], tableId))!.view;
  log(`finished: ${moves} moves in ${Math.round((Date.now() - started) / 1000)}s, rounds ${final.round + 1}, scores ${final.scores}`);
  console.log(`out-of-turn moves refused: ${rejected}, hidden-card leaks: ${leaks}`);

  await sleep(1500);
  for (const [i, c] of clients.entries()) {
    const { data: res } = await c.from("game_results").select("game, format, kind, place, score, rating_before, rating_after, players").eq("table_id", tableId).maybeSingle();
    console.log(`sim${i}:`, JSON.stringify(res));
  }
  const { data: ratings } = await clients[0].from("player_ratings").select("user_id, game, rating, games, wins").eq("game", "bura");
  console.log("ratings:", JSON.stringify(ratings));
  console.log(leaks === 0 ? "OK" : "LEAKS!");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
