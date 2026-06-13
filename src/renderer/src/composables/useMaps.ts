import { ref, computed, watch, onMounted, type Ref } from 'vue';

// 內建地圖清單與目前選取。
// 傳入 imagePath(來自 useSettings),下拉選取會與它雙向連動。
export function useMaps(imagePath: Ref<string>) {
  const maps = ref<MapItem[]>([]);          // [{ name, path, group }]
  const selectedMap = ref('');   // 下拉選的路徑,鏡射 imagePath

  // imagePath 變動(辨識自動切換 / 設定載入)時同步下拉選取
  watch(imagePath, (v) => { selectedMap.value = v || ''; }, { immediate: true });

  onMounted(async () => { maps.value = await window.api.listMaps(); });

  // 選了某張地圖 → 通知主程序切換,並同步 imagePath(供之後的地圖下拉使用)
  function onSelectMap() {
    if (!selectedMap.value) return;
    window.api.selectMap(selectedMap.value);
    imagePath.value = selectedMap.value;
  }

  // 目前地圖名稱(由選取/辨識的路徑推算)
  const currentMapName = computed(() => {
    const p = selectedMap.value || imagePath.value;
    if (!p) return '未選擇';
    const m = maps.value.find((x) => x.path === p);
    return m ? m.name : p.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  });

  // 依地區分組(給下拉的 optgroup 用)
  const groupedMaps = computed(() => {
    const g = {};
    for (const m of maps.value) (g[m.group || '其他'] ||= []).push(m);
    return g;
  });

  return { maps, selectedMap, currentMapName, groupedMaps, onSelectMap };
}
