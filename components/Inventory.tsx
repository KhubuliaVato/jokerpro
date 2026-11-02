"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PROFILE_CHANGED } from "@/lib/auth/AuthProvider";
import { cosmetic, EMOTE_PACKS, loadWorn, wear, type Slot, type Worn } from "@/lib/cosmetics";
import { useT } from "@/lib/i18n";
import { cardBack, loadInventory } from "@/lib/shop";
import { getSupabase } from "@/lib/supabase";
import { Avatar } from "./Avatar";
import { BackPreview } from "./BackPreview";
import { Nick } from "./Nick";

/** What a player owns, by kind; for the player themself each kind has a button to wear it. */
export function Inventory({ userId, owner, avatar, nickname }: { userId: string; owner: boolean; avatar?: { color?: string; icon?: string; url?: string | null }; nickname?: string }) {
  const t = useT();
  const [state, setState] = useState<{ userId: string; owned: string[]; worn: Worn } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  if (!mine) return <div className="h-32 animate-pulse rounded-2xl bg-white/[0.06]" />;

  const put = async (slot: Slot, id: string | null) => {
    const supabase = getSupabase();
    if (!supabase) return;
    setError(await wear(supabase, userId, slot, id));
    window.dispatchEvent(new Event(PROFILE_CHANGED));
    await load();
  };

  const button = (slot: Slot, id: string | null) => {
    const worn = mine.worn[slot] === id;
    if (!owner) return worn ? <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-extrabold text-amber-200">✓ {t("ჩაცმულია", "Equipped", "Надето")}</span> : null;
    return (
      <button
        type="button"
        disabled={worn}
        onClick={() => void put(slot, id)}
        className={`w-full rounded-full border px-4 py-2 text-sm font-extrabold transition-colors ${worn ? "border-amber-300/60 bg-amber-300/15 text-amber-200" : "border-white/20 text-white/80 hover:border-amber-300 hover:text-amber-300"}`}
      >
        {worn ? `✓ ${t("ჩაცმულია", "Equipped", "Надето")}` : t("ჩაცმა", "Equip", "Надеть")}
      </button>
    );
  };

  const tile = (key: string, slot: Slot, id: string | null, art: React.ReactNode, label: string) => (
    <li key={key} className={`group flex flex-col items-center gap-3 rounded-3xl border bg-white/[0.03] p-4 text-center ${mine.worn[slot] === id ? "border-amber-300/70" : "border-white/10"}`}>
      {art}
      <b className="text-base font-extrabold leading-tight">{label}</b>
      {button(slot, id)}
    </li>
  );

  const ids = (prefix: string) => mine.owned.filter((id) => id.startsWith(prefix));
  const decks = mine.owned.filter((id) => cardBack(id));
  const packs = EMOTE_PACKS.filter((p) => p.id === "basic" || mine.owned.includes(`e_${p.id}`));
  const nothing = decks.length + ids("f_").length + ids("n_").length + ids("w_").length + ids("e_").length === 0;

  const group = (title: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-extrabold text-white/80">{title}</h3>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">{children}</ul>
    </div>
  );

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

      {group(
        t("კარტები", "Card decks", "Колоды"),
        <>
          {tile("standard", "back", null, <BackPreview skin={null} />, t("სტანდარტული", "Standard", "Стандартная"))}
          {decks.map((id) => tile(id, "back", id, <BackPreview skin={id} accent={cardBack(id)?.accent} />, cardBack(id)?.name ?? id))}
        </>,
      )}

      {ids("f_").length > 0 &&
        group(
          t("ჩარჩოები", "Frames", "Рамки"),
          <>
            {tile("no-frame", "frame", null, <div className="grid h-24 place-items-center"><Avatar size="lg" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} /></div>, t("ჩარჩოს გარეშე", "No frame", "Без рамки"))}
            {ids("f_").map((id) =>
              tile(id, "frame", id, <div className="grid h-24 place-items-center"><Avatar size="lg" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} frame={id} /></div>, cosmetic(id)?.name ?? id),
            )}
          </>,
        )}

      {ids("n_").length > 0 &&
        group(
          t("სახელის სტილი", "Name styles", "Стили имени"),
          <>
            {tile("no-name", "name", null, <div className="grid h-24 place-items-center text-2xl font-extrabold">{nickname ?? "ProJoker"}</div>, t("ჩვეულებრივი", "Plain", "Обычное"))}
            {ids("n_").map((id) =>
              tile(id, "name", id, <div className="grid h-24 max-w-full place-items-center text-2xl font-extrabold"><Nick name={nickname ?? "ProJoker"} style={id} /></div>, cosmetic(id)?.name ?? id),
            )}
          </>,
        )}

      {ids("w_").length > 0 &&
        group(
          t("მოგების ეფექტები", "Win effects", "Эффекты победы"),
          <>
            {tile("no-fx", "fx", null, <div className="grid h-24 place-items-center text-4xl text-white/30">∅</div>, t("ეფექტის გარეშე", "No effect", "Без эффекта"))}
            {ids("w_").map((id) => tile(id, "fx", id, <div className="grid h-24 place-items-center text-4xl">✨</div>, cosmetic(id)?.name ?? id))}
          </>,
        )}

      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-extrabold text-white/80">{t("ემოციები და ფრაზები", "Emotes and phrases", "Эмоции и фразы")}</h3>
        <ul className="flex flex-wrap gap-3">
          {packs.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <b className="text-sm">{t(p.names[0], p.names[1], p.names[2])}</b>
              <span className="text-lg">{p.emotes.slice(0, 4).join(" ")}</span>
            </li>
          ))}
        </ul>
      </div>

      {nothing && (
        <p className="text-white/45">
          {owner
            ? t("ჯერ არაფერი გაქვთ ნაყიდი. მონეტებით მაღაზიაში შეგიძლიათ დასტები, ჩარჩოები და სხვა იყიდოთ.", "You have not bought anything yet. Decks, frames and more cost coins in the shop.", "Вы ещё ничего не купили. Колоды, рамки и другое продаются в магазине за монеты.")
            : t("ჯერ არაფერი უყიდია.", "Nothing bought yet.", "Пока ничего не куплено.")}
        </p>
      )}
    </section>
  );
}
