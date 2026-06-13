import { app, BrowserWindow, ipcMain, desktopCapturer, screen, shell } from 'electron';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import { recognizeMapName, matchMap, terminateWorker } from './recognize';
import { listMaps } from './maps';
import { clampToVisible } from './geometry';
import { spawn } from 'child_process';
import updaterPkg from 'electron-updater';
const { autoUpdater } = updaterPkg;
import log from 'electron-log/main';

// 檔案日誌:把所有 console.* 接到 electron-log,同時寫進檔案與終端機。
// 檔案位置:userData/logs/main.log(Windows: %AppData%\<app>\logs\),自動輪替。
log.initialize();
log.transports.file.level = 'info';
Object.assign(console, log.functions);

const MATCH_THRESHOLD = 0.45; // 相似度低於此值就不切換(避免誤判)
import { join, extname, dirname } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

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
    console.error('[settings] failed to save settings:', e);
  }
}

// 地圖清單快取:避免每次按 Tab 都同步重掃磁碟。
// 使用者開控制台時(list-maps)才強制重掃,以撿到新放入的地圖。
let mapsCache: MapItem[] | null = null;
function getMaps(forceRefresh = false) {
  if (forceRefresh || !mapsCache) mapsCache = listMaps();
  return mapsCache;
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
    console.error('[image] failed to read image:', e);
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

// 視窗安全防護:不在 app 內開新視窗(外部連結轉系統瀏覽器),並擋掉非預期的頁面導航
function hardenWindow(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault(); // 只允許停在目前頁面(放行 HMR 整頁重載)
  });
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
      nodeIntegration: false,
      sandbox: true
    }
  });

  // 盡量讓 overlay 在全螢幕遊戲之上保持最上層
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  hardenWindow(overlayWin);
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
      nodeIntegration: false,
      sandbox: true
    }
  });
  hardenWindow(controlWin);
  loadPage(controlWin, 'control');

  controlWin.webContents.on('did-finish-load', () => {
    controlWin.webContents.send('settings', settings);
    sendGameState(); // 載入時補送一次目前焦點狀態
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

ipcMain.on('set-opacity', (_e, v) => {
  settings.opacity = v;
  if (overlayWin) overlayWin.setOpacity(v);
  showHud(`透明度 ${Math.round(v * 100)}%`);
  scheduleSave(); // 滑桿拖曳會狂發事件,延遲寫檔避免每次同步寫盤
});

ipcMain.on('set-scale', (_e, v) => {
  settings.scale = v;
  applyOverlayGeometry();
  showHud(`大小 ${Math.round(v * 100)}%`);
  scheduleSave(); // 同上,滑桿連續事件延遲寫檔
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

// 用系統預設瀏覽器開啟外部連結(只允許 http/https,避免被塞危險協定)
ipcMain.on('open-external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
});

// 在檔案總管開啟日誌資料夾(electron-log 實際寫入的目錄)
ipcMain.on('open-logs', () => {
  shell.openPath(dirname(log.transports.file.getFile().path));
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

// 列出內建地圖(使用者開控制台時強制重掃,撿到新放入的地圖)
ipcMain.handle('list-maps', () => getMaps(true));

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

// ===== 前景視窗監看 =====
// active-win 在 Windows 沒有原生 binary(只附 macOS),一律回傳 null,無法區分焦點。
// 改常駐一個 PowerShell:用 user32 的 GetForegroundWindow 取得最前景程序名,
// 持續輸出給主程序。Add-Type 的一次性編譯成本只在啟動付一次,之後查詢極便宜。
const FG_MONITOR_PS = `
$ErrorActionPreference='SilentlyContinue'
Add-Type -Name Fg -Namespace W -MemberDefinition @"
[DllImport("user32.dll")] public static extern System.IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint p);
"@
while ($true) {
  $p = 0
  [W.Fg]::GetWindowThreadProcessId([W.Fg]::GetForegroundWindow(), [ref]$p) | Out-Null
  $n = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName
  [Console]::Out.WriteLine($n)
  Start-Sleep -Milliseconds 600
}
`;

let fgProc = null;
let fgProcName = '';   // 最近一次回報的最前景程序名(無 .exe)
let quitting = false;

function startForegroundMonitor() {
  const b64 = Buffer.from(FG_MONITOR_PS, 'utf16le').toString('base64');
  fgProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', b64], { windowsHide: true });
  console.log('[fg] foreground monitor started');
  let buf = '';
  fgProc.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();            // 留下尚未換行的殘段
    for (const line of lines) {
      fgProcName = line.trim();
      const focused = isDbdForeground();
      if (focused !== dbdFocused) {
        dbdFocused = focused;
        // 焦點變化是隱藏/顯示功能的關鍵事件,記錄目前前景程序名以便 debug
        console.log(`[fg] focus changed: DBD=${focused} (foreground: ${fgProcName || 'unknown'})`);
        applyOverlayVisibility(); // 焦點一變就即時顯示/隱藏(約 0.6s 內)
        sendGameState();          // 同步控制台狀態
      }
    }
  });
  fgProc.on('exit', (code) => {
    fgProc = null;
    if (!quitting) {
      console.warn(`[fg] monitor exited (code ${code}), restarting in 1s`);
      setTimeout(startForegroundMonitor, 1000); // 非正常結束就重啟
    }
  });
}

// 目前最前景視窗是不是 DBD(讀監看程序回報的程序名,DBD 為 DeadByDaylight-Win64-Shipping)
function isDbdForeground() {
  return /DeadByDaylight/i.test(fgProcName);
}

// 把目前焦點狀態推給控制台(由監看程序在焦點變化時、及控制台載入時呼叫)
function sendGameState() {
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.webContents.send('game-state', { focused: dbdFocused });
  }
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
  if (!sources.length) throw new Error('no screen source found');
  const img = sources[0].thumbnail;
  const sz = img.getSize();
  console.log(`[capture] screen captured ${sz.width}x${sz.height}`);
  return img;
}

async function onTabPressed() {
  if (capturing) return;       // 防止連按/長按重複觸發
  if (!settings.enabled) return; // 停用時不偵測 / 不切換
  capturing = true;
  try {
    tabCount++;
    if (settings.onlyWhenDbdFocused && !isDbdForeground()) {
      console.log(`[tab] #${tabCount} skipped: DBD not in foreground`);
      return;
    }
    console.log(`[tab] detected (#${tabCount}), capturing in ${CAPTURE_DELAY}ms`);
    await delay(CAPTURE_DELAY);
    const img = await captureScreen();
    const text = await recognizeMapName(img);
    const best = matchMap(text, getMaps());
    const switched = !!(best && best.score >= MATCH_THRESHOLD);

    console.log(`[ocr] "${text.replace(/\s+/g, ' ').trim()}" -> ` +
      (best ? `${best.map.group}/${best.map.name} (${best.score.toFixed(2)})` : 'no match') +
      (switched ? ' [switched]' : ' [skipped]'));

    if (switched) {
      settings.imagePath = best.map.path;
      saveSettings();
      pushImage();        // overlay 自動切換
      notifyControl();    // 控制台下拉同步
    }
  } catch (e) {
    console.error('[ocr] recognition failed:', e);
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
  if (settings.onlyWhenDbdFocused && !isDbdForeground()) return;
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
    console.log('[hook] uiohook started, listening for Tab (non-blocking)');
  } catch (err) {
    console.error('[hook] uiohook failed to start:', err);
  }
}
// ============================================

app.whenReady().then(() => {
  loadSettings();
  // 啟動時把 overlay 位置夾回可見螢幕(避免外接螢幕拔掉後 overlay 跑到看不見的地方)
  const clamped = clampToVisible(
    { x: settings.x, y: settings.y, width: 400, height: 300 },
    screen.getAllDisplays()
  );
  settings.x = clamped.x;
  settings.y = clamped.y;
  startKeyHook();
  startForegroundMonitor();
  createOverlayWindow();
  createControlWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
      createControlWindow();
    }
  });
});

app.on('will-quit', () => {
  quitting = true;
  try { uIOhook.stop(); } catch {}
  if (fgProc) { try { fgProc.kill(); } catch {} }
  terminateWorker().catch(() => {});
});

app.on('window-all-closed', () => app.quit());
