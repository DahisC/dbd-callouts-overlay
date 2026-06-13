// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUpdater } from '../src/renderer/src/composables/useUpdater.js';

// 更新按鈕:所有狀態整合在單一按鈕,測文字 / disabled / 點擊行為。
let pushStatus;   // 捕捉 composable 註冊的更新狀態回呼,用來模擬主程序推送

beforeEach(() => {
  window.api = {
    onUpdateStatus: (cb) => { pushStatus = cb; },
    checkUpdate: vi.fn(),
    installUpdate: vi.fn()
  };
});

describe('useUpdater', () => {
  it('預設顯示「檢查更新」、可點、非下載完成', () => {
    const u = useUpdater();
    expect(u.updBtnText.value).toBe('檢查更新');
    expect(u.updBtnBusy.value).toBe(false);
    expect(u.isDownloaded.value).toBe(false);
  });

  it('下載中 → 顯示進度且 disable', () => {
    const u = useUpdater();
    pushStatus({ state: 'downloading', percent: 42 });
    expect(u.updBtnText.value).toBe('下載中 42%');
    expect(u.updBtnBusy.value).toBe(true);
  });

  it('下載完成 → 顯示安裝,點擊呼叫 installUpdate', () => {
    const u = useUpdater();
    pushStatus({ state: 'downloaded', version: '1.2.3' });
    expect(u.isDownloaded.value).toBe(true);
    expect(u.updBtnText.value).toBe('重啟以安裝更新');
    u.onUpdateClick();
    expect(window.api.installUpdate).toHaveBeenCalled();
  });

  it('未下載完成時點擊 → 呼叫 checkUpdate', () => {
    const u = useUpdater();
    u.onUpdateClick();
    expect(window.api.checkUpdate).toHaveBeenCalled();
  });

  it('各狀態顯示對應文字(逗號全形)', () => {
    const u = useUpdater();
    pushStatus({ state: 'latest' });
    expect(u.updBtnText.value).toBe('已是最新版本');
    pushStatus({ state: 'error' });
    expect(u.updBtnText.value).toBe('檢查失敗，請稍後再試');
  });
});
