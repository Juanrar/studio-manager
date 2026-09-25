import { defineConfig, devices } from '@playwright/test';
import { PUERTO_E2E, URL_BASE_E2E } from './entorno.ts';

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO_E2E}`,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // La API sirve el frontend compilado, como en producción, contra la base de e2e.
  webServer: {
    command: 'pnpm --filter @studio/api start',
    cwd: '..',
    url: `http://127.0.0.1:${PUERTO_E2E}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DATABASE_URL: URL_BASE_E2E, PORT: String(PUERTO_E2E), WEB_DIST: '../web/dist' },
  },
});
