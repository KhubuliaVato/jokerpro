import { getSupabase } from "./supabase";

const KEY = "visit-session";

/** A random id that lives as long as the browser tab: it counts visitors without recognising anybody. */
function sessionId(): { id: string; fresh: boolean } {
  try {
    const old = sessionStorage.getItem(KEY);
    if (old) return { id: old, fresh: false };
    const id = Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
    sessionStorage.setItem(KEY, id);
    return { id, fresh: true };
  } catch {
    return { id: "nostorage-" + Math.random().toString(36).slice(2, 10), fresh: true };
  }
}

/** Pages whose address holds an id or a table code are counted as one page. */
export function pageOf(path: string): string {
  if (/^\/players\/[^/]+/.test(path)) return "/players/*";
  const table = /^\/(joker|bura|poker|nardi)\/table\//.exec(path);
  if (table) return `/${table[1]}/table/*`;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** Counts one page view (nothing personal: see the migration of `track_visit`). Never throws. */
export function trackVisit(path: string, lang: string) {
  try {
    if (typeof window === "undefined") return;
    const host = location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return;
    if (path.startsWith("/admin")) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const { id, fresh } = sessionId();
    let referrer: string | null = null;
    if (fresh && document.referrer) {
      try {
        const r = new URL(document.referrer).hostname.replace(/^www\./, "");
        if (r && r !== host.replace(/^www\./, "")) referrer = r;
      } catch {
        // an odd referrer: not counted
      }
    }
    void supabase.rpc("track_visit", { p_path: pageOf(path), p_session: id, p_referrer: referrer, p_lang: lang }).then(
      () => {},
      () => {},
    );
  } catch {
    // counting must never break the page
  }
}
