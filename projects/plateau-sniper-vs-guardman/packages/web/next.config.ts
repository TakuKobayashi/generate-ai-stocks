import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // PlayCanvas は ESM で配布されているため transpilePackages 不要
  // MessagePack も同様
  experimental: {
    // App Router での WebAssembly 利用（将来拡張用）
  },
}

export default nextConfig
