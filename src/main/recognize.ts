import { createWorker } from 'tesseract.js';
import { app, nativeImage } from 'electron';

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

// 純灰階(不做對比拉伸):拉伸會把背景霧的漸層放大成雜訊,反而讓辨識更差。
// 灰階讓存檔較小,也等同 tesseract 內部會做的轉換,實際分離交給它的二值化。
function toGrayscale(img: Electron.NativeImage): Electron.NativeImage {
  const { width, height } = img.getSize();
  if (!width || !height) return img;
  const bmp = img.toBitmap(); // BGRA
  const out = Buffer.allocUnsafe(bmp.length);
  for (let i = 0; i < bmp.length; i += 4) {
    const y = (bmp[i + 2] * 0.299 + bmp[i + 1] * 0.587 + bmp[i] * 0.114) | 0;
    out[i] = out[i + 1] = out[i + 2] = y;
    out[i + 3] = 255;
  }
  return nativeImage.createFromBitmap(out, { width, height });
}

// 對「已裁切好的地圖名區域 PNG」做 OCR:灰階 → 放大 2 倍 → 辨識。
// 回傳辨識文字,以及灰階後的 PNG(供 debug 存檔:即 OCR 所見的內容,且檔案較小)。
export async function recognizeMapName(regionPng: Buffer): Promise<{ text: string; image: Buffer }> {
  let img = nativeImage.createFromBuffer(regionPng);
  img = toGrayscale(img);
  const image = img.toPNG();
  const { width } = img.getSize();
  if (width > 0) img = img.resize({ width: width * 2 });
  const worker = await getWorker();
  const { data } = await worker.recognize(img.toPNG());
  return { text: data.text || '', image };
}

// 比對邏輯已移到 ./match(純函式,便於測試);此處 re-export 維持既有 import 路徑
export { matchMap } from './match';
