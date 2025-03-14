/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  // 配置webpack以处理markdown文件
  webpack: (config) => {
    config.module.rules.push({
      test: /\.md$/,
      use: 'raw-loader',
    });
    return config;
  },
  // 配置静态文件服务
  async rewrites() {
    return [
      {
        source: '/output/:path*',
        destination: '/api/static/:path*',
      },
    ];
  },
}

module.exports = nextConfig 