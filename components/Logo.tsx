import Link from "next/link";

/** The ProJoker mark: a winking jester on a card, in a gold and red ribbon. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.webp" alt="" width={192} height={181} className={`${className} object-contain`} draggable={false} />;
}

/** Mark plus the "ProJoker" wordmark, linking home. */
export function Logo({ size = "md", hideWordOnPhones = false }: { size?: "md" | "lg"; hideWordOnPhones?: boolean }) {
  const big = size === "lg";
  return (
    <Link href="/" aria-label="ProJoker" className="group inline-flex items-center gap-2 outline-none min-[380px]:gap-3">
      <LogoMark className={`${big ? "size-14" : "size-9 min-[380px]:size-11 sm:size-12"} drop-shadow-[0_3px_10px_rgb(232_196_106/0.4)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`} />
      <span className={`font-black leading-none tracking-tight ${hideWordOnPhones ? "max-[419px]:hidden" : ""} ${big ? "text-5xl" : "text-2xl min-[380px]:text-3xl sm:text-4xl"}`}>
        <span className="text-white">Pro</span>
        <span className="bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-transparent">Joker</span>
      </span>
    </Link>
  );
}
