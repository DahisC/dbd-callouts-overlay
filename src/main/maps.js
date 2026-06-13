import { app } from 'electron';
import { join, extname, basename } from 'path';
import { readdirSync, existsSync, mkdirSync } from 'fs';

const MAP_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];

// 內建地圖資料夾:開發時讀專案 resources/maps,打包後讀 exe 旁的 resources/maps
function mapsDir() {
  return app.isPackaged
    ? join(process.resourcesPath, 'maps')
    : join(__dirname, '../../resources/maps');
}

// 掃描地圖資料夾(含子資料夾),回傳 [{ name, path, group }]
// group = 直屬的子資料夾(地區)名稱;直接放在 maps 根目錄的圖 group 為 ''
export function listMaps() {
  const root = mapsDir();
  const out = [];
  function walk(dir, group) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, group || entry.name); // 第一層子資料夾名當作地區
      } else if (MAP_EXTS.includes(extname(entry.name).toLowerCase())) {
        out.push({ name: basename(entry.name, extname(entry.name)), path: full, group: group || '' });
      }
    }
  }
  try {
    if (!existsSync(root)) mkdirSync(root, { recursive: true });
    walk(root, '');
  } catch (e) {
    console.error('[maps] failed to scan maps folder:', e);
  }
  return out.sort((a, b) =>
    (a.group || '').localeCompare(b.group || '', 'zh-Hant') ||
    a.name.localeCompare(b.name, 'zh-Hant')
  );
}
