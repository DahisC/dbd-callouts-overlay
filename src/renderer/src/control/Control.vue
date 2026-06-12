<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';

// ===== 狀態與接線(保留供之後的介面綁定,目前畫面未使用)=====
const imagePath = ref('');
const opacity = ref(0.85);
const scale = ref(0.5);
const ocr = ref(null);
const maps = ref([]);
const selectedMap = ref('');
const game = ref({ running: false, focused: false }); // 遊戲狀態

// 依遊戲狀態給對應的顏色 / 標題 / 提示
const status = computed(() => {
  if (!game.value.running) return { key: 'danger', title: '未偵測到遊戲', hint: '應用程式會自動偵測遊戲視窗\n請開啟遊戲' };
  if (!game.value.focused) return { key: 'warn', title: '已暫停', hint: '遊戲處於背景狀態時會自動暫停偵測\n請切換到遊戲視窗' };
  return { key: 'ok', title: '已就緒', hint: '按 Tab 開啟計分板以自動偵測地圖' };
});

// 把目前內容高度回報給主程序,讓視窗高度貼合內容
function reportSize() {
  window.api.resizeControl(Math.ceil(document.body.scrollHeight));
}

onMounted(async () => {
  const s = await window.api.getSettings();
  applySettings(s);
  maps.value = await window.api.listMaps();
  await nextTick();
  reportSize();
  // 內容變動時自動重新貼合
  new ResizeObserver(reportSize).observe(document.body);
});

window.api.onSettings(applySettings);
window.api.onOcrResult((r) => { ocr.value = r; });
window.api.onGameState((st) => { game.value = st; });

const groupedMaps = computed(() => {
  const g = {};
  for (const m of maps.value) (g[m.group || '其他'] ||= []).push(m);
  return g;
});

function applySettings(s) {
  if (!s) return;
  imagePath.value = s.imagePath || '';
  opacity.value = s.opacity ?? 0.85;
  scale.value = s.scale ?? 0.5;
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
function quit() { window.api.quit(); }
</script>

<template>
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
html, body { margin: 0; background: var(--bg); }

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
</style>
