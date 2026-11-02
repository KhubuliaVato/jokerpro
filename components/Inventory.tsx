"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { PROFILE_CHANGED } from "@/lib/auth/AuthProvider";
import { cosmetic, EMOTE_PACKS, loadWorn, wear, type Slot, type Worn } from "@/lib/cosmetics";
import { useT } from "@/lib/i18n";
import { cardBack, loadInventory } from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { applyTheme, DEFAULT_THEME, savedTheme, THEME_CHANGED, themeById, THEMES } from "@/lib/themes";
import { Avatar } from "./Avatar";
import { BackPreview } from "./BackPreview";
import { CardView } from "./CardView";
import { Nick } from "./Nick";

const KING = { joker: false, suit: "H", rank: 13, id: "H13" } as const;

type Rarity = "common" | "rare" | "epic" | "legendary";

/** How hard an item is to earn: the four price tiers of the shop. */
const RARITY: Record<Rarity, string[]> = {
  common: ["blue", "purple", "graphite", "f_laurel", "f_gold", "n_gold", "e_cheer", "e_tilt", "e_talk"],
  rare: ["crimson", "emerald", "suits", "f_neon", "n_frost", "n_neon"],
  epic: ["neon", "sakura", "damask", "frost", "gilded", "aurora", "northern", "embers", "f_frost", "f_flame", "n_fire", "w_sparks", "w_confetti", "w_gold"],
  legendary: ["obsidian", "carbon", "midnight", "f_royal", "n_rainbow", "w_fire"],
};
const rarityOf = (id: string): Rarity => (Object.keys(RARITY) as Rarity[]).find((r) => RARITY[r].includes(id)) ?? "common";

const LOOK: Record<Rarity, { color: string; label: [string, string, string] }> = {
  common: { color: "#94a3b8", label: ["ჩვეულებრივი", "Common", "Обычный"] },
  rare: { color: "#38bdf8", label: ["იშვიათი", "Rare", "Редкий"] },
  epic: { color: "#a78bfa", label: ["ეპიკური", "Epic", "Эпический"] },
  legendary: { color: "#fbbf24", label: ["ლეგენდარული", "Legendary", "Легендарный"] },
};

type Cat = "all" | "decks" | "frames" | "names" | "effects" | "themes" | "emotes";

const subscribeTheme = (cb: () => void) => {
  window.addEventListener(THEME_CHANGED, cb);
  return () => window.removeEventListener(THEME_CHANGED, cb);
};

