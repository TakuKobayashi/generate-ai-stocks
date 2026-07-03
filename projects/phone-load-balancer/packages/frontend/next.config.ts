import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  distDir: "../../packages/worker/assets",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
