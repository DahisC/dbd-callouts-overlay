import { describe, it, expect } from 'vitest';
import { isVisibleOn, clampToVisible } from '../src/main/geometry';

const single = [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
const dual = [
  { bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
  { bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
];

describe('isVisibleOn', () => {
  it('在螢幕內 → true', () => {
    expect(isVisibleOn({ x: 100, y: 100, width: 400, height: 300 }, single)).toBe(true);
  });
  it('完全在螢幕外 → false', () => {
    expect(isVisibleOn({ x: 5000, y: 100, width: 400, height: 300 }, single)).toBe(false);
  });
  it('落在第二螢幕 → true', () => {
    expect(isVisibleOn({ x: 2000, y: 100, width: 400, height: 300 }, dual)).toBe(true);
  });
  it('部分重疊也算可見', () => {
    expect(isVisibleOn({ x: -100, y: 0, width: 400, height: 300 }, single)).toBe(true);
  });
});

describe('clampToVisible', () => {
  it('可見時原樣回傳', () => {
    const r = { x: 100, y: 100, width: 400, height: 300 };
    expect(clampToVisible(r, single)).toEqual(r);
  });
  it('跑出所有螢幕 → 夾回 fallback 範圍內', () => {
    const r = clampToVisible({ x: 5000, y: 5000, width: 400, height: 300 }, single);
    expect(isVisibleOn(r, single)).toBe(true);
    expect(r).toEqual({ x: 1520, y: 780, width: 400, height: 300 }); // 右下角
  });
  it('沒有任何螢幕 → 原樣不崩', () => {
    const r = { x: 5000, y: 5000, width: 400, height: 300 };
    expect(clampToVisible(r, [])).toEqual(r);
  });
});
