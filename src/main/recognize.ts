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

// 比對邏輯已移到 ./match(純函式,便於測試);此處 re-export 維持既有 import 路徑
export { matchMap } from './match';
