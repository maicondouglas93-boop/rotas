import { defineConfig, devices } from '@playwright/test';
import { ambienteApi, URL_API, URL_PAINEL } from './e2e/ambiente';

const ehCi = !!process.env['CI'];

/** Testes E2E do painel: navegador de verdade contra a API e o painel compilados, no banco de teste. */
export default defineConfig({
  testDir: './e2e',
  // Um banco para todos: um teste por vez.
  workers: 1,
  fullyParallel: false,
  forbidOnly: ehCi,
  retries: ehCi ? 1 : 0,
  reporter: ehCi ? [['github'], ['html', { open: 'never' }]] : [['list']],
  globalSetup: './e2e/preparar.ts',
  use: {
    baseURL: URL_PAINEL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // dist-e2e: não apaga o dist do `pnpm --filter api dev`.
      command: 'pnpm --filter api build:e2e-painel && pnpm --filter api start:e2e-painel',
      url: `${URL_API}/saude/pronto`,
      env: ambienteApi,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'ignore',
    },
    {
      // .next-e2e: não disputa a .next com o `next dev`. A URL da API entra no build.
      command: 'pnpm build:e2e && pnpm start:e2e',
      url: URL_PAINEL,
      env: { NEXT_PUBLIC_API_URL: URL_API, NEXT_DIST_DIR: '.next-e2e' },
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: 'ignore',
    },
  ],
});
