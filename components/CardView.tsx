import { tt } from "@/lib/lang";
import { CardFace } from "./CardFace";
import {
  isRed,
  rankLabel,
  SUIT_SYMBOL,
  type Card,
} from "@/lib/joker/cards";

interface Props {
  card?: Card;
  size?: "md" | "sm" | "xs" | "opp";
  className?: string;
  style?: React.CSSProperties;
}

/** A card face, or a card back when no card is given. */
export function CardView({ card, size = "md", className = "", style }: Props) {
  const sizeClass = size === "md" ? "" : size;
  if (!card) {
    return (
      <div className={`pc back ${sizeClass} ${className}`} style={style} />
    );
  }
  if (card.joker) {
    return (
      <div
        className={`pc joker ${sizeClass} ${className}`}
        style={style}
        aria-label={tt("ჯოკერი", "Joker", "Джокер")}
      />
    );
  }
  return (
    <div
      className={`pc ${isRed(card.suit) ? "red" : ""} ${sizeClass} ${className}`}
      style={style}
      aria-label={`${rankLabel(card.rank)} ${SUIT_SYMBOL[card.suit]}`}
    >
      <CardFace card={card} />
    </div>
  );
}
