"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { INVENTORY_CHANGED, itemName, markGiftsSeen, unseenGifts, type Gift } from "@/lib/gifts";
import { useLang } from "@/lib/i18n";
import { COINS_CHANGED } from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { ItemArt } from "./ItemArt";

/**
 * Shows a gift the moment the player opens the site (or, when already here, the moment it is sent):
 * who gave what, and the letter. Closing it marks the gifts as seen.
 */
export function GiftPopup() {
  const { t } = useLang();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [gifts, setGifts] = useState<Gift[]>([]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    const load = () => {
      unseenGifts(supabase).then((found) => {
        if (cancelled || found.length === 0) return;
        setGifts(found);
        window.dispatchEvent(new Event(INVENTORY_CHANGED));
        window.dispatchEvent(new Event(COINS_CHANGED));
      });
    };
    load();
    const channel = supabase
      .channel(`gifts:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "gifts", filter: `to_user=eq.${userId}` }, load)
      .subscribe();
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!userId || gifts.length === 0) return null;

  const close = () => {
    const supabase = getSupabase();
    setGifts([]);
    if (supabase) void markGiftsSeen(supabase);
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-[2rem] border border-amber-300/40 bg-[var(--bg-b)] p-5 shadow-2xl">
        <h2 className="text-center text-2xl font-extrabold text-amber-200">🎁 {gifts.length > 1 ? t("თქვენ საჩუქრები მიიღეთ!", "You received gifts!", "Вы получили подарки!") : t("თქვენ საჩუქარი მიიღეთ!", "You received a gift!", "Вы получили подарок!")}</h2>
        <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
          {gifts.map((g) => (
            <li key={g.id} className="flex flex-col items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.05] p-4 text-center">
              <div className="grid min-h-24 w-full place-items-center rounded-xl bg-black/25 py-3">
                <ItemArt id={g.item_id} avatar={undefined} />
              </div>
              <p className="text-base font-bold">
                <span className="text-amber-300">{g.from_nick}</span> {t("გჩუქნით", "gave you", "дарит вам")}: <b>{itemName(g.item_id)}</b>
              </p>
              {g.message && <p className="w-full whitespace-pre-wrap break-words rounded-xl bg-white/[0.06] px-3 py-2 text-left text-sm italic text-white/80">„{g.message}“</p>}
            </li>
          ))}
        </ul>
        <button type="button" onClick={close} className="rounded-full bg-amber-300 px-5 py-3 text-base font-extrabold text-black hover:bg-amber-200">
          {t("გმადლობთ!", "Thank you!", "Спасибо!")}
        </button>
        <p className="text-center text-xs text-white/45">{t("ნივთი უკვე თქვენს ინვენტარშია.", "The item is already in your inventory.", "Предмет уже в вашем инвентаре.")}</p>
      </div>
    </div>
  );
}
