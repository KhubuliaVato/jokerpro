/** A nickname in the style the player wears (a shop item); plain text without one. */
export function Nick({ name, style, className = "" }: { name: string; style?: string | null; className?: string }) {
  return <span className={`${style ? `nick-${style}` : ""} ${className}`}>{name}</span>;
}
