<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSettings } from '../composables/useSettings';
import { useMaps } from '../composables/useMaps';
import { useUpdater } from '../composables/useUpdater';
import { useGameStatus } from '../composables/useGameStatus';
import { useAutoFit } from '../composables/useAutoFit';

const isDev = import.meta.env.DEV;  // 開發模式(打包後為 false)

// 外觀 / 行為設定(啟用、透明度、大小、滑鼠穿透、只在遊戲時顯示)
const {
  enabled, imagePath, opacity, scale, clickThrough, hideWhenUnfocused,
  opacityFill, scaleFill,
  onEnabled, onOpacity, onScale, onClickThrough, onHideUnfocused
} = useSettings();

// 地圖清單與目前選取(下拉與 imagePath 連動)
const { currentMapName } = useMaps(imagePath);

// 自動更新(狀態 / 按鈕文字 / 點擊)
const { update, isDownloaded, updBtnText, updBtnBusy, onUpdateClick } = useUpdater();

// DBD 前景狀態
const { focused } = useGameStatus();

// 視窗高度自動貼合內容
useAutoFit();

// 應用程式版本(footer 顯示)
const version = ref('');
onMounted(async () => { version.value = await window.api.getVersion(); });

// 依啟用 / 前景狀態給對應的顏色 / 標題 / 提示
const status = computed(() => {
  if (!enabled.value) return { key: 'off', title: '未啟用', hint: '地圖已關閉\n點選「啟用」以查看地圖' };
  if (!focused.value) return { key: 'danger', title: '未偵測到遊戲', hint: '應用程式會自動偵測遊戲視窗\n請開啟遊戲' };
  return { key: 'ok', title: '已就緒', hint: `按 Tab 開啟計分板以自動偵測地圖\n目前地圖：${currentMapName.value}` };
});

// 視窗控制
function minimize() { window.api.minimizeControl(); }
function quit() { window.api.quit(); }
</script>

<template>
  <div class="root">
    <!-- 自訂標題列 -->
    <header class="titlebar">
      <span class="tb-title">DBD CALLOUTS OVERLAY</span>
      <div class="tb-controls">
        <button class="tb-btn" @click="minimize" aria-label="最小化">
          <svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg>
        </button>
        <button class="tb-btn close" @click="quit" aria-label="關閉">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </header>

    <div class="app">
    <!-- 啟用 -->
    <label class="toggle">
      <span>啟用</span>
      <input type="checkbox" v-model="enabled" @change="onEnabled" /><i></i>
    </label>

    <!-- 虛線區塊:遊戲狀態提示 -->
    <section class="dashed" :class="status.key">
      <div class="ic-slot">
        <svg v-if="status.key === 'danger'" class="ic" viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
        <svg v-else-if="status.key === 'warn'" class="ic ic-pause" viewBox="0 0 24 24">
          <rect x="5" y="5" width="4.5" height="14" rx="2.25" />
          <rect x="14.5" y="5" width="4.5" height="14" rx="2.25" />
        </svg>
        <svg v-else-if="status.key === 'off'" class="ic ic-zzz" viewBox="0 0 24 24">
          <path d="M6 12 H11 L6 17 H11" transform="rotate(-10 8.5 14.5)" />
          <path d="M13 4 H21 L13 12 H21" transform="rotate(7 17 8)" />
        </svg>
        <span v-else class="dot"></span>
      </div>
      <div class="dz-title">{{ status.title }}</div>
      <div class="dz-hint">{{ status.hint }}</div>
    </section>

    <template v-if="enabled">
    <!-- 滑鼠穿透 -->
    <label class="toggle">
      <span>滑鼠穿透</span>
      <input type="checkbox" v-model="clickThrough" @change="onClickThrough" /><i></i>
    </label>

    <!-- 不在前景時隱藏地圖 -->
    <label class="toggle">
      <span>只在遊戲時顯示地圖</span>
      <input type="checkbox" v-model="hideWhenUnfocused" @change="onHideUnfocused" /><i></i>
    </label>

    <!-- 大小 -->
    <section class="field">
      <div class="field-head"><span class="cap">大小<span class="keys">
        <kbd><svg viewBox="0 0 12 12"><path d="M6 3.0 L9.3 6.3 L7.2 6.3 L7.2 9.3 L4.8 9.3 L4.8 6.3 L2.7 6.3 Z" /></svg></kbd>
        <kbd><svg viewBox="0 0 12 12"><path d="M6 9.0 L2.7 5.7 L4.8 5.7 L4.8 2.7 L7.2 2.7 L7.2 5.7 L9.3 5.7 Z" /></svg></kbd>
      </span></span><span class="val">{{ Math.round(scale * 100) }}%</span></div>
      <input class="slider" type="range" min="0.1" max="1" step="0.01"
             v-model="scale" @input="onScale" :style="{ '--fill': scaleFill }" />
    </section>

    <!-- 透明度 -->
    <section class="field">
      <div class="field-head"><span class="cap">透明度<span class="keys">
        <kbd><svg viewBox="0 0 12 12"><path d="M3.0 6 L6.3 2.7 L6.3 4.8 L9.3 4.8 L9.3 7.2 L6.3 7.2 L6.3 9.3 Z" /></svg></kbd>
        <kbd><svg viewBox="0 0 12 12"><path d="M9.0 6 L5.7 9.3 L5.7 7.2 L2.7 7.2 L2.7 4.8 L5.7 4.8 L5.7 2.7 Z" /></svg></kbd>
      </span></span><span class="val">{{ Math.round(opacity * 100) }}%</span></div>
      <input class="slider" type="range" min="0.1" max="1" step="0.01"
             v-model="opacity" @input="onOpacity" :style="{ '--fill': opacityFill }" />
    </section>
    </template>

    <!-- 更新:所有狀態(含下載進度、下載完成安裝)整合在同一顆按鈕 -->
    <div class="update">
      <button
        class="upd-btn"
        :class="isDownloaded ? 'ready' : (update && update.state)"
        :disabled="updBtnBusy"
        @click="onUpdateClick">{{ updBtnText }}</button>
    </div>

    <footer class="credit">
      <span>Designed by <b>Pocky</b></span>
      <span v-if="isDev" class="ver dev-tag">Develop</span>
      <span v-else-if="version" class="ver">v{{ version }}</span>
    </footer>
    </div>
  </div>
