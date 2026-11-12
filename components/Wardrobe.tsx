"use client";

import Link from "next/link";
import { useState } from "react";
import { cosmetic, type Slot, type Worn } from "@/lib/cosmetics";
import { useT } from "@/lib/i18n";
import { rarityOf, RARITY_LOOK } from "@/lib/rarity";
import { cardBack } from "@/lib/shop";
import { themeById } from "@/lib/themes";
import { Avatar } from "./Avatar";
import { BackPreview } from "./BackPreview";
import { CardView } from "./CardView";
import { ItemArt } from "./ItemArt";
import { Nick } from "./Nick";

type CatId = "back" | "joker" | "theme" | "frame" | "name" | "fx" | "play" | "snd" | "react" | "throw";

interface Cat {
  id: CatId;
  label: string;
  title: string;
  items: string[];
  /** The slot this kind is worn in; undefined for the table background (own setting) and for things used from the chat. */
  slot?: Slot;
  /** The "nothing" choice of a slot: what the player has without an item. */
  none?: { art: React.ReactNode; label: string };
  chat?: boolean;
}

/** How much an item's picture is shrunk to fit a round button. */
const artScale = (id: string) => (cardBack(id) ? 0.58 : id.startsWith("f_") || id.startsWith("n_") ? 0.55 : id.startsWith("j_") || id.startsWith("w_") ? 0.75 : id.startsWith("r_") || id.startsWith("t_") ? 0.9 : 0.8);

/**
 * The player's own inventory as a wheel: the avatar in the middle, a ring of round buttons around it (one for every kind of
 * item) and, under it, the owned items of the chosen kind as round buttons. A tap wears an item at once.
 */
