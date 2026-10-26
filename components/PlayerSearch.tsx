"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { searchPlayers, type PlayerSummary } from "@/lib/search";
import { getSupabase } from "@/lib/supabase";
import { Avatar } from "./Avatar";
import { INPUT } from "./ui";

const SUGGESTIONS = 5;

/** The exact (case-insensitive) match if there is one, otherwise the first result. */
function pick(players: PlayerSummary[], query: string): PlayerSummary | undefined {
  const q = query.trim().toLowerCase();
  return players.find((p) => p.nickname.toLowerCase() === q) ?? players[0];
}

/** Type a nickname and press Enter (or click a suggestion) to open that player's page. */
export function PlayerSearch() {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlayerSummary[]>([]);
  /** The text the current suggestions were fetched for. */
  const [forQuery, setForQuery] = useState("");
  const [active, setActive] = useState(0);
  /** The query for which nobody was found (so the message disappears by itself when the text changes). */
  const [notFoundFor, setNotFoundFor] = useState<string | null>(null);
  const notFound = notFoundFor !== null && notFoundFor === query.trim();

  const open = (p: PlayerSummary) => router.push(p.id === user?.id ? "/profile" : `/players/${p.id}`);

  // Suggestions appear only while something is typed.
  useEffect(() => {
    const supabase = getSupabase();
    const q = query.trim();
    if (!supabase || !q) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { players } = await searchPlayers(supabase, q, SUGGESTIONS);
      if (cancelled) return;
      setSuggestions(players);
      setForQuery(q);
      setActive(Math.max(0, players.indexOf(pick(players, q) as PlayerSummary)));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getSupabase();
    const q = query.trim();
    if (!supabase || !q) return;
    // Ask again so pressing Enter right after typing never acts on stale suggestions.
    const { players } = await searchPlayers(supabase, q, SUGGESTIONS);
    const target = pick(players, q);
    if (target) open(target);
    else setNotFoundFor(q);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Stale suggestions are ignored: Enter then falls through to the form, which searches afresh.
    if (suggestions.length === 0 || forQuery !== query.trim()) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      // Enter opens the highlighted suggestion.
      e.preventDefault();
      open(suggestions[active]);
    }
  };

  return (
    <form onSubmit={submit} className="relative" role="search">
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-5 top-[1.9rem] size-5 -translate-y-1/2 text-white/40"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        className={`${INPUT} !pl-14`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="მოთამაშის სახელი"
        aria-label="მოთამაშის ძებნა"
        autoComplete="off"
        maxLength={32}
      />

      {((query.trim() && suggestions.length > 0) || notFound) && (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-2xl border border-white/15 bg-[#0d2a1e] shadow-[0_20px_40px_-10px_rgb(0_0_0/0.6)]">
          {notFound ? (
            <li className="px-5 py-4 text-white/50">მოთამაშე ვერ მოიძებნა</li>
          ) : (
            suggestions.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => open(p)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === active ? "bg-white/10" : ""
                  }`}
                >
                  <Avatar size="sm" color={p.avatar_color} icon={p.avatar_icon} url={p.avatar_url} />
                  <span className="min-w-0 flex-1 truncate text-lg font-bold">{p.nickname}</span>
                  {p.id === user?.id && <span className="text-sm font-semibold text-amber-300">თქვენ</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </form>
  );
}
