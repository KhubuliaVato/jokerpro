"use client";

import { useEffect, useState } from "react";
import { PROFILE_CHANGED, useAuth } from "@/lib/auth/AuthProvider";
import { validateNickname, NICKNAME_MAX } from "@/lib/auth/messages";
import { useT } from "@/lib/i18n";
import { getSupabase } from "@/lib/supabase";
import { BTN_PRIMARY, INPUT } from "./ui";

/** The name a profile gets when it was made without one (see handle_new_user). */
const GENERATED = /^მოთამაშე[0-9a-f]{4}$/;

/**
 * Asked once, right after the first sign-in with Google / Facebook, which give no nickname:
 * the player picks the name they play under (free; later changes cost coins). It can be put off.
 */
export function NicknamePrompt() {
  const t = useT();
  const { user, profile, nicknameAvailable } = useAuth();
  const [name, setName] = useState("");
  const [later, setLater] = useState(false);
  const [free, setFree] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const problem = trimmed ? validateNickname(trimmed) : null;
  const due = !!user && !!profile && GENERATED.test(profile.nickname) && !later;

  useEffect(() => {
    if (!due || !trimmed || problem) return;
    let cancelled = false;
    const id = setTimeout(() => {
      nicknameAvailable(trimmed).then((ok) => !cancelled && setFree(ok));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
      setFree(null);
    };
  }, [due, trimmed, problem, nicknameAvailable]);

  if (!due) return null;

  const submit = async () => {
    const supabase = getSupabase();
    if (!supabase || busy || !trimmed || problem || free === false) return;
    setBusy(true);
    setError(null);
    const { error: failed } = await supabase.rpc("choose_first_nickname", { p_name: trimmed });
    setBusy(false);
    if (failed) {
      setError(failed.message.includes("taken") ? t("ეს სახელი დაკავებულია", "This name is taken", "Это имя занято") : t("ეს სახელი არ გამოდგება", "This name cannot be used", "Это имя не подходит"));
      return;
    }
    window.dispatchEvent(new Event(PROFILE_CHANGED));
  };

  const hint = problem ?? (free === false ? t("ეს სახელი დაკავებულია", "This name is taken", "Это имя занято") : error);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex w-full max-w-md flex-col gap-4 rounded-[2rem] border border-amber-300/40 bg-[var(--bg-b)] p-6 shadow-2xl"
      >
        <h2 className="text-2xl font-extrabold text-amber-200">{t("როგორ დაგიძახოთ თამაშში?", "What should we call you?", "Как вас называть в игре?")}</h2>
        <p className="-mt-2 text-sm text-white/55">
          {t("აირჩიეთ სახელი, რომლითაც ითამაშებთ. პირველად უფასოა, მერე შეცვლა მაღაზიაში ფასიანია.", "Pick the name you will play under. It is free now; changing it later costs coins in the shop.", "Выберите имя для игры. Сейчас это бесплатно, потом смена имени платная в магазине.")}
        </p>
        <input
          className={INPUT}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={NICKNAME_MAX}
          placeholder={t("სახელი თამაშში", "In-game name", "Имя в игре")}
          autoComplete="nickname"
          autoFocus
        />
        <p className="min-h-5 text-sm font-bold text-red-300">{hint}</p>
        <button className={`${BTN_PRIMARY} w-full`} disabled={busy || !trimmed || !!problem || free === false}>
          {busy ? t("ერთი წამით…", "One moment…", "Секунду…") : t("არჩევა", "Choose", "Выбрать")}
        </button>
        <button type="button" onClick={() => setLater(true)} className="text-sm font-bold text-white/45 hover:text-white">
          {t("მოგვიანებით", "Later", "Позже")}
        </button>
      </form>
    </div>
  );
}