export function Wardrobe({
  owned,
  worn,
  theme,
  themes,
  decks,
  avatar,
  nickname,
  onPut,
  onTheme,
  onGift,
}: {
  owned: string[];
  worn: Worn;
  theme: string;
  /** Backgrounds the player may use (the free ones and the bought ones). */
  themes: string[];
  decks: string[];
  avatar?: { color?: string; icon?: string; url?: string | null };
  nickname?: string;
  onPut: (slot: Slot, id: string | null) => void;
  onTheme: (id: string) => void;
  onGift: (id: string) => void;
}) {
  const t = useT();
  const ids = (prefix: string) => owned.filter((id) => id.startsWith(prefix));
  const none = (glyph: string) => <span className="text-3xl text-white/35">{glyph}</span>;

  const all: Cat[] = [
    { id: "back", label: t("დასტა", "Deck", "Колода"), title: t("კარტის ზურგი", "Card back", "Рубашка карт"), items: decks, slot: "back", none: { art: <BackPreview skin={null} width="2.6rem" />, label: t("სტანდარტული", "Standard", "Стандартная") } },
    { id: "joker", label: t("ჯოკერი", "Joker", "Джокер"), title: t("ჯოკერის სახე", "Joker look", "Облик джокера"), items: ids("j_"), slot: "joker", none: { art: <CardView card={{ joker: true, id: "J0" }} style={{ "--cw": "2.4rem" } as React.CSSProperties} />, label: t("სტანდარტული", "Standard", "Стандартный") } },
    { id: "theme", label: t("ფონი", "Background", "Фон"), title: t("მაგიდის ფონი", "Table background", "Фон стола"), items: themes },
    { id: "frame", label: t("ჩარჩო", "Frame", "Рамка"), title: t("ავატარის ჩარჩო", "Avatar frame", "Рамка аватара"), items: ids("f_").sort((x, y) => Number(y.startsWith("f_lv")) - Number(x.startsWith("f_lv")) || (x.startsWith("f_lv") ? Number(x.slice(4)) - Number(y.slice(4)) : 0)), slot: "frame", none: { art: none("∅"), label: t("ჩარჩოს გარეშე", "No frame", "Без рамки") } },
    { id: "name", label: t("სახელი", "Name", "Имя"), title: t("სახელის სტილი", "Name style", "Стиль имени"), items: ids("n_"), slot: "name", none: { art: none("Aa"), label: t("ჩვეულებრივი", "Plain", "Обычное") } },
    { id: "fx", label: t("მოგება", "Win", "Победа"), title: t("მოგების ეფექტი", "Win effect", "Эффект победы"), items: ids("w_"), slot: "fx", none: { art: none("∅"), label: t("ეფექტის გარეშე", "No effect", "Без эффекта") } },
    { id: "play", label: t("სვლა", "Play", "Ход"), title: t("კარტის დადების ეფექტი", "Card-play effect", "Эффект хода"), items: ids("p_"), slot: "play", none: { art: none("∅"), label: t("ეფექტის გარეშე", "No effect", "Без эффекта") } },
    { id: "snd", label: t("ხმა", "Sound", "Звук"), title: t("კარტის ხმა", "Card sound", "Звук карт"), items: ids("s_"), slot: "snd", none: { art: none("♪"), label: t("სტანდარტული", "Standard", "Стандартный") } },
    { id: "react", label: t("რეაქცია", "Reactions", "Реакции"), title: t("რეაქციები", "Reactions", "Реакции"), items: ids("r_"), chat: true },
    { id: "throw", label: t("სასროლი", "Throw", "Бросок"), title: t("სასროლი ნივთები", "Throwables", "Бросаемые предметы"), items: ids("t_"), chat: true },
  ];
  // a kind without anything bought is not shown (the deck and the background always have the standard ones)
  const cats = all.filter((c) => c.id === "back" || c.id === "theme" || c.items.length > 0);

  const [chosen, setChosen] = useState<CatId>("back");
  const [picked, setPicked] = useState<string | null | undefined>(undefined);
  const cat = cats.find((c) => c.id === chosen) ?? cats[0];

  const wornId = (c: Cat): string | null => (c.id === "theme" ? theme : c.slot ? worn[c.slot] : null);
  const nameOf = (id: string): string => {
    const th = themeById(id);
    if (th) return t(th.name[0], th.name[1], th.name[2]);
    return cardBack(id)?.name ?? cosmetic(id)?.name ?? id;
  };

  const select = (c: Cat, id: string | null) => {
    setPicked(id);
    if (c.id === "theme") {
      if (id) onTheme(id);
    } else if (c.slot) {
      onPut(c.slot, id);
    }
  };

  const current = picked === undefined ? wornId(cat) : picked;
  const total = owned.length;

  const activeIdx = Math.max(0, cats.findIndex((c) => c.id === cat.id));
  const angleOf = (i: number) => ((-90 + (i * 360) / cats.length) * Math.PI) / 180;
  const ax = 50 + 39 * Math.cos(angleOf(activeIdx));
  const ay = 50 + 39 * Math.sin(angleOf(activeIdx));
  const look = current ? RARITY_LOOK[rarityOf(current)] : null;

  // the colour of a button is the tier of what is worn there (grey for the standard look and for kinds used from the chat)
  const tierColor = (c: Cat): string | null => {
    const id = c.id === "theme" ? theme : c.slot ? worn[c.slot] : null;
    return id ? RARITY_LOOK[rarityOf(id)].color : null;
  };

  // each button of the ring shows what the player wears of its kind (the first thing owned for kinds used from the chat)
  const nodeArt = (c: Cat): { art: React.ReactNode; scale: number } => {
    if (c.id === "name") return { art: <span className="text-[1.7rem] font-extrabold leading-none"><Nick name="Aa" style={worn.name} /></span>, scale: 1 };
    if (c.id === "frame") return { art: <Avatar size="lg" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} frame={worn.frame} />, scale: 0.5 };
    const id = c.id === "theme" ? theme : c.slot ? worn[c.slot] : (c.items[0] ?? null);
    if (id) return { art: <ItemArt id={id} nickname={nickname} avatar={avatar} />, scale: artScale(id) * 0.8 };
    return { art: c.none?.art ?? null, scale: 0.8 };
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-extrabold">{t("ინვენტარი", "Inventory", "Инвентарь")}</h2>
        <Link href="/shop" className="text-base font-bold text-amber-300 underline underline-offset-4">
          {t("მაღაზია", "Shop", "Магазин")} →
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] border border-white/12 bg-[radial-gradient(ellipse_70%_45%_at_50%_30%,rgb(251_191_36/0.16),transparent_70%),linear-gradient(180deg,rgb(255_255_255/0.06),rgb(0_0_0/0.3))] px-3 py-6 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)] sm:px-8 sm:py-9">
        {/* the wheel */}
        <div className="mx-auto w-full max-w-[34rem]">
          <div className="relative aspect-square w-full">
            <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
              <defs>
                <linearGradient id="wd-line" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fbbf24" stopOpacity="0" />
                  <stop offset="1" stopColor="#fbbf24" stopOpacity="0.95" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="39" fill="none" stroke="rgb(255 255 255 / 0.14)" strokeWidth="0.35" strokeDasharray="0.6 1.6" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgb(255 255 255 / 0.05)" strokeWidth="0.3" />
              <line x1="50" y1="50" x2={ax} y2={ay} stroke="url(#wd-line)" strokeWidth="0.7" strokeLinecap="round" style={{ transition: "all 0.35s ease" }} />
            </svg>

            <div className="pointer-events-none absolute inset-[29%] rounded-full bg-[radial-gradient(circle,rgb(251_191_36/0.22),transparent_68%)] blur-md" />

            {/* the avatar sits exactly in the middle of the wheel; the name and the count hang below it */}
            <div className="absolute inset-0 grid place-items-center">
              <div className="relative">
                <span aria-hidden className="wd-orbit pointer-events-none absolute -inset-3 rounded-full" />
                <span className="sm:hidden">
                  <Avatar size="md" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} frame={worn.frame} />
                </span>
                <span className="hidden sm:block">
                  <Avatar size="lg" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} frame={worn.frame} />
                </span>
              </div>
            </div>
            <div className="absolute left-1/2 top-1/2 flex w-[40%] -translate-x-1/2 flex-col items-center gap-1.5 pt-[3.2rem] text-center sm:pt-[5.2rem]">
              <div className="max-w-full truncate px-2 text-base font-extrabold leading-tight sm:text-xl">
                {worn.name ? <Nick name={nickname ?? "ProJoker"} style={worn.name} /> : (nickname ?? "ProJoker")}
              </div>
              <span className="hidden rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[0.7rem] font-bold tracking-wide text-white/50 sm:inline">
                {total} {t("ნივთი", "items", "предм.")}
              </span>
            </div>

            {cats.map((c, i) => {
              const a = angleOf(i);
              const on = c.id === cat.id;
              const node = nodeArt(c);
              const tone = tierColor(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setChosen(c.id);
                    setPicked(undefined);
                  }}
                  aria-pressed={on}
                  aria-label={c.title}
                  title={c.title}
                  className="group absolute w-[16%] -translate-x-1/2 -translate-y-1/2 outline-none"
                  style={{ left: `${50 + 39 * Math.cos(a)}%`, top: `${50 + 39 * Math.sin(a)}%` }}
                >
                  <span
                    className="relative grid aspect-square w-full place-items-center overflow-visible rounded-full border-2 bg-[radial-gradient(circle_at_50%_25%,rgb(255_255_255/0.18),rgb(30_9_17/0.95)_70%)] transition-[transform,box-shadow,border-color] duration-300 group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-amber-300 max-sm:[--k:0.66]"
                    style={{
                      transform: on ? "scale(1.18)" : undefined,
                      borderColor: tone ?? (on ? "rgb(255 255 255 / 0.7)" : "rgb(255 255 255 / 0.15)"),
                      boxShadow: tone
                        ? on
                          ? `0 0 0 4px ${tone}33, 0 0 34px -2px ${tone}`
                          : `0 0 16px -4px ${tone}, 0 8px 18px -8px rgb(0 0 0 / 0.8)`
                        : on
                          ? "0 0 0 4px rgb(255 255 255 / 0.15), 0 0 26px -4px rgb(255 255 255 / 0.5)"
                          : "0 8px 18px -8px rgb(0 0 0 / 0.8)",
                    }}
                  >
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="grid w-max flex-none place-items-center" style={{ transform: `scale(calc(${node.scale} * var(--k, 1)))` }}>
                        {node.art}
                      </span>
                    </span>
                  </span>
                  <span className={`absolute left-1/2 top-full mt-1.5 w-max max-w-[6rem] -translate-x-1/2 text-center text-[0.65rem] font-extrabold leading-tight tracking-wide sm:text-xs ${on ? "" : "text-white/50"}`} style={on ? { color: tone ? `color-mix(in srgb, ${tone} 45%, white)` : "#fde68a" } : undefined}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* the items of the chosen kind */}
        <div className="mx-auto mt-10 max-w-3xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
            <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-amber-200">{cat.title}</h3>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.7rem] font-bold text-white/60">{cat.items.length}</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
          </div>

          <ul className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {cat.none && (
              <Chip key="none" art={cat.none.art} label={cat.none.label} color="#64748b" on={wornId(cat) === null} selected={current === null} onClick={() => select(cat, null)} />
            )}
            {cat.items.map((id) => (
              <Chip
                key={id}
                art={<ItemArt id={id} nickname={nickname} avatar={avatar} />}
                scale={artScale(id)}
                label={nameOf(id)}
                color={RARITY_LOOK[rarityOf(id)].color}
                on={wornId(cat) === id}
                selected={current === id}
                onClick={() => select(cat, id)}
              />
            ))}
          </ul>

          {cat.items.length === 0 && <p className="mt-2 text-center text-sm text-white/45">{t("ამ კატეგორიაში ჯერ არაფერი გაქვთ.", "Nothing here yet.", "Здесь пока ничего нет.")}</p>}

          {/* the item in hand */}
          {current && look && (
            <div className="mt-7 flex flex-col items-center gap-2 text-center">
              <b className="text-2xl font-extrabold leading-tight">{nameOf(current)}</b>
              <span className="rounded-full px-3 py-0.5 text-[0.7rem] font-extrabold uppercase tracking-[0.16em]" style={{ color: look.color, background: `${look.color}1f`, boxShadow: `inset 0 0 0 1px ${look.color}66` }}>
                {t(...look.label)}
              </span>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                {wornId(cat) === current && !cat.chat && <span className="rounded-full bg-amber-300/15 px-4 py-1.5 text-sm font-extrabold text-amber-200">✓ {t("დაყენებულია", "Equipped", "Надето")}</span>}
                {!current.startsWith("f_lv") && (
                  <button
                    type="button"
                    onClick={() => onGift(current)}
                    className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-extrabold text-white/70 transition-colors hover:border-amber-300 hover:text-amber-300"
                  >
                    🎁 {t("გაჩუქება", "Gift", "Подарить")}
                  </button>
                )}
              </div>
            </div>
          )}

          {cat.chat && <p className="mt-5 text-center text-sm text-white/45">{t("ეს ნივთები ჩათიდან გამოიყენება, მაგიდასთან თამაშისას.", "These are used from the chat while you play.", "Эти предметы используются из чата во время игры.")}</p>}
        </div>
      </div>
    </section>
  );
}

