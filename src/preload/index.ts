import { contextBridge, ipcRenderer } from 'electron';

// 安全地把有限的 IPC 能力暴露給 Vue 畫面 (window.api)
contextBridge.exposeInMainWorld('api', {
  // --- 控制台用 ---
  listMaps: () => ipcRenderer.invoke('list-maps'),
  selectMap: (path) => ipcRenderer.send('select-map', path),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  setEnabled: (v) => ipcRenderer.send('set-enabled', v),
  setOpacity: (v) => ipcRenderer.send('set-opacity', v),
  setScale: (v) => ipcRenderer.send('set-scale', v),
  setClickThrough: (v) => ipcRenderer.send('set-click-through', v),
  setHideUnfocused: (v) => ipcRenderer.send('set-hide-unfocused', v),
  setDebug: (v) => ipcRenderer.send('set-debug', v),
  startRebind: (action) => ipcRenderer.send('start-rebind', action),
  cancelRebind: () => ipcRenderer.send('cancel-rebind'),
  minimizeControl: () => ipcRenderer.send('control-minimize'),
  quit: () => ipcRenderer.send('quit-app'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openLogs: () => ipcRenderer.send('open-logs'),
  checkUpdate: () => ipcRenderer.send('check-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_e, s) => cb(s)),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, s) => cb(s)),
  onGameState: (cb) => ipcRenderer.on('game-state', (_e, st) => cb(st)),
  resizeControl: (height) => ipcRenderer.send('resize-control', height),

  // --- overlay 用 ---
  onSetImage: (cb) => ipcRenderer.on('set-image', (_e, path) => cb(path)),
  onShowHud: (cb) => ipcRenderer.on('show-hud', (_e, text) => cb(text)),
  reportImageSize: (size) => ipcRenderer.send('image-natural-size', size),
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: (dx, dy) => ipcRenderer.send('drag-move', { dx, dy }),
  dragEnd: () => ipcRenderer.send('drag-end')
});
