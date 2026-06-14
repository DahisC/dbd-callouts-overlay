import { ref } from 'vue';

// DBD 狀態(由主程序的前景監看推送):
// focused = 是否為最前景視窗(供隱藏 / 截圖判斷);running = 程序是否存在(供狀態燈)
export function useGameStatus() {
  const focused = ref(false);
  const running = ref(false);
  window.api.onGameState((st) => { focused.value = !!st.focused; running.value = !!st.running; });
  return { focused, running };
}
