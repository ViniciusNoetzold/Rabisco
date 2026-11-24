import { defineConfig, devices } from '@playwright/test';

const colagem = /@colagem\b/;
const edge = {
  ...devices['Desktop Edge'],
  channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
  viewport: { width: 1440, height: 1000 },
};

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './output/playwright',
  fullyParallel: true,
  // Limita a pressão no servidor Vite enquanto os módulos sob demanda são preparados.
  workers: 3,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  expect: {
    // O catálogo é rasterizado em canvas sem fontes ou elementos do sistema.
    toHaveScreenshot: { pathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}' },
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'edge',
      grepInvert: colagem,
      use: edge,
    },
    {
      name: 'edge-colagem',
      grep: colagem,
      fullyParallel: false,
      workers: 1,
      use: edge,
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
