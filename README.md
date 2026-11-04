# Wordlee

猜英文單字的小遊戲，**順便學單字**。手機 App（iOS / Android）和網頁版用同一份程式碼。

🌐 **網頁版：https://adamshih27.github.io/wordlee/**（推到預設分支就會自動部署，見下方「部署網頁版」）

- 🟩🟨⬜ 6 次機會猜一個字，可以選 **5、6、7 個字母**，隨機出題、一直玩：綠色＝位置對、黃色＝有這個字母但位置不對、灰色＝沒有這個字母
- 📖 **每猜一個字，旁邊就會出現字典按鈕**：中文意思、詞性、單複數、詞形變化、例句（附中文翻譯）、英文解釋、發音
- 🔖 **單字卡**：看不懂的字按「收藏」，之後可以在單字卡頁用清單或翻卡模式複習
- 🎈 **Hangman**：看**英文解釋**和**挖空的英文例句**，一個一個猜字母拼出單字，想不到再看中文提示；猜錯 6 次（氣球全破）就輸。可以用常見單字或**自己的單字卡**出題
- 勝率、連勝、猜中次數統計（每種字母數分開算）、分享成績、困難模式；沒玩完的局會自動存檔
- ⚡ 連線對戰和 🏆 排行榜：程式已完成，**目前先關閉**，等架好伺服器再打開（見下方「打開連線對戰」）

## 專案結構

```
wordlee/
├── app/        Expo (React Native) App:iOS / Android / Web
├── server/     對戰 + 排行榜伺服器(Node.js + Socket.IO + SQLite)
├── shared/     App 和 Server 共用:判斷顏色的邏輯、字庫、連線協定
└── scripts/    產生字庫與離線字典的腳本
```

答案只存在伺服器上，判斷顏色也在伺服器做，玩家拿不到答案。對手那邊只看得到你的顏色進度，看不到你猜了哪些字母。

## 開始開發

需要 **Node.js 22.13 以上**（伺服器用到 Node 內建的 SQLite）。

```bash
npm install
```

```bash
npm run web
```

瀏覽器打開 http://localhost:8081 就能玩。

### 在手機上測試

1. 手機安裝 **Expo Go**（App Store / Google Play）
2. 電腦執行：

```bash
npm run app
```

3. 用手機掃終端機上的 QR code（手機和電腦要連同一個 Wi-Fi）

## 部署網頁版（GitHub Pages）

`.github/workflows/deploy-web.yml` 會在每次推到 repo 的**預設分支**時，跑測試、打包網頁版、部署到 `https://<帳號>.github.io/<repo>/`。

第一次要在 GitHub 打開 Pages（只要做一次）：

1. repo 的 **Settings → Pages**
2. **Build and deployment → Source** 選 **GitHub Actions**
3. 到 **Actions → Deploy web → Run workflow** 手動跑一次（之後推程式就會自動部署）

網頁版放在子路徑 `/wordlee/` 底下，打包時用 `EXPO_BASE_URL=/wordlee` 告訴 Expo（`app/app.config.js`）。本機開發不用設定。

### 用自己的網域

1. 跟網域商買一個網域（例如 `wordlee.tw`，或用已經有的網域開一個子網域 `wordlee.你的網域.com`）
2. 在網域商的 DNS 設定：
   - 子網域（建議，最簡單）：新增 **CNAME** 記錄，`wordlee` → `adamshih27.github.io`
   - 根網域：新增 4 筆 **A** 記錄指到 GitHub Pages 的 IP（`185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`）
3. repo 的 **Settings → Pages → Custom domain** 填入網域，DNS 生效後勾選 **Enforce HTTPS**
4. repo 的 **Settings → Secrets and variables → Actions → Variables** 新增變數 `CUSTOM_DOMAIN`，值填網域
5. **Actions → Deploy web → Run workflow** 重新部署一次（網站會改放在網域的根目錄，不再是 `/wordlee/`）

## 打開連線對戰

對戰和排行榜需要一直開著的伺服器（`server/`），所以目前從分頁列隱藏。要打開的話：

1. 把 `server/` 部署到能跑 Node 22、支援 WebSocket 的主機（見下方「對戰伺服器」）
2. 打包 App 時設定：

```
EXPO_PUBLIC_ENABLE_ONLINE=1
EXPO_PUBLIC_SERVER_URL=https://your-server.example.com
```

本機想測對戰，就開兩個終端機分別跑 `npm run server` 和 `EXPO_PUBLIC_ENABLE_ONLINE=1 npm run web`。

