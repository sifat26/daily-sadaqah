/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: false,
  },
  async rewrites() {
    // In production or custom deployment, rewrite frontend /api calls to backend if configured
    const backendUrl = process.env.API_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
    if (backendUrl && !backendUrl.startsWith('/api') && !backendUrl.includes('localhost:3000')) {
      const cleanBase = backendUrl.replace(/\/api\/?$/, '');
      return [
        {
          source: '/api/:path*',
          destination: `${cleanBase}/api/:path*`,
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
