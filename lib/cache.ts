/**
 * The last values the database gave this browser (profile, coins), kept so that the header can be drawn at once on
 * the next visit while the fresh ones are on their way. Nothing here is trusted: the database answer replaces it.
 */
const PREFIX = "pj:";

export function readCache<T>(key: string, userId: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    const parsed = raw ? (JSON.parse(raw) as { userId?: string; value?: T }) : null;
    return parsed && parsed.userId === userId ? (parsed.value ?? null) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, userId: string, value: T | null): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify({ userId, value }));
  } catch {
    // private mode or full storage: the next visit just starts without it
  }
}
