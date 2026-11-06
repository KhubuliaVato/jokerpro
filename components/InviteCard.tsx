"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { INVITE_GAMES, INVITER_REWARD, INVITEE_REWARD, inviteLink, loadInviteStats, type InviteStats } from "@/lib/invite";
import { getSupabase } from "@/lib/supabase";
import { CoinIcon } from "./Coins";

/** "Invite a friend": the player's own link, what both get, and how many friends came. */
export function InviteCard() {
  const t = useT();
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    loadInviteStats(supabase).then((s) => !cancelled && setStats(s));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;

  const link = inviteLink(stats.code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("დააკოპირეთ ბმული", "Copy the link", "Скопируйте ссылку"), link);
    }
  };
  const share = async () => {
    const text = t("მოდი ვითამაშოთ ჯოკერი ONLINE ProJoker-ზე!", "Come and play Joker online on ProJoker!", "Давай сыграем в Джокер онлайн на ProJoker!");
    if (navigator.share) {
      try {
        await navigator.share({ title: "ProJoker", text, url: link });
        return;
      } catch {
        /* closed without sharing */
      }
    }
    void copy();
  };

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-amber-300/30 bg-amber-300/[0.06] p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold text-amber-200">🎁 {t("მოიწვიე მეგობარი", "Invite a friend", "Пригласи друга")}</h2>
        <p className="text-sm text-white/60">
          {t(
            `როცა მეგობარი ${INVITE_GAMES} თამაშს ითამაშებს შემთხვევით მოთამაშეებთან, თქვენ მიიღებთ ${INVITER_REWARD} მონეტას, ის კი ${INVITEE_REWARD}-ს.`,
            `When your friend has played ${INVITE_GAMES} games with random players, you get ${INVITER_REWARD} coins and they get ${INVITEE_REWARD}.`,
            `Когда друг сыграет ${INVITE_GAMES} игры со случайными игроками, вы получите ${INVITER_REWARD} монет, а он ${INVITEE_REWARD}.`,
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t("თქვენი ბმული", "Your link", "Ваша ссылка")}
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-2.5 text-sm text-white/80 outline-none"
        />
        <button type="button" onClick={() => void copy()} className="rounded-full border border-white/25 px-4 py-2.5 text-sm font-extrabold transition-colors hover:border-amber-300 hover:text-amber-300">
          {copied ? t("დაკოპირდა ✓", "Copied ✓", "Скопировано ✓") : t("კოპირება", "Copy", "Копировать")}
        </button>
        <button type="button" onClick={() => void share()} className="rounded-full bg-amber-300 px-5 py-2.5 text-sm font-extrabold text-black transition-colors hover:bg-amber-200">
          {t("გაზიარება", "Share", "Поделиться")}
        </button>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/55">
        <span>
          {t("მოწვეული", "Invited", "Приглашено")}: <b className="text-white">{stats.invited}</b>
        </span>
        <span>
          {t("ჯილდო მიღებულია", "Rewarded", "Награда получена")}: <b className="text-white">{stats.rewarded}</b>
        </span>
        <span className="flex items-center gap-1">
          {t("მიღებული", "Earned", "Получено")}: <CoinIcon className="size-4" /> <b className="text-amber-200">{stats.earned}</b>
        </span>
      </p>
    </section>
  );
}
