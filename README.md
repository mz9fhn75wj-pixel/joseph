# 修仙伴讀 · Cultivation Companion

一個把虛擬寵物、修仙養成與讀書專注結合在一起的 React + TypeScript + Vite Web App 原型。

## Phase 1 已完成

- 五區主導覽：洞府、伴讀、修煉、洞府佈置、藏寶閣
- 小豬靈獸「噗比」與可編輯玩家稱號（預設為「居士大人」）
- 25／45／60 分鐘專注計時器與科目選擇
- 自訂科目、難度與品質；完成專注後依倍率增加修為與靈石
- 讀書時間灌注靈植，累積後可收穫月光靈果
- 固定五種靈果：墨香果、星語果、算盤果、靈識果、玄醫果
- 依選擇的讀書科目與專注時間，累積對應靈果的成長進度
- 長庚大學醫學系必修課程匯入：大一至大四、上下學期，可選年級套入；每個年級輪替涵蓋完整五種靈果
- 科目池已清理為長庚醫學系必修課程；舊版非醫學系測試科目會在載入時移除
- 晨間散步、戶外運動與休閒娛樂等大世界探索活動
- 探索掉落稀有、史詩、傳說圖鑑物品
- 探索材料可在洞府煉製台依配方製作靈寵成長道具
- 每日任務：讀書、餵食、探險、採收，完成後可領取修為與靈石
- 今日進度、週統計視覺化、學習歷史
- 任務清單、科目篩選、完成狀態切換
- 修仙境界進度與突破門檻展示
- LocalStorage 自動保存遊戲進度
- 桌面與手機響應式版面

## Phase 3 已完成

- 洞府家具收藏、靈石購買與擺放／收起
- 洞府場景會顯示目前擺放的家具
- 隨身背包：探索材料、成熟靈果與奇珍圖鑑數量
- 成就系統：讀書、探索、採收、煉製與圖鑑成就，可領取修為與靈石
- 修行統計：讀書、探索、採收、餵食、煉製、家具與境界突破紀錄
- Phase 3 資料會自動補入既有 LocalStorage 存檔，不需清除原有進度

## Phase 4 已完成

- 互動音效：讀書完成、餵食、探索、任務／成就領取、煉製與突破各有提示音，可在右上角關閉並保留設定
- 動畫與回饋：提示訊息進場與倒數效果、卡片 hover、收藏／成就／任務互動回饋
- 可及性：鍵盤 `focus-visible` 樣式、通知 `aria-live`、音效按鈕 `aria-pressed`
- 手機體驗：觸控按鈕尺寸、安全區域、播放器與提示訊息避讓，支援 `prefers-reduced-motion`
- PWA 安裝資訊補上描述、直向顯示與噗比圖示；播放器使用 Media Session API 時可配合手機鎖定畫面控制
- 存檔匯出／匯入：從右上角修士稱號選單下載 JSON 存檔，也可在其他裝置匯入恢復遊戲進度
- 存檔管理：可在同一個選單重置遊戲資料；重置不會刪除音樂歌單
- PWA 離線骨架：正式版會快取應用程式外殼，並在右上角顯示目前連線狀態；本機 MP3 不會被 Service Worker 複製或覆寫
- 統計分析：近 7 日／當月專注時間、連續修煉天數、科目專注排行與累積資源總覽
- 伴讀頁週圖：改為依實際日期與讀書紀錄繪製，不再使用固定示意數值
- 噗比提醒：低飽食、低精力與低心情狀態會在網站內提供提醒

## 執行

```bash
npm install
npm run dev
```

### Windows TLS / CA 注意事項

本環境的 Node.js bundled CA 無法驗證目前網路的憑證鏈，但 Windows 系統憑證存放區可以正常驗證。Node.js 24 可使用系統 CA，且不需要關閉 `strict-ssl`：

PowerShell：

```powershell
$env:NODE_OPTIONS="--use-system-ca"
npm ping
npm install
npm run dev
```

若是在公司代理環境，請將公司根 CA 憑證以 PEM 格式匯入 Windows 受信任根憑證，或只在確認來源可信時設定：

```powershell
$env:NODE_EXTRA_CA_CERTS="C:\path\to\corporate-root-ca.pem"
```

不要使用 `strict-ssl=false`、`NODE_TLS_REJECT_UNAUTHORIZED=0` 或 `curl -k`。

建置檢查：

```bash
npm run build
```

## 專案結構

```text
src/
  components/   可重用 UI 元件
  data.ts       初始資料與遊戲常數
  types.ts      遊戲資料模型
  utils/        LocalStorage 等工具
                sound.ts：可關閉的 Web Audio 互動音效
  App.tsx       頁面組合與 Phase 1 遊戲互動
  styles.css    視覺系統與響應式樣式
  phase4.css    Phase 4 動畫、可及性與手機版補強
```

## 課程資料來源

醫學系課程資料依長庚大學官方「【大學部】115學年必選修科目表」整理，適用 115 學年度入學學生：

https://www.cgu.edu.tw/freshman/Contents?nodeId=19531

## 下一步

後續可加入戰鬥／探索消耗體力、更多家具互動、成就分類與月度統計。

## 跨裝置雲端同步

目前的雲端同步使用 Supabase，登入同一組帳號後，電腦與 iPhone 可以共用：

- 遊戲進度、修為、靈石、課程、靈果、探索、家具、成就與統計
- 歌單順序、歌曲名稱、目前歌曲、播放模式與音量
- 使用者上傳的 MP3 歌曲（儲存在自己的私有雲端空間；不同帳號彼此隔離）

啟用方式：

1. 在 Supabase 建立一個專案，開啟 Email 登入。
2. 在 SQL Editor 執行 `supabase/schema.sql`。
3. 複製 `.env.example` 為 `.env.local`，填入 Supabase Project URL 與 anon public key。
4. 執行 `pnpm run build` 後，把新的 `dist` 部署到同一個 Netlify 網站。
5. 電腦與 iPhone 開啟同一網址，在「我的修士檔案」登入同一組帳號。

若尚未設定 Supabase，程式會自動維持本機模式，不會清除 LocalStorage 或 IndexedDB 中的資料。登入後，MP3 會依帳號分開保存；指定的主要帳號載入程式內建 40 首歌曲，其他帳號從空歌單開始建立。沒有雲端資料的帳號則會將目前裝置資料上傳為初始存檔。
