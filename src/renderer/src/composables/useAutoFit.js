import { onMounted } from 'vue';

// 讓無邊框視窗高度自動貼合內容:回報 body 高度給主程序,
// 並用 ResizeObserver 在內容變動(展開/收合設定)時持續貼合。
export function useAutoFit() {
  function reportSize() {
    window.api.resizeControl(Math.ceil(document.body.scrollHeight));
  }
  onMounted(() => {
    reportSize();
    new ResizeObserver(reportSize).observe(document.body);
  });
  return { reportSize };
}
