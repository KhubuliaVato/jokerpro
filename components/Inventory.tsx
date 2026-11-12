"use client";

import { rarityOf, RARITY_LOOK } from "@/lib/rarity";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { PROFILE_CHANGED } from "@/lib/auth/AuthProvider";
import { cosmetic, JOKER_SKINS_ON, loadWorn, wear, type Slot, type Worn } from "@/lib/cosmetics";
import { useT } from "@/lib/i18n";
import { INVENTORY_CHANGED } from "@/lib/gifts";
import { cardBack, loadInventory } from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { applyTheme, DEFAULT_THEME, savedTheme, THEME_CHANGED, themeById, THEMES } from "@/lib/themes";
import { Avatar } from "./Avatar";
import { BackPreview } from "./BackPreview";
import { CardView } from "./CardView";
import { EmojiArt, PlayFxArt, SoundArt } from "./FxArt";
import { GiftDialog } from "./GiftDialog";
import { Nick } from "./Nick";
import { Wardrobe } from "./Wardrobe";

const KING = { joker: false, suit: "H", rank: 13, id: "H13" } as const;

type Cat = "all" | "decks" | "frames" | "names" | "effects" | "themes" | "reactions" | "throws" | "plays" | "sounds" | "jokers";

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
  const [giftFor, setGiftFor] = useState<string | null>(null);
  const theme = useSyncExternalStore(subscribeTheme, savedTheme, () => DEFAULT_THEME);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const [owned, worn] = await Promise.all([loadInventory(supabase, userId), loadWorn(supabase, userId)]);
    setState({ userId, owned, worn });
  }, [userId]);

  // a gift arrived (or went) while this page is open
  useEffect(() => {
    window.addEventListener(INVENTORY_CHANGED, load);
    return () => window.removeEventListener(INVENTORY_CHANGED, load);
  }, [load]);

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
  const reactions = ids("r_");
  const throws = ids("t_");
  const plays = ids("p_");
  const sounds = ids("s_");
  const jokers = ids("j_").filter((id) => JOKER_SKINS_ON.includes(id));
  const frames = ids("f_");
  const names = ids("n_");
  const effects = ids("w_");
  const total = decks.length + frames.length + names.length + effects.length + themes.length + reactions.length + throws.length + plays.length + sounds.length + jokers.length;

  const wornFrame = mine.worn.frame;
  const wornName = mine.worn.name;
  const wornFx = mine.worn.fx;
  const wornBack = mine.worn.back;
  const wornTheme = themeById(theme);

  const tile = (key: string, art: React.ReactNode, label: string, id: string | null, isWorn: boolean, action: React.ReactNode) => {
    const r = id ? RARITY_LOOK[rarityOf(id)] : null;
    const color = r?.color ?? "#64748b";
    return (
      <li
        key={key}
        className={`group relative flex flex-col items-center gap-2 overflow-hidden rounded-3xl border p-3 pt-3 text-center transition-[translate,box-shadow,border-color] duration-300 hover:-translate-y-1 ${id ? `tier-${rarityOf(id)}` : "border-white/10"} ${isWorn ? "ring-2 ring-amber-300/80" : ""}`}
        style={{ background: `linear-gradient(180deg, ${color}1f, rgb(255 255 255 / 0.02) 55%)` }}
      >
        <span className="absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        {isWorn && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-amber-300 text-sm font-black text-black">✓</span>}
        <div className="relative grid h-[7rem] w-full place-items-center rounded-2xl bg-black/20">
          <div className="pointer-events-none absolute size-24 rounded-full blur-2xl" style={{ background: `${color}33` }} />
          <div className="relative">{art}</div>
        </div>
        <div className="flex min-h-11 flex-col items-center justify-center">
          <b className="text-base font-extrabold leading-tight">{label}</b>
          {r && <span className="text-[0.65rem] font-extrabold uppercase tracking-wider" style={{ color }}>{t(...RARITY_LOOK[rarityOf(id!)].label)}</span>}
        </div>
        {action}
        {owner && id && (
          <button
            type="button"
            onClick={() => setGiftFor(id)}
            className="-mt-1 w-full rounded-full border border-white/10 px-3 py-1 text-xs font-extrabold text-white/55 transition-colors hover:border-amber-300 hover:text-amber-300"
          >
            🎁 {t("გაჩუქება", "Gift", "Подарить")}
          </button>
        )}
      </li>
    );
  };

  const useNote = <span className="h-8 text-xs font-bold text-white/40">{t("ჩათიდან გამოიყენება", "Used from the chat", "Из чата")}</span>;

  const wearButton = (slot: Slot, id: string | null) => {
    const isWorn = mine.worn[slot] === id;
    if (!owner) return isWorn ? <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-extrabold text-amber-200">{t("დაყენებულია", "Equipped", "Надето")}</span> : <span className="h-8" />;
    return (
      <button
        type="button"
        disabled={isWorn}
        onClick={() => void put(slot, id)}
        className={`w-full rounded-full border px-4 py-2 text-sm font-extrabold transition-colors ${isWorn ? "border-amber-300/50 bg-amber-300/15 text-amber-200" : "border-white/20 text-white/85 hover:border-amber-300 hover:bg-amber-300/10 hover:text-amber-300"}`}
      >
        {isWorn ? t("დაყენებულია", "Equipped", "Надето") : t("დაყენება", "Equip", "Надеть")}
      </button>
    );
  };

  const slotTile = (slot: Slot, id: string | null, art: React.ReactNode, label: string) =>
    tile(id ?? `no-${slot}`, art, label, id, mine.worn[slot] === id, wearButton(slot, id));

  const avatarArt = (frame?: string) => <Avatar size="lg" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} frame={frame} />;
  // shaped frames are bigger than the round avatar: in a tile they are drawn smaller, so they stay clear of the name and the badge
  const tileAvatar = (frame?: string) => (
    <div className="origin-center scale-[0.72]">{avatarArt(frame)}</div>
  );
  const fxArt = (id: string) => <CardView card={KING} className={`fxw-${id}`} style={{ "--cw": "3.4rem" } as React.CSSProperties} />;

  const section = (id: Cat, title: string, children: React.ReactNode, count: number) =>
    (cat === "all" || cat === id) && (
      <div key={id} className="flex max-w-full flex-col gap-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold text-white/85">
          {title}
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/60">{count}</span>
        </h3>
        <ul
          className={
            cat === "all"
              ? "-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [&>li]:w-40 [&>li]:shrink-0 [&>li]:snap-start"
              : "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          }
        >
          {children}
        </ul>
      </div>
    );

  const cats: { id: Cat; label: string; n: number }[] = [
    { id: "all", label: t("ყველა", "All", "Все"), n: total + 1 },
    { id: "decks", label: t("კარტები", "Cards", "Карты"), n: decks.length + 1 },
    ...(jokers.length > 0 ? [{ id: "jokers" as Cat, label: t("ჯოკერი", "Joker", "Джокер"), n: jokers.length }] : []),
    ...(themes.length > 0 ? [{ id: "themes" as Cat, label: t("ფონები", "Backgrounds", "Фоны"), n: themes.length }] : []),
    ...(frames.length > 0 ? [{ id: "frames" as Cat, label: t("ჩარჩოები", "Frames", "Рамки"), n: frames.length }] : []),
    ...(names.length > 0 ? [{ id: "names" as Cat, label: t("სახელები", "Names", "Имена"), n: names.length }] : []),
    ...(effects.length > 0 ? [{ id: "effects" as Cat, label: t("ეფექტები", "Effects", "Эффекты"), n: effects.length }] : []),
    ...(reactions.length > 0 ? [{ id: "reactions" as Cat, label: t("რეაქციები", "Reactions", "Реакции"), n: reactions.length }] : []),
    ...(throws.length > 0 ? [{ id: "throws" as Cat, label: t("სასროლები", "Throwables", "Бросаемые"), n: throws.length }] : []),
    ...(plays.length > 0 ? [{ id: "plays" as Cat, label: t("დადების ეფექტი", "Play effects", "Эффекты хода"), n: plays.length }] : []),
    ...(sounds.length > 0 ? [{ id: "sounds" as Cat, label: t("ხმები", "Sounds", "Звуки"), n: sounds.length }] : []),
  ];

  // one's own inventory is the wheel: pick a kind, tap an item, it is worn
  if (owner) {
    return (
      <>
        {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
        <Wardrobe
          owned={mine.owned}
          worn={mine.worn}
          theme={theme}
          themes={THEMES.filter((th) => th.free || mine.owned.includes(th.id)).map((th) => th.id)}
          decks={decks}
          avatar={avatar}
          nickname={nickname}
          onPut={(slot, id) => void put(slot, id)}
          onTheme={applyTheme}
          onGift={setGiftFor}
        />
        {giftFor && <GiftDialog itemId={giftFor} onClose={() => setGiftFor(null)} onSent={() => void load()} />}
      </>
    );
  }

  return (
    <section className="flex flex-col gap-4">
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
        <p className="relative mb-3 text-xs font-extrabold uppercase tracking-[0.18em] text-white/45">{t("არჩეული გაქვს", "Currently equipped", "Сейчас надето")}</p>
        <div className="relative grid items-center gap-x-8 gap-y-4 sm:grid-cols-[1fr_auto_1fr]">
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
          <p className="text-sm font-bold text-white/50 sm:justify-self-end">
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

      <div className={cat === "all" ? "flex flex-wrap items-start gap-x-8 gap-y-6" : "flex flex-col gap-6"}>
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
                  {theme === th.id ? t("დაყენებულია", "Active", "Включён") : t("დაყენება", "Use", "Включить")}
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
            {slotTile("frame", null, tileAvatar(), t("ჩარჩოს გარეშე", "No frame", "Без рамки"))}
            {frames.map((id) => slotTile("frame", id, tileAvatar(id), cosmetic(id)?.name ?? id))}
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

      {reactions.length > 0 &&
        section(
          "reactions",
          t("რეაქციები", "Reactions", "Реакции"),
          reactions.map((id) => tile(id, <EmojiArt id={id} />, cosmetic(id)?.name ?? id, id, false, useNote)),
          reactions.length,
        )}

      {throws.length > 0 &&
        section(
          "throws",
          t("სასროლი ნივთები", "Throwables", "Бросаемые предметы"),
          throws.map((id) => tile(id, <EmojiArt id={id} />, cosmetic(id)?.name ?? id, id, false, useNote)),
          throws.length,
        )}

      {jokers.length > 0 &&
        section(
          "jokers",
          t("ჯოკერის სახე", "Joker look", "Облик джокера"),
          <>
            {slotTile("joker", null, <CardView card={{ joker: true, id: "J0" }} style={{ "--cw": "3rem" } as React.CSSProperties} />, t("სტანდარტული", "Standard", "Стандартный"))}
            {jokers.map((id) => slotTile("joker", id, <CardView card={{ joker: true, id: "J0" }} jokerSkin={id} style={{ "--cw": "3rem" } as React.CSSProperties} />, cosmetic(id)?.name ?? id))}
          </>,
          jokers.length,
        )}

      {plays.length > 0 &&
        section(
          "plays",
          t("კარტის დადების ეფექტი", "Card-play effects", "Эффекты хода"),
          <>
            {slotTile("play", null, <span className="text-4xl text-white/30">∅</span>, t("ეფექტის გარეშე", "No effect", "Без эффекта"))}
            {plays.map((id) => slotTile("play", id, <PlayFxArt id={id} width="2.2rem" />, cosmetic(id)?.name ?? id))}
          </>,
          plays.length,
        )}

      {sounds.length > 0 &&
        section(
          "sounds",
          t("კარტის ხმა", "Card sounds", "Звуки карт"),
          <>
            {slotTile("snd", null, <span className="text-4xl text-white/30">♪</span>, t("სტანდარტული", "Standard", "Стандартный"))}
            {sounds.map((id) => slotTile("snd", id, <SoundArt id={id} />, cosmetic(id)?.name ?? id))}
          </>,
          sounds.length,
        )}

      </div>

      {giftFor && <GiftDialog itemId={giftFor} onClose={() => setGiftFor(null)} onSent={() => void load()} />}

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
