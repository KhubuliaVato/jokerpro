import Link from "next/link";

/** The ProJoker mark: an ace of spades and a joker fanned together. */
export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-joker" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1d6" />
          <stop offset="0.55" stopColor="#f0d9ff" />
          <stop offset="1" stopColor="#cfe0ff" />
        </linearGradient>
      </defs>
      <g transform="rotate(-15 15 22)">
        <rect x="5" y="6" width="17" height="25" rx="3.2" fill="#fbf8ef" stroke="rgb(0 0 0 / 0.15)" strokeWidth="0.6" />
        <path
          d="M13.5 12.5c-2.7 2.6-4.4 4.3-4.4 6.4a2.3 2.3 0 0 0 4.1 1.4c-.2 1.3-.7 2.2-1.5 2.8h3.6c-.8-.6-1.3-1.5-1.5-2.8a2.3 2.3 0 0 0 4.1-1.4c0-2.1-1.7-3.8-4.4-6.4z"
          fill="#15251d"
        />
      </g>
      <g transform="rotate(13 25 22)">
        <rect x="16" y="7" width="17" height="25" rx="3.2" fill="url(#logo-joker)" stroke="rgb(0 0 0 / 0.15)" strokeWidth="0.6" />
        <path
          d="m24.5 12 1.9 4.2 4.6.5-3.4 3.1 1 4.5-4.1-2.3-4.1 2.3 1-4.5-3.4-3.1 4.6-.5z"
          fill="#6b2fa8"
        />
      </g>
    </svg>
  );
}

/** Mark plus the "ProJoker" wordmark, linking home. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <Link href="/" aria-label="ProJoker" className="group inline-flex items-center gap-2 outline-none min-[380px]:gap-3">
      <LogoMark className={`${big ? "size-14" : "size-9 min-[380px]:size-11 sm:size-12"} drop-shadow-[0_3px_10px_rgb(232_196_106/0.4)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110`} />
      <span className={`font-black leading-none tracking-tight ${big ? "text-5xl" : "text-2xl min-[380px]:text-3xl sm:text-4xl"}`}>
        <span className="text-white">Pro</span>
        <span className="bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-transparent">Joker</span>
      </span>
    </Link>
  );
}
