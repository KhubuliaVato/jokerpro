"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { NICKNAME_MAX, validateNickname } from "@/lib/auth/messages";
import { resizeToSquare } from "@/lib/image";
import { loadResults } from "@/lib/results";
import type { GameResult } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase";
import { AVATAR_COLORS, AVATAR_ICONS, Avatar } from "./Avatar";
import { PageShell } from "./PageShell";
import { PlayerHero } from "./PlayerHero";
import { PlayerSearch } from "./PlayerSearch";
import { StatsSection } from "./StatsSection";
import { BTN_GHOST, BTN_PRIMARY, INPUT, rise } from "./ui";

export function ProfilePage() {
  const router = useRouter();
  const { configured, loading, user, profile, signOut } = useAuth();
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const userId = user?.id ?? null;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    loadResults(supabase, userId).then(({ results: rows, error }) => {
      if (cancelled) return;
      setResults(rows);
      setLoadError(error);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <PageShell width="max-w-5xl">
      {!configured ? (
        <Notice title="პროფილები ჯერ არ არის ჩართული" />
      ) : loading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-white/[0.06]" />
      ) : !user ? (
        <Notice
          title="ჯერ შედით ანგარიშში"
          action={
            <Link href="/login" className={`${BTN_PRIMARY} w-fit`}>
              შესვლა
            </Link>
          }
        />
      ) : (
        <>
          <div style={rise(1)}>
            <PlayerSearch />
          </div>

          <PlayerHero player={profile} subtitle={user.email}>
            <button className={BTN_GHOST} onClick={() => setEditing((v) => !v)}>
              {editing ? "დახურვა" : "რედაქტირება"}
            </button>
            <button
              className={BTN_GHOST}
              onClick={async () => {
                await signOut();
                router.replace("/");
              }}
            >
              გასვლა
            </button>
          </PlayerHero>

          {editing && profile && <EditProfile onDone={() => setEditing(false)} />}

          <StatsSection results={results} loadError={loadError} owner />
        </>
      )}
    </PageShell>
  );
}

function Notice({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5" style={rise(1)}>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
      {action}
    </section>
  );
}

function EditProfile({ onDone }: { onDone: () => void }) {
  const { profile, updateProfile, nicknameAvailable } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [color, setColor] = useState(profile?.avatar_color ?? "amber");
  const [icon, setIcon] = useState(profile?.avatar_icon ?? "♠");
  /** undefined: keep the current photo, Blob: upload this one, null: remove it. */
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [check, setCheck] = useState<{ name: string; free: boolean | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the temporary preview URL.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  // Tell the player right away whether the name they typed is free.
  const trimmed = nickname.trim();
  const changed = trimmed !== (profile?.nickname ?? "");
  const checkable = changed && validateNickname(trimmed) === null;
  const nameState: "idle" | "checking" | "free" | "taken" = !checkable
    ? "idle"
    : check?.name !== trimmed
      ? "checking"
      : check.free === null
        ? "idle"
        : check.free
          ? "free"
          : "taken";
  useEffect(() => {
    if (!checkable) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const free = await nicknameAvailable(trimmed);
      if (!cancelled) setCheck({ name: trimmed, free });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, checkable, nicknameAvailable]);

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const blob = await resizeToSquare(file);
      setPhoto(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : "სურათი ვერ აირჩა");
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setPreview(null);
  };

  // What the avatar will look like after saving.
  const shownUrl = photo === null ? null : (preview ?? profile?.avatar_url ?? null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nameState === "taken") return;
    setBusy(true);
    setError(null);
    const err = await updateProfile({ nickname, avatar_color: color, avatar_icon: icon, photo });
    setBusy(false);
    if (err) setError(err);
    else onDone();
  };

  return (
    <form
      onSubmit={save}
      className="flex flex-col gap-7 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8"
      style={rise(0)}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="group relative rounded-full outline-none"
            aria-label="სურათის არჩევა"
          >
            <Avatar size="xl" color={color} icon={icon} url={shownUrl} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-sm font-bold opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              სურათის არჩევა
            </span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={pickFile}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold transition-[border-color,color,background-color] duration-200 hover:border-amber-300 hover:bg-amber-300/10 hover:text-amber-300"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              {shownUrl ? "შეცვლა" : "ატვირთვა"}
            </button>
            {shownUrl && (
              <button
                type="button"
                onClick={removePhoto}
                aria-label="სურათის წაშლა"
                title="სურათის წაშლა"
                className="grid size-9 place-items-center rounded-full border border-white/20 text-white/60 transition-[border-color,color,background-color] duration-200 hover:border-red-400 hover:bg-red-400/10 hover:text-red-300"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            className={`${INPUT} ${nameState === "taken" ? "!border-red-400" : ""}`}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={NICKNAME_MAX}
            aria-label="სახელი"
            placeholder="სახელი"
            required
          />
          <p className="min-h-5 px-1 text-sm">
            {nameState === "checking" && <span className="text-white/40">ვამოწმებ…</span>}
            {nameState === "free" && <span className="text-emerald-300">✓ სახელი თავისუფალია</span>}
            {nameState === "taken" && <span className="text-red-300">ეს სახელი უკვე დაკავებულია</span>}
            {nameState === "idle" && (
              <span className="text-white/35">სახელი უნიკალურია: ერთს მხოლოდ ერთი მოთამაშე ატარებს</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm text-white/45">
          ან აირჩიეთ ფერი და ნიშანი{shownUrl ? " (სურათის წაშლის შემდეგ გამოჩნდება)" : ""}
        </span>
        <div className="flex flex-wrap gap-3">
          {Object.entries(AVATAR_COLORS).map(([key, cls]) => (
            <button
              key={key}
              type="button"
              aria-label={key}
              onClick={() => setColor(key)}
              className={`size-11 rounded-full bg-gradient-to-br ${cls} transition-transform duration-200 hover:scale-110 ${
                color === key ? "ring-4 ring-white" : "ring-2 ring-white/15"
              }`}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {AVATAR_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={`grid size-12 place-items-center rounded-2xl text-2xl transition-[box-shadow,background-color] duration-200 ${
                icon === ic ? "bg-white/10 ring-2 ring-amber-300" : "ring-1 ring-white/15 hover:bg-white/5"
              } ${ic === "♥" || ic === "♦" ? "text-red-400" : "text-white"}`}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-base text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button className={BTN_PRIMARY} disabled={busy || nameState === "taken" || nameState === "checking"}>
          {busy ? "ინახება…" : "შენახვა"}
        </button>
        <button type="button" className={BTN_GHOST} onClick={onDone}>
          გაუქმება
        </button>
      </div>
    </form>
  );
}
