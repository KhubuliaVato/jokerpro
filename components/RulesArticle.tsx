import Link from "next/link";
import { PageShell } from "./PageShell";
import { rise } from "./ui";

export interface RulesSection {
  title: string;
  /** Paragraphs; a string starting with "- " lines is drawn as a list. */
  body: string[];
}

/** A rules page: plain, server-rendered text (good for search engines) with a button to play at the end. */
export function RulesArticle({
  title,
  intro,
  sections,
  play,
  faq,
}: {
  title: string;
  intro: string;
  sections: RulesSection[];
  play: { href: string; label: string };
  faq?: { q: string; a: string }[];
}) {
  const jsonLd = faq
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }
    : null;
  return (
    <PageShell width="max-w-3xl">
      <article className="flex flex-col gap-8 pb-10">
        <header className="flex flex-col gap-3" style={rise(1)}>
          <Link href="/rules" className="w-fit text-sm font-bold text-amber-300 underline underline-offset-4">
            ← წესები
          </Link>
          <h1 className="text-[clamp(1.8rem,8vw,2.4rem)] font-extrabold leading-tight tracking-tight sm:text-5xl">{title}</h1>
          <p className="text-lg leading-relaxed text-white/70">{intro}</p>
          <Link href={play.href} className="w-fit rounded-full bg-amber-300 px-6 py-3 text-base font-extrabold text-black transition-colors hover:bg-amber-200">
            {play.label}
          </Link>
        </header>

        {sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-3" style={rise(2)}>
            <h2 className="text-2xl font-extrabold text-amber-200">{s.title}</h2>
            {s.body.map((p, i) =>
              p.startsWith("- ") ? (
                <ul key={i} className="flex list-disc flex-col gap-1.5 pl-6 text-base leading-relaxed text-white/75">
                  {p.split("\n").map((line) => (
                    <li key={line}>{line.replace(/^- /, "")}</li>
                  ))}
                </ul>
              ) : (
                <p key={i} className="text-base leading-relaxed text-white/75">
                  {p}
                </p>
              ),
            )}
          </section>
        ))}

        {faq && (
          <section className="flex flex-col gap-4" style={rise(3)}>
            <h2 className="text-2xl font-extrabold text-amber-200">ხშირად დასმული კითხვები</h2>
            {faq.map((f) => (
              <div key={f.q} className="flex flex-col gap-1">
                <h3 className="text-lg font-extrabold">{f.q}</h3>
                <p className="text-base leading-relaxed text-white/75">{f.a}</p>
              </div>
            ))}
          </section>
        )}

        <div className="flex flex-col items-start gap-3 rounded-3xl border border-amber-300/30 bg-amber-300/[0.06] p-5">
          <p className="text-lg font-bold">მზად ხარ? ითამაშე ახლავე, რეგისტრაციის გარეშეც შეგიძლია ბოტებთან.</p>
          <Link href={play.href} className="rounded-full bg-amber-300 px-6 py-3 text-base font-extrabold text-black transition-colors hover:bg-amber-200">
            {play.label}
          </Link>
        </div>
      </article>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />}
    </PageShell>
  );
}
