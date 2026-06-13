import { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen } from 'electron';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import { recognizeMapName, matchMap, terminateWorker } from './recognize.js';
import activeWin from 'active-win';
import { exec } from 'child_process';
import updaterPkg from 'electron-updater';
const { autoUpdater } = updaterPkg;

const MATCH_THRESHOLD = 0.45; // 相似度低於此值就不切換(避免誤判)
import { join, extname, basename } from 'path';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';

const MAP_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];

// 內建地圖資料夾:開發時讀專案 resources/maps,打包後讀 exe 旁的 resources/maps
function mapsDir() {
  return app.isPackaged
    ? join(process.resourcesPath, 'maps')
    : join(__dirname, '../../resources/maps');
}

// 掃描地圖資料夾(含子資料夾),回傳 [{ name, path, group }]
// group = 直屬的子資料夾(地區)名稱;直接放在 maps 根目錄的圖 group 為 ''
function listMaps() {
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
    console.error('掃描地圖資料夾失敗:', e);
  }
  return out.sort((a, b) =>
    (a.group || '').localeCompare(b.group || '', 'zh-Hant') ||
    a.name.localeCompare(b.name, 'zh-Hant')
  );
}

const isDev = !!process.env.ELECTRON_RENDERER_URL;

const settingsPath = () => join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS = {
  enabled: true,      // 是否啟用 overlay 顯示
  imagePath: '',      // 目前選取的圖片絕對路徑
  opacity: 0.5,       // 0.1 ~ 1.0 整個 overlay 視窗的不透明度
  scale: 0.5,         // 相對於圖片原始尺寸的縮放比例
  x: 0,               // overlay 左上角位置
  y: 0,
  clickThrough: false,   // 滑鼠是否穿透 overlay
  onlyWhenDbdFocused: true, // Tab 偵測只在 DBD 為最前景視窗時才觸發
  hideWhenUnfocused: true  // DBD 不在最前景時自動隱藏地圖
};

let settings = { ...DEFAULT_SETTINGS };
let overlayWin = null;
let controlWin = null;
let imgNatural = { w: 0, h: 0 }; // 目前圖片的原始像素尺寸

function loadSettings() {
  try {
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsPath(), 'utf-8')) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('儲存設定失敗:', e);
  }
}

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp'
};

// 把圖片讀成 data URL,避免 dev 模式下 http 頁面無法載入 file:// 的限制
function imageToDataUrl(path) {
  if (!path || !existsSync(path)) return '';
  try {
    const mime = MIME[extname(path).toLowerCase()] || 'image/png';
    return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
  } catch (e) {
    console.error('讀取圖片失敗:', e);
    return '';
  }
}

// 把目前選取的圖片送到 overlay 顯示
function pushImage() {
  if (overlayWin) overlayWin.webContents.send('set-image', imageToDataUrl(settings.imagePath));
}

// 載入某個 renderer 頁面 (dev 連 dev server,prod 載入打包後的 html)
function loadPage(win, page) {
  if (isDev) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}/${page}.html`);
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}.html`));
  }
}

// 依目前圖片尺寸與縮放比例調整 overlay 視窗大小與位置
function applyOverlayGeometry() {
  if (!overlayWin) return;
  if (imgNatural.w > 0 && imgNatural.h > 0) {
    const w = Math.max(40, Math.round(imgNatural.w * settings.scale));
    const h = Math.max(40, Math.round(imgNatural.h * settings.scale));
    overlayWin.setBounds({ x: settings.x, y: settings.y, width: w, height: h });
  } else {
    overlayWin.setPosition(settings.x, settings.y);
  }
  overlayWin.setOpacity(settings.opacity);
}

function applyClickThrough() {
  if (!overlayWin) return;
  overlayWin.setIgnoreMouseEvents(settings.clickThrough, { forward: true });
}

let dbdFocused = false; // 最近一次偵測到的 DBD 是否為最前景(供自動隱藏判斷)

// 依啟用狀態 + 前景狀態顯示 / 隱藏 overlay 視窗
function applyOverlayVisibility() {
  if (!overlayWin) return;
  // 啟用,且(未開自動隱藏 或 DBD 正在前景)才顯示
  const shouldShow = settings.enabled && (!settings.hideWhenUnfocused || dbdFocused);
  if (shouldShow) {
    overlayWin.showInactive(); // 顯示但不搶焦點
    overlayWin.setAlwaysOnTop(true, 'screen-saver');
  } else {
    overlayWin.hide();
  }
}

