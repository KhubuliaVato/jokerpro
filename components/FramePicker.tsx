"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PROFILE_CHANGED } from "@/lib/auth/AuthProvider";
import { cosmetic, FRAMES, loadWorn, wear } from "@/lib/cosmetics";
import { useT } from "@/lib/i18n";
import { LEVEL_FRAMES, levelColor } from "@/lib/level";
import { RARITY_LOOK, rarityOf } from "@/lib/rarity";
import { loadInventory } from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { Avatar } from "./Avatar";

type Face = { color?: string; icon?: string; url?: string | null };

/** A window to choose the frame around one's photo: the owned ones (shop and level frames), or none. */
export function FramePicker({ userId, face, level, onClose }: { userId: string; face: Face; level: number; onClose: () => void }) {
  const t = useT();
  const [owned, setOwned] = useState<string[] | null>(null);
  const [worn, setWorn] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    Promise.all([loadInventory(supabase, userId), loadWorn(supabase, userId)]).then(([items, w]) => {
      if (cancelled) return;
      setOwned(items.filter((id) => id.startsWith("f_")));
      setWorn(w.frame);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const choose = useCallback(
    async (id: string | null) => {
      const supabase = getSupabase();
      if (!supabase || busy) return;
      setBusy(id ?? "none");
      setError(null);
      const err = await wear(supabase, userId, "frame", id);
      setBusy(null);
      if (err) {
        setError(err);
        return;
      }
      setWorn(id);
      window.dispatchEvent(new Event(PROFILE_CHANGED));
    },
    [busy, userId],
  );

  const mine = owned ?? [];
  const shop = FRAMES.map((f) => f.id).filter((id) => !id.startsWith("f_lv") && mine.includes(id));
  const levelOnes = LEVEL_FRAMES.map((f) => ({ ...f, has: mine.includes(f.id) }));

  const tile = (id: string | null, label: string, caption?: string, locked = false) => {
    const on = worn === id;
    const color = id ? RARITY_LOOK[rarityOf(id)].color : "#64748b";
    const lvl = LEVEL_FRAMES.find((f) => f.id === id);
    return (
      <li key={id ?? "none"} className="flex">
        <button
          type="button"
          disabled={locked || busy !== null}
          onClick={() => choose(id)}
          aria-pressed={on}
          className={`relative flex h-full w-full flex-col items-center justify-between gap-2 rounded-2xl border p-3 pt-6 text-center transition-[border-color,background-color,translate] duration-200 enabled:hover:-translate-y-0.5 ${on ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.03] enabled:hover:border-white/30"} ${locked ? "opacity-70" : ""}`}
        >
          {lvl && (
            <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.7rem] font-black leading-none text-black shadow" style={{ background: lvl.accent, opacity: locked ? 0.7 : 1 }}>
              {lvl.level}
            </span>
          )}
          {on && <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-amber-300 text-xs font-black text-black">✓</span>}
          <span className="grid h-24 w-full place-items-center">
            <Avatar size="md" color={face.color} icon={face.icon} url={face.url} frame={id} />
          </span>
          <b className="text-sm font-extrabold leading-tight" style={{ color: lvl ? lvl.accent : id ? color : undefined }}>{label}</b>
          {caption && <span className="text-xs text-white/50">{caption}</span>}
        </button>
      </li>
    );
  };

  // in the body: the hero card animates, and a window inside it would be faded and stacked under the page
  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4 backdrop-blur-sm" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-[var(--bg-b)] p-6 shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9)] sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-extrabold">{t("აირჩიეთ ჩარჩო", "Choose a frame", "Выберите рамку")}</h2>
          <button type="button" onClick={onClose} aria-label={t("დახურვა", "Close", "Закрыть")} className="grid size-9 flex-none place-items-center rounded-full border border-white/15 text-lg text-white/70 transition-colors hover:border-white/40 hover:text-white">
            ✕
          </button>
        </div>

        {!owned ? (
          <div className="mt-6 h-40 animate-pulse rounded-2xl bg-white/[0.06]" />
        ) : (
          <>
            <h3 className="mt-6 text-sm font-bold uppercase tracking-wider text-white/45">{t("ლეველის ჩარჩოები", "Level frames", "Рамки уровней")}</h3>
            <div className="ml-1 mr-6 mb-8 mt-8">
              <div className="relative h-2 rounded-full bg-white/10">
                <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${level}%`, background: `linear-gradient(90deg, #94a3b8, ${levelColor(level)})` }} />
                {LEVEL_FRAMES.map((f) => {
                  const got = level >= f.level;
                  return (
                    <span key={f.id} className="absolute top-1/2 flex w-max -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${f.level}%` }}>
                      <span className={got ? "" : "opacity-60"}>
                        <Avatar size="sm" color={face.color} icon={face.icon} url={face.url} frame={f.id} />
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {levelOnes.map((f) => tile(f.id, cosmetic(f.id)?.name ?? f.id, f.has ? undefined : t(`ლეველი ${f.level}`, `Level ${f.level}`, `Уровень ${f.level}`), !f.has))}
            </ul>
            {level < 100 && <p className="mt-2 text-xs text-white/40">{t("ჩარჩო იხსნება 25, 50, 75 და 100 ლეველზე", "A frame unlocks at levels 25, 50, 75 and 100", "Рамка открывается на уровнях 25, 50, 75 и 100")}</p>}

            <h3 className="mt-7 text-sm font-bold uppercase tracking-wider text-white/45">{t("თქვენი ჩარჩოები", "Your frames", "Ваши рамки")}</h3>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tile(null, t("ჩარჩოს გარეშე", "No frame", "Без рамки"))}
              {shop.map((id) => tile(id, cosmetic(id)?.name ?? id))}
            </ul>
            {shop.length === 0 && (
              <p className="mt-3 text-sm text-white/45">{t("მაღაზიაში ნაყიდი ჩარჩოები აქ გამოჩნდება.", "Frames you buy in the shop appear here.", "Купленные в магазине рамки появятся здесь.")}</p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 text-base text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
