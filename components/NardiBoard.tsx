"use client";

import { BAR, CHECKERS, type NardiState, type Step } from "@/lib/nardi/engine";

const W = 596;
const H = 760;
const X0 = 20;
const COL = 40;
const BAR_W = 36;
const TOP = 30;
const BOTTOM = 730;
const TRI = 300;
const R = 17;
const TRAY_X = 546;

/** Left edge of one of the 12 columns; the bar sits between the sixth and the seventh. */
const colX = (c: number) => X0 + c * COL + (c >= 6 ? BAR_W : 0);
const BAR_X = X0 + 6 * COL;

/** Where a board point (white's own number) sits: the top row runs 13..24, the bottom row 12..1, left to right. */
function column(abs: number): { x: number; top: boolean } {
  return abs >= 13 ? { x: colX(abs - 13), top: true } : { x: colX(12 - abs), top: false };
}

/** The board point of a player's own number (white: the same; black runs the other way). */
const absOf = (rel: number, player: 0 | 1) => (player === 0 ? rel : 25 - rel);

function Checker({ cx, cy, side, glow }: { cx: number; cy: number; side: 0 | 1; glow?: boolean }) {
  return (
    <g>
      {glow && <circle cx={cx} cy={cy} r={R + 5} fill="none" stroke="#fcd34d" strokeWidth="3" className="nd-pulse" />}
      <circle cx={cx} cy={cy + 1.5} r={R} fill="#000" opacity="0.35" />
      <circle cx={cx} cy={cy} r={R} fill={side === 0 ? "url(#nd-white)" : "url(#nd-black)"} stroke={side === 0 ? "#b9ad92" : "#000"} strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={R - 6} fill="none" stroke={side === 0 ? "#cfc4aa" : "#4a4a55"} strokeWidth="1.5" />
    </g>
  );
}

/**
 * The board. The human is white and travels 24 → 13 along the top row to the left, then 12 → 1 along
 * the bottom row to the right (home is the bottom right). Tap one of your checkers, then a lit point
 * (or the tray) to move it. A hit checker waits on the bar in the middle.
 */
