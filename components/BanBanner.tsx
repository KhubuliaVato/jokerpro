"use client";

import { tt, useLang } from "@/lib/i18n";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getSupabase } from "@/lib/supabase";
import { BAN_CHANGED, myPlayBan, returnableTable, tablePath, type PlayBan, type TableRow } from "@/lib/online/client";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
};

/**
 * The red strip on top of every page after leaving a running game: for 7 minutes the seat can be taken back,
 * after that no new table can be joined until the ban (2 hours) is over.
 */
export function BanBanner() {
  useLang();
  const pathname = usePathname();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [ban, setBan] = useState<PlayBan | null>(null);
  const [table, setTable] = useState<TableRow | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Look at the ban when a page opens, when the player comes back to the tab, and right after leaving a game.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    const load = () => {
      myPlayBan(supabase, userId).then(async (b) => {
        if (cancelled) return;
        setBan(b);
        const open = b?.returnUntil && Date.parse(b.returnUntil) > Date.now();
        setTable(open ? await returnableTable(supabase) : null);
      });
    };
    load();
    window.addEventListener(BAN_CHANGED, load);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener(BAN_CHANGED, load);
      window.removeEventListener("focus", load);
    };
  }, [userId, pathname]);

  useEffect(() => {
    if (!ban) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ban]);

  if (!userId || !ban || Date.parse(ban.until) <= now) return null;

  const returnMs = ban.returnUntil ? Date.parse(ban.returnUntil) - now : 0;
  const canReturn = returnMs > 0 && !!table;
  return (
    <div role="alert" className="relative z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-red-700 px-4 py-2 text-center text-sm font-bold text-white shadow-lg">
      <span>
        {canReturn
          ? tt(
              `თქვენ დატოვეთ თამაში! დაბრუნებისთვის დრო დაგრჩათ ${clock(returnMs)}`,
              `You left the game! Time left to return: ${clock(returnMs)}`,
              `Вы покинули игру! Времени на возвращение: ${clock(returnMs)}`,
            )
          : tt(
              `თქვენ დატოვეთ თამაში, ამიტომ დაჯარიმდით: ახალ მაგიდაზე დაჯდომა შეგეძლებათ ${clock(Date.parse(ban.until) - now)}-ის შემდეგ`,
              `You left the game, so you are fined: you can join a new table in ${clock(Date.parse(ban.until) - now)}`,
              `Вы покинули игру, поэтому оштрафованы: сесть за новый стол можно через ${clock(Date.parse(ban.until) - now)}`,
            )}
      </span>
      {canReturn && table && (
        <Link href={tablePath(table)} className="rounded-full bg-white px-3 py-1 text-red-700 hover:bg-red-50">
          {tt("დაბრუნება", "Return", "Вернуться")}
        </Link>
      )}
    </div>
  );
}