function createOverlayWindow() {
  overlayWin = new BrowserWindow({
    x: settings.x,
    y: settings.y,
    width: 400,
    height: 300,
    show: settings.enabled,   // 停用狀態啟動時不顯示,避免地圖閃一下
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 盡量讓 overlay 在全螢幕遊戲之上保持最上層
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  loadPage(overlayWin, 'overlay');

  overlayWin.webContents.on('did-finish-load', () => {
    pushImage();
    applyClickThrough();
    applyOverlayVisibility();
  });

}

// ---- 自訂拖曳:即時夾住,讓 overlay 出不了螢幕邊界 ----
let dragStartBounds = null;

ipcMain.on('drag-start', () => {
  if (overlayWin) dragStartBounds = overlayWin.getBounds();
});

ipcMain.on('drag-move', (_e, { dx, dy }) => {
  if (!overlayWin || !dragStartBounds) return;
  const b = dragStartBounds;
  const area = screen.getDisplayMatching(b).bounds; // 視窗所在那個螢幕
  // 起始位置 + 滑鼠位移,再夾在螢幕範圍內
  const x = Math.max(area.x, Math.min(b.x + dx, area.x + area.width - b.width));
  const y = Math.max(area.y, Math.min(b.y + dy, area.y + area.height - b.height));
  overlayWin.setBounds({ x, y, width: b.width, height: b.height });
  settings.x = x;
  settings.y = y;
});

ipcMain.on('drag-end', () => {
  dragStartBounds = null;
  saveSettings(); // 拖曳結束才寫檔,避免頻繁存
});

function createControlWindow() {
  controlWin = new BrowserWindow({
    width: 360,
    height: 200,
    useContentSize: true,   // 寬高指的是內容區,方便依內容貼合
    title: 'DBD Callouts Overlay',
    frame: false,           // 無邊框,改用自訂標題列
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  loadPage(controlWin, 'control');

  controlWin.webContents.on('did-finish-load', () => {
    controlWin.webContents.send('settings', settings);
  });

  controlWin.on('closed', () => { controlWin = null; });
}

// 自訂標題列:最小化
ipcMain.on('control-minimize', () => {
  if (controlWin && !controlWin.isDestroyed()) controlWin.minimize();
});

// 依控制台內容高度自動調整視窗高度(寬度不變)
ipcMain.on('resize-control', (_e, height) => {
  if (!controlWin || controlWin.isDestroyed()) return;
  const [w] = controlWin.getContentSize();
  controlWin.setContentSize(w, Math.max(80, Math.round(height)));
});

// ---- IPC: 控制台 -> 主程序 ----

ipcMain.handle('pick-image', async () => {
  const res = await dialog.showOpenDialog(controlWin, {
    title: '選擇地圖圖片',
    properties: ['openFile'],
    filters: [{ name: '圖片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
  });
  if (res.canceled || !res.filePaths.length) return null;
  settings.imagePath = res.filePaths[0];
  saveSettings();
  pushImage(); // overlay 立即切換
  return settings.imagePath;
});

ipcMain.on('set-opacity', (_e, v) => {
  settings.opacity = v;
  if (overlayWin) overlayWin.setOpacity(v);
  showHud(`透明度 ${Math.round(v * 100)}%`);
  saveSettings();
});

ipcMain.on('set-scale', (_e, v) => {
  settings.scale = v;
  applyOverlayGeometry();
  showHud(`大小 ${Math.round(v * 100)}%`);
  saveSettings();
});

ipcMain.on('set-enabled', (_e, v) => {
  settings.enabled = !!v;
  applyOverlayVisibility();
  saveSettings();
});

ipcMain.on('set-hide-unfocused', (_e, v) => {
  settings.hideWhenUnfocused = !!v;
  applyOverlayVisibility();
  saveSettings();
});

ipcMain.on('set-click-through', (_e, v) => {
  settings.clickThrough = v;
  applyClickThrough();
  saveSettings();
});

ipcMain.on('set-only-dbd', (_e, v) => {
  settings.onlyWhenDbdFocused = !!v;
  saveSettings();
});

ipcMain.on('reset-position', () => {
  settings.x = 0;
  settings.y = 0;
  applyOverlayGeometry();
  saveSettings();
});

ipcMain.on('quit-app', () => app.quit());

// overlay 載入圖片後回報原始尺寸,主程序據此設定視窗大小
ipcMain.on('image-natural-size', (_e, size) => {
  imgNatural = size;
  applyOverlayGeometry();
});

ipcMain.handle('get-settings', () => settings);

ipcMain.handle('get-version', () => app.getVersion());

// ---- 自動更新 ----
function sendUpdate(payload) {
  if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('update-status', payload);
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;          // 查到新版就自動下載
  autoUpdater.autoInstallOnAppQuit = true;  // 關閉 app 時自動安裝
  autoUpdater.on('checking-for-update', () => sendUpdate({ state: 'checking' }));
  autoUpdater.on('update-available', (i) => sendUpdate({ state: 'available', version: i.version }));
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'latest' }));
  autoUpdater.on('download-progress', (p) => sendUpdate({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => sendUpdate({ state: 'downloaded', version: i.version }));
  autoUpdater.on('error', (e) => sendUpdate({ state: 'error', message: String((e && e.message) || e) }));
}

// 按鈕:檢查更新(開發模式沒有更新設定,回報 dev)
ipcMain.on('check-update', () => {
  if (!app.isPackaged) { sendUpdate({ state: 'dev' }); return; }
  autoUpdater.checkForUpdates().catch((e) => sendUpdate({ state: 'error', message: String(e.message || e) }));
});

// 按鈕:立即重啟安裝
ipcMain.on('install-update', () => autoUpdater.quitAndInstall());

// 列出內建地圖
ipcMain.handle('list-maps', () => listMaps());

// 從下拉選單選了某張內建地圖
ipcMain.on('select-map', (_e, path) => {
  settings.imagePath = path;
  saveSettings();
  pushImage();
});

// ---- App 生命週期 ----

// ===== 用 uiohook 監聽 Tab(只聽不攔,遊戲照樣收到 Tab) =====
const CAPTURE_DELAY = 350;  // 按 Tab 後等記分板動畫跑完再截
let capturing = false;
let tabCount = 0;
let tabHeld = false;   // Tab 是否正被按住(用來忽略自動重複)

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// 判斷目前最前景視窗是不是 DBD
async function isDbdForeground() {
  try {
    const w = await activeWin();
    if (w) {
      const hay = `${w.title} ${w.owner?.name || ''} ${w.owner?.path || ''}`
        .toLowerCase().replace(/\s+/g, '');
      if (hay.includes('deadbydaylight')) return true;
      // active-win 抓到的是別的視窗 → 確實不是 DBD 前景
      return false;
    }
    // active-win 抓不到視窗(DBD 受 EAC 保護 / 全螢幕等)→ 改判斷 DBD 是否在執行
    return await isDbdRunning();
  } catch (e) {
    console.error('[FG] active-win failed:', e.message);
    return await isDbdRunning(); // 偵測失敗也退而求其次用「是否在執行」
  }
}

// 檢查 DBD 程序是否正在執行(不論前景與否)
function isDbdRunning() {
  return new Promise((resolve) => {
    exec(
      'tasklist /FI "IMAGENAME eq DeadByDaylight-Win64-Shipping.exe" /NH',
      { windowsHide: true },
      (err, stdout) => resolve(!err && /DeadByDaylight/i.test(stdout))
    );
  });
}

// 輪詢遊戲狀態,推給控制台:{ running, focused }
let gameStateTimer = null;
function startGameStatePoll() {
  const tick = async () => {
    const focused = await isDbdForeground();        // 前景就是 DBD
    const running = focused ? true : await isDbdRunning();
    dbdFocused = focused;
    applyOverlayVisibility();   // 依前景狀態自動顯示/隱藏地圖
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('game-state', { running, focused });
    }
  };
  tick();
  gameStateTimer = setInterval(tick, 2000);
}

// 帶 500ms 快取的前景判斷(按住方向鍵時避免每次都去查)
let fgCache = { t: 0, isDbd: false };
async function isDbdForegroundCached() {
  const now = Date.now();
  if (now - fgCache.t < 500) return fgCache.isDbd;
  fgCache.t = now;
  fgCache.isDbd = await isDbdForeground();
  return fgCache.isDbd;
}

// 截全螢幕(原生解析度),回傳 NativeImage
async function captureScreen() {
  const display = screen.getPrimaryDisplay();
  const sf = display.scaleFactor || 1;
  const width = Math.round(display.size.width * sf);
  const height = Math.round(display.size.height * sf);
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  });
  if (!sources.length) throw new Error('找不到螢幕來源');
  const img = sources[0].thumbnail;
  const sz = img.getSize();
  console.log(`[CAP] captured ${sz.width}x${sz.height}`);
  return img;
}

async function onTabPressed() {
  if (capturing) return;       // 防止連按/長按重複觸發
  if (!settings.enabled) return; // 停用時不偵測 / 不切換
  capturing = true;
  try {
    tabCount++;
    if (settings.onlyWhenDbdFocused && !(await isDbdForeground())) {
      console.log(`[TAB] #${tabCount} skip: foreground is not DBD`);
      return;
    }
    console.log(`[TAB] detected (#${tabCount}), capturing in ${CAPTURE_DELAY}ms...`);
    await delay(CAPTURE_DELAY);
    const img = await captureScreen();
    const text = await recognizeMapName(img);
    const best = matchMap(text, listMaps());
    const switched = !!(best && best.score >= MATCH_THRESHOLD);

    console.log(`[OCR] "${text.replace(/\s+/g, ' ').trim()}" -> ` +
      (best ? `${best.map.group}/${best.map.name} (${best.score.toFixed(2)})` : 'no match') +
      (switched ? ' [switched]' : ' [skip]'));

    if (switched) {
      settings.imagePath = best.map.path;
      saveSettings();
      pushImage();        // overlay 自動切換
      notifyControl();    // 控制台下拉同步
    }

    // 把辨識結果送到控制台顯示(避免終端機中文亂碼)
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('ocr-result', {
        text: text.replace(/\s+/g, ' ').trim(),
        match: best ? `${best.map.group} / ${best.map.name}` : '(無)',
        score: best ? best.score : 0,
        switched
      });
    }
  } catch (e) {
    console.error('[OCR] failed:', e);
    // 打包版看不到 console,把錯誤送到控制台顯示以便除錯
    if (controlWin && !controlWin.isDestroyed()) {
      controlWin.webContents.send('ocr-result', { error: String((e && e.message) || e) });
    }
  } finally {
    capturing = false;
  }
}

// 把最新設定送回控制台(讓下拉選單/滑桿同步)
function notifyControl() {
  if (controlWin && !controlWin.isDestroyed()) controlWin.webContents.send('settings', settings);
}

// ---- 方向鍵微調:上下調大小、左右調透明度 ----
const STEP_SCALE = 0.02;
const STEP_OPACITY = 0.02;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let saveTimer = null;
function scheduleSave() {            // 連續微調時延遲寫檔,避免頻繁存
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveSettings(); saveTimer = null; }, 400);
}

