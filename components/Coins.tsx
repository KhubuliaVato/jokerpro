"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { readCache, writeCache } from "@/lib/cache";
import { loadBalance, loadTableGrants, type CoinGrant } from "@/lib/coins";
import { titleOf } from "@/lib/achievements";
import { useT } from "@/lib/i18n";
import { COINS_CHANGED } from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { HEADER_BTN } from "./ui";

/** A gold coin with a star pressed into it. */
export function CoinIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`flex-none ${className}`} aria-hidden>
      <defs>
        <linearGradient id="coin-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="0.55" stopColor="#f5b83d" />
          <stop offset="1" stopColor="#b9770e" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10.5" fill="url(#coin-face)" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="#7a4a06" strokeOpacity="0.55" strokeWidth="1" />
      <path d="M12 6.6l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="#7a4a06" fillOpacity="0.75" />
    </svg>
  );
}

/** The signed-in player's coins, in the header. Nothing is drawn for a visitor or while it loads. */
export function CoinBalance() {
  const { user } = useAuth();
  const t = useT();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !user) return;
    let cancelled = false;
    const load = () =>
      loadBalance(supabase, user.id).then((b) => {
        if (cancelled) return;
        setBalance(b);
        writeCache("coins", user.id, b);
      });
    // the last known balance shows at once; the fresh one replaces it
    const last = readCache<number>("coins", user.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (last !== null) setBalance((now) => now ?? last);
    void load();
    window.addEventListener(COINS_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(COINS_CHANGED, load);
    };
  }, [user]);

  if (!user || balance === null) return null;
  return (
    <Link
      href="/profile"
      aria-label={`${t("მონეტები", "Coins", "Монеты")}: ${balance}`}
      title={t("მონეტები", "Coins", "Монеты")}
      className={`flex h-10 items-center gap-1.5 px-3 text-[0.95rem] font-extrabold tabular-nums text-amber-200 ${HEADER_BTN}`}
    >
      <CoinIcon />
      {balance}
    </Link>
  );
}

/** What a grant was paid for, in words. */
export function grantLabel(g: Pick<CoinGrant, "reason" | "ref">, t: (ka: string, en: string, ru: string) => string): string {
  if (g.reason === "win") return t("გამარჯვება", "Victory", "Победа");
  if (g.reason === "play") return t("თამაში", "Game played", "Сыграно");
  const n = titleOf(g.ref);
  return n ? t(...n) : t("მიღწევა", "Achievement", "Достижение");
}

/**
 * After a game: the coins it paid (the win and any achievement it completed). The server writes the result a
 * moment after the last move, so this asks a few times; nothing is shown when the game paid nothing.
 */
export function CoinsEarned({ tableId, userId }: { tableId: string; userId: string }) {
  const t = useT();
  const [grants, setGrants] = useState<CoinGrant[] | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const look = async () => {
      const found = await loadTableGrants(supabase, tableId, userId);
      if (cancelled) return;
      if (found.length > 0) setGrants(found);
      else if (++tries < 8) timer = setTimeout(look, 1000);
    };
    timer = setTimeout(look, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tableId, userId]);

  if (!grants) return null;
  const total = grants.reduce((a, g) => a + g.amount, 0);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <style>{"@keyframes coin-pop{0%{transform:scale(.4) rotate(-20deg);opacity:0}70%{transform:scale(1.2) rotate(6deg)}100%{transform:none;opacity:1}}"}</style>
      <b className="flex items-center gap-2 text-3xl font-black tabular-nums text-amber-300" style={{ animation: "coin-pop 0.55s ease-out both" }}>
        <CoinIcon className="size-8" />+{total}
      </b>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-0.5 text-sm text-white/60">
        {grants.map((g) => (
          <li key={`${g.reason}-${g.ref}`}>
            {grantLabel(g, t)} <span className="font-bold text-amber-200">+{g.amount}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
