<script setup lang="ts">
import { ref } from 'vue';

// 擷取回饋小視窗:主程序在按下擷取鍵時推送狀態,釘在螢幕左上短暫顯示。
const state = ref('');
const text = ref('');
const ICON: Record<string, string> = { capturing: '⟳', switched: '✓', skipped: '✗' };

window.api.onToast((t) => {
  state.value = t.state;
  text.value = t.text;
});
</script>

<template>
  <div class="toast" :class="state">
    <span class="icon">{{ ICON[state] || '' }}</span>
    <span class="msg">{{ text }}</span>
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  overflow: hidden;
  -webkit-user-select: none;
  user-select: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 100%;
  padding: 0 16px;
  box-sizing: border-box;
  background: rgba(13, 14, 18, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 3px solid #8a8b98;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
  font-family: "Microsoft JhengHei", "Segoe UI", sans-serif;
  color: #ecedf2;
}
.toast.switched { border-left-color: #46d6a0; }
.toast.skipped { border-left-color: #e0a23c; }
.toast .icon { font-size: 16px; font-weight: 700; color: #8a8b98; }
.toast.switched .icon { color: #46d6a0; }
.toast.skipped .icon { color: #e0a23c; }
.toast .msg {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
