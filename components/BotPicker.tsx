"use client";

import { BOTS, botById, randomBots, TIER_LABEL, type BotProfile, type BotTier } from "@/lib/joker/botProfiles";
import { Avatar } from "./Avatar";
import { LABEL } from "./RulesForm";

const TIERS: BotTier[] = ["easy", "medium", "hard"];
const DOTS: Record<BotTier, number> = { easy: 1, medium: 2, hard: 3 };

/** Choose the three opponents: nine bots on three levels, each with a face and a way of playing. */
export function BotPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    // A fourth pick replaces the oldest one, so three are always possible with a single click.
    else onChange([...selected, id].slice(-3));
  };

  return (
    <fieldset>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <legend className={`${LABEL} !mb-0`}>
          ოპონენტები <span className="ml-2 text-amber-300">{selected.length}/3</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["შემთხვევითი", () => onChange(randomBots())],
              ["მარტივი", () => onChange(randomBots("easy"))],
              ["ძლიერი", () => onChange(randomBots("hard"))],
            ] as const
          ).map(([label, pick]) => (
            <button
              key={label}
              type="button"
              onClick={pick}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-bold text-white/70 transition-colors hover:border-amber-300 hover:text-amber-300"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {TIERS.map((tier) => (
          <div key={tier}>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white/60">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`size-2 rounded-full ${i < DOTS[tier] ? "bg-amber-300" : "bg-white/15"}`}
                  />
                ))}
              </span>
              {TIER_LABEL[tier]}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {BOTS.filter((b) => b.tier === tier).map((b) => (
                <BotCard key={b.id} bot={b} on={selected.includes(b.id)} onClick={() => toggle(b.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function BotCard({ bot, on, onClick }: { bot: BotProfile; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-[border-color,background-color,translate] duration-200 hover:-translate-y-0.5 ${
        on ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-white/[0.03] hover:border-white/30"
      }`}
    >
      <Avatar size="md" color={bot.color} icon={bot.icon} />
      <span className="min-w-0 flex-1">
        <b className="block text-lg">{bot.name}</b>
        <span className="block text-sm leading-snug text-white/50">{bot.trait}</span>
      </span>
      {on && (
        <span className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-amber-300 text-sm font-black text-black">
          ✓
        </span>
      )}
    </button>
  );
}

export { botById };