// 在 overlay 圖片上浮現數值提示約 1 秒
function showHud(text) {
  if (overlayWin && !overlayWin.isDestroyed()) overlayWin.webContents.send('show-hud', text);
}

function adjustScale(delta) {
  settings.scale = clamp(+(settings.scale + delta).toFixed(3), 0.1, 1);
  applyOverlayGeometry();
  showHud(`大小 ${Math.round(settings.scale * 100)}%`);
  notifyControl();
  scheduleSave();
}
function adjustOpacity(delta) {
  settings.opacity = clamp(+(settings.opacity + delta).toFixed(3), 0.1, 1);
  if (overlayWin) overlayWin.setOpacity(settings.opacity);
  showHud(`透明度 ${Math.round(settings.opacity * 100)}%`);
  notifyControl();
  scheduleSave();
}

async function onArrowKey(keycode) {
  let action = null;
  if (keycode === UiohookKey.ArrowUp) action = () => adjustScale(+STEP_SCALE);
  else if (keycode === UiohookKey.ArrowDown) action = () => adjustScale(-STEP_SCALE);
  else if (keycode === UiohookKey.ArrowRight) action = () => adjustOpacity(+STEP_OPACITY);
  else if (keycode === UiohookKey.ArrowLeft) action = () => adjustOpacity(-STEP_OPACITY);
  if (!action) return;
  // 跟 Tab 一樣:只在 DBD 為前景時生效(桌面操作不受干擾)
  if (settings.onlyWhenDbdFocused && !(await isDbdForegroundCached())) return;
  action();
}

function startKeyHook() {
  uIOhook.on('keydown', (e) => {
    if (e.keycode === UiohookKey.Tab) {
      if (tabHeld) return;   // 按住期間的重複 keydown,略過
      tabHeld = true;
      onTabPressed();
      return;
    }
    onArrowKey(e.keycode);   // 方向鍵微調(按住會持續調整)
  });
  uIOhook.on('keyup', (e) => {
    if (e.keycode === UiohookKey.Tab) tabHeld = false;
  });
  try {
    uIOhook.start();
    console.log('[TAB] uiohook started, listening for Tab (non-blocking).');
  } catch (err) {
    console.error('[TAB] uiohook start failed:', err);
  }
}
// ============================================

app.whenReady().then(() => {
  loadSettings();
  startKeyHook();
  createOverlayWindow();
  createControlWindow();
  startGameStatePoll();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
      createControlWindow();
    }
  });
});

app.on('will-quit', () => {
  try { uIOhook.stop(); } catch {}
  if (gameStateTimer) clearInterval(gameStateTimer);
  terminateWorker().catch(() => {});
});

app.on('window-all-closed', () => app.quit());
