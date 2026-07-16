import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  // Allow large file uploads (audio up to 10 Mo, video up to 50 Mo)
  experimental: {
    serverActions: {
      bodySizeLimit: "55mb",
    },
  },
};

export default nextConfig;
