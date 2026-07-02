import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['5a28-2409-40e5-bf-c41f-4032-33ce-4263-8fc4.ngrok-free.app'],
  images: {
    localPatterns: [
      {
        pathname: '/api/upload/view',
        // `search` is intentionally omitted (not ''): each image has a unique
        // ?key=events/.../asset.jpg value, and Next doesn't support globs in `search`,
        // so omitting it is the only way to allow any ?key=... value through.
      },
    ],
  },
};

export default nextConfig;