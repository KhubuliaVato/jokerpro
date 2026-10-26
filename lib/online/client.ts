import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameState } from "@/lib/joker/engine";
import type { Rules } from "@/lib/joker/rules";

export interface TableRow {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "playing" | "finished" | "closed";
  rules: Rules;
}

export interface SeatRow {
  seat: number;
  user_id: string;
  bot: boolean;
}

/** The player's own, already rotated view of the game, as the server wrote it. */
export interface ViewRow {
  version: number;
  seat: number;
  view: GameState;
  turn_deadline: string | null;
}

/** Georgian text for what the database and the game server can answer. */
export function onlineMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("table not found")) return "ასეთი კოდით მაგიდა ვერ მოიძებნა";
  if (m.includes("already started")) return "ამ მაგიდაზე თამაში უკვე დაიწყო";
  if (m.includes("table is full")) return "მაგიდა სავსეა";
  if (m.includes("not signed in")) return "ჯერ შედით ანგარიშში";
  if (m.includes("not your turn")) return "ახლა თქვენი სვლა არ არის";
  if (m.includes("illegal")) return "ეს სვლა დაუშვებელია";
  if (m.includes("not seated")) return "თქვენ ამ მაგიდასთან არ ზიხართ";
  if (m.includes("failed to fetch") || m.includes("network")) return "კავშირის შეცდომა, შეამოწმეთ ინტერნეტი";
  return `შეცდომა: ${message}`;
}

/** Normalises what a player typed as a join code: letters and digits only, upper case. */
export const cleanCode = (raw: string) => raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);

export async function createTable(
  supabase: SupabaseClient,
  rules: Rules,
): Promise<{ table: TableRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_table", { p_rules: rules });
  return { table: (data as TableRow | null) ?? null, error: error ? onlineMessage(error.message) : null };
}

export async function joinTable(
  supabase: SupabaseClient,
  code: string,
): Promise<{ table: TableRow | null; error: string | null }> {
  const { data, error } = await supabase.rpc("join_table", { p_code: code });
  return { table: (data as TableRow | null) ?? null, error: error ? onlineMessage(error.message) : null };
}

export async function leaveTable(supabase: SupabaseClient, tableId: string): Promise<void> {
  await supabase.rpc("leave_table", { p_table_id: tableId });
}

/** Calls the game server (Edge Function `joker`). Resolves to an error message, or null on success. */
export async function callJoker(supabase: SupabaseClient, body: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.functions.invoke("joker", { body });
  if (!error) return null;
  // The server explains refusals in the response body.
  const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
  return onlineMessage(detail?.error ?? error.message);
}
