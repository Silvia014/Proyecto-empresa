import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this app inside the repository monorepo.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
