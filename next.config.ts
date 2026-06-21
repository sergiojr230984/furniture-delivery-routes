import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Linting is run separately; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
