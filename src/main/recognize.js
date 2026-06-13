import { createWorker } from 'tesseract.js';
import { app } from 'electron';

// 地圖名稱在畫面的相對位置(正下方中央那行),依此比例裁切,適應不同解析度
export const NAME_REGION = { x: 0.26, y: 0.796, w: 0.48, h: 0.043 };

let workerPromise = null;
// 共用一個 OCR worker(第一次建立,之後重用)
// worker / 核心路徑都用 tesseract.js 預設(在 Node 下會正確挑 Node 版 worker 與核心,
// 直接從 asar 載入,跟 v0.0.1 一樣);只覆寫語言檔快取到可寫的 userData。
// oem=1 (LSTM):chi_tra 走 LSTM 引擎,非 LSTM 的核心變體可從打包排除以瘦身。
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('chi_tra', 1, {
      cachePath: app.getPath('userData') // 預設快取路徑打包後可能唯讀,改放 userData
    });
  }
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
