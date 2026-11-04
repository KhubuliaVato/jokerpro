"use client";

import { useState } from "react";
import { useAuth, type OAuthProvider } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";

/** The providers switched on for this site: NEXT_PUBLIC_OAUTH_PROVIDERS="google,facebook" (each must also be enabled in Supabase). */
const ENABLED = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter((p): p is OAuthProvider => p === "google" || p === "facebook");

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-6" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#1877F2" />
      <path fill="#fff" d="M16.6 24v-8.7h2.9l.5-3.4h-3.4V9.8c0-1 .3-1.7 1.7-1.7H20V5.1c-.3 0-1.4-.1-2.6-.1-2.6 0-4.3 1.6-4.3 4.4v2.5H10v3.4h3.1V24h3.5z" />
    </svg>
  );
}

/** "Continue with Google / Facebook" buttons; nothing is drawn when no provider is switched on. */
export function SocialSignIn() {
  const t = useT();
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (ENABLED.length === 0) return null;

  const go = async (provider: OAuthProvider) => {
    setBusy(provider);
    setError(null);
    const failed = await signInWithProvider(provider);
    if (failed) {
      setError(failed);
      setBusy(null);
    }
  };

  const LABEL: Record<OAuthProvider, string> = {
    google: t("Google-ით შესვლა", "Continue with Google", "Войти через Google"),
    facebook: t("Facebook-ით შესვლა", "Continue with Facebook", "Войти через Facebook"),
  };

  return (
    <div className="flex flex-col gap-3">
      {ENABLED.map((p) => (
        <button
          key={p}
          type="button"
          disabled={busy !== null}
          onClick={() => void go(p)}
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-base font-bold text-white transition-colors hover:border-amber-300/60 hover:bg-white/[0.1] disabled:opacity-60"
        >
          {p === "google" ? <GoogleMark /> : <FacebookMark />}
          {LABEL[p]}
        </button>
      ))}
      {error && (
        <p role="alert" className="text-base text-red-300">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-white/35">
        <span className="h-px flex-1 bg-white/10" />
        {t("ან", "or", "или")}
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}
