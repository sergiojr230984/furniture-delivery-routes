import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Linting is run separately; don't block production builds on it.
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Default 1MB is too small for phone camera photos uploaded via Server Actions
    // (pickup/delivery condition photos, item photos, signatures).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
