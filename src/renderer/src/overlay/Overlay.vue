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

// 擷取回饋:擷取中 → 變暗+轉圈圈;成功/失敗 → 閃綠/紅邊框;成功另在中央顯示地圖名 3 秒
const capturing = ref(false);
const flash = ref(''); // '' | 'ok' | 'fail'
const mapName = ref(''); // 成功時短暫顯示的地圖名
const failMsg = ref(''); // 失敗時短暫顯示的提示
let flashTimer: ReturnType<typeof setTimeout> | null = null;
let nameTimer: ReturnType<typeof setTimeout> | null = null;
let failTimer: ReturnType<typeof setTimeout> | null = null;
window.api.onCaptureStatus(({ state, name, key }) => {
  capturing.value = state === 'capturing';
  if (state === 'success' || state === 'fail') {
    flash.value = state === 'success' ? 'ok' : 'fail';
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flash.value = ''; }, 1000);
  }
  if (state === 'success' && name) {
    mapName.value = name;
    if (nameTimer) clearTimeout(nameTimer);
    nameTimer = setTimeout(() => { mapName.value = ''; }, 3000);
  }
  if (state === 'fail') {
    failMsg.value = `請在開啟計分板的情況下按下擷取鍵${key || ''}`;
    if (failTimer) clearTimeout(failTimer);
    failTimer = setTimeout(() => { failMsg.value = ''; }, 3000);
  }
});
</script>

<template>
  <div class="wrap" @mousedown="onMouseDown">
    <img v-if="src" :src="src" @load="onImgLoad" draggable="false" />
    <div v-else class="hint">地圖未載入</div>
    <div class="hud" :class="{ show: hudShow }">{{ hud }}</div>
    <!-- 擷取中:遮罩 + 轉圈圈 -->
    <div v-if="capturing" class="cap-mask"><div class="spinner"></div></div>
    <!-- 結果:閃綠/紅邊框 -->
    <div v-if="flash" class="flash" :class="flash"></div>
    <!-- 辨識成功:中央短暫顯示地圖名 -->
    <div v-if="mapName" class="map-name">{{ mapName }}</div>
    <!-- 辨識失敗:中央短暫顯示提示 -->
    <div v-if="failMsg" class="map-name fail-msg">{{ failMsg }}</div>
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

/* 辨識成功:地圖名置中浮現,3 秒內淡入 → 停留 → 淡出 */
.map-name {
  position: absolute;
  top: 50%;
  left: 50%;
  width: max-content;
  max-width: 90%;
  padding: 6px 14px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-family: "Microsoft JhengHei", sans-serif;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  line-height: 1.35;
  box-sizing: border-box;
  pointer-events: none;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
  animation: name-pop 3s ease-out forwards;
}
@keyframes name-pop {
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
  8%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  82%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
}

/* 結果邊框閃爍:成功綠、失敗紅 */
.flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 3px solid;
  border-radius: 4px;
  box-sizing: border-box;
  animation: flash-blink 1s ease-out forwards;
}
.flash.ok { border-color: #46d6a0; box-shadow: inset 0 0 14px rgba(70, 214, 160, 0.6); }
.flash.fail { border-color: #e0322f; box-shadow: inset 0 0 14px rgba(224, 50, 47, 0.6); }
@keyframes flash-blink {
  0%, 40%, 80% { opacity: 1; }
  20%, 60%, 100% { opacity: 0; }
}
</style>
