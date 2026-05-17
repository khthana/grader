import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.240.1'],
  async redirects() {
    return [
      { source: '/', destination: '/login', permanent: false },
    ]
  },
};

export default nextConfig;