/** What a player owns, by kind; for the player themself each kind has a button to wear it. */
export function Inventory({ userId, owner, avatar, nickname }: { userId: string; owner: boolean; avatar?: { color?: string; icon?: string; url?: string | null }; nickname?: string }) {
  const t = useT();
  const [state, setState] = useState<{ userId: string; owned: string[]; worn: Worn } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cat, setCat] = useState<Cat>("all");
  const theme = useSyncExternalStore(subscribeTheme, savedTheme, () => DEFAULT_THEME);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [owned, worn] = await Promise.all([loadInventory(supabase, userId), loadWorn(supabase, userId)]);
    setState({ userId, owned, worn });
  }, [userId]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    Promise.all([loadInventory(supabase, userId), loadWorn(supabase, userId)]).then(([owned, worn]) => {
      if (!cancelled) setState({ userId, owned, worn });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const mine = state && state.userId === userId ? state : null;
  if (!mine) return <div className="h-48 animate-pulse rounded-3xl bg-white/[0.06]" />;

  const put = async (slot: Slot, id: string | null) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setError(await wear(supabase, userId, slot, id));
    window.dispatchEvent(new Event(PROFILE_CHANGED));
    await load();
  };

  const ids = (prefix: string) => mine.owned.filter((id) => id.startsWith(prefix));
  const decks = mine.owned.filter((id) => cardBack(id));
  const themes = THEMES.filter((th) => !th.free && mine.owned.includes(th.id));
  const packs = EMOTE_PACKS.filter((p) => p.id === "basic" || mine.owned.includes(`e_${p.id}`));
  const frames = ids("f_");
  const names = ids("n_");
  const effects = ids("w_");
  const total = decks.length + frames.length + names.length + effects.length + themes.length + ids("e_").length;

  const wornFrame = mine.worn.frame;
  const wornName = mine.worn.name;
  const wornFx = mine.worn.fx;
  const wornBack = mine.worn.back;
  const wornTheme = themeById(theme);

  const tile = (key: string, art: React.ReactNode, label: string, id: string | null, isWorn: boolean, action: React.ReactNode) => {
    const r = id ? LOOK[rarityOf(id)] : null;
    const color = r?.color ?? "#64748b";
    return (
      <li
        key={key}
        className={`group relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl border p-3 pt-4 text-center transition-[translate,box-shadow,border-color] duration-300 hover:-translate-y-1 ${isWorn ? "border-amber-300/70 shadow-[0_0_0_1px_rgb(252_211_77/0.35),0_20px_40px_-22px_rgb(252_211_77/0.5)]" : "border-white/10 hover:border-white/25"}`}
        style={{ background: `linear-gradient(180deg, ${color}1f, rgb(255 255 255 / 0.02) 55%)` }}
      >
        <span className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        {isWorn && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-amber-300 text-sm font-black text-black">✓</span>}
        <div className="relative grid h-28 w-full place-items-center rounded-2xl bg-black/20">
          <div className="pointer-events-none absolute size-24 rounded-full blur-2xl" style={{ background: `${color}33` }} />
          <div className="relative">{art}</div>
        </div>
        <div className="flex min-h-11 flex-col items-center justify-center">
          <b className="text-base font-extrabold leading-tight">{label}</b>
          {r && <span className="text-[0.65rem] font-extrabold uppercase tracking-wider" style={{ color }}>{t(...LOOK[rarityOf(id!)].label)}</span>}
        </div>
        {action}
      </li>
    );
  };

  const wearButton = (slot: Slot, id: string | null) => {
    const isWorn = mine.worn[slot] === id;
    if (!owner) return isWorn ? <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-extrabold text-amber-200">{t("ჩაცმულია", "Equipped", "Надето")}</span> : <span className="h-8" />;
    return (
      <button
        type="button"
        disabled={isWorn}
        onClick={() => void put(slot, id)}
        className={`w-full rounded-full border px-4 py-2 text-sm font-extrabold transition-colors ${isWorn ? "border-amber-300/50 bg-amber-300/15 text-amber-200" : "border-white/20 text-white/85 hover:border-amber-300 hover:bg-amber-300/10 hover:text-amber-300"}`}
      >
        {isWorn ? t("ჩაცმულია", "Equipped", "Надето") : t("ჩაცმა", "Equip", "Надеть")}
      </button>
    );
  };

  const slotTile = (slot: Slot, id: string | null, art: React.ReactNode, label: string) =>
    tile(id ?? `no-${slot}`, art, label, id, mine.worn[slot] === id, wearButton(slot, id));

  const avatarArt = (frame?: string) => <Avatar size="lg" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} frame={frame} />;
  const fxArt = (id: string) => <CardView card={KING} className={`fxw-${id}`} style={{ "--cw": "3.4rem" } as React.CSSProperties} />;

  const section = (id: Cat, title: string, children: React.ReactNode, count: number) =>
    (cat === "all" || cat === id) && (
      <div key={id} className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold text-white/85">
          {title}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/60">{count}</span>
        </h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</ul>
      </div>
    );

  const cats: { id: Cat; label: string; n: number }[] = [
    { id: "all", label: t("ყველა", "All", "Все"), n: total + 1 },
    { id: "decks", label: t("კარტები", "Cards", "Карты"), n: decks.length + 1 },
    ...(themes.length > 0 ? [{ id: "themes" as Cat, label: t("ფონები", "Backgrounds", "Фоны"), n: themes.length }] : []),
    ...(frames.length > 0 ? [{ id: "frames" as Cat, label: t("ჩარჩოები", "Frames", "Рамки"), n: frames.length }] : []),
    ...(names.length > 0 ? [{ id: "names" as Cat, label: t("სახელები", "Names", "Имена"), n: names.length }] : []),
    ...(effects.length > 0 ? [{ id: "effects" as Cat, label: t("ეფექტები", "Effects", "Эффекты"), n: effects.length }] : []),
    { id: "emotes", label: t("ემოციები", "Emotes", "Эмоции"), n: packs.length },
  ];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-extrabold">{t("ინვენტარი", "Inventory", "Инвентарь")}</h2>
        {owner && (
          <Link href="/shop" className="text-base font-bold text-amber-300 underline underline-offset-4">
            {t("მაღაზია", "Shop", "Магазин")} →
          </Link>
        )}
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}

      {/* what is worn right now, as the others see it */}
      <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/[0.09] to-white/[0.02] p-4 sm:p-5">
        <div className="pointer-events-none absolute -left-10 -top-16 size-56 rounded-full bg-amber-300/10 blur-3xl" />
        <p className="relative mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-white/45">{t("ახლა გაცვია", "Currently equipped", "Сейчас надето")}</p>
        <div className="relative flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-4">
            {avatarArt(wornFrame ?? undefined)}
            <div className="text-2xl font-extrabold">{wornName ? <Nick name={nickname ?? "ProJoker"} style={wornName} /> : (nickname ?? "ProJoker")}</div>
          </div>
          <div className="flex items-center gap-5">
            <figure className="flex flex-col items-center gap-1.5">
              <BackPreview skin={wornBack} accent={wornBack ? cardBack(wornBack)?.accent : undefined} width="2.8rem" />
              <figcaption className="text-[0.7rem] font-bold text-white/50">{t("დასტა", "Deck", "Колода")}</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-1.5">
              {wornFx ? fxArt(wornFx) : <div className="grid h-[4.7rem] w-[3.4rem] place-items-center rounded-lg border border-dashed border-white/20 text-xl text-white/30">∅</div>}
              <figcaption className="text-[0.7rem] font-bold text-white/50">{t("ეფექტი", "Effect", "Эффект")}</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-1.5">
              <span className="size-12 rounded-full ring-2 ring-white/20" style={{ background: `radial-gradient(circle at 30% 30%, #fff5, ${wornTheme?.color ?? "#8a2540"} 60%)` }} />
              <figcaption className="text-[0.7rem] font-bold text-white/50">{t("ფონი", "Background", "Фон")}</figcaption>
            </figure>
          </div>
          <p className="ml-auto text-sm font-bold text-white/50">
            {t("სულ", "Total", "Всего")}: {total} {t("ნივთი", "items", "предм.")}
          </p>
        </div>
      </div>

      <nav className="-mx-1 flex flex-wrap gap-2" aria-label={t("კატეგორიები", "Categories", "Категории")}>
        {cats.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-extrabold transition-colors ${cat === c.id ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"}`}
          >
            {c.label}
            <span className={`rounded-full px-1.5 text-[0.7rem] ${cat === c.id ? "bg-black/15" : "bg-white/10"}`}>{c.n}</span>
          </button>
        ))}
      </nav>

      {section(
        "decks",
        t("კარტები", "Card decks", "Колоды"),
        <>
          {slotTile("back", null, <BackPreview skin={null} width="3.6rem" />, t("სტანდარტული", "Standard", "Стандартная"))}
          {decks.map((id) => slotTile("back", id, <BackPreview skin={id} accent={cardBack(id)?.accent} width="3.6rem" />, cardBack(id)?.name ?? id))}
        </>,
        decks.length + 1,
      )}

      {themes.length > 0 &&
        section(
          "themes",
          t("ფონები", "Backgrounds", "Фоны"),
          themes.map((th) =>
            tile(
              th.id,
              <span className="block size-16 rounded-full ring-2 ring-white/25" style={{ background: `radial-gradient(circle at 30% 28%, #fff6, ${th.color} 58%, #0006)` }} />,
              t(th.name[0], th.name[1], th.name[2]),
              th.id,
              theme === th.id,
              owner ? (
                <button
                  type="button"
                  disabled={theme === th.id}
                  onClick={() => applyTheme(th.id)}
                  className={`w-full rounded-full border px-4 py-2 text-sm font-extrabold transition-colors ${theme === th.id ? "border-amber-300/50 bg-amber-300/15 text-amber-200" : "border-white/20 text-white/85 hover:border-amber-300 hover:bg-amber-300/10 hover:text-amber-300"}`}
                >
                  {theme === th.id ? t("ჩართულია", "Active", "Включён") : t("ჩართვა", "Use", "Включить")}
                </button>
              ) : (
                <span className="h-8" />
              ),
            ),
          ),
          themes.length,
        )}

      {frames.length > 0 &&
        section(
          "frames",
          t("ჩარჩოები", "Frames", "Рамки"),
          <>
            {slotTile("frame", null, avatarArt(), t("ჩარჩოს გარეშე", "No frame", "Без рамки"))}
            {frames.map((id) => slotTile("frame", id, avatarArt(id), cosmetic(id)?.name ?? id))}
          </>,
          frames.length,
        )}

      {names.length > 0 &&
        section(
          "names",
          t("სახელის სტილი", "Name styles", "Стили имени"),
          <>
            {slotTile("name", null, <span className="text-2xl font-extrabold">{nickname ?? "ProJoker"}</span>, t("ჩვეულებრივი", "Plain", "Обычное"))}
            {names.map((id) => slotTile("name", id, <span className="text-2xl font-extrabold"><Nick name={nickname ?? "ProJoker"} style={id} /></span>, cosmetic(id)?.name ?? id))}
          </>,
          names.length,
        )}

      {effects.length > 0 &&
        section(
          "effects",
          t("მოგების ეფექტები", "Win effects", "Эффекты победы"),
          <>
            {slotTile("fx", null, <span className="text-4xl text-white/30">∅</span>, t("ეფექტის გარეშე", "No effect", "Без эффекта"))}
            {effects.map((id) => slotTile("fx", id, fxArt(id), cosmetic(id)?.name ?? id))}
          </>,
          effects.length,
        )}

      {section(
        "emotes",
        t("ემოციები და ფრაზები", "Emotes and phrases", "Эмоции и фразы"),
        packs.map((p) =>
          tile(
            p.id,
            <span className="flex max-w-36 flex-wrap items-center justify-center gap-1 text-2xl">{(p.emotes.length > 0 ? p.emotes : ["💬"]).slice(0, 6).join(" ")}</span>,
            t(p.names[0], p.names[1], p.names[2]),
            p.id === "basic" ? null : `e_${p.id}`,
            false,
            <span className="h-8 text-xs font-bold text-white/40">{p.id === "basic" ? t("უფასო", "Free", "Бесплатно") : ""}</span>,
          ),
        ),
        packs.length,
      )}

      {total === 0 && (
        <p className="text-white/45">
          {owner
            ? t("ჯერ არაფერი გიყიდიათ. დასტებს, ჩარჩოებსა და სხვა ნივთებს მაღაზიაში მონეტებით შეიძენთ.", "You have not bought anything yet. Decks, frames and more cost coins in the shop.", "Вы ещё ничего не купили. Колоды, рамки и другое продаются в магазине за монеты.")
            : t("ჯერ არაფერი უყიდია.", "Nothing bought yet.", "Пока ничего не куплено.")}
        </p>
      )}
    </section>
  );
}
