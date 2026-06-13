// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { useSettings } from '../src/renderer/src/composables/useSettings.js';

// 在真正的元件 setup 內呼叫 composable,讓 onMounted 正常觸發
function withSetup(composable) {
  let result;
  const app = createApp({ setup() { result = composable(); return () => null; } });
  app.mount(document.createElement('div'));
  return [result, app];
}

let onSettingsCb;   // 捕捉 composable 註冊的設定同步回呼
beforeEach(() => {
  window.api = {
    getSettings: vi.fn().mockResolvedValue({
      enabled: false, imagePath: 'C:/m/a.png', opacity: 0.8, scale: 0.3,
      clickThrough: true, hideWhenUnfocused: false
    }),
    onSettings: (cb) => { onSettingsCb = cb; },
    setEnabled: vi.fn(), setOpacity: vi.fn(), setScale: vi.fn(),
    setClickThrough: vi.fn(), setHideUnfocused: vi.fn()
  };
});

describe('useSettings', () => {
  it('掛載時從主程序載入設定', async () => {
    const [s] = withSetup(useSettings);
    await flushPromises();
    expect(s.enabled.value).toBe(false);
    expect(s.opacity.value).toBe(0.8);
    expect(s.clickThrough.value).toBe(true);
    expect(s.hideWhenUnfocused.value).toBe(false);
  });

  it('主程序推送設定時即時同步', async () => {
    const [s] = withSetup(useSettings);
    await flushPromises();
    onSettingsCb({ enabled: true, opacity: 0.5 });
    expect(s.enabled.value).toBe(true);
    expect(s.opacity.value).toBe(0.5);
  });

  it('缺欄位回到預設值', async () => {
    const [s] = withSetup(useSettings);
    await flushPromises();
    onSettingsCb({});
    expect(s.enabled.value).toBe(true);
    expect(s.hideWhenUnfocused.value).toBe(true);
  });

  it('改動後回推主程序對應 setter', async () => {
    const [s] = withSetup(useSettings);
    await flushPromises();
    s.opacity.value = 0.42;
    s.onOpacity();
    expect(window.api.setOpacity).toHaveBeenCalledWith(0.42);
    s.clickThrough.value = true;
    s.onClickThrough();
    expect(window.api.setClickThrough).toHaveBeenCalledWith(true);
  });

  it('拉桿填色比例(0.1~1 → 0~100%)', async () => {
    const [s] = withSetup(useSettings);
    await flushPromises();
    onSettingsCb({ opacity: 0.1, scale: 1 });
    expect(s.opacityFill.value).toBe('0%');
    expect(s.scaleFill.value).toBe('100%');
  });
});
