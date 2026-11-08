"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useT } from "@/lib/i18n";
import { resizeToSquare } from "@/lib/image";
import { motionOff, setMotionOff } from "@/lib/motion";
import { loadResults } from "@/lib/results";
import type { GameResult } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase";
import { AVATAR_COLORS, AVATAR_ICONS, Avatar } from "./Avatar";
import { PageShell } from "./PageShell";
import { InviteCard } from "./InviteCard";
import { PlayerSearch } from "./PlayerSearch";
import { StatsSection } from "./StatsSection";
import { BTN_GHOST, BTN_PRIMARY, HEADER_BTN, HEADER_MENU, INPUT, rise } from "./ui";

export function ProfilePage() {
  const router = useRouter();
  const { configured, loading, user, profile, signOut } = useAuth();
  const t = useT();
  const [results, setResults] = useState<GameResult[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        <Notice title={t("პროფილები ჯერ არ არის ჩართული", "Profiles are not enabled yet", "Профили пока не включены")} />
      ) : loading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-white/[0.06]" />
      ) : !user ? (
        <Notice
          title={t("ჯერ შედით ანგარიშში", "Sign in first", "Сначала войдите")}
          action={
            <Link href="/login" className={`${BTN_PRIMARY} w-fit`}>
              {t("შესვლა", "Sign in", "Войти")}
            </Link>
          }
        />
      ) : (
        <>
          {searching && (
            <div style={rise(0)}>
              <PlayerSearch />
            </div>
          )}

          <InviteCard />

          <StatsSection
            userId={user.id}
            results={results}
            loadError={loadError}
            owner
            player={profile}
            subtitle={user.email}
            actions={
              <ProfileMenu
                onEdit={() => setEditing(true)}
                onSearch={() => setSearching((v) => !v)}
                onDelete={() => setDeleting(true)}
                onSignOut={async () => {
                  await signOut();
                  router.replace("/");
                }}
              />
            }
          />

          {deleting && profile && (
            <Modal onClose={() => setDeleting(false)}>
              <DeleteAccount
                nickname={profile.nickname}
                onCancel={() => setDeleting(false)}
                onDeleted={() => router.replace("/")}
              />
            </Modal>
          )}

          {editing && profile && (
            <Modal onClose={() => setEditing(false)}>
              <EditProfile onDone={() => setEditing(false)} />
            </Modal>
          )}
        </>
      )}
    </PageShell>
  );
}

/** The gear on the hero card: edit the profile, search for a player, sign out. */
function ProfileMenu({ onEdit, onSearch, onSignOut, onDelete }: { onEdit: () => void; onSearch: () => void; onSignOut: () => void; onDelete: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [still, setStill] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors hover:bg-white/10";
  const icon = { viewBox: "0 0 24 24", className: "size-5 flex-none", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={t("პარამეტრები", "Settings", "Настройки")}
        aria-expanded={open}
        onClick={() => {
          setStill(motionOff());
          setOpen((o) => !o);
        }}
        className={`grid size-11 place-items-center text-white/75 ${HEADER_BTN}`}
      >
        <svg {...icon}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {open && (
        <div className={`${HEADER_MENU} left-0 right-auto w-60`}>
          <button type="button" className={item} onClick={() => { setOpen(false); onEdit(); }}>
            <svg {...icon}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            {t("რედაქტირება", "Edit profile", "Редактировать")}
          </button>
          <button type="button" className={item} onClick={() => { setOpen(false); onSearch(); }}>
            <svg {...icon}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            {t("მოთამაშის ძებნა", "Find a player", "Найти игрока")}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={!still}
            className={item}
            onClick={() => {
              setMotionOff(!still);
              setStill(!still);
            }}
          >
            <svg {...icon}><path d="M3 12c2.5-6 5-6 7.5 0s5 6 7.5 0 2-3 3-3" /></svg>
            <span className="flex-1">{t("ანიმაციები", "Animations", "Анимации")}</span>
            <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${still ? "bg-white/20" : "bg-amber-300"}`}>
              <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] duration-200 ${still ? "left-0.5" : "left-[1.2rem]"}`} />
            </span>
          </button>
          <button type="button" className={`${item} text-red-300 hover:!bg-red-400/10`} onClick={() => { setOpen(false); onSignOut(); }}>
            <svg {...icon}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            {t("გასვლა", "Sign out", "Выйти")}
          </button>
          <button type="button" className={`${item} text-white/45 hover:!bg-red-400/10 hover:text-red-300`} onClick={() => { setOpen(false); onDelete(); }}>
            <svg {...icon}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg>
            {t("ანგარიშის წაშლა", "Delete account", "Удалить аккаунт")}
          </button>
        </div>
      )}
    </div>
  );
}

/** A window over the page; Escape or a click outside closes it. */
function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
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
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-[var(--bg-b)] shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9)]">{children}</div>
    </div>
  );
}

