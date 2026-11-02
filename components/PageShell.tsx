import { SiteHeader } from "./SiteHeader";
import { ThemeFx } from "./ThemeFx";
import { RISE_CSS, rise } from "./ui";

/** Common frame of the hub pages: calm green backdrop, header, and a centred column that rises in. */
export function PageShell({
  children,
  width = "max-w-3xl",
  glow,
}: {
  children: React.ReactNode;
  width?: string;
  /** A colour that tints the top of the page, e.g. the accent of a game. */
  glow?: string;
}) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[radial-gradient(ellipse_at_50%_-10%,var(--bg-a),var(--bg-b)_70%)]">
      <style>{RISE_CSS}</style>
      <ThemeFx />
      {glow && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] transition-[background] duration-500"
          style={{ background: `radial-gradient(ellipse 60% 100% at 50% 0%, ${glow}30, transparent)` }}
        />
      )}
      <div className={`relative mx-auto flex min-h-dvh w-full flex-col gap-10 px-5 py-6 sm:gap-14 sm:px-8 sm:py-8 ${width}`}>
        <div className="relative z-30" style={rise(0)}>
          <SiteHeader />
        </div>
        {children}
      </div>
    </main>
  );
}
