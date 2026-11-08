"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase";

/** What the database says when a non-admin calls an admin function, or something is not allowed, in Georgian. */
function message(raw: string): string {
  if (raw.includes("not an admin")) return "წვდომა არ გაქვთ";
  if (raw.includes("nickname taken")) return "ეს სახელი დაკავებულია";
  if (raw.includes("bad nickname")) return "სახელი 2-დან 16 სიმბოლომდე უნდა იყოს";
  if (raw.includes("cannot ban yourself")) return "საკუთარ თავს ვერ დააბლოკავთ";
  if (raw.includes("cannot remove yourself")) return "საკუთარ თავს ადმინობას ვერ წაართმევთ";
  if (raw.includes("no such player")) return "მოთამაშე ვერ მოიძებნა";
  if (raw.includes("no such item")) return "ნივთი ვერ მოიძებნა";
  if (raw.includes("amount must not be zero")) return "რაოდენობა ნულის ტოლი არ უნდა იყოს";
  if (raw.includes("bad price")) return "ფასი 1-ზე ნაკლები არ უნდა იყოს";
  if (raw.includes("bad rating")) return "ქულა არასწორია";
  if (raw.includes("bad duration")) return "ვადა არასწორია";
  if (raw.includes("Could not find the function")) return "ადმინის ფუნქციები ბაზაში ჯერ არ არის (მიგრაცია 20261122 არ არის დადებული)";
  return raw;
}

/** Calls an admin function; throws a Georgian message on failure. */
export async function admin<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("ბაზა არ არის მიერთებული");
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(message(error.message));
  return data as T;
}

const known = new Map<string, boolean>();

/** Whether the signed-in player is an admin (null while it is being asked). Only decides what the page shows: the database decides what is allowed. */
export function useIsAdmin(): boolean | null {
  const { user } = useAuth();
  const id = user?.id ?? null;
  const [answer, setAnswer] = useState<{ id: string; admin: boolean } | null>(null);

  useEffect(() => {
    if (!id || known.has(id)) return;
    const supabase = getSupabase();
    if (!supabase) return;
    let off = false;
    supabase.rpc("is_admin").then(({ data }) => {
      const admin = data === true;
      known.set(id, admin);
      if (!off) setAnswer({ id, admin });
    });
    return () => {
      off = true;
    };
  }, [id]);

  if (!id) return false;
  if (known.has(id)) return known.get(id)!;
  return answer && answer.id === id ? answer.admin : null;
}

/** Loads something with an admin call and keeps the old answer on screen while it is loaded again. */
export function useRemote<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string } | null>(null);
  const [tick, setTick] = useState(0);
  const k = `${key}#${tick}`;
  useEffect(() => {
    let off = false;
    load().then(
      (data) => {
        if (!off) setState({ key: k, data });
      },
      (e: Error) => {
        if (!off) setState({ key: k, error: e.message });
      },
    );
    return () => {
      off = true;
    };
    // `load` is a new closure on every render; `k` says when it must run again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return {
    data: state?.data,
    error: state?.key === k ? state.error : undefined,
    loading: state?.key !== k,
    reload: () => setTick((t) => t + 1),
  };
}

export interface Overview {
  users: number;
  new_24h: number;
  new_7d: number;
  active_24h: number;
  results: number;
  results_24h: number;
  tables_waiting: number;
  tables_playing: number;
  tables_finished: number;
  coins_total: number;
  coins_paid_7d: number;
  items_owned: number;
  bans: number;
  gifts: number;
  referrals: number;
  by_game: Record<string, number>;
  signups: { d: string; n: number }[];
}

export interface AdminUserRow {
  id: string;
  nickname: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  avatar_color: string;
  avatar_icon: string;
  avatar_url: string | null;
  balance: number;
  games: number;
  items: number;
  banned_until: string | null;
  is_admin: boolean;
}

export interface AdminUserDetail {
  id: string;
  nickname: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  avatar_color: string;
  avatar_icon: string;
  avatar_url: string | null;
  equipped: { back: string | null; frame: string | null; name: string | null; fx: string | null };
  balance: number;
  is_admin: boolean;
  banned_until: string | null;
  ratings: { game: string; rating: number; games: number; wins: number; peak: number }[];
  items: { id: string; kind: string; price: number; at: string }[];
  results: { game: string; kind: string | null; format: string | null; place: number; score: number; online: boolean; at: string; before: number | null; after: number | null }[];
  coins: { amount: number; reason: string; at: string }[];
  gifts_sent: number;
  gifts_received: number;
  invited: number;
}

export interface AdminTable {
  id: string;
  code: string;
  game: string;
  kind: string;
  status: string;
  created_at: string;
  seats: { seat: number; user: string | null; nickname: string | null; bot: boolean }[];
}

export interface AdminMessage {
  id: number;
  body: string;
  created_at: string;
  user_id: string | null;
  nickname: string | null;
  table_code: string | null;
  game: string | null;
}

export interface AdminShopItem {
  id: string;
  kind: string;
  price: number;
  tier: "permanent" | "rotating";
  owners: number;
}

export interface AdminErrorRow {
  source: "client" | "server";
  message: string;
  n: number;
  last: string;
  first: string;
  url: string | null;
  detail: Record<string, unknown>;
  users: number;
}

export interface AdminLogRow {
  id: number;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
  admin: string | null;
  target: string | null;
}
