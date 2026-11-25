import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';
import { apiBaseURL, webBaseURL } from './utils/urls';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './tests',
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ...(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ? [['json'] as ['json']] : []),
  ],
  use: { trace: 'retain-on-failure' },
  projects: [
    {
      name: 'api',
      testMatch: '**/*.api.spec.ts',
      use: { baseURL: apiBaseURL },
    },
    {
      name: 'ui-chromium',
      testMatch: '**/*.ui.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: webBaseURL },
    },
  ],
});
