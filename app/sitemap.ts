import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://projoker.netlify.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/joker", "/bura", "/poker", "/leaderboard", "/ranks", "/rules", "/rules/joker", "/rules/bura", "/privacy"];
  return pages.map((p) => ({ url: `${SITE}${p}`, changeFrequency: p.startsWith("/rules") ? "monthly" : "weekly", priority: p === "" ? 1 : p.startsWith("/rules") ? 0.8 : 0.6 }));
}
