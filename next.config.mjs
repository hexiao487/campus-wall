/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/sb/:path*',
        destination: 'https://mkbqmgvkdreireobvodr.supabase.co/:path*'
      }
    ];
  },
  images: {
    // Supabase Storage 的公共图片域名
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' }
    ]
  }
};

export default nextConfig;
