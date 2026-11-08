"use client";

import { createContext, useContext } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { tt } from "@/lib/i18n";

/** Seats go clockwise: you at the bottom, then left, top and right. */
export const PLAYER_NAMES: string[] = ["", "ლევანი", "ნინო", "მარიამი"];
// "You" follows the chosen language.
Object.defineProperty(PLAYER_NAMES, 0, { get: () => tt("თქვენ", "You", "Вы"), enumerable: true });

export interface SeatAvatar {
  color?: string;
  icon?: string;
  url?: string | null;
  /** The shop card back this player wears; their hidden cards are drawn with it. */
  back?: string | null;
  /** Their avatar frame, nickname style and win effect (shop items). */
  frame?: string | null;
  nick?: string | null;
  fx?: string | null;
  /** The effect of their cards landing on the table. */
  play?: string | null;
  /** Their joker card's look. */
  joker?: string | null;
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

/** The player's own seat in a game against bots: their nickname and photo when signed in, otherwise "თქვენ". */
export function useMe(): { name: string; avatar: SeatAvatar | null } {
  const { profile } = useAuth();
  if (!profile) return { name: tt("თქვენ", "You", "Вы"), avatar: null };
  return {
    name: profile.nickname,
    avatar: { color: profile.avatar_color, icon: profile.avatar_icon, url: profile.avatar_url, back: profile.equipped_back, frame: profile.equipped_frame, nick: profile.equipped_name, fx: profile.equipped_fx, play: profile.equipped_play, joker: profile.equipped_joker },
  };
}
