"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { act as actBura, type BuraAction, type BuraState } from "@/lib/bura/engine";
import type { BuraRules } from "@/lib/bura/online";
import type { GameState } from "@/lib/joker/engine";
import { applyAction, realSeat, type Action } from "@/lib/joker/online";
import { HAND_END_PAUSE, TRICK_PAUSE } from "@/lib/joker/useGame";
import { getSupabase } from "@/lib/supabase";
import { acceptMatch, callJoker, clockSkew, expireMatch, joinTable, leaveTable, pingTable, READY_SECONDS, type SeatRow, type TableRow, type ViewRow } from "./client";

export interface SeatProfile {
  id: string;
  nickname: string;
  avatar_color: string;
  avatar_icon: string;
  avatar_url: string | null;
}

/** Seconds the round result of Bura stays up before the next round is dealt. */
const ROUND_PAUSE = 6000;

/** A game of this table needs a decision from somebody (Joker: trump / bid / play; Bura: play). */
const needsMove = (v: GameState | BuraState) => ["trump", "bidding", "playing", "play", "call", "var"].includes(v.phase);

/** A little randomness so that four browsers do not all ask the server for the same thing at once. */
const jitter = (ms: number) => ms + Math.random() * 250;

/** Everything the screen of an online table needs, kept live through Realtime. */
export function useOnlineTable(code: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [table, setTable] = useState<TableRow | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [seatsLoaded, setSeatsLoaded] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, SeatProfile>>({});
  const [row, setRow] = useState<ViewRow | null>(null);
  const [optimistic, setOptimistic] = useState<{ version: number; view: ViewRow["view"] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [skew, setSkew] = useState(0);

  const tableId = table?.id ?? null;

  // 1. Sit down (or come back to) the table behind this code.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    let cancelled = false;
    joinTable(supabase, code).then(({ table: t, error: e }) => {
      if (cancelled) return;
      if (e) setError(e);
      else setTable(t);
    });
    return () => {
      cancelled = true;
    };
  }, [code, userId]);

  // 2. Load seats, profiles and my view, then follow all three live.
  const loadSeats = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !tableId) return;
    const { data } = await supabase.from("table_seats").select("seat, user_id, bot, accepted").eq("table_id", tableId).order("seat");
    const list = (data ?? []) as SeatRow[];
    setSeats(list);
    setSeatsLoaded(true);
    const missing = list.map((s) => s.user_id).filter((id) => !profiles[id]);
    if (missing.length > 0) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_color, avatar_icon, avatar_url")
        .in("id", missing);
      if (ps) setProfiles((prev) => ({ ...prev, ...Object.fromEntries((ps as SeatProfile[]).map((p) => [p.id, p])) }));
    }
  }, [tableId, profiles]);

  const loadTable = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !tableId) return;
    const { data } = await supabase.from("game_tables").select("id, code, host_id, game, kind, status, rules, ready_at").eq("id", tableId).maybeSingle();
    if (data) setTable(data as TableRow);
  }, [tableId]);

  const loadView = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !tableId) return;
    const { data } = await supabase
      .from("table_views")
      .select("version, seat, view, turn_deadline")
      .eq("table_id", tableId)
      .maybeSingle();
    if (data) setRow((prev) => (prev && prev.version >= (data as ViewRow).version ? prev : (data as ViewRow)));
  }, [tableId]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId) return;
    const first = setTimeout(() => {
      void loadSeats();
      void loadTable();
      void loadView();
    }, 0);
    const channel = supabase
      .channel(`table-${tableId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_seats", filter: `table_id=eq.${tableId}` }, () => void loadSeats())
      .on("postgres_changes", { event: "*", schema: "public", table: "game_tables", filter: `id=eq.${tableId}` }, () => void loadTable())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "table_views", filter: `table_id=eq.${tableId}` },
        (payload) => {
          const next = payload.new as ViewRow | undefined;
          if (next?.view) setRow((prev) => (prev && prev.version >= next.version ? prev : next));
        },
      )
      .subscribe();
    // Realtime is the fast path; this slow poll only repairs a missed message.
    const poll = setInterval(() => {
      void loadView();
      void loadTable();
      void loadSeats();
    }, 5000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
    // loadSeats depends on `profiles`; re-subscribing on each profile load would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const mySeat = seats.find((s) => s.user_id === userId);
  const capacity = table?.game === "bura" ? (table.rules as BuraRules).players : 4;
  const full = seats.length === capacity;
  const status = table?.status ?? null;
  // Lost the seat in a ready check that I did not accept in time.
  const kicked = !!table && table.kind !== "private" && table.status === "waiting" && seatsLoaded && !mySeat;

  // While waiting at a table of random players, keep telling the server we are still here.
  const waitingPublic = !!table && table.status === "waiting" && table.kind !== "private";
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || !waitingPublic) return;
    const ping = () => void pingTable(supabase, tableId);
    ping();
    const id = setInterval(ping, 10000);
    return () => clearInterval(id);
  }, [tableId, waitingPublic]);

  // 3. Four players seated. Private table: the game begins. Table of random players: everyone must accept first
  // (READY_SECONDS), and the game begins once all four did. The server ignores duplicate requests.
  const isPublic = !!table && table.kind !== "private";
  const allAccepted = full && seats.every((x) => x.accepted);
  const readyAt = table?.ready_at ? Date.parse(table.ready_at) : null;
  const started = useRef(false);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || status !== "waiting" || !full || started.current) return;
    if (isPublic && !allAccepted) return;
    started.current = true;
    const t = setTimeout(() => {
      void callJoker(supabase, { action: "start", table_id: tableId }).then((e) => {
        if (e) {
          started.current = false;
          setError(e);
        }
      });
    }, jitter(600));
    return () => clearTimeout(t);
  }, [tableId, status, full, isPublic, allAccepted]);

  const accept = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase || !tableId) return;
    setSeats((prev) => prev.map((x) => (x.user_id === userId ? { ...x, accepted: true } : x)));
    await acceptMatch(supabase, tableId);
  }, [tableId, userId]);

  // The ready check's clock; when it runs out, those who did not accept lose their seats.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !isPublic) return;
    let cancelled = false;
    clockSkew(supabase).then((ms) => {
      if (!cancelled) setSkew(ms);
    });
    return () => {
      cancelled = true;
    };
  }, [isPublic]);

  const checking = isPublic && status === "waiting" && full && readyAt !== null && !allAccepted;
  useEffect(() => {
    if (!checking) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [checking]);
  const readyLeft = checking && readyAt !== null ? Math.max(0, Math.ceil((readyAt + READY_SECONDS * 1000 - (now + skew)) / 1000)) : null;
  const expired = readyLeft === 0;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || !expired) return;
    const t = setTimeout(() => void expireMatch(supabase, tableId), jitter(1200));
    const again = setInterval(() => void expireMatch(supabase, tableId), 4000);
    return () => {
      clearTimeout(t);
      clearInterval(again);
    };
  }, [tableId, expired]);

  const view = optimistic && row && optimistic.version === row.version ? optimistic.view : (row?.view ?? null);
  const version = row?.version ?? 0;

  // 4. Finished tricks and hands: after the pause that lets everyone see them, ask the server to move on.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || !row) return;
    const phase = row.view.phase;
    if (phase !== "trickEnd" && phase !== "handEnd" && phase !== "roundEnd") return;
    const t = setTimeout(
      () => void callJoker(supabase, { action: "advance", table_id: tableId, version: row.version }),
      jitter(phase === "trickEnd" ? TRICK_PAUSE : phase === "roundEnd" ? ROUND_PAUSE : HAND_END_PAUSE),
    );
    return () => clearTimeout(t);
  }, [tableId, row]);

  // 5. A bot's turn, or a player's timer ran out: the server plays for them when asked.
  const realTurn = row
    ? table?.game === "bura"
      ? (row.view.turn + row.seat) % capacity
      : realSeat(row.view.turn, row.seat)
    : -1;
  const turnIsBot = seats.find((s) => s.seat === realTurn)?.bot ?? false;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || !row || !needsMove(row.view)) return;
    const deadline = row.turn_deadline ? Date.parse(row.turn_deadline) : null;
    const wait = turnIsBot ? 700 : deadline ? Math.max(0, deadline - Date.now()) + 1600 : null;
    if (wait === null) return;
    const t = setTimeout(() => void callJoker(supabase, { action: "tick", table_id: tableId }), jitter(wait));
    return () => clearTimeout(t);
  }, [tableId, row, turnIsBot]);

  // Countdown shown on my own turn.
  const myDecision = !!row && needsMove(row.view) && row.view.turn === 0;
  useEffect(() => {
    if (!myDecision) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [myDecision]);
  const secondsLeft =
    myDecision && row?.turn_deadline
      ? Math.max(0, Math.ceil((Date.parse(row.turn_deadline) - now) / 1000))
      : null;

  // Moves are shown at once (the server confirms a moment later, or the screen snaps back with a message).
  const act = useCallback(
    async (action: Action) => {
      const supabase = getSupabase();
      if (!supabase || !tableId || !row) return;
      try {
        setOptimistic({ version: row.version, view: applyAction(row.view as GameState, 0, action) });
      } catch {
        // not predictable locally: wait for the server
      }
      const err = await callJoker(supabase, { action: "move", table_id: tableId, move: action });
      if (err) {
        setOptimistic(null);
        setNotice(err);
        setTimeout(() => setNotice(null), 3500);
        void loadView();
      }
    },
    [tableId, row, loadView],
  );

  /** Bura: cards, a call, an answer to a call or "var". */
  const buraAct = useCallback(
    async (action: BuraAction) => {
      const supabase = getSupabase();
      if (!supabase || !tableId || !row) return;
      // (saying "var" or going on changes what is drawn, which only the server knows)
      if (action.type !== "var") {
        try {
          setOptimistic({ version: row.version, view: actBura(row.view as BuraState, action) });
        } catch {
          return;
        }
      }
      const err = await callJoker(supabase, { action: "move", table_id: tableId, move: action });
      if (err) {
        setOptimistic(null);
        setNotice(err);
        setTimeout(() => setNotice(null), 3500);
        void loadView();
      }
    },
    [tableId, row, loadView],
  );
  const playCards = useCallback((ids: string[]) => buraAct({ type: "play", ids }), [buraAct]);

  const leave = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase && tableId) await leaveTable(supabase, tableId);
  }, [tableId]);

  // Players in the order the screen shows them: me first, then clockwise.
  const players = useMemo(() => {
    const me = mySeat?.seat ?? 0;
    return Array.from({ length: capacity }, (_, k) => {
      const seat = seats.find((s) => s.seat === (me + k) % capacity);
      return seat ? { ...seat, profile: profiles[seat.user_id] ?? null } : null;
    });
  }, [seats, profiles, mySeat, capacity]);

  return {
    table,
    seats,
    players,
    mySeat: mySeat ?? null,
    isHost: !!table && table.host_id === userId,
    view,
    version,
    secondsLeft,
    readyLeft,
    kicked,
    accept,
    error,
    notice,
    act,
    playCards,
    buraAct,
    capacity,
    leave,
  };
}
