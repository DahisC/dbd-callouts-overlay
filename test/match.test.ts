import { describe, it, expect } from 'vitest';
import { matchMap, normalize, similarity } from '../src/main/match.js';

// 核心功能:OCR 文字 → 正確地圖。比對邏輯是純函式,直接斷言。
const MAPS = [
  { name: '惡夢屋', path: 'a', group: '麥克米倫莊園' },
  { name: '碎裂的迴聲', path: 'b', group: '冷風農場' },
  { name: '遊樂園', path: 'c', group: '' }
];

describe('normalize', () => {
  it('去除空白與標點,保留中英數', () => {
    expect(normalize(' 惡夢屋 ! ')).toBe('惡夢屋');
    expect(normalize('The Game (2)')).toBe('TheGame2');
  });
  it('空值安全', () => {
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });
});

describe('similarity', () => {
  it('完全相同為 1', () => expect(similarity('abc', 'abc')).toBe(1));
  it('完全不同為 0', () => expect(similarity('abc', 'xyz')).toBe(0));
  it('兩個空字串為 1', () => expect(similarity('', '')).toBe(1));
});

describe('matchMap', () => {
  it('完全命中地圖名 → 高分', () => {
    const r = matchMap('惡夢屋', MAPS);
    expect(r.map.name).toBe('惡夢屋');
    expect(r.score).toBeGreaterThanOrEqual(0.95);
  });

  it('OCR 夾雜雜訊但含完整地圖名 → 0.95 加成命中', () => {
    const r = matchMap('地圖:惡夢屋 3F', MAPS);
    expect(r.map.name).toBe('惡夢屋');
    expect(r.score).toBeGreaterThanOrEqual(0.95);
  });

  it('比對「地區+地圖名」也能命中', () => {
    const r = matchMap('麥克米倫莊園惡夢屋', MAPS);
    expect(r.map.name).toBe('惡夢屋');
    expect(r.score).toBeGreaterThan(0.9);
  });

  it('選出分數最高的地圖', () => {
    const r = matchMap('碎裂的迴聲', MAPS);
    expect(r.map.name).toBe('碎裂的迴聲');
  });

  it('空 OCR / 純標點 → null', () => {
    expect(matchMap('', MAPS)).toBeNull();
    expect(matchMap('  !!  ', MAPS)).toBeNull();
  });

  it('沒有任何地圖 → null', () => {
    expect(matchMap('惡夢屋', [])).toBeNull();
  });
});
