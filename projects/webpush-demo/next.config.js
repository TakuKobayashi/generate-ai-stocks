/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Worker関連のファイルを除外
    config.externals = config.externals || [];
    config.externals.push({
      'src/worker': 'commonjs src/worker',
    });
    
    return config;
  },
}

module.exports = nextConfig
