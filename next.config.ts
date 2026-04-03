import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file with override to ensure correct DB URL even if shell has old value
config({ path: resolve(process.cwd(), ".env"), override: true });

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
