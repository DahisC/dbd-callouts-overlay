import { ref, computed } from 'vue';

// 自動更新:接收主程序推送的更新狀態,所有狀態(含下載進度、下載完成的安裝)
// 都整合在單一按鈕上由本 composable 計算文字 / disabled / 點擊行為。
export function useUpdater() {
  const update = ref(null);   // { state, percent, version, message }
  window.api.onUpdateStatus((s) => { update.value = s; });

  // 各狀態對應的顯示文字
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

  const isDownloaded = computed(() => !!update.value && update.value.state === 'downloaded');
  // 按鈕文字:下載完成顯示安裝提示,其餘顯示狀態文字,沒狀態就顯示預設
  const updBtnText = computed(() => isDownloaded.value ? '重啟以安裝更新' : (updateText.value || '檢查更新'));
  // 檢查中 / 下載中時 disable,避免重複觸發
  const updBtnBusy = computed(() => !!update.value && (update.value.state === 'checking' || update.value.state === 'downloading'));

  function checkUpdate() {
    update.value = { state: 'checking' };
    window.api.checkUpdate();
  }
  function installUpdate() { window.api.installUpdate(); }
  function onUpdateClick() { isDownloaded.value ? installUpdate() : checkUpdate(); }

  return { update, isDownloaded, updBtnText, updBtnBusy, onUpdateClick };
}
