"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isActivePhase, applyAction, realSeat, type Action } from "@/lib/joker/online";
import { HAND_END_PAUSE, TRICK_PAUSE } from "@/lib/joker/useGame";
import { getSupabase } from "@/lib/supabase";
import { callJoker, joinTable, leaveTable, pingTable, type SeatRow, type TableRow, type ViewRow } from "./client";

export interface SeatProfile {
  id: string;
  nickname: string;
  avatar_color: string;
  avatar_icon: string;
  avatar_url: string | null;
}

/** A little randomness so that four browsers do not all ask the server for the same thing at once. */
const jitter = (ms: number) => ms + Math.random() * 250;

/** Everything the screen of an online table needs, kept live through Realtime. */
export function useOnlineTable(code: string) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [table, setTable] = useState<TableRow | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SeatProfile>>({});
  const [row, setRow] = useState<ViewRow | null>(null);
  const [optimistic, setOptimistic] = useState<{ version: number; view: ViewRow["view"] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

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
    const { data } = await supabase.from("table_seats").select("seat, user_id, bot").eq("table_id", tableId).order("seat");
    const list = (data ?? []) as SeatRow[];
    setSeats(list);
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
    const { data } = await supabase.from("game_tables").select("id, code, host_id, kind, status, rules").eq("id", tableId).maybeSingle();
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
  const full = seats.length === 4;
  const status = table?.status ?? null;

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

  // 3. Four players seated: the game begins (the server ignores duplicate requests).
  const started = useRef(false);
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || status !== "waiting" || !full || started.current) return;
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
  }, [tableId, status, full]);

  const view = optimistic && row && optimistic.version === row.version ? optimistic.view : (row?.view ?? null);
  const version = row?.version ?? 0;

  // 4. Finished tricks and hands: after the pause that lets everyone see them, ask the server to move on.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || !row) return;
    const phase = row.view.phase;
    if (phase !== "trickEnd" && phase !== "handEnd") return;
    const t = setTimeout(
      () => void callJoker(supabase, { action: "advance", table_id: tableId, version: row.version }),
      jitter(phase === "trickEnd" ? TRICK_PAUSE : HAND_END_PAUSE),
    );
    return () => clearTimeout(t);
  }, [tableId, row]);

  // 5. A bot's turn, or a player's timer ran out: the server plays for them when asked.
  const realTurn = row ? realSeat(row.view.turn, row.seat) : -1;
  const turnIsBot = seats.find((s) => s.seat === realTurn)?.bot ?? false;
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !tableId || !row || !isActivePhase(row.view)) return;
    const deadline = row.turn_deadline ? Date.parse(row.turn_deadline) : null;
    const wait = turnIsBot ? 700 : deadline ? Math.max(0, deadline - Date.now()) + 1600 : null;
    if (wait === null) return;
    const t = setTimeout(() => void callJoker(supabase, { action: "tick", table_id: tableId }), jitter(wait));
    return () => clearTimeout(t);
  }, [tableId, row, turnIsBot]);

  // Countdown shown on my own turn.
  const myDecision = !!row && isActivePhase(row.view) && row.view.turn === 0;
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
        setOptimistic({ version: row.version, view: applyAction(row.view, 0, action) });
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

  const leave = useCallback(async () => {
    const supabase = getSupabase();
    if (supabase && tableId) await leaveTable(supabase, tableId);
  }, [tableId]);

  // Players in the order the screen shows them: me first, then clockwise.
  const players = useMemo(() => {
    const me = mySeat?.seat ?? 0;
    return [0, 1, 2, 3].map((k) => {
      const seat = seats.find((s) => s.seat === (me + k) % 4);
      return seat ? { ...seat, profile: profiles[seat.user_id] ?? null } : null;
    });
  }, [seats, profiles, mySeat]);

  return {
    table,
    seats,
    players,
    mySeat: mySeat ?? null,
    isHost: !!table && table.host_id === userId,
    view,
    version,
    secondsLeft,
    error,
    notice,
    act,
    leave,
  };
}
