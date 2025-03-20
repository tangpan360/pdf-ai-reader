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
  // 优化流式响应的配置
  experimental: {
    // 增加超时时间
    responseTimeout: 120000, // 2分钟
  },
  // 为API路由添加自定义头部，优化流式响应
  async headers() {
    return [
      {
        source: '/api/assistant/chat-stream',
        headers: [
          {
            key: 'Connection',
            value: 'keep-alive'
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-transform'
          },
          {
            key: 'X-Accel-Buffering',
            value: 'no' // 禁用Nginx的缓冲，重要！解决内网穿透问题
          }
        ]
      }
    ]
  },
  // 增加请求体大小限制
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    },
    // 解决内网穿透场景下的流终止问题
    externalResolver: true,
  }
}

module.exports = nextConfig