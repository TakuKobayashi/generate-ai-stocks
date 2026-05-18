import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloudflare Pages (next-on-pages) 用の設定
  experimental: {
    // Server Actions を有効化
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787',
  },
};

export default nextConfig;
