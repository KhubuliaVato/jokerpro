import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lets a production build run beside `next dev` without touching its cache (NEXT_DIST_DIR=.next-build)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
