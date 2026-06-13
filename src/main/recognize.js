import { createWorker } from 'tesseract.js';
import { app } from 'electron';
import { join } from 'path';

// 地圖名稱在畫面的相對位置(正下方中央那行),依此比例裁切,適應不同解析度
export const NAME_REGION = { x: 0.26, y: 0.796, w: 0.48, h: 0.043 };

// 打包後 tesseract 的 worker / 核心要從 asar 解壓出來的真實路徑載入,
// 語言檔快取改放可寫的 userData(預設快取路徑在打包後可能唯讀)
function tessOptions() {
  const nm = app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
    : join(app.getAppPath(), 'node_modules');
  return {
    // OCR 跑在 Electron 主程序(Node worker_thread),必須用 Node 版 worker script;
    // dist/worker.min.js 是瀏覽器版,在 Node 載入會丟 r.g.addEventListener is not a function
    workerPath: join(nm, 'tesseract.js', 'src', 'worker-script', 'node', 'index.js'),
    corePath: join(nm, 'tesseract.js-core'),
    cachePath: app.getPath('userData')
  };
}

let workerPromise = null;
// 共用一個 OCR worker(第一次建立,之後重用)
function getWorker() {
  if (!workerPromise) workerPromise = createWorker('chi_tra', 1, tessOptions());
  return workerPromise;
}

export async function terminateWorker() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}

// 對一張 NativeImage 裁切地圖名稱區域、放大後做 OCR,回傳辨識文字
export async function recognizeMapName(nativeImg) {
  const { width, height } = nativeImg.getSize();
  const rect = {
    x: Math.round(NAME_REGION.x * width),
    y: Math.round(NAME_REGION.y * height),
    width: Math.round(NAME_REGION.w * width),
    height: Math.round(NAME_REGION.h * height)
  };
  // 裁切 + 放大 2 倍(小字放大有助辨識)
  const cropped = nativeImg.crop(rect).resize({ width: rect.width * 2 });
  const worker = await getWorker();
  const { data } = await worker.recognize(cropped.toPNG());
  return data.text || '';
}

// --- 文字正規化與比對 ---

// 只保留中日韓文字與英數,去掉空格/標點/破折號
function normalize(s) {
  return (s || '').replace(/[^一-鿿㐀-䶿A-Za-z0-9]/g, '');
}

// Levenshtein 編輯距離
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[m];
}

function similarity(a, b) {
  if (!a.length && !b.length) return 1;
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1 - levenshtein(a, b) / maxLen : 0;
}

// 從 OCR 文字比對出最相符的地圖
// maps: [{ name, path, group }]
// 回傳 { map, score } 或 null
export function matchMap(ocrText, maps) {
  const ocr = normalize(ocrText);
  if (!ocr || !maps.length) return null;

  let best = null;
  for (const m of maps) {
    const nameN = normalize(m.name);
    const realmNameN = normalize((m.group || '') + m.name);
    // 跟「地區+地圖」與「只地圖名」兩種都比,取較高分
    let score = Math.max(similarity(ocr, realmNameN), similarity(ocr, nameN));
    // OCR 文字若直接包含完整地圖名,給強加成
    if (nameN && ocr.includes(nameN)) score = Math.max(score, 0.95);
    if (!best || score > best.score) best = { map: m, score };
  }
  return best;
}
