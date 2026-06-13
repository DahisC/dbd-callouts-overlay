// 自訂拖曳:用滑鼠在螢幕上的位移驅動,主程序會即時把視窗夾在螢幕邊界內。
// 把回傳的 onMouseDown 綁在 overlay 容器的 @mousedown 即可。
export function useOverlayDrag() {
  let dragging = false;
  let startX = 0;
  let startY = 0;

  function onMouseMove(e) {
    if (!dragging) return;
    window.api.dragMove(e.screenX - startX, e.screenY - startY);
  }
  function onMouseUp() {
    dragging = false;
    window.api.dragEnd();
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }
  function onMouseDown(e) {
    if (e.button !== 0) return;        // 只接受左鍵
    dragging = true;
    startX = e.screenX;
    startY = e.screenY;
    window.api.dragStart();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  return { onMouseDown };
}
