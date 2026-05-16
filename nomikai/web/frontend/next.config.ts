import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cloudflare Workers の静的アセットとして配信するため SSG でエクスポート
  output: 'export',
  // 末尾スラッシュをつけてインデックスHTMLを生成
  trailingSlash: true,
  // 画像最適化はSSGでは使えないのでデフォルトローダーを無効化
  images: { unoptimized: true },
  // 本番ビルドでのソースマップを無効化
  productionBrowserSourceMaps: false,
};

export default nextConfig;
