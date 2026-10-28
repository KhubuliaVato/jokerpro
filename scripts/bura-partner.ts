/**
 * Plays the second seat of a private Bura table as test2 (so one browser alone can try the online table):
 *
 *   node .sim/bura-partner.cjs CODE
 *
 * Needs .env.local and the test account test2@projoker.test.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { botAct, STRONG_STYLE } from "../lib/bura/bot";
import type { BuraState } from "../lib/bura/engine";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const code = process.argv[2];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error: e1 } = await c.auth.signInWithPassword({ email: "test2@projoker.test", password: "123456" });
  if (e1) throw e1;
  const { data: table, error: e2 } = await c.rpc("join_table", { p_code: code });
  if (e2) throw e2;
  console.log("joined", table.id);
  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await c.functions.invoke("joker", { body });
    if (error) console.log("call error", body.action, error.message);
    return data;
  };
  await call({ action: "start", table_id: table.id });
  let lastVersion = -1;
  for (let i = 0; i < 4000; i++) {
    const { data: v } = await c.from("table_views").select("version, seat, view, turn_deadline").eq("table_id", table.id).maybeSingle();
    if (v && v.version !== lastVersion) {
      const view = v.view as BuraState;
      if (view.phase === "gameEnd") break;
      if ((view.phase === "play" || view.phase === "call" || view.phase === "var") && view.turn === 0) {
        await sleep(1200);
        // the view has the other hand blanked and the pile hidden, which is what a client has to work with
        const action = botAct(view, { ...STRONG_STYLE, samples: 12 });
        await call({ action: "move", table_id: table.id, move: action });
        lastVersion = -1;
        continue;
      }
      if (view.phase === "trickEnd" || view.phase === "roundEnd") {
        await sleep(view.phase === "roundEnd" ? 4000 : 1500);
        await call({ action: "advance", table_id: table.id, version: v.version });
      }
      lastVersion = v.version;
    }
    await sleep(400);
  }
  console.log("done");
}
main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
