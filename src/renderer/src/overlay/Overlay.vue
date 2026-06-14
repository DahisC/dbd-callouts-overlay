<script setup lang="ts">
import { ref } from 'vue';
import { useHud } from '../composables/useHud';
import { useOverlayDrag } from '../composables/useOverlayDrag';

// 地圖圖片(主程序送來的已是 data URL,直接用)
const src = ref('');
window.api.onSetImage((dataUrl) => { src.value = dataUrl || ''; });

// 圖片載入完成後,把原始尺寸回報給主程序以決定視窗大小
function onImgLoad(e) {
  window.api.reportImageSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
}

// 數值提示 HUD(調整大小 / 透明度時浮現)
const { hud, hudShow } = useHud();

// 自訂拖曳(回傳的 onMouseDown 綁在容器上)
const { onMouseDown } = useOverlayDrag();

// 擷取讀取效果:主程序通知擷取中 → 地圖變暗 + 轉圈圈
const capturing = ref(false);
window.api.onCaptureStatus((on) => { capturing.value = on; });
</script>

<template>
  <div class="wrap" @mousedown="onMouseDown">
    <img v-if="src" :src="src" @load="onImgLoad" draggable="false" />
    <div v-else class="hint">地圖未載入</div>
    <div class="hud" :class="{ show: hudShow }">{{ hud }}</div>
    <!-- 擷取中:遮罩 + 轉圈圈 -->
    <div v-if="capturing" class="cap-mask"><div class="spinner"></div></div>
  </div>
</template>

<style>
/* 只把數字(0-9)指到乾淨的系統 Latin 字,讓 HUD 的「大小/透明度 %」數字不帶襯線 */
@font-face {
  font-family: 'CleanDigits';
  src: local('Segoe UI'), local('Arial');
  unicode-range: U+0030-0039;
}
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  -webkit-user-select: none;
  user-select: none;
}
.wrap {
  width: 100%;
  height: 100%;
  position: relative;
  cursor: move; /* 自己接管拖曳,讓主程序即時夾住邊界 */
}
.hud {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 14px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-family: "CleanDigits", "Microsoft JhengHei", sans-serif;
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.25s;
}
.hud.show { opacity: 1; }
img {
  width: 100%;
  height: 100%;
  object-fit: fill;
  display: block;
  -webkit-user-select: none;
  user-select: none;
}
.hint {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: "Microsoft JhengHei", sans-serif;
  font-size: 13px;
  color: #fff;
  background: rgba(0, 0, 0, 0.45);
  border: 1px dashed rgba(255, 255, 255, 0.5);
  box-sizing: border-box;
}

/* 擷取讀取效果:遮罩 + 轉圈圈 */
.cap-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: none;
}
.spinner {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
