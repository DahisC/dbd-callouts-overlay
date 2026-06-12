# 發佈新版本流程

自動更新透過 **GitHub Release + electron-updater** 運作。
使用者按控制台的「檢查更新」按鈕,app 會去這個 repo 的 Release 找最新版、下載、提示重啟安裝。

## 一次性準備

1. 建立 GitHub Personal Access Token(classic),勾選 `repo` 權限。
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 把它設成環境變數(每個終端機 session 設一次即可):

   ```powershell
   $env:GH_TOKEN = "ghp_你的token"
   ```

## 每次發版

1. **更新版本號**(唯一要改的地方,介面版本號與更新比對都讀這個):

   ```powershell
   npm version patch      # 0.0.1 -> 0.0.2(小修)
   # npm version minor    # 0.0.x -> 0.1.0(功能)
   # npm version major    # 0.x.x -> 1.0.0(大改)
   ```

2. **打包並發佈**(會建安裝檔 + latest.yml 並上傳到 GitHub Release 草稿):

   ```powershell
   npm run release
   ```

3. 到 GitHub 的 **Releases** 頁面,把剛產生的**草稿(draft)發佈出去**(按 Publish release)。

4. 完成。使用者開 app 按「檢查更新」就會收到新版。

## 注意事項

- **開發模式(`npm run dev`)無法測自動更新** —— 按「檢查更新」會顯示「開發模式無法檢查更新」。要實測得用打包後的安裝版。
- **第一版**:使用者要先手動下載安裝一次(NSIS 安裝程式),之後才能自動更新。
- **沒有程式碼簽章**:Windows SmartScreen 會跳「不明發行者」警告,點「仍要執行」即可;要消除需購買憑證。
- 安裝檔輸出在 `release/` 資料夾。
