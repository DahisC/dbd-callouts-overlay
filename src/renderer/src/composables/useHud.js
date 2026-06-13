import { ref } from 'vue';

// 在 overlay 圖上短暫浮現數值提示(調整大小 / 透明度時),約 1 秒後淡出。
export function useHud() {
  const hud = ref('');
  const hudShow = ref(false);
  let hudTimer = null;

  window.api.onShowHud((text) => {
    hud.value = text;
    hudShow.value = true;
    if (hudTimer) clearTimeout(hudTimer);
    hudTimer = setTimeout(() => { hudShow.value = false; }, 1000);
  });

  return { hud, hudShow };
}
