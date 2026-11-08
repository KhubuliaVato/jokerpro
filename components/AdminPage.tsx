"use client";

import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  admin,
  useIsAdmin,
  useRemote,
  type AdminLogRow,
  type AdminMessage,
  type AdminShopItem,
  type AdminTable,
  type AdminUserDetail,
  type AdminUserRow,
  type Overview,
} from "@/lib/admin";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cosmetic } from "@/lib/cosmetics";
import { cardBack } from "@/lib/shop";
import { themeById } from "@/lib/themes";
import { Avatar } from "./Avatar";
import { PageShell } from "./PageShell";
import { Panel } from "./ProfileWidgets";
import { BTN_GHOST, BTN_PRIMARY, rise } from "./ui";

const TABS = [
  { id: "overview", label: "მიმოხილვა" },
  { id: "players", label: "მოთამაშეები" },
  { id: "tables", label: "მაგიდები" },
  { id: "shop", label: "მაღაზია" },
  { id: "chat", label: "ჩათი" },
  { id: "log", label: "ჟურნალი" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const GAMES: Record<string, string> = { joker: "ჯოკერი", bura: "ბურა", poker: "პოკერი" };
const KINDS: Record<string, string> = { card_back: "კარტი", theme: "ფონი", frame: "ჩარჩო", name_style: "სახელი", win_fx: "ეფექტი", reaction: "რეაქცია", throwable: "სასროლი", play_fx: "დადების ეფექტი", sound_pack: "ხმა", joker_skin: "ჯოკერი" };
const STATUS: Record<string, string> = { waiting: "ელოდება", playing: "თამაშობს", finished: "დასრულდა", closed: "დახურულია" };
const ACTIONS: Record<string, string> = {
  coins: "მონეტები",
  "item+": "ნივთი დაემატა",
  "item-": "ნივთი ჩამოერთვა",
  rating: "ქულა შეიცვალა",
  ban: "დაბლოკვა",
  unban: "განბლოკვა",
  nickname: "სახელი შეიცვალა",
  "admin+": "ადმინი დაინიშნა",
  "admin-": "ადმინობა მოეხსნა",
  "table-close": "მაგიდა დაიხურა",
  "message-delete": "შეტყობინება წაიშალა",
  price: "ფასი შეიცვალა",
  tier: "ტიპი შეიცვალა",
};

const FIELD = "rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-amber-300";
const SMALL = "rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-white/75 transition-colors hover:border-amber-300 hover:text-amber-300 disabled:opacity-40";

/** The name of a shop item by its id. */
function itemName(id: string | null | undefined): string {
  if (!id) return "—";
  const theme = themeById(id);
  return cardBack(id)?.name ?? cosmetic(id)?.name ?? (theme ? theme.name[0] : id);
}

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("ka-GE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 90) return "ახლახან";
  if (s < 5400) return `${Math.round(s / 60)} წთ წინ`;
  if (s < 129600) return `${Math.round(s / 3600)} სთ წინ`;
  return `${Math.round(s / 86400)} დღის წინ`;
}

const num = (n: number) => n.toLocaleString("ka-GE");

export function AdminPage() {
  const { user, loading } = useAuth();
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<Tab>("overview");

  if (loading || isAdmin === null) {
    return (
      <PageShell width="max-w-6xl">
        <div className="h-40 animate-pulse rounded-3xl bg-white/[0.06]" />
      </PageShell>
    );
  }
  if (!user || !isAdmin) {
    return (
      <PageShell>
        <section className="flex flex-col gap-4" style={rise(1)}>
          <h1 className="text-4xl font-extrabold">წვდომა არ გაქვთ</h1>
          <p className="text-white/60">ეს გვერდი მხოლოდ ადმინისტრატორებისთვისაა.</p>
          <Link href={user ? "/" : "/login?next=/admin"} className={`${BTN_GHOST} w-fit`}>
            {user ? "მთავარი" : "შესვლა"}
          </Link>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell width="max-w-6xl">
      <section className="flex flex-col gap-5" style={rise(1)}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">ადმინის პანელი</h1>
          <span className="rounded-full bg-amber-300/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-200">ყველა ცვლილება იწერება ჟურნალში</span>
        </div>
        <nav className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl border px-4 py-2 text-sm font-extrabold transition-colors ${tab === t.id ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 text-white/70 hover:border-white/40 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </section>

      <div style={rise(2)}>
        {tab === "overview" && <OverviewTab />}
        {tab === "players" && <PlayersTab />}
        {tab === "tables" && <TablesTab />}
        {tab === "shop" && <ShopTab />}
        {tab === "chat" && <ChatTab />}
        {tab === "log" && <LogTab />}
      </div>
    </PageShell>
  );
}

function Failed({ error }: { error?: string }) {
  return error ? <p className="rounded-xl bg-red-500/15 px-4 py-3 text-sm font-bold text-red-200">{error}</p> : null;
}

function Loading() {
  return <div className="h-32 animate-pulse rounded-3xl bg-white/[0.06]" />;
}

// ---------------------------------------------------------------------------------------------
// Overview

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <span className="text-xs font-bold uppercase tracking-wider text-white/45">{label}</span>
      <b className={`text-3xl font-extrabold tabular-nums ${accent ? "text-amber-300" : ""}`}>{value}</b>
      {hint && <span className="text-xs text-white/45">{hint}</span>}
    </div>
  );
}

function OverviewTab() {
  const { data, error, loading, reload } = useRemote(() => admin<Overview>("admin_overview"), "overview");
  if (!data) return error ? <Failed error={error} /> : <Loading />;
  const max = Math.max(1, ...data.signups.map((s) => s.n));
  return (
    <div className="flex flex-col gap-6">
      <Failed error={error} />
      <div className="flex justify-end">
        <button type="button" className={SMALL} onClick={reload} disabled={loading}>
          {loading ? "იტვირთება…" : "განახლება"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="მოთამაშეები" value={num(data.users)} hint={`+${data.new_24h} დღეღამეში · +${data.new_7d} კვირაში`} accent />
        <Stat label="შემოვიდა 24 სთ-ში" value={num(data.active_24h)} />
        <Stat label="თამაშის ჩანაწერები" value={num(data.results)} hint={`${data.results_24h} დღეღამეში`} />
        <Stat label="მაგიდები" value={`${data.tables_playing} / ${data.tables_waiting}`} hint="თამაშობს / ელოდება" />
        <Stat label="მონეტები ბრუნვაში" value={num(data.coins_total)} />
        <Stat label="მონეტა გაიცა 7 დღეში" value={num(data.coins_paid_7d)} />
        <Stat label="ნაყიდი ნივთები" value={num(data.items_owned)} hint={`${data.gifts} საჩუქარი`} />
        <Stat label="დაბლოკილი" value={num(data.bans)} hint={`${data.referrals} მოწვევა`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="რეგისტრაციები · 14 დღე">
          <div className="flex h-40 items-end gap-1.5">
            {data.signups.map((s) => (
              <div key={s.d} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${s.d}: ${s.n}`}>
                <span className="text-[0.65rem] font-bold tabular-nums text-white/60">{s.n || ""}</span>
                <span className="w-full rounded-t-md bg-gradient-to-t from-amber-500 to-amber-300" style={{ height: `${Math.max(3, (s.n / max) * 100)}%` }} />
                <span className="text-[0.6rem] text-white/35">{s.d.slice(8)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="თამაშები სახეობით">
          <ul className="flex flex-col gap-3">
            {Object.entries(data.by_game).map(([g, c]) => (
              <li key={g} className="flex items-center justify-between gap-3">
                <span className="font-bold">{GAMES[g] ?? g}</span>
                <b className="tabular-nums text-amber-200">{num(c)}</b>
              </li>
            ))}
            {Object.keys(data.by_game).length === 0 && <li className="text-white/45">ჯერ არაფერი</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Players

function PlayersTab() {
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, loading, reload } = useRemote(() => admin<AdminUserRow[]>("admin_users", { p_query: asked, p_limit: 100 }), `users:${asked}`);
  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setAsked(query.trim());
        }}
      >
        <input className={`${FIELD} min-w-64 flex-1`} placeholder="სახელი ან ელფოსტა" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className={`${BTN_PRIMARY} !px-6 !py-2 !text-base`} type="submit">
          ძებნა
        </button>
        <button className={SMALL} type="button" onClick={reload} disabled={loading}>
          განახლება
        </button>
      </form>
      <Failed error={error} />
      {!data ? (
        error ? null : <Loading />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3">მოთამაშე</th>
                <th className="px-3 py-3">ელფოსტა</th>
                <th className="px-3 py-3 text-right">მონეტა</th>
                <th className="px-3 py-3 text-right">თამაში</th>
                <th className="px-3 py-3 text-right">ნივთი</th>
                <th className="px-3 py-3">რეგისტრაცია</th>
                <th className="px-3 py-3">ბოლოს</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} onClick={() => setOpen(u.id)} className="cursor-pointer border-t border-white/5 transition-colors hover:bg-white/[0.05]">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-3">
                      <Avatar size="sm" color={u.avatar_color} icon={u.avatar_icon} url={u.avatar_url} />
                      <b className="font-extrabold">{u.nickname}</b>
                      {u.is_admin && <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[0.65rem] font-extrabold text-amber-200">ადმინი</span>}
                      {u.banned_until && <span className="rounded-full bg-red-500/25 px-2 py-0.5 text-[0.65rem] font-extrabold text-red-200">ბლოკი</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-white/60">{u.email ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-amber-200">{num(u.balance)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.games}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{u.items}</td>
                  <td className="px-3 py-2.5 text-white/60">{when(u.created_at)}</td>
                  <td className="px-3 py-2.5 text-white/60">{ago(u.last_sign_in_at)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-white/45">
                    ვერავინ მოიძებნა
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {open && <PlayerDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </div>
  );
}

function PlayerDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const { data, error, reload } = useRemote(() => admin<AdminUserDetail>("admin_user", { p_user: id }), `user:${id}`);
  const shop = useRemote(() => admin<AdminShopItem[]>("admin_shop"), "shop-for-drawer");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [coins, setCoins] = useState("");
  const [item, setItem] = useState("");
  const [nick, setNick] = useState("");
  const [hours, setHours] = useState("24");
  const [rating, setRating] = useState<Record<string, string>>({});

  const run = async (what: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await what();
      setNote({ text: done, ok: true });
      reload();
      onChanged();
    } catch (e) {
      setNote({ text: (e as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  const owned = new Set(data?.items.map((i) => i.id));
  const available = (shop.data ?? []).filter((i) => !owned.has(i.id));
  const self = user?.id === id;

  // (in <body>: the page rises in with an animation, which would pin a fixed panel inside its own box)
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside className="flex h-full w-full max-w-xl flex-col gap-5 overflow-y-auto border-l border-white/10 bg-[#1a0a10] p-5 sm:p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">მოთამაშე</h2>
          <button type="button" className={SMALL} onClick={onClose}>
            დახურვა ✕
          </button>
        </div>
        <Failed error={error} />
        {note && <p className={`rounded-xl px-4 py-2.5 text-sm font-bold ${note.ok ? "bg-emerald-400/15 text-emerald-200" : "bg-red-500/15 text-red-200"}`}>{note.text}</p>}
        {!data ? (
          error ? null : <Loading />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar size="lg" color={data.avatar_color} icon={data.avatar_icon} url={data.avatar_url} frame={data.equipped.frame ?? undefined} />
              <div className="min-w-0">
                <b className="block truncate text-2xl font-extrabold">{data.nickname}</b>
                <span className="block truncate text-sm text-white/60">{data.email ?? "—"}</span>
                <span className="block text-xs text-white/40">
                  რეგისტრაცია {when(data.created_at)} · ბოლოს {ago(data.last_sign_in_at)}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {data.is_admin && <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[0.65rem] font-extrabold text-amber-200">ადმინი</span>}
                  {data.banned_until && <span className="rounded-full bg-red-500/25 px-2 py-0.5 text-[0.65rem] font-extrabold text-red-200">დაბლოკილია {when(data.banned_until)}-მდე</span>}
                </span>
              </div>
            </div>

            <Panel title={`მონეტები · ${num(data.balance)}`}>
              <div className="flex flex-wrap items-center gap-2">
                <input className={`${FIELD} w-32`} inputMode="numeric" placeholder="± რაოდენობა" value={coins} onChange={(e) => setCoins(e.target.value.replace(/[^0-9-]/g, ""))} />
                <button className={SMALL} disabled={busy || !Number(coins)} onClick={() => void run(() => admin("admin_grant_coins", { p_user: id, p_amount: Number(coins), p_note: "ადმინი" }).then(() => setCoins("")), "მონეტები შეიცვალა")}>
                  გადატარება
                </button>
                {[100, 500, 1000, -100].map((n) => (
                  <button key={n} className={SMALL} disabled={busy} onClick={() => void run(() => admin("admin_grant_coins", { p_user: id, p_amount: n, p_note: "ადმინი" }), `${n > 0 ? "+" : ""}${n} მონეტა`)}>
                    {n > 0 ? "+" : ""}
                    {n}
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title={`ნივთები · ${data.items.length}`}>
              <ul className="mb-3 flex flex-wrap gap-2">
                {data.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1 pl-3 pr-1.5 text-xs font-bold">
                    {itemName(i.id)}
                    <span className="text-white/35">{KINDS[i.kind] ?? i.kind}</span>
                    <button className="grid size-5 place-items-center rounded-full bg-white/10 hover:bg-red-500/60" title="ჩამორთმევა" disabled={busy} onClick={() => void run(() => admin("admin_revoke_item", { p_user: id, p_item: i.id }), `${itemName(i.id)} ჩამოერთვა`)}>
                      ✕
                    </button>
                  </li>
                ))}
                {data.items.length === 0 && <li className="text-sm text-white/45">ნივთები არ აქვს</li>}
              </ul>
              <div className="flex gap-2">
                <select className={`${FIELD} min-w-0 flex-1`} value={item} onChange={(e) => setItem(e.target.value)}>
                  <option value="">აირჩიეთ ნივთი…</option>
                  {available.map((i) => (
                    <option key={i.id} value={i.id}>
                      {itemName(i.id)} · {KINDS[i.kind] ?? i.kind}
                    </option>
                  ))}
                </select>
                <button className={SMALL} disabled={busy || !item} onClick={() => void run(() => admin("admin_grant_item", { p_user: id, p_item: item }).then(() => setItem("")), "ნივთი დაემატა")}>
                  მიცემა
                </button>
              </div>
            </Panel>

            <Panel title="ქულა (წოდება)">
              <ul className="flex flex-col gap-2">
                {["joker", "bura"].map((g) => {
                  const r = data.ratings.find((x) => x.game === g);
                  return (
                    <li key={g} className="flex flex-wrap items-center gap-3">
                      <span className="w-20 font-bold">{GAMES[g]}</span>
                      <span className="w-40 text-sm text-white/55">
                        {r ? `${r.rating} · ${r.games} თამაში · ${r.wins} მოგება` : "ჯერ არ უთამაშია"}
                      </span>
                      <input className={`${FIELD} w-24`} inputMode="numeric" placeholder={String(r?.rating ?? 50)} value={rating[g] ?? ""} onChange={(e) => setRating({ ...rating, [g]: e.target.value.replace(/\D/g, "") })} />
                      <button className={SMALL} disabled={busy || !rating[g]} onClick={() => void run(() => admin("admin_set_rating", { p_user: id, p_game: g, p_rating: Number(rating[g]) }).then(() => setRating({ ...rating, [g]: "" })), "ქულა შეიცვალა")}>
                        დაყენება
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel title="სახელი და ბლოკი">
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <input className={`${FIELD} min-w-0 flex-1`} placeholder="ახალი სახელი" maxLength={16} value={nick} onChange={(e) => setNick(e.target.value)} />
                  <button className={SMALL} disabled={busy || nick.trim().length < 2} onClick={() => void run(() => admin("admin_set_nickname", { p_user: id, p_name: nick }).then(() => setNick("")), "სახელი შეიცვალა")}>
                    შეცვლა
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className={FIELD} value={hours} onChange={(e) => setHours(e.target.value)}>
                    <option value="1">1 საათი</option>
                    <option value="24">1 დღე</option>
                    <option value="168">1 კვირა</option>
                    <option value="720">30 დღე</option>
                  </select>
                  <button className={`${SMALL} !border-red-400/50 !text-red-200`} disabled={busy || self} onClick={() => void run(() => admin("admin_ban", { p_user: id, p_hours: Number(hours) }), "დაიბლოკა")}>
                    დაბლოკვა
                  </button>
                  <button className={SMALL} disabled={busy || !data.banned_until} onClick={() => void run(() => admin("admin_unban", { p_user: id }), "განბლოკა")}>
                    განბლოკვა
                  </button>
                </div>
                <div>
                  <button
                    className={`${SMALL} ${data.is_admin ? "" : "!border-amber-300/50 !text-amber-200"}`}
                    disabled={busy || (self && data.is_admin)}
                    onClick={() => {
                      if (window.confirm(data.is_admin ? "ადმინობა მოვხსნათ?" : `${data.nickname}-ს ადმინის უფლებები მივცეთ? ის დაინახავს ყველა მოთამაშის ელფოსტას და შეძლებს ცვლილებებს.`)) {
                        void run(() => admin("admin_set_admin", { p_user: id, p_on: !data.is_admin }), data.is_admin ? "ადმინობა მოიხსნა" : "ადმინი დაინიშნა");
                      }
                    }}
                  >
                    {data.is_admin ? "ადმინობის მოხსნა" : "ადმინად დანიშვნა"}
                  </button>
                </div>
              </div>
            </Panel>

            <Panel title="ბოლო თამაშები">
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.results.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-1.5 text-white/75">
                    <span>
                      <b className="text-white">{GAMES[r.game] ?? r.game}</b> · {r.kind ?? (r.online ? "ონლაინ" : "ბოტებთან")} · #{r.place} · {r.score}
                    </span>
                    <span className="text-xs text-white/40">
                      {r.before !== null && r.after !== null ? `${r.before} → ${r.after} · ` : ""}
                      {when(r.at)}
                    </span>
                  </li>
                ))}
                {data.results.length === 0 && <li className="text-white/45">ჯერ არაფერი</li>}
              </ul>
            </Panel>

            <Panel title="მონეტების ისტორია">
              <ul className="flex flex-col gap-1.5 text-sm">
                {data.coins.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-white/75">
                    <span>
                      <b className="text-amber-200">+{c.amount}</b> · {c.reason}
                    </span>
                    <span className="text-xs text-white/40">{when(c.at)}</span>
                  </li>
                ))}
                {data.coins.length === 0 && <li className="text-white/45">ჯერ არაფერი</li>}
              </ul>
              <p className="mt-3 text-xs text-white/40">
                საჩუქარი გაგზავნა {data.gifts_sent} · მიიღო {data.gifts_received} · მოიწვია {data.invited}
              </p>
            </Panel>
          </>
        )}
      </aside>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------------------------------------
// Tables

function TablesTab() {
  const [status, setStatus] = useState("");
  const { data, error, loading, reload } = useRemote(() => admin<AdminTable[]>("admin_tables", { p_status: status || null }), `tables:${status}`);
  const [msg, setMsg] = useState<string | null>(null);
  const close = async (t: AdminTable) => {
    if (!window.confirm(`დავხუროთ მაგიდა ${t.code}? შედეგი არ ჩაიწერება.`)) return;
    try {
      await admin("admin_close_table", { p_table: t.id });
      setMsg(`${t.code} დაიხურა`);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {[["", "ყველა"], ["playing", "თამაშობს"], ["waiting", "ელოდება"], ["finished", "დასრულდა"], ["closed", "დახურული"]].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setStatus(v)} className={`rounded-xl border px-3 py-1.5 text-sm font-bold ${status === v ? "border-amber-300 bg-amber-300 text-black" : "border-white/15 text-white/70 hover:border-white/40"}`}>
            {l}
          </button>
        ))}
        <button className={SMALL} onClick={reload} disabled={loading}>
          განახლება
        </button>
      </div>
      <Failed error={error} />
      {msg && <p className="text-sm font-bold text-emerald-200">{msg}</p>}
      {!data ? (
        error ? null : <Loading />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <b className="text-lg font-extrabold">{GAMES[t.game] ?? t.game}</b>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/70">{t.kind}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.status === "playing" ? "bg-emerald-400/20 text-emerald-200" : t.status === "waiting" ? "bg-amber-300/20 text-amber-200" : "bg-white/10 text-white/50"}`}>{STATUS[t.status] ?? t.status}</span>
                </span>
                <span className="font-mono text-sm text-white/60">{t.code}</span>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {t.seats.map((s) => (
                  <li key={s.seat} className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.bot ? "bg-violet-400/15 text-violet-200" : "bg-white/10"}`}>
                    {s.nickname ?? "—"}
                    {s.bot ? " · ბოტი" : ""}
                  </li>
                ))}
                {t.seats.length === 0 && <li className="text-xs text-white/40">ცარიელია</li>}
              </ul>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">{ago(t.created_at)}</span>
                {(t.status === "playing" || t.status === "waiting") && (
                  <button className={`${SMALL} !border-red-400/50 !text-red-200`} onClick={() => void close(t)}>
                    დახურვა
                  </button>
                )}
              </div>
            </li>
          ))}
          {data.length === 0 && <li className="text-white/45">მაგიდები არ არის</li>}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Shop

function ShopTab() {
  const { data, error, loading, reload } = useRemote(() => admin<AdminShopItem[]>("admin_shop"), "shop");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const run = async (what: () => Promise<unknown>, done: string) => {
    try {
      await what();
      setMsg({ text: done, ok: true });
      reload();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/55">ფასს და ტიპს (მუდმივი / კვირის ექსკლუზივის წრე) ცვლიან უშუალოდ. ახალი ფასი მაშინვე მოქმედებს.</p>
        <button className={SMALL} onClick={reload} disabled={loading}>
          განახლება
        </button>
      </div>
      <Failed error={error} />
      {msg && <p className={`text-sm font-bold ${msg.ok ? "text-emerald-200" : "text-red-200"}`}>{msg.text}</p>}
      {!data ? (
        error ? null : <Loading />
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03]">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-4 py-3">ნივთი</th>
                <th className="px-3 py-3">სახეობა</th>
                <th className="px-3 py-3 text-right">მფლობელი</th>
                <th className="px-3 py-3">ტიპი</th>
                <th className="px-3 py-3">ფასი</th>
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-bold">{itemName(i.id)}</td>
                  <td className="px-3 py-2 text-white/60">{KINDS[i.kind] ?? i.kind}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.owners}</td>
                  <td className="px-3 py-2">
                    <button className={SMALL} onClick={() => void run(() => admin("admin_set_tier", { p_item: i.id, p_tier: i.tier === "permanent" ? "rotating" : "permanent" }), `${itemName(i.id)}: ${i.tier === "permanent" ? "კვირის წრეში" : "მუდმივი"}`)}>
                      {i.tier === "permanent" ? "მუდმივი" : "კვირის"}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <input className={`${FIELD} w-24 !py-1`} inputMode="numeric" placeholder={String(i.price)} value={prices[i.id] ?? ""} onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value.replace(/\D/g, "") })} />
                      <button className={SMALL} disabled={!prices[i.id] || Number(prices[i.id]) === i.price} onClick={() => void run(() => admin("admin_set_price", { p_item: i.id, p_price: Number(prices[i.id]) }).then(() => setPrices({ ...prices, [i.id]: "" })), `${itemName(i.id)}: ${prices[i.id]} მონეტა`)}>
                        შენახვა
                      </button>
                      <span className="text-xs text-white/40">ახლა: {i.price}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Chat and the log

function ChatTab() {
  const { data, error, loading, reload } = useRemote(() => admin<AdminMessage[]>("admin_chat", { p_limit: 100 }), "chat");
  const [msg, setMsg] = useState<string | null>(null);
  const remove = async (m: AdminMessage) => {
    try {
      await admin("admin_delete_message", { p_id: m.id });
      setMsg("შეტყობინება წაიშალა");
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button className={SMALL} onClick={reload} disabled={loading}>
          განახლება
        </button>
      </div>
      <Failed error={error} />
      {msg && <p className="text-sm font-bold text-emerald-200">{msg}</p>}
      {!data ? (
        error ? null : <Loading />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <b className="text-amber-200">{m.nickname ?? "?"}</b> <span className="break-words text-white/85">{m.body}</span>
                </p>
                <p className="mt-0.5 text-xs text-white/40">
                  {m.game ? GAMES[m.game] ?? m.game : ""} {m.table_code ? `· ${m.table_code}` : ""} · {when(m.created_at)}
                </p>
              </div>
              <button className={`${SMALL} flex-none`} onClick={() => void remove(m)}>
                წაშლა
              </button>
            </li>
          ))}
          {data.length === 0 && <li className="text-white/45">შეტყობინებები არ არის</li>}
        </ul>
      )}
    </div>
  );
}

function LogTab() {
  const { data, error, loading, reload } = useRemote(() => admin<AdminLogRow[]>("admin_log_list", { p_limit: 150 }), "log");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button className={SMALL} onClick={reload} disabled={loading}>
          განახლება
        </button>
      </div>
      <Failed error={error} />
      {!data ? (
        error ? null : <Loading />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm">
              <span>
                <b className="text-amber-200">{l.admin ?? "?"}</b> · {ACTIONS[l.action] ?? l.action}
                {l.target && <b> · {l.target}</b>}
                <span className="ml-2 text-xs text-white/45">{summary(l.detail)}</span>
              </span>
              <span className="text-xs text-white/40">{when(l.created_at)}</span>
            </li>
          ))}
          {data.length === 0 && <li className="text-white/45">ჟურნალი ცარიელია</li>}
        </ul>
      )}
    </div>
  );
}

function summary(d: Record<string, unknown>): string {
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "string" && v.length > 20 ? v.slice(0, 8) + "…" : String(v)}`)
    .join(" · ");
}
