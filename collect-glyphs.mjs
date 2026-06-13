// 收集介面 + 地圖名實際用到的所有字元,輸出成子集化用的字表
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const chars = new Set();
const add = (s) => { for (const ch of s) chars.add(ch); };

// 1) 介面原始碼裡的文字
const srcFiles = [
  'src/renderer/control.html',
  'src/renderer/overlay.html',
  'src/renderer/src/control/Control.vue',
  'src/renderer/src/overlay/Overlay.vue'
];
for (const f of srcFiles) {
  try { add(readFileSync(f, 'utf-8')); } catch {}
}

// 2) 所有地圖的地區名與地圖名(資料夾名 + 檔名)
const root = 'resources/maps';
for (const realm of readdirSync(root)) {
  const dir = join(root, realm);
  if (!statSync(dir).isDirectory()) continue;
  add(realm);
  for (const f of readdirSync(dir)) add(f.replace(/\.[^.]+$/, ''));
}

// 3) 基本 ASCII + 常用標點保險
add(' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~');
add('，。：、…！？「」『』%v');

// 只保留「可見字元」(去掉控制字元、換行等)
const list = [...chars].filter((c) => c.codePointAt(0) >= 0x20);
writeFileSync('glyphs.txt', list.join(''), 'utf-8');
console.log(`收集到 ${list.length} 個唯一字元 -> glyphs.txt`);
