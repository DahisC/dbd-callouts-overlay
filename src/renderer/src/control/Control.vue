<script setup>
import { ref, computed, onMounted } from 'vue';

const imagePath = ref('');
const opacity = ref(0.85);
const scale = ref(0.5);
const ocr = ref(null);        // 最近一次辨識結果
const maps = ref([]);         // 內建地圖清單 [{name, path, group}]
const selectedMap = ref('');  // 下拉目前選的路徑

onMounted(async () => {
  const s = await window.api.getSettings();
  applySettings(s);
  maps.value = await window.api.listMaps();
});

window.api.onSettings(applySettings);
window.api.onOcrResult((r) => { ocr.value = r; });

// 依地區分組
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
  <div class="panel">
    <!-- 主框:自動切換說明 + 狀態 -->
    <div class="hero">
      <div class="hero-top">
        <kbd>TAB</kbd>
        <div class="hero-text">
          <div class="hero-title">自動切換地圖</div>
          <div class="hero-sub">遊戲中按 <b>Tab</b> 開啟計分板,即自動辨識並切換地圖</div>
        </div>
      </div>
      <div class="hero-status" :class="ocr ? (ocr.switched ? 'ok' : 'warn') : 'idle'">
        <span class="dot"></span>
        <template v-if="!ocr">等待中 — 進遊戲開啟計分板</template>
        <template v-else-if="ocr.switched">已切換:{{ ocr.match }}</template>
        <template v-else>未辨識成功(相似度 {{ ocr.score.toFixed(2) }})</template>
      </div>
    </div>

    <!-- 手動選圖 -->
    <div class="field">
      <span class="label">地圖</span>
      <select v-model="selectedMap" @change="onSelectMap">
        <option value="" disabled>— 手動選擇 —</option>
        <optgroup v-for="(items, realm) in groupedMaps" :key="realm" :label="realm">
          <option v-for="m in items" :key="m.path" :value="m.path">{{ m.name }}</option>
        </optgroup>
      </select>
    </div>

    <!-- 滑桿 -->
    <div class="field">
      <div class="label-row"><span class="label">透明度</span><span class="val">{{ Math.round(opacity * 100) }}%</span></div>
      <input type="range" min="0.1" max="1" step="0.01" v-model="opacity" @input="onOpacity" />
    </div>
    <div class="field">
      <div class="label-row"><span class="label">大小</span><span class="val">{{ Math.round(scale * 100) }}%</span></div>
      <input type="range" min="0.1" max="2" step="0.01" v-model="scale" @input="onScale" />
    </div>

    <!-- 底部 -->
    <div class="footer">
      <button class="ghost danger" @click="quit">關閉程式</button>
    </div>
  </div>
</template>

<style>
* { box-sizing: border-box; }
:root {
  --bg: #15161a;
  --card: #1f2128;
  --card2: #262830;
  --line: #313340;
  --text: #e9e9ee;
  --muted: #8a8b95;
  --accent: #e23b3b;
}
body {
  margin: 0;
  font-family: "Microsoft JhengHei", "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
  user-select: none;
}
.panel { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

/* ===== Hero ===== */
.hero {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: linear-gradient(150deg, #2a1518 0%, #1c1d24 55%);
  padding: 16px;
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
}
.hero-top { display: flex; align-items: center; gap: 14px; }
kbd {
  flex: none;
  font-family: inherit;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 1px;
  color: #fff;
  background: linear-gradient(180deg, #3a3c45, #23242b);
  border: 1px solid #4a4c57;
  border-bottom-width: 3px;
  border-radius: 8px;
  padding: 8px 12px;
}
.hero-title { font-size: 16px; font-weight: 800; letter-spacing: .5px; }
.hero-sub { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.5; }
.hero-sub b { color: var(--accent); }
.hero-status {
  display: flex; align-items: center; gap: 8px;
  margin-top: 14px; padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 12.5px; font-weight: 600;
}
.hero-status .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.hero-status.idle { color: var(--muted); }
.hero-status.idle .dot { background: #6a6b75; }
.hero-status.ok { color: #5cd6a0; }
.hero-status.ok .dot { background: #3ecf8e; box-shadow: 0 0 8px #3ecf8e88; }
.hero-status.warn { color: #e0b250; }
.hero-status.warn .dot { background: #e0b250; }

/* ===== Fields ===== */
.field { display: flex; flex-direction: column; gap: 7px; }
.label { font-size: 12.5px; color: var(--muted); }
.label-row { display: flex; justify-content: space-between; align-items: baseline; }
.val { font-size: 13px; font-weight: 700; color: var(--accent); }

select {
  width: 100%; padding: 9px 11px; border-radius: 8px;
  background: var(--card2); color: var(--text);
  border: 1px solid var(--line); font-size: 13px; cursor: pointer;
}
select:focus { outline: none; border-color: var(--accent); }

input[type="range"] {
  -webkit-appearance: none; width: 100%; height: 5px; border-radius: 4px;
  background: var(--card2); cursor: pointer;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
  background: var(--accent); border: 2px solid #fff2; box-shadow: 0 0 6px #e23b3b66;
}

/* ===== Toggle ===== */
.toggle {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; cursor: pointer; padding: 2px 0;
}
.toggle input { display: none; }
.toggle i {
  width: 38px; height: 22px; border-radius: 22px; background: var(--card2);
  border: 1px solid var(--line); position: relative; transition: .2s; flex: none;
}
.toggle i::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 16px; height: 16px; border-radius: 50%; background: #9a9ba4; transition: .2s;
}
.toggle input:checked + i { background: var(--accent); border-color: var(--accent); }
.toggle input:checked + i::after { transform: translateX(16px); background: #fff; }

/* ===== Footer ===== */
.footer { display: flex; gap: 8px; margin-top: 2px; }
button.ghost {
  flex: 1; padding: 9px 6px; border-radius: 8px; cursor: pointer;
  background: var(--card2); color: var(--text);
  border: 1px solid var(--line); font-size: 12.5px; transition: .15s;
}
button.ghost:hover { background: #30323b; border-color: #45474f; }
button.ghost.danger:hover { background: #3a1f1f; border-color: #6e3333; color: #ff8a8a; }
</style>
