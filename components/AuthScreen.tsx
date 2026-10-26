"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { NICKNAME_MAX } from "@/lib/auth/messages";
import { PageShell } from "./PageShell";
import { BTN_PRIMARY, INPUT, rise } from "./ui";

type Mode = "signin" | "signup";

const TITLE: Record<Mode, string> = { signin: "შესვლა", signup: "რეგისტრაცია" };

export function AuthScreen() {
  const router = useRouter();
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
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">პროფილები ჯერ არ არის ჩართული</h1>
          <p className="text-lg text-white/55">
            Supabase-ის მისამართი და გასაღები არ არის მითითებული (იხილეთ <code>supabase/README.md</code>).
          </p>
        </section>
      ) : confirmSent ? (
        <section className="flex flex-col gap-4" style={rise(1)}>
          <div className="text-5xl">✉️</div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">შეამოწმეთ ელფოსტა</h1>
          <p className="text-lg text-white/55">
            წერილი გამოვგზავნეთ მისამართზე <b className="text-white">{email}</b>. დაადასტურეთ და შემდეგ შედით ანგარიშში.
          </p>
          <button
            className={`${BTN_PRIMARY} mt-2 w-fit`}
            onClick={() => {
              setConfirmSent(false);
              switchMode("signin");
            }}
          >
            შესვლა
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
                placeholder="სახელი თამაშში"
                aria-label="სახელი"
                autoComplete="nickname"
                required
              />
            )}
            <input
              className={INPUT}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ელფოსტა"
              aria-label="ელფოსტა"
              autoComplete="email"
              required
            />
            <input
              className={INPUT}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "პაროლი (მინიმუმ 6 სიმბოლო)" : "პაროლი"}
              aria-label="პაროლი"
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
              {busy ? "ერთი წამით…" : mode === "signin" ? "შესვლა" : "პროფილის შექმნა"}
            </button>

            <p className="text-center text-sm text-white/40">
              ანგარიშის გარეშეც შეგიძლიათ ითამაშოთ, უბრალოდ შედეგები არ შეინახება.{" "}
              <Link href="/" className="underline underline-offset-4 hover:text-amber-300">
                მთავარი
              </Link>
            </p>
          </form>
        </>
      )}
    </PageShell>
  );
}
