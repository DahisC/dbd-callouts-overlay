import { describe, it, expect } from 'vitest';
import { matchMap, normalize, similarity, lcsLen, nameCoverage } from '../src/main/match.js';

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

describe('lcsLen / nameCoverage', () => {
  it('lcsLen 取依序對上的字數', () => {
    expect(lcsLen('abc', 'aXbYc')).toBe(3);
    expect(lcsLen('abc', 'cba')).toBe(1);
    expect(lcsLen('', 'abc')).toBe(0);
  });
  it('名字大部分出現在雜訊裡 → 覆蓋率高', () => {
    // 名字 6 字,雜訊中依序出現 5 字
    expect(nameCoverage('上郭品廢舊更庫回庫后院弦', '廢舊車庫后院')).toBeCloseTo(5 / 6, 5);
  });
  it('名字完全沒出現 → 0', () => {
    expect(nameCoverage('完全不相干的文字', '廢舊車庫后院')).toBe(0);
  });
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

  it('名字被一堆雜訊包圍仍命中(覆蓋率抗雜訊)', () => {
    // 純相似度會被雜訊拉到很低,覆蓋率仍能認出「碎裂的迴聲」
    const r = matchMap('a碎b裂c的x迴y聲z 一二三四五六七八九', MAPS);
    expect(r.map.name).toBe('碎裂的迴聲');
    expect(r.score).toBeGreaterThanOrEqual(0.45);
  });

  it('短名字(<4 字)不靠覆蓋率,避免在雜訊裡湊巧命中', () => {
    // 「惡夢屋」3 字,散在雜訊裡不應靠覆蓋率硬湊成高分
    const r = matchMap('惡xxxx夢xxxx屋xxxx一二三四五', MAPS);
    expect(r.score).toBeLessThan(0.45);
  });
});
