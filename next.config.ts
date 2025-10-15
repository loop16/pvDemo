import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js build to proceed even if ESLint finds issues.
  // We'll run `npm run lint` separately to address them iteratively.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
