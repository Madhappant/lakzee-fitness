import fs from 'fs';
import path from 'path';
import { chromium, defineConfig, devices } from '@playwright/test';

function resolveBrowserLaunchConfig(): { launchOptions?: { executablePath: string }; channel?: 'chrome' | 'msedge' } {
  const defaultPath = chromium.executablePath();
  if (defaultPath && fs.existsSync(defaultPath)) {
    return {};
  }

  const localCacheRoot = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(localCacheRoot)) {
    const cachedChromiumDirs = fs
      .readdirSync(localCacheRoot)
      .filter((name) => name.startsWith('chromium-'))
      .sort()
      .reverse();
    for (const dir of cachedChromiumDirs) {
      const candidate = path.join(localCacheRoot, dir, 'chrome-win64', 'chrome.exe');
      if (fs.existsSync(candidate)) {
        return { launchOptions: { executablePath: candidate } };
      }
    }
  }

  if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
    return { channel: 'chrome' };
  }
  if (fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')) {
    return { channel: 'msedge' };
  }
  return {};
}

const browserLaunch = resolveBrowserLaunchConfig();
const usePrebuiltWeb = process.env.E2E_USE_PREBUILT === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        ...browserLaunch,
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        ...browserLaunch,
      },
    },
  ],
  webServer: [
    {
      command: 'npx tsx tests/fixtures/e2e-api-server.ts',
      cwd: path.resolve(__dirname, '../backend'),
      url: 'http://127.0.0.1:5055/__test__/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        NODE_ENV: 'development',
        PORT: '5055',
        DATABASE_URL: 'postgresql://e2e_isolated:e2e_isolated@127.0.0.1:5432/lakzee_e2e?schema=public',
        DIRECT_URL: 'postgresql://e2e_isolated:e2e_isolated@127.0.0.1:5432/lakzee_e2e?schema=public',
        JWT_SECRET: 'e2e-isolated-access-secret-lakzee-2026-min-length',
        JWT_REFRESH_SECRET: 'e2e-isolated-refresh-secret-lakzee-2026-min-length',
        CLIENT_URL: 'http://127.0.0.1:3100,http://localhost:3100,http://localhost:3000',
      },
    },
    {
      command: usePrebuiltWeb
        ? 'npx next start --port 3100 --hostname 127.0.0.1'
        : 'npx next dev --port 3100 --hostname 127.0.0.1',
      cwd: __dirname,
      url: 'http://127.0.0.1:3100/login',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:5055/api',
        NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
      },
    },
  ],
});
