import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return []
  },
  experimental: {
    proxyTimeout: 120000,
  },
};

export default nextConfig;
