import { SiteHeader } from "./SiteHeader";
import { RISE_CSS, rise } from "./ui";

/** Common frame of the hub pages: calm green backdrop, header, and a centred column that rises in. */
export function PageShell({
  children,
  width = "max-w-3xl",
}: {
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_50%_-10%,#17623f,#0a2418_70%)]">
      <style>{RISE_CSS}</style>
      <div className={`relative mx-auto flex min-h-dvh w-full flex-col gap-10 px-5 py-6 sm:gap-14 sm:px-8 sm:py-8 ${width}`}>
        <div className="relative z-30" style={rise(0)}>
          <SiteHeader />
        </div>
        {children}
      </div>
    </main>
  );
}
