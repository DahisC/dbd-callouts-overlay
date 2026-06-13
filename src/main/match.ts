// OCR 文字 → 地圖比對的純邏輯(無 electron / tesseract 依賴,方便單元測試)

// 只保留中日韓文字與英數,去掉空格/標點/破折號
export function normalize(s) {
  return (s || '').replace(/[^一-鿿㐀-䶿A-Za-z0-9]/g, '');
}

// Levenshtein 編輯距離
export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = Math.min(
        dp[i] + 1,
        dp[i - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[m];
}

// 兩字串相似度(0~1):1 - 編輯距離 / 較長字串長度
export function similarity(a, b) {
  if (!a.length && !b.length) return 1;
  const maxLen = Math.max(a.length, b.length);
  return maxLen ? 1 - levenshtein(a, b) / maxLen : 0;
}

// 從 OCR 文字比對出最相符的地圖
// maps: [{ name, path, group }]
// 回傳 { map, score } 或 null
export function matchMap(ocrText, maps) {
  const ocr = normalize(ocrText);
  if (!ocr || !maps.length) return null;

  let best = null;
  for (const m of maps) {
    const nameN = normalize(m.name);
    const realmNameN = normalize((m.group || '') + m.name);
    // 跟「地區+地圖」與「只地圖名」兩種都比,取較高分
    let score = Math.max(similarity(ocr, realmNameN), similarity(ocr, nameN));
    // OCR 文字若直接包含完整地圖名,給強加成
    if (nameN && ocr.includes(nameN)) score = Math.max(score, 0.95);
    if (!best || score > best.score) best = { map: m, score };
  }
  return best;
}
