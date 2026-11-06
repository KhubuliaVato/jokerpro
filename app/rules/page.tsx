import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { rise } from "@/components/ui";

const DESCRIPTION = "ჯოკერისა და ბურას წესები ქართულად: როგორ ვითამაშოთ, როგორ დავითვალოთ ქულები და რა რჩევები დაგეხმარება.";

export const metadata: Metadata = {
  title: "კარტის თამაშების წესები",
  description: DESCRIPTION,
  alternates: { canonical: "/rules" },
};

const GAMES = [
  { href: "/rules/joker", title: "ჯოკერის წესები", text: "დარიგება, კოზირი, ნათქვამი, ჯოკერის ორი რეჟიმი და ქულების დათვლა." },
  { href: "/rules/bura", title: "ბურას წესები", text: "ქულები, კოზირი, ბურა, მოლოტკა, ვარ და გამოძახებები: დავი, სე, ჩარი." },
];

export default function Rules() {
  return (
    <PageShell width="max-w-3xl">
      <section className="flex flex-col gap-2" style={rise(1)}>
        <h1 className="text-[clamp(1.8rem,9vw,2.4rem)] font-extrabold tracking-tight sm:text-5xl">წესები</h1>
        <p className="text-lg text-white/60">{DESCRIPTION}</p>
      </section>
      <ul className="grid gap-4 pb-10 sm:grid-cols-2" style={rise(2)}>
        {GAMES.map((g) => (
          <li key={g.href}>
            <Link href={g.href} className="flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-6 transition-colors hover:border-amber-300/50 hover:bg-white/[0.07]">
              <h2 className="text-xl font-extrabold">{g.title}</h2>
              <p className="text-base text-white/60">{g.text}</p>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
