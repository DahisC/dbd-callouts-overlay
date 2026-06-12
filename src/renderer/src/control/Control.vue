<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';

// ===== 狀態與接線(保留供之後的介面綁定,目前畫面未使用)=====
const imagePath = ref('');
const opacity = ref(0.5);
const scale = ref(0.5);
const clickThrough = ref(false);
const ocr = ref(null);
const maps = ref([]);
const selectedMap = ref('');
const game = ref({ running: false, focused: false }); // 遊戲狀態
const version = ref('');
const update = ref(null);   // 更新狀態 { state, percent, version, message }

// 目前地圖名稱(由選取/辨識的路徑推算)
const currentMapName = computed(() => {
  const p = selectedMap.value || imagePath.value;
  if (!p) return '未選擇';
  const m = maps.value.find((x) => x.path === p);
  return m ? m.name : p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
});

// 依遊戲狀態給對應的顏色 / 標題 / 提示
const status = computed(() => {
  if (!game.value.running) return { key: 'danger', title: '未偵測到遊戲', hint: '應用程式會自動偵測遊戲視窗\n請開啟遊戲' };
  if (!game.value.focused) return { key: 'warn', title: '已暫停', hint: '遊戲處於背景狀態時會自動暫停偵測\n請切換到遊戲視窗' };
  return { key: 'ok', title: '已就緒', hint: `按 Tab 開啟計分板以自動偵測地圖\n目前地圖：${currentMapName.value}` };
});

// 把目前內容高度回報給主程序,讓視窗高度貼合內容
function reportSize() {
  window.api.resizeControl(Math.ceil(document.body.scrollHeight));
}

onMounted(async () => {
  const s = await window.api.getSettings();
  applySettings(s);
  maps.value = await window.api.listMaps();
  version.value = await window.api.getVersion();
  await nextTick();
  reportSize();
  // 內容變動時自動重新貼合
  new ResizeObserver(reportSize).observe(document.body);
});

window.api.onSettings(applySettings);
window.api.onOcrResult((r) => { ocr.value = r; });
window.api.onGameState((st) => { game.value = st; });
window.api.onUpdateStatus((s) => { update.value = s; });

// 更新狀態文字
const updateText = computed(() => {
  const u = update.value;
  if (!u) return '';
  switch (u.state) {
    case 'checking': return '檢查更新中…';
    case 'available': return `發現新版 v${u.version}，下載中…`;
    case 'downloading': return `下載中 ${u.percent}%`;
    case 'downloaded': return `v${u.version} 已就緒`;
    case 'latest': return '已是最新版本';
    case 'dev': return '開發模式無法檢查更新';
    case 'error': return '檢查失敗，請稍後再試';
    default: return '';
  }
});

function checkUpdate() {
  update.value = { state: 'checking' };
  window.api.checkUpdate();
}
function installUpdate() { window.api.installUpdate(); }

const groupedMaps = computed(() => {
  const g = {};
  for (const m of maps.value) (g[m.group || '其他'] ||= []).push(m);
  return g;
});

// 拉桿填色比例
const opacityFill = computed(() => `${((opacity.value - 0.1) / 0.9) * 100}%`);
const scaleFill = computed(() => `${((scale.value - 0.1) / 0.9) * 100}%`);

function applySettings(s) {
  if (!s) return;
  imagePath.value = s.imagePath || '';
  opacity.value = s.opacity ?? 0.5;
  scale.value = s.scale ?? 0.5;
  clickThrough.value = !!s.clickThrough;
  selectedMap.value = s.imagePath || '';
}

function onSelectMap() {
  if (selectedMap.value) {
    window.api.selectMap(selectedMap.value);
    imagePath.value = selectedMap.value;
  }
}
function onOpacity() { window.api.setOpacity(Number(opacity.value)); }
function onScale() { window.api.setScale(Number(scale.value)); }
function onClickThrough() { window.api.setClickThrough(clickThrough.value); }
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
        <span v-else class="dot"></span>
      </div>
      <div class="dz-title">{{ status.title }}</div>
      <div class="dz-hint">{{ status.hint }}</div>
    </section>

    <!-- 滑鼠穿透 -->
    <label class="toggle">
      <span>滑鼠穿透</span>
      <input type="checkbox" v-model="clickThrough" @change="onClickThrough" /><i></i>
    </label>

    <!-- 大小 -->
    <section class="field">
      <div class="field-head"><span class="cap">大小</span><span class="val">{{ Math.round(scale * 100) }}%</span></div>
      <input class="slider" type="range" min="0.1" max="1" step="0.01"
             v-model="scale" @input="onScale" :style="{ '--fill': scaleFill }" />
    </section>

    <!-- 透明度 -->
    <section class="field">
      <div class="field-head"><span class="cap">透明度</span><span class="val">{{ Math.round(opacity * 100) }}%</span></div>
      <input class="slider" type="range" min="0.1" max="1" step="0.01"
             v-model="opacity" @input="onOpacity" :style="{ '--fill': opacityFill }" />
    </section>

    <!-- 更新 -->
    <div class="update">
      <button
        v-if="update && update.state === 'downloaded'"
        class="upd-btn ready"
        @click="installUpdate">重啟以安裝更新</button>
      <button
        v-else
        class="upd-btn"
        :disabled="update && (update.state === 'checking' || update.state === 'downloading')"
        @click="checkUpdate">檢查更新</button>
      <span v-if="updateText" class="upd-text" :class="update.state">{{ updateText }}</span>
    </div>

    <footer class="credit">
      <span>Designed by <b>Pocky</b></span>
      <span v-if="version" class="ver">v{{ version }}</span>
    </footer>
    </div>
  </div>
</template>

<style>
:root {
  --bg: #0d0e12;
  --text: #ecedf2;
  --muted: #8a8b98;
  --ui: "Noto Sans TC", "Microsoft JhengHei", "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); overflow: hidden; }

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
.field-head { display: flex; justify-content: space-between; align-items: baseline; }
.cap { font-size: 12.5px; color: var(--muted); letter-spacing: 0.5px; }
.val { font-size: 12.5px; font-weight: 600; color: #c2c3cd; font-variant-numeric: tabular-nums; }

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
.upd-text { font-size: 11px; color: var(--muted); }
.upd-text.downloaded { color: #46d6a0; }
.upd-text.error { color: #e0a23c; }

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
</style>
