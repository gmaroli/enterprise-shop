import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'api',
      testMatch: '**/*.api.spec.ts',
      use: { baseURL: 'http://localhost:4000/api/' },
    },
    {
      name: 'ui-chromium',
      testMatch: '**/*.ui.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3001' },
    },
  ],
});
