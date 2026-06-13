import { ref } from 'vue';

// DBD 是否為最前景視窗(由主程序的前景監看在焦點變化時推送)
export function useGameStatus() {
  const focused = ref(false);
  window.api.onGameState((st) => { focused.value = !!st.focused; });
  return { focused };
}
