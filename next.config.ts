import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A second build directory lets a measurement build run beside `pnpm dev` without corrupting it.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