/** Deleting the account for good: the player types their nickname to confirm. */
function DeleteAccount({ nickname, onCancel, onDeleted }: { nickname: string; onCancel: () => void; onDeleted: () => void }) {
  const t = useT();
  const { deleteAccount } = useAuth();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typed.trim().toLowerCase() !== nickname.toLowerCase() || busy) return;
    setBusy(true);
    setError(null);
    const failed = await deleteAccount();
    setBusy(false);
    if (failed) setError(failed);
    else onDeleted();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 p-6 sm:p-8">
      <h2 className="text-2xl font-extrabold text-red-300">{t("ანგარიშის წაშლა", "Delete account", "Удаление аккаунта")}</h2>
      <p className="text-base text-white/70">
        {t(
          "ანგარიში სამუდამოდ წაიშლება: პროფილი, მონეტები, ნივთები, რეიტინგი, თამაშების ისტორია და საჩუქრები. ამის გაუქმება შეუძლებელია.",
          "Your account will be deleted for good: the profile, coins, items, rating, game history and gifts. This cannot be undone.",
          "Аккаунт будет удалён навсегда: профиль, монеты, предметы, рейтинг, история игр и подарки. Отменить это нельзя.",
        )}{" "}
        <Link href="/privacy" className="font-bold text-amber-300 underline underline-offset-4">
          {t("დეტალები", "Details", "Подробнее")}
        </Link>
      </p>
      <label className="flex flex-col gap-2 text-sm text-white/60">
        {t(`დასადასტურებლად ჩაწერეთ თქვენი მეტსახელი: ${nickname}`, `To confirm, type your nickname: ${nickname}`, `Для подтверждения введите ваш никнейм: ${nickname}`)}
        <input className={INPUT} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      {error && (
        <p role="alert" className="text-base text-red-300">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button
          className="rounded-full bg-red-500 px-6 py-3 text-base font-extrabold text-white transition-colors hover:bg-red-400 disabled:bg-white/10 disabled:text-white/45"
          disabled={busy || typed.trim().toLowerCase() !== nickname.toLowerCase()}
        >
          {busy ? t("იშლება…", "Deleting…", "Удаляю…") : t("სამუდამოდ წაშლა", "Delete for good", "Удалить навсегда")}
        </button>
        <button type="button" className={BTN_GHOST} onClick={onCancel}>
          {t("გაუქმება", "Cancel", "Отмена")}
        </button>
      </div>
    </form>
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
  const { profile, updateProfile } = useAuth();
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);
  const nickname = profile?.nickname ?? "";
  const [color, setColor] = useState(profile?.avatar_color ?? "amber");
  const [icon, setIcon] = useState(profile?.avatar_icon ?? "♠");
  /** undefined: keep the current photo, Blob: upload this one, null: remove it. */
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the temporary preview URL.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

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
      setError(err instanceof Error ? err.message : t("სურათის არჩევა ვერ მოხერხდა", "Could not pick the image", "Не удалось выбрать изображение"));
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
    setBusy(true);
    setError(null);
    const err = await updateProfile({ avatar_color: color, avatar_icon: icon, photo });
    setBusy(false);
    if (err) setError(err);
    else onDone();
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-7 p-6 sm:p-8">
      <h2 className="text-2xl font-extrabold">{t("პროფილის რედაქტირება", "Edit profile", "Редактирование профиля")}</h2>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="group relative rounded-full outline-none"
            aria-label={t("სურათის არჩევა", "Choose a picture", "Выбрать картинку")}
          >
            <Avatar size="xl" color={color} icon={icon} url={shownUrl} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 text-sm font-bold opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              {t("სურათის არჩევა", "Choose a picture", "Выбрать картинку")}
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
              {shownUrl ? t("შეცვლა", "Change", "Изменить") : t("ატვირთვა", "Upload", "Загрузить")}
            </button>
            {shownUrl && (
              <button
                type="button"
                onClick={removePhoto}
                aria-label={t("სურათის წაშლა", "Remove picture", "Удалить картинку")}
                title={t("სურათის წაშლა", "Remove picture", "Удалить картинку")}
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
            className={`${INPUT} cursor-not-allowed opacity-70`}
            value={nickname}
            readOnly
            aria-label={t("სახელი", "Name", "Имя")}
          />
          <p className="min-h-5 px-1 text-sm text-white/45">
            {t("მეტსახელის შეცვლა ახლა მაღაზიაშია: ", "A nickname is now changed in the shop: ", "Никнейм теперь меняется в магазине: ")}
            <Link href="/shop" className="font-bold text-amber-300 underline underline-offset-4">
              {t("ახალი მეტსახელი", "New nickname", "Новый никнейм")}
            </Link>
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm text-white/45">
          {t("ან აირჩიეთ ფერი და ნიშანი", "Or pick a color and a symbol", "Или выберите цвет и значок")}{shownUrl ? t(" (სურათის წაშლის შემდეგ გამოჩნდება)", " (shown after the picture is removed)", " (появится после удаления картинки)") : ""}
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
        <button className={BTN_PRIMARY} disabled={busy}>
          {busy ? t("ინახება…", "Saving…", "Сохраняю…") : t("შენახვა", "Save", "Сохранить")}
        </button>
        <button type="button" className={BTN_GHOST} onClick={onDone}>
          {t("გაუქმება", "Cancel", "Отмена")}
        </button>
      </div>
    </form>
  );
}
