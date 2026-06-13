import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',          // 預設 node;需要 DOM 的測試用檔首 @vitest-environment jsdom
    include: ['test/**/*.test.js']
  }
});
