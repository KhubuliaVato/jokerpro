"use client";

import { EMOTE_PACKS } from "@/lib/cosmetics";
import { cardBack } from "@/lib/shop";
import { themeById } from "@/lib/themes";
import { Avatar } from "./Avatar";
import { BackPreview } from "./BackPreview";
import { CardView } from "./CardView";
import { Nick } from "./Nick";

const KING = { joker: false, suit: "H", rank: 13, id: "H13" } as const;

/** The picture of any shop item, small: a card back, a frame on an avatar, a name style, an effect, a background or an emote pack. */
export function ItemArt({ id, nickname, avatar }: { id: string; nickname?: string; avatar?: { color?: string; icon?: string; url?: string | null } }) {
  const theme = themeById(id);
  if (theme) {
    return <span className="block size-16 rounded-full ring-2 ring-white/25" style={{ background: `radial-gradient(circle at 30% 28%, #fff6, ${theme.color} 58%, #0006)` }} />;
  }
  if (cardBack(id)) return <BackPreview skin={id} accent={cardBack(id)?.accent} width="3.6rem" />;
  if (id.startsWith("f_")) return <Avatar size="lg" color={avatar?.color} icon={avatar?.icon} url={avatar?.url} frame={id} />;
  if (id.startsWith("n_")) return <span className="text-2xl font-extrabold"><Nick name={nickname ?? "ProJoker"} style={id} /></span>;
  if (id.startsWith("w_")) return <CardView card={KING} className={`fxw-${id}`} style={{ "--cw": "3.4rem" } as React.CSSProperties} />;
  if (id.startsWith("e_")) {
    const pack = EMOTE_PACKS.find((p) => `e_${p.id}` === id);
    return <span className="flex max-w-36 flex-wrap items-center justify-center gap-1 text-2xl">{(pack?.emotes.length ? pack.emotes : ["💬"]).slice(0, 6).join(" ")}</span>;
  }
  return <span className="text-4xl">🎁</span>;
}
