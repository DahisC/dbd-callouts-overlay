// 離線測試:對真實截圖的「地圖名稱」區域做 OCR
import { createWorker } from 'tesseract.js';
import { readFileSync } from 'fs';

const FILE = process.argv[2] ||
  'C:/Users/Dahis/AppData/Roaming/dbd-map-overlay/captures/cap-1781295386808.png';

// 讀 PNG 寬高(IHDR:寬在 offset 16,高在 offset 20,big-endian)
function pngSize(path) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// 地圖名稱區域(相對比例,正下方中央那行)
const FRAC = { x: 0.26, y: 0.796, w: 0.48, h: 0.043 };

const { w, h } = pngSize(FILE);
const rect = {
  left: Math.round(FRAC.x * w),
  top: Math.round(FRAC.y * h),
  width: Math.round(FRAC.w * w),
  height: Math.round(FRAC.h * h)
};
console.log('image size:', w, 'x', h);
console.log('rectangle :', rect);

const worker = await createWorker('chi_tra');
const { data } = await worker.recognize(FILE, { rectangle: rect });
console.log('----- OCR 結果 -----');
console.log(JSON.stringify(data.text));
console.log('confidence:', data.confidence);
await worker.terminate();
