"use client";

import { useState } from "react";
import { INVENTORY_CHANGED, itemName, LETTER_MAX, sendGift } from "@/lib/gifts";
import { useT } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { PROFILE_CHANGED } from "@/lib/auth/AuthProvider";
import { ItemArt } from "./ItemArt";

/** Gives an item of the inventory to another player, with a short letter. */
export function GiftDialog({ itemId, onClose, onSent }: { itemId: string; onClose: () => void; onSent: () => void }) {
  const t = useT();
  const [to, setTo] = useState("");
  const [letter, setLetter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    const supabase = getSupabase();
    if (!supabase || busy || !to.trim()) return;
    setBusy(true);
    setError(null);
    const failed = await sendGift(supabase, to, itemId, letter);
    setBusy(false);
    if (failed) {
      setError(failed);
      return;
    }
    setSentTo(to.trim());
    window.dispatchEvent(new Event(INVENTORY_CHANGED));
    window.dispatchEvent(new Event(PROFILE_CHANGED));
    onSent();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-[2rem] border border-white/15 bg-[var(--bg-b)] p-5 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("დახურვა", "Close", "Закрыть")}
          className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/10 text-xl leading-none text-white/80 hover:bg-white/20"
        >
          ×
        </button>
        <h2 className="text-2xl font-extrabold">🎁 {t("საჩუქრის გაგზავნა", "Send a gift", "Отправить подарок")}</h2>

        {sentTo ? (
          <>
            <p className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-base font-bold text-emerald-200">
              {t(`საჩუქარი გაეგზავნა: ${sentTo}`, `The gift was sent to ${sentTo}`, `Подарок отправлен игроку ${sentTo}`)}
            </p>
            <button type="button" onClick={onClose} className="rounded-full bg-amber-300 px-5 py-3 text-base font-extrabold text-black hover:bg-amber-200">
              {t("კარგი", "OK", "Хорошо")}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-4 rounded-2xl bg-black/25 p-3 ring-1 ring-white/10">
              <div className="grid min-h-24 min-w-24 place-items-center">
                <ItemArt id={itemId} />
              </div>
              <b className="text-lg font-extrabold leading-tight">{itemName(itemId)}</b>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-white/70">
              {t("მიმღების მეტსახელი", "Nickname of the receiver", "Никнейм получателя")}
              <input
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setError(null);
                }}
                maxLength={16}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base font-normal text-white outline-none placeholder:text-white/30 focus:border-amber-300"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-white/70">
              {t("წერილი (არასავალდებულო)", "A letter (optional)", "Письмо (необязательно)")}
              <textarea
                value={letter}
                onChange={(e) => setLetter(e.target.value.slice(0, LETTER_MAX))}
                rows={4}
                className="resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-base font-normal text-white outline-none placeholder:text-white/30 focus:border-amber-300"
              />
              <span className="self-end text-xs font-normal text-white/40">{letter.length}/{LETTER_MAX}</span>
            </label>
            <p className="text-xs text-white/50">
              {t("ნივთი თქვენი ინვენტარიდან გადავა მიმღებთან და უკან აღარ დაბრუნდება.", "The item moves from your inventory to theirs and does not come back.", "Предмет перейдёт из вашего инвентаря к получателю и не вернётся.")}
            </p>
            {error && <p className="text-sm font-bold text-red-300">{error}</p>}
            <button
              type="button"
              disabled={busy || !to.trim()}
              onClick={() => void submit()}
              className="rounded-full bg-amber-300 px-5 py-3 text-base font-extrabold text-black transition-colors hover:bg-amber-200 disabled:bg-white/10 disabled:text-white/45"
            >
              {t("გაჩუქება", "Send the gift", "Подарить")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
