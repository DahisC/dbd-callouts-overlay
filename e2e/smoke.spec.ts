import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 端對端冒煙:啟動真正的 Electron app,確認控制台會渲染,且改設定有寫進 settings.json。
// 用獨立的 --user-data-dir,避免動到真實安裝的設定。

let app;
let userDataDir;

test.beforeAll(async () => {
  userDataDir = mkdtempSync(join(tmpdir(), 'dbd-e2e-'));
  // 預先放一個很舊的 log,驗證啟動會清掉(logs 收進 debug/ 之下)
  mkdirSync(join(userDataDir, 'debug', 'logs'), { recursive: true });
  writeFileSync(join(userDataDir, 'debug', 'logs', '2000-01-01.log'), 'old');
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
  // 預設 enabled=true;點開關本體關掉(整條不再可點)
  await control.locator('.toggle', { hasText: '啟用' }).locator('.sw').click();

  const settingsPath = join(userDataDir, 'settings.json');
  await expect
    .poll(() => {
      if (!existsSync(settingsPath)) return null;
      return JSON.parse(readFileSync(settingsPath, 'utf8')).enabled;
    }, { message: 'settings.json 的 enabled 應變成 false', timeout: 8_000 })
    .toBe(false);
});

test('Debug 預設關閉:啟動時清空 logs 資料夾(預放的舊 log 被刪)', async () => {
  const oldLog = join(userDataDir, 'debug', 'logs', '2000-01-01.log');
  await expect
    .poll(() => existsSync(oldLog), { message: '舊 log 應被清掉', timeout: 8_000 })
    .toBe(false);
});

test('開啟 Debug 後才會寫入檔案日誌', async () => {
  const logsDir = join(userDataDir, 'debug', 'logs');
  const hasLog = () => existsSync(logsDir) && readdirSync(logsDir).some((f) => /^\d{4}-\d{2}-\d{2}\.log$/.test(f));
  expect(hasLog()).toBe(false); // 預設關閉 → 還沒有 log

  const control = await windowByName('control');
  await control.locator('.toggle.dim i').first().click();   // 點除錯開關 → 跳自訂同意彈窗
  await control.locator('.modal .m-btn.primary').click();   // 在彈窗按「開啟」

  await expect
    .poll(hasLog, { message: '開啟除錯後 logs/ 應出現 YYYY-MM-DD.log', timeout: 8_000 })
    .toBe(true);
});

test('點齒輪開啟熱鍵設定，顯示 5 個可綁定熱鍵', async () => {
  const control = await windowByName('control');
  await control.locator('.tb-btn[aria-label="設定"]').click();
  await expect(control.locator('.modal-title', { hasText: '熱鍵設定' })).toBeVisible();
  await expect(control.locator('.kb-row')).toHaveCount(5);
  // 預設擷取鍵顯示 F
  await expect(
    control.locator('.kb-row', { hasText: '擷取地圖名' }).locator('.kb-key')
  ).toHaveText('F');
});
