import { describe, it, expect } from 'vitest';
import { staleLogFiles } from '../src/main/logclean';

describe('staleLogFiles', () => {
  const today = '2026-06-14';

  it('刪掉今天以前的 log', () => {
    expect(staleLogFiles(['2026-06-13.log', '2026-06-12.log', '2026-06-14.log'], today))
      .toEqual(['2026-06-13.log', '2026-06-12.log']);
  });

  it('保留今天的', () => {
    expect(staleLogFiles(['2026-06-14.log'], today)).toEqual([]);
  });

  it('也清掉舊日期的輪替檔,但保留今天的輪替檔', () => {
    expect(staleLogFiles(['2026-06-13.old.log', '2026-06-14.old.log'], today))
      .toEqual(['2026-06-13.old.log']);
  });

  it('忽略非日期命名的檔(如舊版 main.log)', () => {
    expect(staleLogFiles(['readme.txt', 'main.log'], today)).toEqual([]);
  });
});
