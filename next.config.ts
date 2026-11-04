import type { NextConfig } from "next";

const s3Bucket = process.env.AWS_S3_BUCKET;
const awsRegion = process.env.AWS_REGION;

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ['5a28-2409-40e5-bf-c41f-4032-33ce-4263-8fc4.ngrok-free.app'],
  outputFileTracingIncludes: {
    "/api/upload/*": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  images: {
    remotePatterns: s3Bucket && awsRegion ? [
      {
        protocol: "https",
        hostname: `${s3Bucket}.s3.${awsRegion}.amazonaws.com`,
        pathname: "/**",
      },
    ] : [],
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