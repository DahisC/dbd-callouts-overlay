// 日誌清理:只保留「今天」的 log,啟動時把日期早於今天的都刪掉。
// 純函式(吃檔名清單 + 今天日期字串,回傳該刪的檔名),便於測試。

// today 格式為 'YYYY-MM-DD'。YYYY-MM-DD 補零後字典序 === 日期序,可直接字串比較。
export function staleLogFiles(fileNames: string[], today: string): string[] {
  return fileNames.filter((f) => {
    const m = /^(\d{4}-\d{2}-\d{2}).*\.log$/.exec(f); // 含當天輪替檔如 2026-06-13.old.log
    return m !== null && m[1] < today;
  });
}
