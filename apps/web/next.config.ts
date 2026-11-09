import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Load the shared monorepo .env (DATABASE_URL, API_URL, ...) for the web app.
loadEnvConfig(path.resolve(__dirname, '../..'));

const nextConfig: NextConfig = {
  // A separate output folder lets a check build run next to `next dev` without clobbering it.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
