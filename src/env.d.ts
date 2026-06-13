/// <reference types="vite/client" />

// ===== 共用領域型別(全域 ambient) =====

interface MapItem {
  name: string;
  path: string;
  group: string;
}

interface Settings {
  enabled: boolean;
  imagePath: string;
  opacity: number;
  scale: number;
  x: number;
  y: number;
  clickThrough: boolean;
  onlyWhenDbdFocused: boolean;
  hideWhenUnfocused: boolean;
}

interface UpdateStatus {
  state: 'checking' | 'available' | 'downloading' | 'downloaded' | 'latest' | 'dev' | 'error';
  percent?: number;
  version?: string;
  message?: string;
}

interface GameState {
  focused: boolean;
}

// preload 經 contextBridge 暴露到 window.api 的介面
interface Api {
  // 控制台
  pickImage(): Promise<string | null>;
  listMaps(): Promise<MapItem[]>;
  selectMap(path: string): void;
  getSettings(): Promise<Settings>;
  getVersion(): Promise<string>;
  setEnabled(v: boolean): void;
  setOpacity(v: number): void;
  setScale(v: number): void;
  setClickThrough(v: boolean): void;
  setOnlyDbd(v: boolean): void;
  setHideUnfocused(v: boolean): void;
  resetPosition(): void;
  minimizeControl(): void;
  quit(): void;
  openExternal(url: string): void;
  checkUpdate(): void;
  installUpdate(): void;
  onUpdateStatus(cb: (s: UpdateStatus) => void): void;
  onSettings(cb: (s: Settings) => void): void;
  onGameState(cb: (st: GameState) => void): void;
  resizeControl(height: number): void;
  // overlay
  onSetImage(cb: (dataUrl: string) => void): void;
  onShowHud(cb: (text: string) => void): void;
  reportImageSize(size: { w: number; h: number }): void;
  dragStart(): void;
  dragMove(dx: number, dy: number): void;
  dragEnd(): void;
}

interface Window {
  api: Api;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
