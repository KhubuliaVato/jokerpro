"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PROFILE_CHANGED, useAuth } from "@/lib/auth/AuthProvider";
import { validateNickname } from "@/lib/auth/messages";
import { loadBalance } from "@/lib/coins";
import {
  buyNickname,
  cosmetic,
  EMOTE_PACKS,
  loadWorn,
  NICKNAME_PRICE,
  slotOf,
  wear,
  type Worn,
} from "@/lib/cosmetics";
import { useT } from "@/lib/i18n";
import {
  buyItem,
  cardBack,
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
import { Nick } from "./Nick";
import { PageShell } from "./PageShell";
import { ThemeShowcase } from "./ThemeShowcase";
import { rise } from "./ui";

interface Wallet {
  balance: number;
  owned: string[];
  worn: Worn;
}

type Kind = StockItem["kind"];

type SectionId = "decks" | "themes" | "frames" | "names" | "emotes" | "effects";

/** The category boxes that always stand in the two side columns; each opens the full list of its kind. */
const SECTIONS: Record<SectionId, { kind: Kind; label: [string, string, string]; hint: [string, string, string]; glow: string }> = {
  decks: { kind: "card_back", label: ["კარტები", "Cards", "Карты"], hint: ["ზურგიც და სახეც", "Back and face", "Рубашка и лицо"], glow: "#e11d4855" },
  themes: { kind: "theme", label: ["ფონები", "Backgrounds", "Фоны"], hint: ["ფერადი და მოძრავი", "Plain and moving", "Цветные и движущиеся"], glow: "#38bdf855" },
  emotes: { kind: "emote_pack", label: ["ემოციები და ფრაზები", "Emotes and phrases", "Эмоции и фразы"], hint: ["სწრაფი რეაქცია მაგიდასთან", "Quick reactions at the table", "Быстрые реакции за столом"], glow: "#34d39955" },
  frames: { kind: "frame", label: ["ჩარჩოები", "Frames", "Рамки"], hint: ["ავატარის ჩარჩო", "A frame for your avatar", "Рамка для аватара"], glow: "#fbbf2455" },
  names: { kind: "name_style", label: ["სახელის სტილი", "Name styles", "Стили имени"], hint: ["თქვენი სახელი გამოირჩევა", "Make your name stand out", "Ваше имя заметят"], glow: "#a78bfa55" },
  effects: { kind: "win_fx", label: ["მოგების ეფექტები", "Win effects", "Эффекты победы"], hint: ["როცა ხელს იღებთ", "When you take a trick", "Когда берёте взятку"], glow: "#f9731655" },
};
const LEFT_IDS: SectionId[] = ["decks", "themes", "emotes"];
const RIGHT_IDS: SectionId[] = ["frames", "names", "effects"];

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
  const [section, setSection] = useState<SectionId | null>(null);

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
      // an emote pack is not worn: owning it is the whole point
      if (item.kind === "emote_pack") {
        return <div className={`rounded-full border border-emerald-400/40 bg-emerald-400/10 text-center font-extrabold text-emerald-300 ${dim}`}>✓ {t("ნაყიდია", "Owned", "Куплено")}</div>;
      }
      return (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => (item.kind === "theme" ? applyTheme(item.id) : void putOn(item))}
          className={`rounded-full border font-extrabold transition-colors disabled:opacity-50 ${dim} ${worn ? "border-amber-300/60 bg-amber-300/15 text-amber-200" : "border-white/20 text-white/80 hover:border-amber-300 hover:text-amber-300"}`}
        >
          {worn ? `✓ ${t("ჩაცმულია", "Equipped", "Надето")}` : t("ჩაცმა", "Equip", "Надеть")}
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
        {short > 0 && size !== "compact" && <span className="text-xs font-bold">· {t(`კიდევ ${short}`, `${short} more`, `ещё ${short}`)}</span>}
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
      case "emote_pack":
        return <EmotePreview id={item.id} />;
    }
  };

  /** A big card (the week's exclusives). */
  const card = (item: StockItem) => {
    const worn = isWorn(item);
    const note = message?.id === item.id ? message : null;
    return (
      <li
        key={item.id}
        className={`group flex flex-col items-center gap-3 rounded-3xl border bg-gradient-to-b from-white/[0.1] to-white/[0.02] p-4 text-center transition-[translate,border-color] duration-300 hover:-translate-y-1 ${worn ? "border-amber-300/70" : "border-amber-300/25 hover:border-amber-300/60"}`}
      >
        {previewOf(item)}
        <b className="text-lg font-extrabold leading-tight">{labelOf(item)}</b>
        {actionFor(item)}
        {note && <span className={`text-xs font-bold ${note.ok ? "text-emerald-300" : "text-red-300"}`}>{note.text}</span>}
      </li>
    );
  };

  /** The art of a category box. */
  const boxArt = (id: SectionId) => {
    const mine = profile ?? null;
    switch (id) {
      case "decks":
        return <BackPreview skin="crimson" accent="#e11d48" width="4.6rem" />;
      case "themes":
        return <ThemeShowcase />;
      case "frames":
        return (
          <div className="flex items-center gap-2 [&_.avatar-face]:size-14! [&_.avatar-face]:text-2xl!">
            {(["f_gold", "f_flame", "f_neon"] as const).map((f) => (
              <Avatar key={f} size="lg" color={mine?.avatar_color ?? "amber"} icon={mine?.avatar_icon} url={mine?.avatar_url} frame={f} />
            ))}
          </div>
        );
      case "names":
        return (
          <div className="flex flex-col items-center text-xl font-extrabold leading-tight">
            {(["n_rainbow", "n_fire", "n_neon"] as const).map((n) => (
              <Nick key={n} name={mine?.nickname ?? "ProJoker"} style={n} />
            ))}
          </div>
        );
      case "emotes":
        return (
          <div className="flex flex-wrap items-center justify-center gap-2 text-3xl">
            {["🔥", "😎", "🎉", "😅", "🏆", "👏"].map((e, i) => (
              <span key={i} className="transition-transform duration-300 group-hover:-translate-y-1" style={{ transitionDelay: `${i * 40}ms` }}>
                {e}
              </span>
            ))}
          </div>
        );
      case "effects":
        return (
          <div className="flex items-center gap-4">
            {(["w_sparks", "w_gold", "w_fire"] as const).map((fx) => (
              <CardView key={fx} card={KING} className={`fxw-${fx}`} style={{ "--cw": "3.2rem" } as React.CSSProperties} />
            ))}
          </div>
        );
    }
  };

  const boxFor = (id: SectionId) => {
    const x = SECTIONS[id];
    const items = (stock ?? []).filter((i) => i.kind === x.kind);
    if (items.length === 0) return null;
    const mine = items.filter((i) => wallet?.owned.includes(i.id)).length;
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => setSection(id)}
          className="group relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-[1.75rem] border border-white/12 bg-gradient-to-b from-white/[0.09] to-white/[0.02] p-4 text-center shadow-[0_18px_40px_-24px_rgb(0_0_0/0.7)] transition-[translate,border-color,box-shadow] duration-300 hover:-translate-y-1.5 hover:border-amber-300/60 hover:shadow-[0_30px_60px_-20px_rgb(0_0_0/0.6)]"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full blur-3xl" style={{ background: x.glow }} />
          <div className={`relative grid w-full place-items-center ${id === "themes" ? "h-36 pb-4" : "h-32"}`}>{boxArt(id)}</div>
          <h2 className="relative text-xl font-extrabold leading-tight">{t(x.label[0], x.label[1], x.label[2])}</h2>
          <div className="relative flex flex-wrap items-center justify-center gap-1.5">
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[0.7rem] font-bold text-white/70">
              {items.length} {t("ნივთი", "items", "предм.")}
            </span>
            {userId && mine > 0 && (
              <span className="rounded-full bg-amber-300/15 px-2.5 py-0.5 text-[0.7rem] font-bold text-amber-200">✓ {mine}</span>
            )}
          </div>
        </button>
      </li>
    );
  };

  const servicesBox = (
    <li key="services">
      <button
        type="button"
        onClick={() => setNickOpen(true)}
        className="group relative flex w-full flex-col items-center gap-3 overflow-hidden rounded-[1.75rem] border border-white/12 bg-gradient-to-b from-white/[0.09] to-white/[0.02] p-4 text-center shadow-[0_18px_40px_-24px_rgb(0_0_0/0.7)] transition-[translate,border-color,box-shadow] duration-300 hover:-translate-y-1.5 hover:border-amber-300/60"
      >
        <div className="relative grid h-32 w-full place-items-center">
          <div className="flex items-center gap-3 rounded-2xl bg-black/25 px-4 py-3 ring-1 ring-white/10">
            <span className="text-base font-bold text-white/50 line-through">{profile?.nickname ?? "TOJI"}</span>
            <span className="text-lg text-amber-300">→</span>
            <span className="text-xl font-extrabold">?</span>
          </div>
        </div>
        <h2 className="relative text-xl font-extrabold leading-tight">{t("ახალი მეტსახელი", "A new nickname", "Новый никнейм")}</h2>
        <span className="relative flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[0.7rem] font-bold text-white/70">
          <CoinIcon className="size-3.5" /> {NICKNAME_PRICE}
        </span>
      </button>
    </li>
  );

  const viewed = view ? (stock ?? []).find((i) => i.id === view) : undefined;
  const viewedLook = viewed ? cardBack(viewed.id) : undefined;

  return (
    <PageShell width="max-w-7xl" glow="#fbbf24">
      <section className="flex flex-wrap items-end justify-between gap-4" style={rise(1)}>
        <div className="flex flex-col gap-2">
          <h1 className="text-[clamp(1.8rem,9vw,2.4rem)] font-extrabold tracking-tight sm:text-5xl">{t("მაღაზია", "Shop", "Магазин")}</h1>
          <p className="max-w-xl text-base text-white/55">
            {t("მუდმივი ნივთები გვერდებზეა, ცენტრში კი კვირის ექსკლუზივები.", "Always-available items on the sides, the week's exclusives in the middle.", "Постоянные предметы по бокам, эксклюзивы недели в центре.")}
          </p>
        </div>
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
          {section !== null && (
            <button
              type="button"
              onClick={() => setSection(null)}
              className="flex w-fit items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-base font-bold text-white/75 transition-colors hover:border-amber-300 hover:text-amber-300"
              style={rise(2)}
            >
              ← {t("მაღაზია", "Shop", "Магазин")}
            </button>
          )}

          {section === null ? (
            <div className="grid items-start gap-8 pb-10 lg:grid-cols-[17rem_minmax(0,1fr)_17rem]" style={rise(2)}>
              {/* the week's exclusives come first on a phone, and in the middle on a wide screen */}
              <section className="order-first flex flex-col gap-4 lg:order-none lg:col-start-2 lg:row-start-1">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300/30 bg-gradient-to-r from-amber-300/15 to-transparent px-4 py-3">
                  <h2 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
                    {t("კვირის ექსკლუზივი", "Weekly exclusives", "Эксклюзивы недели")}
                  </h2>
                  {endsAt && (
                    <span className="rounded-full bg-black/30 px-3 py-1 text-sm font-bold text-amber-200">
                      {t("განახლებამდე", "Refreshes in", "Обновление через")} {daysLeft(endsAt, now)}
                    </span>
                  )}
                </div>
                {weekly.length === 0 ? (
                  <p className="text-white/50">{t("ამ კვირაში ექსკლუზივი ჯერ არ არის.", "No exclusives this week yet.", "На этой неделе эксклюзивов пока нет.")}</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-4 xl:grid-cols-3">{weekly.map(card)}</ul>
                )}
              </section>

              <ul className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">{LEFT_IDS.map(boxFor)}</ul>
              <ul className="flex flex-col gap-4 lg:col-start-3 lg:row-start-1">
                {RIGHT_IDS.map(boxFor)}
                {servicesBox}
              </ul>
            </div>
          ) : (
            <section className="flex flex-col gap-4 pb-10" style={rise(3)}>
              <h2 className="text-2xl font-extrabold">{t(SECTIONS[section].label[0], SECTIONS[section].label[1], SECTIONS[section].label[2])}</h2>
              {section === "themes" && <p className="-mt-2 text-white/50">{t("ღვინისფერი და მწვანე უფასოა.", "Wine and green are free.", "Бордовый и зелёный бесплатны.")}</p>}
              {section === "emotes" && (
                <p className="-mt-2 text-white/50">
                  {t("ძირითადი ნაკრები უფასოა. ემოციებს ჩათიდან გააგზავნით (😀).", "The basic pack is free. Send emotes from the chat (😀).", "Базовый набор бесплатен. Эмоции отправляются из чата (😀).")}
                </p>
              )}
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{(stock ?? []).filter((i) => i.kind === SECTIONS[section].kind).map(card)}</ul>
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

/** The emotes and phrases of a pack, as the featured card shows them. */
function EmotePreview({ id }: { id: string }) {
  const t = useT();
  const pack = EMOTE_PACKS.find((p) => `e_${p.id}` === id);
  return (
    <div className="flex h-[8.06rem] w-full flex-wrap content-center items-center justify-center gap-1.5 rounded-2xl bg-black/25 p-2 ring-1 ring-white/10">
      {pack?.emotes.map((e, i) => (
        <span key={i} className="text-2xl leading-none">
          {e}
        </span>
      ))}
      {pack?.phrases.slice(0, 3).map((ph, i) => (
        <span key={`p${i}`} className="rounded-lg bg-white/10 px-1.5 py-0.5 text-[0.65rem] font-bold leading-tight">
          {t(ph[0], ph[1], ph[2])}
        </span>
      ))}
    </div>
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