export function NardiBoard({
  game,
  steps,
  selected,
  onSelect,
  onMove,
  lastStep,
}: {
  game: NardiState;
  /** The human's legal moves right now (empty when it is not their turn to move). */
  steps: Step[];
  selected: number | null;
  onSelect: (from: number | null) => void;
  onMove: (st: Step) => void;
  lastStep: { by: 0 | 1; step: Step } | null;
}) {
  const sources = new Set(steps.map((s) => s.from));
  const targets = selected === null ? [] : steps.filter((s) => s.from === selected);
  const targetAbs = new Map(targets.map((s) => [s.to, s]));
  const offStep = targetAbs.get(0);
  const lastFrom = lastStep && lastStep.step.from !== BAR ? absOf(lastStep.step.from, lastStep.by) : null;
  const lastTo = lastStep && lastStep.step.to > 0 ? absOf(lastStep.step.to, lastStep.by) : null;

  const tapPoint = (rel: number) => {
    const target = targetAbs.get(rel);
    if (target) return onMove(target);
    if (sources.has(rel)) {
      if (selected === rel && targets.length === 1) return onMove(targets[0]);
      return onSelect(selected === rel ? null : rel);
    }
    onSelect(null);
  };

  const points = [];
  for (let abs = 1; abs <= 24; abs++) {
    const { x, top } = column(abs);
    const v = game.points[abs - 1];
    const n = Math.abs(v);
    const side: 0 | 1 = v > 0 ? 0 : 1;
    const baseY = top ? TOP : BOTTOM;
    const tipY = top ? TOP + TRI : BOTTOM - TRI;
    const shape = `${x + 2},${baseY} ${x + COL - 2},${baseY} ${x + COL / 2},${tipY}`;
    const isTarget = targetAbs.has(abs);
    const isSource = sources.has(abs);
    const spacing = n > 1 ? Math.min(2 * R, (TRI - 2 * R) / (n - 1)) : 0;
    points.push(
      <g key={abs} onClick={() => tapPoint(abs)} className={isTarget || isSource ? "cursor-pointer" : undefined}>
        <polygon points={shape} fill={abs % 2 === 0 ? "#8b3a2f" : "#d9b878"} opacity="0.95" />
        {(abs === lastFrom || abs === lastTo) && <polygon points={shape} fill="#fcd34d" opacity="0.28" />}
        {selected === abs && <polygon points={shape} fill="none" stroke="#fcd34d" strokeWidth="3" />}
        {isTarget && (
          <>
            <polygon points={shape} fill="#34d399" opacity="0.32" />
            <circle cx={x + COL / 2} cy={top ? tipY - 16 : tipY + 16} r="9" fill="#34d399" stroke="#064e3b" strokeWidth="2" />
          </>
        )}
        {/* a generous tap area over the whole half-column */}
        <rect x={x} y={top ? TOP : BOTTOM - TRI - 30} width={COL} height={TRI + 30} fill="transparent" />
        {Array.from({ length: n }, (_, k) => (
          <Checker
            key={k}
            cx={x + COL / 2}
            cy={top ? baseY + R + k * spacing : baseY - R - k * spacing}
            side={side}
            glow={side === 0 && k === n - 1 && isSource && selected === null}
          />
        ))}
      </g>,
    );
  }

  const barCheckers = (side: 0 | 1) =>
    // white waits below the middle strip, black above it
    Array.from({ length: game.bar[side] }, (_, k) => (
      <Checker
        key={k}
        cx={BAR_X + BAR_W / 2}
        cy={side === 0 ? H / 2 + 62 + k * 36 : H / 2 - 62 - k * 36}
        side={side}
        glow={side === 0 && k === game.bar[0] - 1 && sources.has(BAR) && selected === null}
      />
    ));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-manipulation select-none" role="img" aria-label="Nardi board">
      <defs>
        <radialGradient id="nd-white" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9cfb8" />
        </radialGradient>
        <radialGradient id="nd-black" cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#5a5a66" />
          <stop offset="1" stopColor="#15151a" />
        </radialGradient>
        <linearGradient id="nd-felt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12362a" />
          <stop offset="1" stopColor="#0b2219" />
        </linearGradient>
        <style>{`@keyframes nd-pulse{0%,100%{opacity:.35}50%{opacity:1}}.nd-pulse{animation:nd-pulse 1.4s ease-in-out infinite}`}</style>
      </defs>
      <rect x="2" y="2" width={W - 4} height={H - 4} rx="26" fill="#6b4423" stroke="#3b2411" strokeWidth="4" />
      <rect x={X0 - 6} y={TOP - 8} width={12 * COL + BAR_W + 12} height={BOTTOM - TOP + 16} rx="10" fill="url(#nd-felt)" />
      {points}
      {/* the middle strip (dice go here) and the bar */}
      <rect x={X0 - 6} y={TOP + TRI + 8} width={12 * COL + BAR_W + 12} height={BOTTOM - TOP - 2 * TRI - 16} fill="#0a1d15" opacity="0.7" />
      <g onClick={() => sources.has(BAR) && tapPoint(BAR)} className={sources.has(BAR) ? "cursor-pointer" : undefined}>
        <rect x={BAR_X} y={TOP - 8} width={BAR_W} height={BOTTOM - TOP + 16} fill="#6b4423" />
        {barCheckers(1)}
        {barCheckers(0)}
        {sources.has(BAR) && <rect x={BAR_X} y={H / 2} width={BAR_W} height={H / 2 - 20} fill="transparent" />}
      </g>

      {/* trays: black's checkers off at the top, white's at the bottom */}
      {([1, 0] as const).map((side) => {
        const y = side === 1 ? TOP - 8 : H / 2 + 10;
        const h = H / 2 - 22;
        const n = game.off[side];
        const lit = side === 0 && !!offStep;
        return (
          <g key={side} onClick={() => lit && offStep && onMove(offStep)} className={lit ? "cursor-pointer" : undefined}>
            <rect x={TRAY_X} y={y} width="38" height={h} rx="8" fill="#0b2219" stroke={lit ? "#34d399" : "#3b2411"} strokeWidth={lit ? 3 : 2} />
            {lit && <rect x={TRAY_X} y={y} width="38" height={h} rx="8" fill="#34d399" opacity="0.2" />}
            {Array.from({ length: n }, (_, k) => (
              <rect
                key={k}
                x={TRAY_X + 4}
                y={side === 1 ? y + 4 + k * ((h - 8) / CHECKERS) : y + h - 4 - (k + 1) * ((h - 8) / CHECKERS) + 1}
                width="30"
                height={(h - 8) / CHECKERS - 2}
                rx="3"
                fill={side === 0 ? "#f5efe0" : "#26262c"}
                stroke={side === 0 ? "#b9ad92" : "#000"}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
