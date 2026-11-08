import { getSupabase } from "./supabase";

const seen = new Set<string>();
let sent = 0;
let installed = false;

/** Browser noise that says nothing about the site. */
const IGNORED = /ResizeObserver|^Script error|Failed to fetch|Load failed|NetworkError|AbortError|cancelled|chrome-extension/i;

/** Sends one error to the log (each message once per page, at most ten per page). Never throws. */
export function reportError(message: string, detail: Record<string, unknown> = {}) {
  try {
    const text = message.trim();
    if (!text || IGNORED.test(text)) return;
    const key = text.slice(0, 120);
    if (seen.has(key) || sent >= 10) return;
    seen.add(key);
    sent += 1;
    const supabase = getSupabase();
    if (!supabase) return;
    void supabase.rpc("log_error", { p_message: text, p_detail: detail, p_url: location.pathname }).then(
      () => {},
      () => {},
    );
  } catch {
    // reporting must never break the page
  }
}

/** Listens for the errors nobody caught (once per page). */
export function installErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    reportError(e.message || "error", { file: e.filename, line: e.lineno, col: e.colno, stack: e.error?.stack?.slice(0, 1500), ua: navigator.userAgent.slice(0, 120) });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    reportError(r instanceof Error ? r.message : String(r), { rejected: true, stack: r instanceof Error ? r.stack?.slice(0, 1500) : undefined, ua: navigator.userAgent.slice(0, 120) });
  });
}
