"use client";

import { motionOff } from "@/lib/motion";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { THEMES } from "@/lib/themes";

/** A tiny site window that tries on every background in turn, so the shop can show what they look like. */
export function ThemeShowcase() {
  const t = useT();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (motionOff()) return;
    const id = setInterval(() => setI((n) => (n + 1) % THEMES.length), 2400);
    return () => clearInterval(id);
  }, []);

  const current = THEMES[i];
  return (
    <div className="relative w-full max-w-[17rem]">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl ring-1 ring-white/25 shadow-[0_20px_40px_-18px_rgb(0_0_0/0.9)] transition-transform duration-500 [transform:perspective(700px)_rotateX(6deg)] group-hover:[transform:perspective(700px)_rotateX(0deg)_scale(1.04)]">
        {THEMES.map((th, k) => (
          <div
            key={th.id}
            aria-hidden
            className="absolute inset-0 transition-opacity duration-1000"
            style={{
              opacity: k === i ? 1 : 0,
              background: `radial-gradient(ellipse at 50% -10%, color-mix(in srgb, ${th.color} 65%, white), ${th.color} 50%, color-mix(in srgb, ${th.color} 50%, #05030a) 100%)`,
            }}
          >
            {"fx" in th && <div className={`theme-fx fx-${th.id}`} />}
          </div>
        ))}

        {/* the page drawn on top: a header and three boxes */}
        <div className="absolute inset-0 flex flex-col gap-2 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="size-3.5 rounded bg-white/90" />
            <span className="h-2 w-10 rounded-full bg-white/80" />
            <span className="ml-1 h-3 w-8 rounded-full bg-white/20" />
            <span className="h-3 w-8 rounded-full bg-white/20" />
            <span className="ml-auto size-3.5 rounded-full bg-amber-300" />
          </div>
          <div className="mt-1 grid flex-1 grid-cols-3 gap-1.5">
            {[0, 1, 2].map((n) => (
              <div
                key={n}
                className="flex flex-col justify-end gap-1 rounded-lg border border-white/20 bg-white/10 p-1.5 backdrop-blur-[1px]"
              >
                <span className="h-1.5 w-2/3 rounded-full bg-white/70" />
                <span className="h-3 rounded-full bg-amber-300/90" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/65 px-3 py-1 text-xs font-extrabold text-white/90 ring-1 ring-white/20">
        {t(current.name[0], current.name[1], current.name[2])}
      </span>
    </div>
  );
}