/** One round item: its picture in a glass disc with a halo the colour of its rarity; amber with a tick when it is worn. */
function Chip({ art, scale = 1, label, color, on, selected, onClick }: { art: React.ReactNode; scale?: number; label: string; color: string; on: boolean; selected: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        aria-label={label}
        title={label}
        className={`relative flex size-[5rem] items-center sm:size-[6rem] justify-center rounded-full border transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:scale-105 ${selected ? "scale-105" : ""}`}
        style={{
          background: `radial-gradient(circle at 50% 28%, ${color}38, rgb(14 4 8 / 0.78) 72%)`,
          borderColor: on ? "#fcd34d" : selected ? "rgb(255 255 255 / 0.8)" : `${color}77`,
          boxShadow: on ? "0 0 0 3px rgb(251 191 36 / 0.25), 0 0 28px -4px rgb(251 191 36 / 0.75)" : `0 10px 26px -12px ${color}`,
        }}
      >
        <span className="pointer-events-none grid w-max flex-none place-items-center" style={{ transform: `scale(${scale})` }}>
          {art}
        </span>
        {on && <span className="absolute -right-0.5 -top-0.5 grid size-6 place-items-center rounded-full bg-amber-300 text-sm font-black text-black shadow-lg">✓</span>}
      </button>
    </li>
  );
}
