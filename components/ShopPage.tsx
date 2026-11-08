"use client";

import { RARITIES, rarityOf, RARITY_LOOK } from "@/lib/rarity";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PROFILE_CHANGED, useAuth } from "@/lib/auth/AuthProvider";
import { validateNickname } from "@/lib/auth/messages";
import { loadBalance } from "@/lib/coins";
import {
  buyNickname,
  cosmetic,
  loadWorn,
  NICKNAME_PRICE,
  slotOf,
  wear,
  type Worn,
} from "@/lib/cosmetics";
import { useT } from "@/lib/i18n";
import {
  buyBundle,
  buyItem,
  BUNDLE_INFO,
  cardBack,
  loadBundles,
  type Bundle,
  COINS_CHANGED,
  loadInventory,
  loadStock,
  daysLeft,
  type StockItem,
} from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { applyTheme, savedTheme, THEME_CHANGED, themeById } from "@/lib/themes";
import { Avatar } from "./Avatar";
import { BackPreview } from "./BackPreview";
import { CardView } from "./CardView";
import { CoinIcon } from "./Coins";
import { DeckViewer } from "./DeckViewer";
import { EmojiArt, PlayFxArt, SoundArt } from "./FxArt";
import { ItemArt } from "./ItemArt";
import { Nick } from "./Nick";
import { PageShell } from "./PageShell";
import { rise } from "./ui";

interface Wallet {
  balance: number;
  owned: string[];
  worn: Worn;
}

type Kind = StockItem["kind"];

type SectionId = "decks" | "themes" | "frames" | "names" | "reactions" | "throws" | "effects" | "plays" | "sounds";

/** The category boxes that always stand in the two side columns; each opens the full list of its kind. */
const SECTIONS: Record<SectionId, { kind: Kind; label: [string, string, string]; hint: [string, string, string]; glow: string }> = {
  decks: { kind: "card_back", label: ["კარტები", "Cards", "Карты"], hint: ["ზურგიც და სახეც", "Back and face", "Рубашка и лицо"], glow: "#e11d4855" },
  themes: { kind: "theme", label: ["ფონები", "Backgrounds", "Фоны"], hint: ["ფერადი და მოძრავი", "Plain and moving", "Цветные и движущиеся"], glow: "#38bdf855" },
  reactions: { kind: "reaction", label: ["რეაქციები", "Reactions", "Реакции"], hint: ["დიდი ანიმაცია მთელ მაგიდას", "A big animation for the whole table", "Большая анимация для всего стола"], glow: "#34d39955" },
  throws: { kind: "throwable", label: ["სასროლი ნივთები", "Throwables", "Бросаемые предметы"], hint: ["ესროლე მოწინააღმდეგეს", "Throw it at a rival", "Бросьте в соперника"], glow: "#fb718555" },
  frames: { kind: "frame", label: ["ჩარჩოები", "Frames", "Рамки"], hint: ["ავატარის ჩარჩო", "A frame for your avatar", "Рамка для аватара"], glow: "#fbbf2455" },
  names: { kind: "name_style", label: ["სახელის სტილი", "Name styles", "Стили имени"], hint: ["თქვენი სახელი გამოირჩევა", "Make your name stand out", "Ваше имя заметят"], glow: "#a78bfa55" },
  effects: { kind: "win_fx", label: ["მოგების ეფექტები", "Win effects", "Эффекты победы"], hint: ["როცა ხელს იღებთ", "When you take a trick", "Когда берёте взятку"], glow: "#f9731655" },
  plays: { kind: "play_fx", label: ["კარტის დადების ეფექტი", "Card-play effects", "Эффекты хода"], hint: ["როცა კარტს დებთ", "When you play a card", "Когда вы ходите"], glow: "#a78bfa55" },
  sounds: { kind: "sound_pack", label: ["კარტის ხმა", "Card sounds", "Звуки карт"], hint: ["ხმა თქვენთვის", "Heard by you", "Слышите только вы"], glow: "#67e8f955" },
};
const TAB_IDS: SectionId[] = ["decks", "themes", "frames", "names", "effects", "plays", "sounds", "reactions", "throws"];

const KING = { joker: false, suit: "H", rank: 13, id: "H13" } as const;

/**
 * The shop, laid out like a game store: what is always on sale stands in the two side columns, and the middle
 * belongs to the week's exclusives, which change every Monday.
 */
