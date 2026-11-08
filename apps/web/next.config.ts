import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Load the shared monorepo .env (DATABASE_URL, API_URL, ...) for the web app.
loadEnvConfig(path.resolve(__dirname, '../..'));

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
