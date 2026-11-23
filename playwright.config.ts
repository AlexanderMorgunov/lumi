import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Each worker creates a WebGL renderer and decodes the art atlas.
  workers: 2,
  use: { baseURL: 'http://localhost:4289', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 360, height: 800 },
        hasTouch: true,
        reducedMotion: 'reduce',
      },
    },
  ],
  webServer: {
    command: 'npm exec vite -- --host localhost --port 4289 --strictPort',
    url: 'http://localhost:4289',
    reuseExistingServer: false,
  },
});
