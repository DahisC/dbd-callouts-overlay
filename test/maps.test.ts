import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// maps.js 會 import electron(mapsDir 用),測試只用 scanMaps,mock 掉避免載入失敗
vi.mock('electron', () => ({ app: { isPackaged: false, getPath: () => '' } }));

import { scanMaps } from '../src/main/maps.js';

let root;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'maps-test-'));
  writeFileSync(join(root, '遊樂園.png'), '');               // 根目錄一張圖(group '')
  mkdirSync(join(root, '麥克米倫莊園'));                       // 地區子資料夾
  writeFileSync(join(root, '麥克米倫莊園', '惡夢屋.jpg'), '');
  writeFileSync(join(root, '麥克米倫莊園', '碎裂的迴聲.webp'), '');
  writeFileSync(join(root, 'readme.txt'), '');               // 非圖片,應被忽略
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('scanMaps', () => {
  it('回傳所有圖片、忽略非圖片', () => {
    const names = scanMaps(root).map((m) => m.name);
    expect(names.sort()).toEqual(['惡夢屋', '碎裂的迴聲', '遊樂園'].sort());
  });

  it('子資料夾名當作 group,根目錄圖 group 為空', () => {
    const maps = scanMaps(root);
    expect(maps.find((m) => m.name === '惡夢屋').group).toBe('麥克米倫莊園');
    expect(maps.find((m) => m.name === '遊樂園').group).toBe('');
  });

  it('回傳的 path 指向實際檔案', () => {
    const m = scanMaps(root).find((x) => x.name === '惡夢屋');
    expect(existsSync(m.path)).toBe(true);
  });

  it('資料夾不存在時自動建立並回傳空陣列', () => {
    const missing = join(root, 'newsub');
    expect(existsSync(missing)).toBe(false);
    expect(scanMaps(missing)).toEqual([]);
    expect(existsSync(missing)).toBe(true);
  });
});
