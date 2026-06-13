import { defineConfig } from '@playwright/test';

// 端對端冒煙測試:啟動真正打包後的 Electron app(out/main/index.js)。
// 與 vitest(test/**/*.test.js)分開,放在 e2e/。
export default defineConfig({
  testDir: './e2e',
  timeout: 40_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,               // Electron app 一次只開一個
  reporter: 'list'
});
