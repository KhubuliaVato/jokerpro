import type { SupabaseClient } from "@supabase/supabase-js";

/** The reward the invited friend gets after 3 games with random players (the inviter gets INVITER_REWARD). */
export const INVITEE_REWARD = 100;
export const INVITER_REWARD = 150;
export const INVITE_GAMES = 3;

const KEY = "invite:ref";

/** Remembers the code of an invite link (`/?ref=CODE`) until the visitor signs in. */
export function rememberInvite(): string | null {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) localStorage.setItem(KEY, ref.toUpperCase());
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetInvite(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}

/** Tells the database who invited the signed-in player (it decides whether it counts); the code is forgotten either way. */
export async function claimInvite(supabase: SupabaseClient, code: string): Promise<boolean> {
  const { data } = await supabase.rpc("claim_invite", { p_code: code });
  forgetInvite();
  return data === true;
}

export interface InviteStats {
  code: string;
  invited: number;
  rewarded: number;
  earned: number;
}

export async function loadInviteStats(supabase: SupabaseClient): Promise<InviteStats | null> {
  const { data } = await supabase.rpc("my_invite_stats");
  const row = Array.isArray(data) ? data[0] : data;
  return (row as InviteStats | undefined) ?? null;
}

export const inviteLink = (code: string) => `${window.location.origin}/?ref=${code}`;
