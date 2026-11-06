import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://projoker.netlify.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/profile", "/login", "/*/table/"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