</template>

<style>
/* 子集化的 Noto Sans TC(可變字重,只含介面+地圖名用到的字)*/
@font-face {
  font-family: 'Noto Sans TC';
  src: url('../assets/notosanstc-subset.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-display: swap;
}

:root {
  --bg: #0d0e12;
  --text: #ecedf2;
  --muted: #8a8b98;
  --ui: "Noto Sans TC", "Microsoft JhengHei", "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); overflow: hidden; }
/* 整個視窗禁止選取 / 複製文字 */
body {
  -webkit-user-select: none;
  user-select: none;
  cursor: default;
}

/* ===== 自訂標題列 ===== */
.titlebar {
  -webkit-app-region: drag;   /* 整條可拖曳移動視窗 */
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-family: var(--ui);
}
.tb-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--muted);
}
.tb-controls { display: flex; height: 100%; -webkit-app-region: no-drag; }
.tb-btn {
  width: 44px; height: 38px;
  border: none; background: transparent;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: var(--muted);
  transition: background 0.15s, color 0.15s;
}
.tb-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.tb-btn:hover { background: rgba(255, 255, 255, 0.07); color: var(--text); }
.tb-btn.close:hover { background: #e0322f; color: #fff; }

.app {
  padding: 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: var(--ui);
  color: var(--text);
  background: var(--bg);
}

/* ===== 虛線狀態區塊 ===== */
.dashed {
  --c: 160, 160, 170;        /* 狀態色 RGB,由 .danger/.warn/.ok 覆寫 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 150px;
  padding: 18px;
  border-radius: 16px;
  border: 2px dashed rgba(var(--c), 0.5);
  background: rgba(var(--c), 0.07);
  text-align: center;
  transition: border-color 0.35s, background 0.35s, color 0.35s;
}
.dashed.off    { --c: 138, 139, 152; } /* 灰 */
.dashed.danger { --c: 224, 80, 77; }   /* 紅 */
.dashed.warn   { --c: 230, 181, 63; }  /* 黃 */
.dashed.ok     { --c: 70, 214, 160; }  /* 綠 */

/* 圖示固定槽位,讓三種狀態的圖示對齊一致 */
.ic-slot {
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dashed .dot {
  width: 11px; height: 11px;
  border-radius: 50%;
  background: rgb(var(--c));
  box-shadow: 0 0 12px rgba(var(--c), 0.7);
  transition: background 0.35s, box-shadow 0.35s;
}
.dashed.ok .dot { animation: pulse 1.8s infinite; }

.dashed .ic {
  width: 20px; height: 20px;
  fill: none;
  stroke: rgb(var(--c));
  stroke-width: 2.6;
  stroke-linecap: round;
  filter: drop-shadow(0 0 8px rgba(var(--c), 0.6));
}
.dashed .ic-pause { fill: rgb(var(--c)); stroke: none; }

/* 未啟用:兩個大小遞增、角度各異的 z(睡覺 Zzz) */
.dashed .ic-zzz {
  fill: none;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dz-title {
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: rgb(var(--c));
  transition: color 0.35s;
}
.dz-hint {
  font-size: 12px;
  color: var(--muted);
  white-space: pre-line;
  line-height: 1.65;
  min-height: 3.3em;   /* 預留兩行高度,讓三種狀態版面一致 */
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(var(--c), 0.55); }
  70% { box-shadow: 0 0 0 9px rgba(var(--c), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--c), 0); }
}

/* ===== 拉桿 ===== */
.field { display: flex; flex-direction: column; gap: 11px; }
.field-head { display: flex; justify-content: space-between; align-items: center; }
.cap { display: inline-flex; align-items: center; font-size: 12.5px; color: var(--muted); letter-spacing: 0.5px; }
.val { font-size: 12.5px; font-weight: 600; color: #c2c3cd; font-variant-numeric: tabular-nums; }

/* 方向鍵提示鍵帽 */
.keys { display: inline-flex; gap: 3px; margin-left: 7px; vertical-align: middle; }
.keys kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px; height: 16px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  /* 立體底邊用陰影,不動到內容區,保持箭頭精準置中 */
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
}
.keys svg {
  display: block;
  width: 11px; height: 11px;
}
.keys svg path {
  fill: #b6b7c2;
  stroke: #b6b7c2;
  stroke-width: 1;       /* 同色描邊 + 圓角讓實心箭頭的尖角圓潤一點 */
  stroke-linejoin: round;
}

.slider {
  -webkit-appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 999px;
  cursor: pointer;
  background: linear-gradient(90deg,
    rgba(255, 255, 255, 0.85) 0 var(--fill),
    rgba(255, 255, 255, 0.08) var(--fill) 100%);
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #f3f3f6;
  border: none;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.55);
  transition: transform 0.12s;
}
.slider::-webkit-slider-thumb:hover { transform: scale(1.14); }

/* ===== 開關 ===== */
.toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;        /* 與 .cap 一致 */
  color: var(--muted);
  letter-spacing: 0.5px;
  cursor: pointer;
}
.toggle input { display: none; }
.toggle i {
  width: 38px; height: 20px;
  flex: none;
  position: relative;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
}
.toggle i::after {
  content: '';
  position: absolute; top: 3px; left: 3px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #9a9ba6;
  transition: transform 0.2s, background 0.2s;
}
.toggle input:checked + i { background: rgba(255, 255, 255, 0.9); }
.toggle input:checked + i::after { transform: translateX(18px); background: #16171f; }

/* ===== 更新 ===== */
.update {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding-top: 16px;
}
.update::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
}
.upd-btn {
  width: 100%;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: var(--ui);
  font-size: 13px;
  cursor: pointer;
  transition: 0.15s;
}
.upd-btn:hover:not(:disabled) { background: rgba(255, 255, 255, 0.09); border-color: rgba(255, 255, 255, 0.16); }
.upd-btn:disabled { opacity: 0.5; cursor: default; }
.upd-btn.ready { background: #46d6a0; border-color: #46d6a0; color: #0d2a1f; font-weight: 700; }
.upd-btn.ready:hover { background: #54e2ad; }
/* 狀態文字直接顯示在按鈕內,錯誤用琥珀色提示 */
.upd-btn.error { color: #e0a23c; }
.upd-btn.dev { color: var(--muted); }

/* ===== 作者署名 ===== */
.credit {
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10.5px;
  letter-spacing: 1px;
  color: #5c5d68;
}
.credit b { font-weight: 700; color: #9a9ba6; }
.credit .ver { color: #6c6d78; }
/* 開發模式標記 */
.credit .dev-tag { color: #e0a23c; font-weight: 700; letter-spacing: 0.5px; }
</style>