## 試玩版（不需要網路服務）

只想試單人模式的話，可以打包一個純靜態的試玩版。這個版本不連對戰伺服器、不查線上字典，只用 App 裡內建的離線字典，所以可以放在任何靜態網頁空間：

```bash
cd app
EXPO_PUBLIC_DEMO=1 npx expo export --platform web
```

## 積分規則

目前是**暫定版**，全部集中在 [`server/src/scoring.ts`](server/src/scoring.ts)：

| 項目 | 分數 |
| --- | --- |
| 解出來 | +50 |
| 每少猜一次 | +10（1 次猜中 +50，6 次猜中 +0） |
| 名次（有解出才算） | 第 1 名 +30、第 2 名 +15、第 3 名 +5 |
| 沒解出 | 0 |

要改規則只要改 `scoreRound()`，然後同步改 `describeScoring()` 的說明文字（App 的排行榜頁會顯示這段文字）。App 端不用改。

## 對戰伺服器

| 環境變數 | 預設 | 說明 |
| --- | --- | --- |
| `PORT` | `3001` | |
| `DB_PATH` | `server/data/wordlee.db` | 排行榜資料庫 |
| `TIME_LIMIT_MS` | `300000` | 每局時間上限（5 分鐘） |
| `COUNTDOWN_MS` | `3000` | 開局倒數 |
| `MAX_PLAYERS` | `8` | 一間房最多幾人 |

HTTP API：`GET /api/leaderboard`、`GET /api/players/:id`、`GET /api/scoring`、`GET /health`

部署時，任何能跑 Node 22 的主機都可以（Render、Fly.io、Railway、自己的 VPS…）。要注意兩點：一是要支援 WebSocket，二是 `DB_PATH` 要指到不會被清掉的磁碟。

## 字典與字庫資料

| 資料 | 來源 | 授權 |
| --- | --- | --- |
| 中文翻譯、詞性、詞形變化（離線，打包在 App 裡） | [ECDICT](https://github.com/skywind3000/ECDICT) | MIT |
| 可以猜的單字 | [ENABLE word list](https://github.com/dolph/dictionary) | Public Domain |
| 簡體 → 繁體轉換表 | [OpenCC](https://github.com/BYVoid/OpenCC) | Apache 2.0 |
| 英文解釋、音標、發音（線上） | [Free Dictionary API](https://dictionaryapi.dev/)（資料來自 Wiktionary） | CC BY-SA |
| 例句 + 中文翻譯（線上） | [Tatoeba](https://tatoeba.org/) | CC BY 2.0 FR |

- 答案庫：5 個字母 1452 個、6 個字母 1749 個、7 個字母 1667 個常見字。挑選條件是：有考試標籤（國高中、全民英檢等級、TOEFL、IELTS）或詞頻夠高，而且不是複數或過去式這類變化形。可以猜的字總共約 4.7 萬個。
- 離線字典依長度分成三個檔案（約 1.2MB / 1.9MB / 2.6MB），網頁版用到哪個長度才下載哪一份。答案字另附 ECDICT 的英文解釋（來自 WordNet，已略過專有名詞義項），當 Hangman 的離線提示。
- 沒網路時字典只會顯示離線的中文意思和詞形變化，例句和英文解釋需要連線。

要重新產生字庫（例如調整答案的挑選條件）：

```bash
pip install opencc-python-reimplemented
python scripts/build_words.py path/to/ecdict.csv path/to/enable1.txt
```

## 測試與檢查

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint -w app
```

`shared` 測顏色判斷（含重複字母）、困難模式、5/6/7 字母字庫、Hangman 規則、簡轉繁；`server` 用真的 Socket.IO 連線測開房、加入、搶答、計分、排行榜、快速配對、時間到、斷線重連。

## 上架 App

用 Expo 的雲端建置（EAS Build），不需要自己裝 Xcode / Android Studio：

```bash
cd app
npx eas-cli@latest build --platform all
```

上架前要先在 `app/app.json` 確認 `ios.bundleIdentifier`、`android.package`（目前是 `com.wordlee.app`），並設定正式的 `EXPO_PUBLIC_SERVER_URL`。

## 目前的限制 / 之後可以做

- **玩家身分**目前是存在手機裡的隨機 ID + 暱稱，沒有登入。換手機或清資料，排行榜紀錄就接不回來；技術上也有人能冒用 ID。正式上線前建議加登入（例如 Apple / Google 登入）。
- 單字卡只存在手機本機，還沒有雲端同步。
- 積分規則是暫定版。
