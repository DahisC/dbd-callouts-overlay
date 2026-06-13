import { ref, computed, onMounted } from 'vue';

// overlay 的外觀 / 行為設定:啟動時從主程序載入、之後即時同步,
// 任何改動都回推主程序保存(主程序為單一真實來源)。
export function useSettings() {
  const enabled = ref(true);
  const imagePath = ref('');            // 目前地圖圖片路徑(與地圖下拉連動)
  const opacity = ref(0.5);
  const scale = ref(0.5);
  const clickThrough = ref(false);
  const hideWhenUnfocused = ref(true);

  // 把主程序送來的設定套用到本地 ref(載入時與之後變動時都會呼叫)
  function apply(s) {
    if (!s) return;
    enabled.value = s.enabled ?? true;
    imagePath.value = s.imagePath || '';
    opacity.value = s.opacity ?? 0.5;
    scale.value = s.scale ?? 0.5;
    clickThrough.value = !!s.clickThrough;
    hideWhenUnfocused.value = s.hideWhenUnfocused ?? true;
  }

  window.api.onSettings(apply);
  onMounted(async () => apply(await window.api.getSettings()));

  // 各開關 / 拉桿改動 → 回推主程序
  const onEnabled = () => window.api.setEnabled(enabled.value);
  const onOpacity = () => window.api.setOpacity(Number(opacity.value));
  const onScale = () => window.api.setScale(Number(scale.value));
  const onClickThrough = () => window.api.setClickThrough(clickThrough.value);
  const onHideUnfocused = () => window.api.setHideUnfocused(hideWhenUnfocused.value);

  // 拉桿填色比例(0.1~1 映射到 0~100%)
  const opacityFill = computed(() => `${((opacity.value - 0.1) / 0.9) * 100}%`);
  const scaleFill = computed(() => `${((scale.value - 0.1) / 0.9) * 100}%`);

  return {
    enabled, imagePath, opacity, scale, clickThrough, hideWhenUnfocused,
    opacityFill, scaleFill,
    onEnabled, onOpacity, onScale, onClickThrough, onHideUnfocused
  };
}
