import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Per-run Playwright output (videos, traces) is wiped by Playwright at the start of each run. Evidence worth keeping is copied by
  // reporters/status.reporter.ts to ./artifacts/evidence/, which is outside this folder and never deleted.
  outputDir: './artifacts/test-output',
  reporter: [['list'], ['html', { open: 'never' }], ['./reporters/status.reporter.ts']],
  use: {
    channel: 'chrome',
    baseURL: 'https://10.10.19.104:4443',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
