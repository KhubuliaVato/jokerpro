"use client";

import { createContext, useContext } from "react";

/** Seats go clockwise: you at the bottom, then left, top and right. */
export const PLAYER_NAMES = ["თქვენ", "ლევანი", "ნინო", "მარიამი"];

export interface SeatAvatar {
  color?: string;
  icon?: string;
  url?: string | null;
}

const NamesContext = createContext<string[]>(PLAYER_NAMES);
const AvatarsContext = createContext<(SeatAvatar | null)[] | null>(null);

/**
 * Who sits where, in the order the table shows them (you first). Without a provider the table uses the
 * default bots; online games provide the real players' nicknames and photos.
 */
export function PlayerNamesProvider({
  names,
  avatars,
  children,
}: {
  names: string[];
  avatars?: (SeatAvatar | null)[];
  children: React.ReactNode;
}) {
  return (
    <NamesContext.Provider value={names}>
      <AvatarsContext.Provider value={avatars ?? null}>{children}</AvatarsContext.Provider>
    </NamesContext.Provider>
  );
}

export const usePlayerNames = () => useContext(NamesContext);
export const usePlayerAvatars = () => useContext(AvatarsContext);
