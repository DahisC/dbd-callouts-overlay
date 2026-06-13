import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 端對端冒煙:啟動真正的 Electron app,確認控制台會渲染,且改設定有寫進 settings.json。
// 用獨立的 --user-data-dir,避免動到真實安裝的設定。

let app;
let userDataDir;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'dbd-e2e-'));
  app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
});

test.afterAll(async () => {
  await app?.close();
  if (userDataDir) rmSync(userDataDir, { recursive: true, force: true });
});

// 依視窗 URL(control.html / overlay.html)找到對應視窗
async function windowByName(name) {
  for (let i = 0; i < 50; i++) {
    const w = app.windows().find((w) => w.url().includes(name));
    if (w) return w;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`找不到 ${name} 視窗`);
}

test('啟動後開出 overlay 與控制台兩個視窗', async () => {
  const control = await windowByName('control');
  const overlay = await windowByName('overlay');
  expect(control).toBeTruthy();
  expect(overlay).toBeTruthy();
});

test('控制台標題列正確渲染', async () => {
  const control = await windowByName('control');
  await expect(control.locator('.tb-title')).toHaveText('DBD CALLOUTS OVERLAY');
});

test('切「啟用」toggle 會寫進 settings.json', async () => {
  const control = await windowByName('control');
  // 預設 enabled=true;點一下關掉
  await control.locator('label.toggle', { hasText: '啟用' }).first().click();

  const settingsPath = join(userDataDir, 'settings.json');
  await expect
    .poll(() => {
      if (!existsSync(settingsPath)) return null;
      return JSON.parse(readFileSync(settingsPath, 'utf8')).enabled;
    }, { message: 'settings.json 的 enabled 應變成 false', timeout: 8_000 })
    .toBe(false);
});
