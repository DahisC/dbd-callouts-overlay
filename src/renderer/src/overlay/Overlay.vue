<script setup>
import { ref } from 'vue';

const src = ref('');

// 主程序送來的已是 data URL,直接用
window.api.onSetImage((dataUrl) => {
  src.value = dataUrl || '';
});

// 調整大小/透明度時,在圖上浮現數值約 1 秒後淡出
const hud = ref('');
const hudShow = ref(false);
let hudTimer = null;
window.api.onShowHud((text) => {
  hud.value = text;
  hudShow.value = true;
  if (hudTimer) clearTimeout(hudTimer);
  hudTimer = setTimeout(() => { hudShow.value = false; }, 1000);
});

// 圖片載入完成後,把原始尺寸回報給主程序以決定視窗大小
function onImgLoad(e) {
  window.api.reportImageSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
}

// --- 自訂拖曳:用滑鼠在螢幕上的位移驅動,主程序會即時夾在邊界內 ---
let dragging = false;
let startX = 0;
let startY = 0;

function onMouseDown(e) {
  if (e.button !== 0) return;        // 只接受左鍵
  dragging = true;
  startX = e.screenX;
  startY = e.screenY;
  window.api.dragStart();
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
  if (!dragging) return;
  window.api.dragMove(e.screenX - startX, e.screenY - startY);
}

function onMouseUp() {
  dragging = false;
  window.api.dragEnd();
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
}
</script>

<template>
  <div class="wrap" @mousedown="onMouseDown">
    <img v-if="src" :src="src" @load="onImgLoad" draggable="false" />
    <div v-else class="hint">尚未選擇圖片<br />（在控制台選擇地圖）</div>
    <div class="hud" :class="{ show: hudShow }">{{ hud }}</div>
  </div>
</template>

<style>
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
  font-family: "Microsoft JhengHei", sans-serif;
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
</style>