export function ShopPage() {
  const { user, profile, configured } = useAuth();
  const t = useT();
  const [stock, setStock] = useState<StockItem[] | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [theme, setTheme] = useState<string>("wine");
  const [view, setView] = useState<string | null>(null);
  const [nickOpen, setNickOpen] = useState(false);
  const [section, setSection] = useState<SectionId | "packs" | null>(null);
  // the home page shows one pack, a different one each visit; all of them are under the Packs tab
  const [packSeed] = useState(() => Math.random());
  // how the items of a category are ordered
  const [sort, setSort] = useState<"rarity-up" | "rarity-down" | "price-up" | "price-down">("rarity-down");
  const [sortOpen, setSortOpen] = useState(false);
  const sortOptions: { id: typeof sort; label: string }[] = [
    { id: "rarity-up", label: t("ტაიერი: დაბლიდან მაღლა", "Tier: low to high", "Уровень: по возрастанию") },
    { id: "rarity-down", label: t("ტაიერი: მაღლიდან დაბლა", "Tier: high to low", "Уровень: по убыванию") },
    { id: "price-up", label: t("ფასი: იაფიდან ძვირისკენ", "Price: low to high", "Цена: по возрастанию") },
    { id: "price-down", label: t("ფასი: ძვირიდან იაფისკენ", "Price: high to low", "Цена: по убыванию") },
  ];
  const [bundles, setBundles] = useState<Bundle[]>([]);

  const userId = user?.id ?? null;

  useEffect(() => {
    const sync = () => setTheme(savedTheme());
    sync();
    window.addEventListener(THEME_CHANGED, sync);
    return () => window.removeEventListener(THEME_CHANGED, sync);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let cancelled = false;
    loadStock(supabase).then((s) => !cancelled && setStock(s));
    loadBundles(supabase).then((b) => !cancelled && setBundles(b));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadWallet = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    const [balance, owned, worn] = await Promise.all([loadBalance(supabase, userId), loadInventory(supabase, userId), loadWorn(supabase, userId)]);
    setWallet({ balance, owned, worn });
  }, [userId]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    Promise.all([loadBalance(supabase, userId), loadInventory(supabase, userId), loadWorn(supabase, userId)]).then(([balance, owned, worn]) => {
      if (!cancelled) setWallet({ balance, owned, worn });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // the countdown of the weekly items
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const buy = async (item: StockItem) => {
    const supabase = getSupabase();
    if (!supabase || busy) return;
    setBusy(item.id);
    setMessage(null);
    const { error } = await buyItem(supabase, item.id);
    if (error) {
      setMessage({ id: item.id, text: error, ok: false });
    } else {
      setMessage({ id: item.id, text: t("ნივთი შეძენილია და ინვენტარშია.", "Bought! It is in your inventory.", "Куплено! Ищите в инвентаре."), ok: true });
      window.dispatchEvent(new Event(COINS_CHANGED));
    }
    await loadWallet();
    setBusy(null);
  };

  /** Puts on everything of a pack that can be worn: the cards, the background, the frame, the name and the effects. */
  const equipPack = async (b: Bundle) => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    const kindOf = Object.fromEntries((stock ?? []).map((i) => [i.id, i.kind]));
    const jobs: Promise<string | null>[] = [];
    for (const id of b.items) {
      if (kindOf[id] === "theme") {
        applyTheme(id);
        continue;
      }
      const slot = slotOf(kindOf[id]);
      if (slot) jobs.push(wear(supabase, userId, slot, id));
    }
    const errors = (await Promise.all(jobs)).filter((e): e is string => !!e);
    window.dispatchEvent(new Event(PROFILE_CHANGED));
    await loadWallet();
    return errors[0] ?? null;
  };

  const packWorn = (b: Bundle) => {
    const kindOf = Object.fromEntries((stock ?? []).map((i) => [i.id, i.kind]));
    return b.items.every((id) => {
      if (kindOf[id] === "theme") return theme === id;
      const slot = slotOf(kindOf[id]);
      return slot ? wallet?.worn[slot] === id : true;
    });
  };

  const buyPack = async (b: Bundle) => {
    const supabase = getSupabase();
    if (!supabase || busy) return;
    setBusy(b.id);
    setMessage(null);
    const { error } = await buyBundle(supabase, b.id);
    if (error) {
      setMessage({ id: b.id, text: error, ok: false });
    } else {
      window.dispatchEvent(new Event(COINS_CHANGED));
      const failed = await equipPack(b);
      setMessage({
        id: b.id,
        text: failed ?? t("პაკი შეძენილია და დაყენებულია.", "Pack bought and equipped!", "Набор куплен и надет!"),
        ok: !failed,
      });
    }
    await loadWallet();
    setBusy(null);
  };

  const wearPack = async (b: Bundle) => {
    if (busy) return;
    setBusy(b.id);
    const failed = await equipPack(b);
    setMessage(failed ? { id: b.id, text: failed, ok: false } : null);
    setBusy(null);
  };

  const putOn = async (item: StockItem) => {
    const supabase = getSupabase();
    const slot = slotOf(item.kind);
    if (!supabase || !userId || !slot || busy) return;
    setBusy(item.id);
    const error = await wear(supabase, userId, slot, wallet?.worn[slot] === item.id ? null : item.id);
    setMessage(error ? { id: item.id, text: error, ok: false } : null);
    window.dispatchEvent(new Event(PROFILE_CHANGED));
    await loadWallet();
    setBusy(null);
  };

  const pack = bundles.length > 0 ? bundles[Math.floor(packSeed * bundles.length)] : null;
  const sorted = (items: StockItem[]) => {
    const r = (i: StockItem) => RARITIES.indexOf(rarityOf(i.id));
    const dir = sort.endsWith("down") ? -1 : 1;
    return [...items].sort((a, b) => (sort.startsWith("rarity") ? dir * (r(a) - r(b)) || a.price - b.price : dir * (a.price - b.price) || r(a) - r(b)));
  };
  const weekly = (stock ?? []).filter((i) => i.tier === "rotating");
  const endsAt = weekly[0]?.ends_at ?? null;

  const labelOf = (item: StockItem): string => {
    if (item.kind === "theme") {
      const n = themeById(item.id)?.name;
      return n ? t(n[0], n[1], n[2]) : item.id;
    }
    if (item.kind === "card_back") return cardBack(item.id)?.name ?? item.id;
    return cosmetic(item.id)?.name ?? item.id;
  };

  const isWorn = (item: StockItem) => {
    if (item.kind === "theme") return theme === item.id;
    const slot = slotOf(item.kind);
    return slot ? wallet?.worn[slot] === item.id : false;
  };

  /** The buy / wear button of an item; `compact` is the small one of the side columns. */
  const actionFor = (item: StockItem, size: "card" | "large" | "compact" = "card") => {
    const owned = wallet?.owned.includes(item.id) ?? false;
    const worn = isWorn(item);
    const short = wallet ? item.price - wallet.balance : item.price;
    const dim = size === "large" ? "w-full px-4 py-2.5 text-base" : size === "card" ? "w-full px-4 py-2 text-sm" : "w-full px-2 py-1.5 text-xs";
    if (owned) {
      // reactions and throwables are not worn: owning them is the whole point
      if (item.kind === "reaction" || item.kind === "throwable") {
        return <div className={`rounded-full border border-emerald-400/40 bg-emerald-400/10 text-center font-extrabold text-emerald-300 ${dim}`}>✓ {t("ნაყიდია", "Owned", "Куплено")}</div>;
      }
      return (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => (item.kind === "theme" ? applyTheme(item.id) : void putOn(item))}
          className={`rounded-full border font-extrabold transition-colors disabled:opacity-50 ${dim} ${worn ? "border-amber-300/60 bg-amber-300/15 text-amber-200" : "border-white/20 text-white/80 hover:border-amber-300 hover:text-amber-300"}`}
        >
          {worn ? `✓ ${t("დაყენებულია", "Equipped", "Надето")}` : t("დაყენება", "Equip", "Надеть")}
        </button>
      );
    }
    if (!userId) {
      return (
        <Link href="/login" className={`flex items-center justify-center gap-1.5 rounded-full border border-white/20 font-extrabold text-white/80 hover:border-amber-300 hover:text-amber-300 ${dim}`}>
          <CoinIcon className="size-4" />
          {item.price}
        </Link>
      );
    }
    return (
      <button
        type="button"
        disabled={!!busy || short > 0}
        onClick={() => void buy(item)}
        className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-amber-300 font-extrabold text-black transition-colors hover:bg-amber-200 disabled:bg-white/10 disabled:text-white/45 ${dim}`}
      >
        <CoinIcon className="size-4" />
        {item.price}
        {short > 0 && size !== "compact" && <span className="hidden text-xs font-bold sm:inline">· {t(`კიდევ ${short}`, `${short} more`, `ещё ${short}`)}</span>}
      </button>
    );
  };

  /** The big picture of an item (the featured cards in the middle). */
  const previewOf = (item: StockItem) => {
    const mine = profile ?? null;
    switch (item.kind) {
      case "theme": {
        const th = themeById(item.id);
        return (
          <div
            className="relative h-[8.06rem] w-full overflow-hidden rounded-2xl ring-1 ring-white/15"
            style={{ background: `radial-gradient(ellipse at 50% -10%, ${th?.color}, #0b0710 85%)` }}
          >
            {th && "fx" in th && <div aria-hidden className={`theme-fx fx-${item.id}`} />}
          </div>
        );
      }
      case "card_back":
        return (
          <button
            type="button"
            onClick={() => setView(item.id)}
            aria-label={`${labelOf(item)} 3D`}
            className="relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <BackPreview skin={item.id} accent={cardBack(item.id)?.accent} />
            <span className="absolute bottom-0 right-0 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] font-extrabold text-white/80 ring-1 ring-white/20">3D</span>
          </button>
        );
      case "frame":
        return (
          <div className="grid h-[8.06rem] place-items-center">
            <Avatar size="lg" color={mine?.avatar_color} icon={mine?.avatar_icon} url={mine?.avatar_url} frame={item.id} />
          </div>
        );
      case "name_style":
        return (
          <div className="grid h-[8.06rem] w-full place-items-center rounded-2xl bg-black/25 px-2 ring-1 ring-white/10">
            <Nick name={mine?.nickname ?? "ProJoker"} style={item.id} className="max-w-full truncate text-3xl font-extrabold" />
          </div>
        );
      case "win_fx":
        return (
          <div className="grid h-[8.06rem] w-full place-items-center rounded-2xl bg-black/25 ring-1 ring-white/10">
            <CardView card={KING} className={`fxw-${item.id}`} style={{ "--cw": "4.2rem" } as React.CSSProperties} />
          </div>
        );
      case "reaction":
      case "throwable":
        return (
          <div className="grid h-[8.06rem] w-full place-items-center rounded-2xl bg-black/25 ring-1 ring-white/10">
            <EmojiArt id={item.id} size="text-6xl" />
          </div>
        );
      case "play_fx":
        return (
          <div className="grid h-[8.06rem] w-full place-items-center rounded-2xl bg-black/25 ring-1 ring-white/10">
            <PlayFxArt id={item.id} />
          </div>
        );
      case "sound_pack":
        return (
          <div className="grid h-[8.06rem] w-full place-items-center rounded-2xl bg-black/25 ring-1 ring-white/10">
            <SoundArt id={item.id} />
          </div>
        );
    }
  };

  /** A big card (the week's exclusives). */
  const card = (item: StockItem) => {
    const worn = isWorn(item);
    const note = message?.id === item.id ? message : null;
    return (
      <li
        key={item.id}
        className={`tier-${rarityOf(item.id)} flex flex-col items-center gap-3 rounded-2xl border bg-white/[0.04] p-4 text-center transition-colors duration-200 ${worn ? "ring-2 ring-amber-300/80" : ""}`}
      >
        {previewOf(item)}
        <div className="flex flex-col items-center">
          <b className="text-base font-extrabold leading-tight">{labelOf(item)}</b>
          <span className="text-[0.65rem] font-extrabold uppercase tracking-wider" style={{ color: RARITY_LOOK[rarityOf(item.id)].color === "#a21caf" ? "#d946ef" : RARITY_LOOK[rarityOf(item.id)].color }}>
            {t(...RARITY_LOOK[rarityOf(item.id)].label)}
          </span>
        </div>
        {actionFor(item)}
        {note && <span className={`text-xs font-bold ${note.ok ? "text-emerald-300" : "text-red-300"}`}>{note.text}</span>}
      </li>
    );
  };

  const viewed = view ? (stock ?? []).find((i) => i.id === view) : undefined;
  const viewedLook = viewed ? cardBack(viewed.id) : undefined;

  const packCard = (b: Bundle) => {
                const info = BUNDLE_INFO[b.id];
  const prices = Object.fromEntries((stock ?? []).map((i) => [i.id, i.price]));
  const total = b.items.reduce((sum, id) => sum + (prices[id] ?? 0), 0);
  const missing = b.items.filter((id) => !wallet?.owned.includes(id));
  const missingTotal = missing.reduce((sum, id) => sum + (prices[id] ?? 0), 0);
  const cost = total > 0 ? Math.round((b.price * missingTotal) / total) : b.price;
  const done = !!wallet && missing.length === 0;
  const short = wallet ? cost - wallet.balance : cost;
  const note = message?.id === b.id ? message : null;
  const accent = info?.accent ?? "#fbbf24";
  return (
    <section
      key={b.id}
      className="relative flex flex-col gap-5 overflow-hidden rounded-[2rem] border p-5 sm:p-7"
      style={{ borderColor: `${accent}88`, background: `linear-gradient(135deg, ${info?.bg[0] ?? "#333"}, ${info?.bg[1] ?? "#111"})`, boxShadow: `0 24px 70px -34px ${accent}` }}
    >
      {/* the pack's own background, the one it sells, moving behind the card */}
      {info && <div aria-hidden className={`theme-fx fx-${info.theme}`} />}
      <div className="relative flex flex-wrap items-center gap-5 sm:gap-8">
        {(() => {
          // the pack's cards, big: tap to turn them in 3D
          const deckId = b.items.find((id) => cardBack(id));
          if (!deckId) return null;
          return (
            <button
              type="button"
              onClick={() => setView(deckId)}
              aria-label={`${cardBack(deckId)?.name ?? ""} 3D`}
              className="group relative flex-none self-center rounded-3xl p-2 outline-none transition-transform duration-300 hover:-rotate-2 hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-300"
              style={{ filter: `drop-shadow(0 18px 30px ${accent}55)` }}
            >
              <BackPreview skin={deckId} accent={cardBack(deckId)?.accent} width="9.5rem" />
              <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-2.5 py-0.5 text-xs font-extrabold text-white/90 ring-1 ring-white/25">3D</span>
            </button>
          );
        })()}

        <div className="flex min-w-[14rem] max-w-xl flex-1 flex-col gap-1.5">
          <span className="text-xs font-extrabold uppercase tracking-[0.2em]" style={{ color: accent }}>{t("პაკი", "Pack", "Набор")}</span>
          <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">{info?.name() ?? b.id}</h2>
          <p className="text-base text-white/60">{info?.blurb()}</p>
        </div>
        <div className="flex w-full min-w-[13rem] flex-col items-stretch gap-2 sm:ml-auto sm:w-auto">
          <div className="flex items-center justify-end gap-2">
            {total > b.price && <s className="text-sm font-bold text-white/40">{total}</s>}
            {!done && (
              <span className="flex items-center gap-1.5 text-2xl font-extrabold text-amber-200">
                <CoinIcon className="size-6" />
                {cost}
              </span>
            )}
            {total > b.price && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-extrabold text-emerald-300">−{Math.round((1 - b.price / total) * 100)}%</span>}
          </div>
          {done ? (
            packWorn(b) ? (
              <div className="rounded-full border border-amber-300/50 bg-amber-300/15 py-2.5 text-center font-extrabold text-amber-200">✓ {t("დაყენებულია", "Equipped", "Надето")}</div>
            ) : (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void wearPack(b)}
                className="rounded-full bg-amber-300 py-2.5 font-extrabold text-black transition-colors hover:bg-amber-200 disabled:opacity-50"
              >
                {t("ყველაფრის დაყენება", "Equip everything", "Надеть всё")}
              </button>
            )
          ) : !userId ? (
            <Link href="/login" className="rounded-full border border-white/20 py-2.5 text-center font-extrabold text-white/80 hover:border-amber-300 hover:text-amber-300">
              {t("შესვლა", "Sign in", "Войти")}
            </Link>
          ) : (
            <button
              type="button"
              disabled={!!busy || short > 0}
              onClick={() => void buyPack(b)}
              className="rounded-full bg-amber-300 py-2.5 font-extrabold text-black transition-colors hover:bg-amber-200 disabled:bg-white/10 disabled:text-white/45"
            >
              {short > 0 ? t(`კიდევ ${short} მონეტა`, `${short} more coins`, `ещё ${short} монет`) : t("ყიდვა და დაყენება", "Buy and equip", "Купить и надеть")}
            </button>
          )}
          {note && <span className={`text-right text-xs font-bold ${note.ok ? "text-emerald-300" : "text-red-300"}`}>{note.text}</span>}
        </div>
      </div>
      <ul className="relative grid grid-cols-3 gap-x-1 gap-y-3 sm:grid-cols-4 sm:gap-2 lg:grid-cols-7">
        {b.items.filter((id) => !cardBack(id)).map((id) => {
          const th = themeById(id);
          const label = th ? t(th.name[0], th.name[1], th.name[2]) : (cardBack(id)?.name ?? cosmetic(id)?.name ?? id);
          return (
            <li
              key={id}
              title={label}
              className={`tier-${rarityOf(id)} group relative flex flex-col items-center gap-2 rounded-3xl border px-1.5 pb-2.5 pt-3 transition-transform duration-300 hover:-translate-y-1.5 hover:scale-[1.06]`}
            >
              {/* a soft glow in the item's own colour, and the picture lifted off it like the big cards */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-2 top-2 h-20 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                style={{ background: cosmetic(id)?.accent ?? themeById(id)?.color ?? accent }}
              />
              <div
                className="relative flex h-[7.2rem] w-full items-center justify-center"
                style={{ filter: `drop-shadow(0 10px 14px ${(cosmetic(id)?.accent ?? themeById(id)?.color ?? accent)}66)` }}
              >
                <div className="shrink-0 origin-center scale-[0.74] transition-transform duration-300 group-hover:scale-[0.8]">
                  <ItemArt id={id} nickname={profile?.nickname} avatar={profile ? { color: profile.avatar_color, icon: profile.avatar_icon, url: profile.avatar_url } : undefined} />
                </div>
              </div>
              <span className="relative line-clamp-2 max-w-full rounded-2xl bg-black/40 px-2.5 py-0.5 text-center text-[0.68rem] font-extrabold leading-tight text-white/85 ring-1 ring-white/15">{label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
  };

  const tabBtn = (key: string, active: boolean, onClick: () => void, label: string, count?: number) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-none items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-extrabold transition-colors ${
        active ? "border-amber-300 bg-amber-300 text-black" : "border-white/12 bg-white/[0.04] text-white/75 hover:border-white/35 hover:text-white"
      }`}
    >
      {label}
      {count !== undefined && <span className={`rounded-full px-1.5 text-[0.7rem] ${active ? "bg-black/15" : "bg-white/10"}`}>{count}</span>}
    </button>
  );

  return (
    <PageShell width="max-w-7xl" glow="#fbbf24">
      <section className="flex flex-wrap items-center justify-between gap-4" style={rise(1)}>
        <h1 className="text-[clamp(1.8rem,9vw,2.4rem)] font-extrabold tracking-tight sm:text-5xl">{t("მაღაზია", "Shop", "Магазин")}</h1>
        {wallet && (
          <b className="flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-lg tabular-nums text-amber-200">
            <CoinIcon /> {wallet.balance}
          </b>
        )}
      </section>

      {!configured ? (
        <p className="text-white/55">{t("მაღაზია ჯერ არ არის ჩართული.", "The shop is not enabled yet.", "Магазин пока не включён.")}</p>
      ) : stock === null ? (
        <div className="h-64 animate-pulse rounded-3xl bg-white/[0.06]" />
      ) : stock.length === 0 ? (
        <p className="text-white/55">{t("მაღაზია ჯერ ცარიელია.", "The shop is empty for now.", "Магазин пока пуст.")}</p>
      ) : (
        <>
          {/* one row of tabs instead of a wall of boxes */}
          <nav className="relative z-20 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" aria-label={t("კატეგორიები", "Categories", "Категории")} style={rise(2)}>
            {tabBtn("home", section === null, () => setSection(null), t("მთავარი", "Home", "Главная"))}
            {bundles.length > 0 && tabBtn("packs", section === "packs", () => setSection("packs"), t("პაკები", "Packs", "Наборы"), bundles.length)}
            {TAB_IDS.filter((id) => (stock ?? []).some((i) => i.kind === SECTIONS[id].kind)).map((id) =>
              tabBtn(id, section === id, () => setSection(id), t(SECTIONS[id].label[0], SECTIONS[id].label[1], SECTIONS[id].label[2])),
            )}
            <button
              type="button"
              onClick={() => setNickOpen(true)}
              className="flex flex-none items-center gap-2 whitespace-nowrap rounded-full border border-dashed border-white/25 px-4 py-2 text-sm font-extrabold text-white/70 transition-colors hover:border-amber-300 hover:text-amber-300"
            >
              {t("ახალი მეტსახელი", "New nickname", "Новый никнейм")}
              <span className="flex items-center gap-1 text-white/45">
                <CoinIcon className="size-3.5" />
                {NICKNAME_PRICE}
              </span>
            </button>
            {section !== null && section !== "packs" && (
              <div className="relative flex-none self-center sm:ml-auto">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={sortOpen}
                  onClick={() => setSortOpen((o) => !o)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-extrabold transition-colors ${
                    sortOpen ? "border-amber-300/70 bg-amber-300/15 text-amber-200" : "border-white/12 bg-white/[0.04] text-white/80 hover:border-white/35 hover:text-white"
                  }`}
                >
                  <span className="text-white/45">{t("დალაგება", "Sort", "Сортировка")}</span>
                  {sortOptions.find((o) => o.id === sort)?.label}
                  <svg viewBox="0 0 12 12" className={`size-3 transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M2.5 4.5 6 8l3.5-3.5" />
                  </svg>
                </button>
                {sortOpen && (
                  <>
                    <button type="button" aria-label={t("დახურვა", "Close", "Закрыть")} tabIndex={-1} onClick={() => setSortOpen(false)} className="fixed inset-0 z-30 cursor-default" />
                    <ul
                      role="listbox"
                      className="absolute right-0 top-full z-40 mt-2 flex w-[18.5rem] max-w-[calc(100vw-2rem)] origin-top-right flex-col gap-1 rounded-3xl border border-white/15 bg-[#0d0a1f]/95 p-2 shadow-[0_24px_60px_-16px_rgb(0_0_0/0.8)] backdrop-blur-xl"
                      style={{ animation: "sort-pop 0.16s ease-out both" }}
                    >
                      {sortOptions.map((o) => (
                        <li key={o.id} role="option" aria-selected={o.id === sort}>
                          <button
                            type="button"
                            onClick={() => {
                              setSort(o.id);
                              setSortOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm font-extrabold transition-colors ${
                              o.id === sort ? "bg-amber-300 text-black" : "text-white/80 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {o.label}
                            <svg viewBox="0 0 12 12" className={`size-3 flex-none ${o.id === sort ? "" : "opacity-0"}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M2 6.5 4.8 9 10 3" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </nav>

          {section === null ? (
            <div className="flex flex-col gap-10 pb-10" style={rise(3)}>
              {pack && (
                <div className="flex flex-col gap-3">
                  {packCard(pack)}
                  {bundles.length > 1 && (
                    <button type="button" onClick={() => setSection("packs")} className="w-fit px-1 text-sm font-extrabold text-amber-300 underline underline-offset-4 hover:text-amber-200">
                      {t(`ყველა პაკი (${bundles.length})`, `All packs (${bundles.length})`, `Все наборы (${bundles.length})`)} →
                    </button>
                  )}
                </div>
              )}

              <section className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-2xl font-extrabold">{t("კვირის ექსკლუზივი", "Weekly exclusives", "Эксклюзивы недели")}</h2>
                  {endsAt && (
                    <span className="rounded-full bg-amber-300/10 px-3 py-1 text-sm font-bold text-amber-200">
                      {t("განახლებამდე", "Refreshes in", "Обновление через")} {daysLeft(endsAt, now)}
                    </span>
                  )}
                </div>
                {weekly.length === 0 ? (
                  <p className="text-white/50">{t("ამ კვირაში ექსკლუზივი ჯერ არ არის.", "No exclusives this week yet.", "На этой неделе эксклюзивов пока нет.")}</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">{weekly.map(card)}</ul>
                )}
              </section>
            </div>
          ) : section === "packs" ? (
            <div className="flex flex-col gap-8 pb-10" style={rise(3)}>
              {bundles.map(packCard)}
            </div>
          ) : (
            <section className="flex flex-col gap-4 pb-10" style={rise(3)}>
              {section === "themes" && <p className="text-white/50">{t("ღვინისფერი და მწვანე უფასოა.", "Wine and green are free.", "Бордовый и зелёный бесплатны.")}</p>}
              {(section === "reactions" || section === "throws") && (
                <p className="text-white/50">
                  {t("ჩათიდან (😀) გააგზავნეთ: რეაქციას ყველა ხედავს, სასროლს კი მოწინააღმდეგეზე ესვრით.", "Send from the chat (😀): everybody sees a reaction, a throwable flies at a rival.", "Отправляйте из чата (😀): реакцию видят все, а предмет летит в соперника.")}
                </p>
              )}
              {section === "sounds" && <p className="text-white/50">{t("▶ დააჭირეთ და მოუსმინეთ. ხმას მხოლოდ თქვენ გაიგონებთ.", "Press ▶ to listen. Only you hear it.", "Нажмите ▶, чтобы послушать. Слышите только вы.")}</p>}
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{sorted((stock ?? []).filter((i) => i.kind === SECTIONS[section].kind)).map(card)}</ul>
            </section>
          )}
        </>
      )}

      {viewed && viewedLook && (
        <DeckViewer skin={viewed.id} name={viewedLook.name} accent={viewedLook.accent} actions={actionFor(viewed, "large")} onClose={() => setView(null)} />
      )}

      {nickOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
          onPointerDown={(e) => e.target === e.currentTarget && setNickOpen(false)}
        >
          <div className="relative w-full max-w-lg rounded-[2rem] border border-white/15 bg-[var(--bg-b)] p-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setNickOpen(false)}
              aria-label={t("დახურვა", "Close", "Закрыть")}
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/10 text-xl leading-none text-white/80 hover:bg-white/20"
            >
              ×
            </button>
            <NicknameService balance={wallet?.balance ?? null} signedIn={!!userId} onDone={loadWallet} />
          </div>
        </div>
      )}
    </PageShell>
  );
}


/** A new nickname for coins: the name is checked for being free before the coins are asked. */
function NicknameService({ balance, signedIn, onDone }: { balance: number | null; signedIn: boolean; onDone: () => Promise<void> }) {
  const t = useT();
  const { profile, nicknameAvailable } = useAuth();
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy">("idle");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [free, setFree] = useState<boolean | null>(null);

  const trimmed = name.trim();
  const problem = trimmed ? validateNickname(trimmed) : null;
  const same = trimmed.toLowerCase() === (profile?.nickname ?? "").toLowerCase();
  const short = balance === null ? NICKNAME_PRICE : NICKNAME_PRICE - balance;

  useEffect(() => {
    if (!trimmed || problem || same) return;
    let cancelled = false;
    const id = setTimeout(() => {
      nicknameAvailable(trimmed).then((ok) => !cancelled && setFree(ok));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
      setFree(null);
    };
  }, [trimmed, problem, same, nicknameAvailable]);

  const submit = async () => {
    const supabase = getSupabase();
    if (!supabase || state === "busy") return;
    setState("busy");
    setResult(null);
    const error = await buyNickname(supabase, trimmed);
    if (error) {
      setResult({ ok: false, text: error });
    } else {
      setResult({ ok: true, text: t(`ახალი სახელი: ${trimmed}`, `Your new nickname: ${trimmed}`, `Ваш новый никнейм: ${trimmed}`) });
      setName("");
      window.dispatchEvent(new Event(COINS_CHANGED));
      window.dispatchEvent(new Event(PROFILE_CHANGED));
      await onDone();
    }
    setState("idle");
  };

  const hint = problem ?? (same && trimmed ? t("ეს თქვენი ახლანდელი სახელია", "This is your current name", "Это ваше текущее имя") : free === false ? t("ეს სახელი დაკავებულია", "This name is taken", "Это имя занято") : null);
  const ready = signedIn && !!trimmed && !problem && !same && free !== false && short <= 0;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-extrabold">{t("ახალი მეტსახელი", "A new nickname", "Новый никнейм")}</h2>
      <p className="-mt-2 text-sm text-white/50">
        {t(
          "მეტსახელის შეცვლა მხოლოდ აქ შეიძლება. სახელი უნიკალური უნდა იყოს, ძველი კი თავისუფლდება.",
          "A nickname can be changed only here. It must be unique, and your old name becomes free.",
          "Никнейм меняется только здесь. Он должен быть уникальным, а старый освободится.",
        )}
      </p>
      <div>
        <p className="text-sm text-white/45">{t("ახლა", "Now", "Сейчас")}</p>
        <p className="mb-3 text-2xl font-extrabold">{profile?.nickname ?? "—"}</p>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setResult(null);
          }}
          maxLength={16}
          placeholder={t("ახალი სახელი", "New name", "Новое имя")}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-lg text-white outline-none placeholder:text-white/30 focus:border-amber-300"
        />
        <p className="mt-2 min-h-5 text-sm font-bold text-red-300">{hint}</p>
        <button
          type="button"
          disabled={!ready || state === "busy"}
          onClick={() => void submit()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-amber-300 px-5 py-3 text-base font-extrabold text-black transition-colors hover:bg-amber-200 disabled:bg-white/10 disabled:text-white/45"
        >
          <CoinIcon className="size-4" />
          {NICKNAME_PRICE}
          {short > 0 && signedIn && <span className="text-xs font-bold">· {t(`კიდევ ${short}`, `${short} more`, `ещё ${short}`)}</span>}
        </button>
        {!signedIn && (
          <Link href="/login" className="mt-3 block text-center text-sm font-bold text-amber-300 underline underline-offset-4">
            {t("შედით ანგარიშში", "Sign in", "Войдите")}
          </Link>
        )}
        {result && <p className={`mt-3 text-sm font-bold ${result.ok ? "text-emerald-300" : "text-red-300"}`}>{result.text}</p>}
      </div>
    </section>
  );
}
