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

// 灰階 + 對比拉伸:地圖名是暗灰、低對比的字,先把它壓明顯再交給 tesseract。
// 用 1%/99% 百分位當黑白點(避開亮紅橫幅等離群值),把亮度線性拉伸到 0~255。
function enhanceContrast(img: Electron.NativeImage): Electron.NativeImage {
  const { width, height } = img.getSize();
  if (!width || !height) return img;
  const bmp = img.toBitmap(); // BGRA
  const n = width * height;
  const gray = new Uint8Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const y = (bmp[i + 2] * 0.299 + bmp[i + 1] * 0.587 + bmp[i] * 0.114) | 0;
    gray[p] = y;
    hist[y]++;
  }
  const loCount = Math.floor(n * 0.01);
  const hiCount = Math.floor(n * 0.99);
  let acc = 0, min = 0, max = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= loCount) { min = v; break; } }
  acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= hiCount) { max = v; break; } }
  const range = Math.max(1, max - min);
  const out = Buffer.allocUnsafe(bmp.length);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let y = ((gray[p] - min) * 255) / range;
    y = y < 0 ? 0 : y > 255 ? 255 : y | 0;
    out[i] = out[i + 1] = out[i + 2] = y;
    out[i + 3] = 255;
  }
  return nativeImage.createFromBitmap(out, { width, height });
}

// 對「已裁切好的地圖名區域 PNG」做 OCR:放大 2 倍 + 灰階對比拉伸後辨識
export async function recognizeMapName(regionPng: Buffer): Promise<string> {
  let img = nativeImage.createFromBuffer(regionPng);
  const { width } = img.getSize();
  if (width > 0) img = img.resize({ width: width * 2 });
  img = enhanceContrast(img);
  const worker = await getWorker();
  const { data } = await worker.recognize(img.toPNG());
  return data.text || '';
}

// 比對邏輯已移到 ./match(純函式,便於測試);此處 re-export 維持既有 import 路徑
export { matchMap } from './match';
