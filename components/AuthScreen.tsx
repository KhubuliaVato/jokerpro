"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { NICKNAME_MAX } from "@/lib/auth/messages";
import { useT } from "@/lib/i18n";
import { PageShell } from "./PageShell";
import { BTN_PRIMARY, INPUT, rise } from "./ui";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const router = useRouter();
  const t = useT();
  const TITLE: Record<Mode, string> = { signin: t("შესვლა", "Sign in", "Вход"), signup: t("რეგისტრაცია", "Sign up", "Регистрация") };
  const { configured, loading, user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  // Already signed in (or just became so): go to the menu.
  useEffect(() => {
    if (!user) return;
    // `?next=/some/page` brings a player back to what they came for (e.g. a friend's table link).
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (mode === "signin") {
      const err = await signIn(email, password);
      if (err) setError(err);
    } else {
      const { error: err, needsConfirm } = await signUp(email, password, nickname);
      if (err) setError(err);
      else if (needsConfirm) setConfirmSent(true);
    }
    setBusy(false);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  return (
    <PageShell width="max-w-xl">
      {!configured ? (
        <section className="flex flex-col gap-3" style={rise(1)}>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t("პროფილები ჯერ არ არის ჩართული", "Profiles are not enabled yet", "Профили пока не включены")}</h1>
          <p className="text-lg text-white/55">
            {t("Supabase-ის მისამართი და გასაღები არ არის მითითებული", "The Supabase address and key are not set", "Адрес и ключ Supabase не указаны")} (<code>supabase/README.md</code>).
          </p>
        </section>
      ) : confirmSent ? (
        <section className="flex flex-col gap-4" style={rise(1)}>
          <div className="text-5xl">✉️</div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{t("შეამოწმეთ ელფოსტა", "Check your email", "Проверьте почту")}</h1>
          <p className="text-lg text-white/55">
            {t("წერილი გამოვგზავნეთ მისამართზე", "We sent a message to", "Мы отправили письмо на")} <b className="text-white">{email}</b>. {t("დაადასტურეთ და შემდეგ შედით ანგარიშში.", "Confirm it, then sign in.", "Подтвердите его и затем войдите.")}
          </p>
          <button
            className={`${BTN_PRIMARY} mt-2 w-fit`}
            onClick={() => {
              setConfirmSent(false);
              switchMode("signin");
            }}
          >
            {t("შესვლა", "Sign in", "Войти")}
          </button>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-4" style={rise(1)}>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">{TITLE[mode]}</h1>
            <div className="flex gap-6 text-lg font-bold">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`border-b-2 pb-1 transition-colors duration-200 ${
                    mode === m
                      ? "border-amber-300 text-amber-300"
                      : "border-transparent text-white/45 hover:text-white"
                  }`}
                >
                  {TITLE[m]}
                </button>
              ))}
            </div>
          </section>

          <form onSubmit={submit} className="flex flex-col gap-4" style={rise(2)}>
            {mode === "signup" && (
              <input
                className={INPUT}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={NICKNAME_MAX}
                placeholder={t("სახელი თამაშში", "In-game name", "Имя в игре")}
                aria-label={t("სახელი", "Name", "Имя")}
                autoComplete="nickname"
                required
              />
            )}
            <input
              className={INPUT}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("ელფოსტა", "Email", "Почта")}
              aria-label={t("ელფოსტა", "Email", "Почта")}
              autoComplete="email"
              required
            />
            <input
              className={INPUT}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? t("პაროლი (მინიმუმ 6 სიმბოლო)", "Password (at least 6 characters)", "Пароль (минимум 6 символов)") : t("პაროლი", "Password", "Пароль")}
              aria-label={t("პაროლი", "Password", "Пароль")}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />

            {error && (
              <p role="alert" className="text-base text-red-300">
                {error}
              </p>
            )}

            <button className={`${BTN_PRIMARY} mt-2 w-full`} disabled={busy || loading}>
              {busy ? t("ერთი წამით…", "One moment…", "Секунду…") : mode === "signin" ? t("შესვლა", "Sign in", "Войти") : t("პროფილის შექმნა", "Create profile", "Создать профиль")}
            </button>

            <p className="text-center text-sm text-white/40">
              {t("ანგარიშის გარეშეც შეგიძლიათ ითამაშოთ, უბრალოდ შედეგები არ შეინახება.", "You can play without an account, results just will not be saved.", "Можно играть и без аккаунта, но результаты не сохранятся.")}{" "}
              <Link href="/" className="underline underline-offset-4 hover:text-amber-300">
                {t("მთავარი", "Home", "Главная")}
              </Link>
            </p>
          </form>
        </>
      )}
    </PageShell>
  );
}
