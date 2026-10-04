import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const tmp = 'tests/e2e/.tmp';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.js',
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, ...devices['Pixel 5'] },
  webServer: {
    command: `sh -c "rm -rf ${tmp} && mkdir -p ${tmp} && cp -r tests/e2e/fixtures/content ${tmp}/content && node scripts/create-admin.js && node src/server.js"`,
    url: `http://localhost:${PORT}/healthz`,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT), CONTENT_DIR: `${tmp}/content`, DB_PATH: `${tmp}/app.sqlite`, UPLOADS_DIR: `${tmp}/uploads`, LOG_LEVEL: 'warn',
      ADMIN_USERNAME: 'e2e-admin', ADMIN_PASSWORD: 'e2e-password-123',
    },
  },
});
