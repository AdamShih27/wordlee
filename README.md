# Wordlee

猜 5 個字母英文單字的小遊戲，**順便學單字**。手機 App（iOS / Android）和網頁版用同一份程式碼。

- 🟩🟨⬜ 6 次機會猜一個字：綠色＝位置對、黃色＝有這個字母但位置不對、灰色＝沒有這個字母
- 📖 **每猜一個字，旁邊就會出現字典按鈕**：中文意思、詞性、單複數、詞形變化、例句（附中文翻譯）、英文解釋、發音
- 🔖 **單字卡**：看不懂的字按「收藏」，之後可以在單字卡頁用清單或翻卡模式複習
- ⚡ **連線對戰**：大家猜同一題，比誰解得快。可以快速配對，也可以開房間給朋友房號
- 🏆 **排行榜**：對戰積分累計排名（積分規則可以自己改，見下方）
- 每日挑戰（每天一題、連勝統計、分享成績）、練習模式（無限玩）、困難模式

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

開兩個終端機：

```bash
npm run server
```

```bash
npm run web
```

瀏覽器打開 http://localhost:8081 就能玩。對戰功能要先開 server。

### 在手機上測試

1. 手機安裝 **Expo Go**（App Store / Google Play）
2. 電腦執行 `npm run server`，以及：

```bash
npm run app
```

3. 用手機掃終端機上的 QR code（手機和電腦要連同一個 Wi-Fi）

App 會自動連到電腦上的對戰伺服器（用電腦在區網的 IP + port 3001）。要連別的伺服器，就在 `app/.env` 設定：

```
EXPO_PUBLIC_SERVER_URL=https://your-server.example.com
```

### 試玩版(不需要伺服器)

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

- 答案庫有 1452 個常見字。挑選條件是：有考試標籤（國高中、全民英檢等級、TOEFL、IELTS）或詞頻夠高，而且不是複數或過去式這類變化形。總共約 8,600 個字可以猜。
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

`shared` 測顏色判斷（含重複字母）、困難模式、每日題目、簡轉繁；`server` 用真的 Socket.IO 連線測開房、加入、搶答、計分、排行榜、快速配對、時間到、斷線重連。

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
