"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useLang } from "@/lib/i18n";
import { claimInvite, INVITE_GAMES, INVITEE_REWARD, pendingInvite, rememberInvite } from "@/lib/invite";
import { getSupabase } from "@/lib/supabase";

/**
 * Handles a visit through a friend's invite link: remembers the code, welcomes a visitor who is not signed in
 * (with the reward they get), and tells the database about the invitation once they have an account.
 */
export function InviteWelcome() {
  const { t } = useLang();
  const { user, loading } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    // the link is read once, after the page has opened
    const found = rememberInvite();
    const id = setTimeout(() => setCode(found), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    const pending = pendingInvite();
    if (!supabase || !userId || !pending) return;
    void claimInvite(supabase, pending);
  }, [userId]);

  if (loading || userId || !code) return null;

  return (
    <div role="status" className="relative z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-300 px-4 py-2 text-center text-sm font-bold text-black">
      <span>
        🎁 {t(
          `მეგობარმა გიწვევთ ProJoker-ზე! ითამაშეთ ${INVITE_GAMES} თამაში და მიიღებთ ${INVITEE_REWARD} მონეტას.`,
          `A friend invited you to ProJoker! Play ${INVITE_GAMES} games and get ${INVITEE_REWARD} coins.`,
          `Друг приглашает вас в ProJoker! Сыграйте ${INVITE_GAMES} игры и получите ${INVITEE_REWARD} монет.`,
        )}
      </span>
      <Link href="/login" className="rounded-full bg-black px-3 py-1 text-amber-200 hover:bg-black/80">
        {t("შესვლა", "Sign in", "Войти")}
      </Link>
    </div>
  );
}
