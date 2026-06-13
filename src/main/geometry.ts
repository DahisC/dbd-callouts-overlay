// 視窗位置幾何:確保 overlay 啟動時落在可見螢幕內(無 electron 依賴,便於測試)

interface Rect { x: number; y: number; width: number; height: number }
interface Display { bounds: Rect; workArea?: Rect }

// 視窗矩形與任一螢幕(優先用 workArea)是否有交集
export function isVisibleOn(rect: Rect, displays: Display[]): boolean {
  return displays.some((d) => {
    const a = d.workArea ?? d.bounds;
    const ix = Math.min(rect.x + rect.width, a.x + a.width) - Math.max(rect.x, a.x);
    const iy = Math.min(rect.y + rect.height, a.y + a.height) - Math.max(rect.y, a.y);
    return ix > 0 && iy > 0;
  });
}

// 若視窗完全跑出所有螢幕(例如拔掉外接螢幕),夾回 fallback 螢幕(預設第一個)的可見範圍
export function clampToVisible(rect: Rect, displays: Display[], fallback?: Display): Rect {
  if (!displays.length || isVisibleOn(rect, displays)) return rect;
  const a = (fallback ?? displays[0]).workArea ?? (fallback ?? displays[0]).bounds;
  const x = Math.max(a.x, Math.min(rect.x, a.x + a.width - rect.width));
  const y = Math.max(a.y, Math.min(rect.y, a.y + a.height - rect.height));
  return { x, y, width: rect.width, height: rect.height };
}
