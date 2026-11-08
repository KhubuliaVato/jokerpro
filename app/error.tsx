"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/errorReport";
import { BTN_PRIMARY } from "@/components/ui";

/** What the player sees when a page breaks: a way back, and the error goes to the log. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const e = error instanceof Error ? error : new Error(String(error));
    reportError(`page: ${e.message}`, { stack: e.stack?.slice(0, 1500), digest: (e as { digest?: string }).digest });
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[#1a0a10] p-6 text-center text-white">
      <div className="flex max-w-md flex-col items-center gap-4">
        <h1 className="text-3xl font-extrabold">რაღაც არ გამოვიდა</h1>
        <p className="text-white/65">გვერდზე შეცდომა მოხდა და ჩვენთან უკვე ჩაიწერა. სცადეთ ისევ, ან დაბრუნდით მთავარზე.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className={`${BTN_PRIMARY} !px-6 !py-2.5 !text-base`} onClick={() => retry()}>
            ისევ ცდა
          </button>
          <Link href="/" className="rounded-full border border-white/20 px-6 py-2.5 font-bold text-white/80 hover:border-amber-300 hover:text-amber-300">
            მთავარი
          </Link>
        </div>
      </div>
    </main>
  );
}
