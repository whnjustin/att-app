import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const localChromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests',
  use: {
    baseURL: 'http://localhost:4173/att-app/',
    trace: 'off',
    launchOptions: existsSync(localChromium) && !process.env.CI ? { executablePath: localChromium } : {},
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/att-app/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
