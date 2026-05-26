# Desktop Web Loader 鈥?鎵嬪姩 GUI 楠岃瘉鎸囧崡

鏈枃妗ｄ緵 Windows 妗岄潰鐢ㄦ埛鍦ㄥ彲瑙傚療 Electron 绐楀彛鐨勭幆澧冧笅鎵ц銆?
## 鍓嶆彁鏉′欢

- Windows 妗岄潰鐜锛堝彲鏄剧ず Electron 绐楀彛锛?- Node.js 鈮?2, pnpm
- 椤圭洰宸插畨瑁呬緷璧栵細`pnpm install`

## 婧愮爜瀹夊叏瀹¤缁撴灉锛圓191 宸查€氳繃浠ｇ爜瀹℃煡锛?
| # | 妫€鏌ラ」 | 缁撴灉 |
|---|--------|------|
| 1 | 鐧藉悕鍗? localhost, 127.0.0.1, [::1] | 鉁?|
| 2 | 鍗忚闄愬埗: 浠?http | 鉁?|
| 3 | 鍑嵁妫€娴?| 鉁?|
| 4 | 绔彛蹇呭～ | 鉁?|
| 5 | 闈炴硶 URL 鈫?鍥為€€闈欐€侀椤?| 鉁?|
| 6 | did-fail-load 鍥為€€ | 鉁?|
| 7 | will-navigate 瀵艰埅闄愬埗 | 鉁?|
| 8 | setWindowOpenHandler 绂佹鏂扮獥鍙?| 鉁?|
| 9 | nodeIntegration: false | 鉁?|
| 10 | contextIsolation: true | 鉁?|
| 11 | sandbox: true | 鉁?|
| 12 | 鏃?preload | 鉁?|
| 13 | CSP (index.html) strict | 鉁?|

## 鍦烘櫙 1锛氶粯璁ら潤鎬侀椤?
**鐩殑锛?* 纭 Desktop 鍦ㄦ棤鐜鍙橀噺鏃舵甯告樉绀?static HTML銆?
**姝ラ锛?*

1. 鎵撳紑 PowerShell锛堥潪绠＄悊鍛樺嵆鍙級
2. 娓呴櫎鍙兘娈嬬暀鐨勭幆澧冨彉閲忥細
   ```powershell
   Remove-Item Env:LAP_DESKTOP_WEB_URL -ErrorAction SilentlyContinue
   ```
3. 纭宸叉竻闄わ細
   ```powershell
   $env:LAP_DESKTOP_WEB_URL
   # 搴旇緭鍑虹┖锛屾垨鎶ラ敊"Cannot find path"
   ```
4. 鍚姩 Desktop锛?   ```powershell
   cd E:\code\learning-agent-platform
   npx electron apps/desktop
   ```
5. **棰勬湡缁撴灉锛?*
   - Electron 绐楀彛鎵撳紑锛屾爣棰樻爮鏄剧ず "Program Learning Desktop - Dev Preview"
   - 绐楀彛鍐呭鏄剧ず闈欐€侀椤碉紙涓枃鐣岄潰锛屾爣棰?"缂栫▼瀛︿範妗岄潰鐗?鈥?寮€鍙戦瑙?锛?   - 鏄剧ず Desktop 缁勪欢鐘舵€佸崱鐗囷紙4 寮犲崱鐗囷細Electron 澹炽€侀槄璇诲伐浣滃彴銆丄gent 宸ヤ綔鍙般€佹湰鍦拌缃級
   - 鏄剧ず瀹夊叏杈圭晫澹版槑锛?2 鏉?鉁?瑙勫垯锛?   - 鏄剧ず寮€鍙戦瑙堟ā寮忚鏄?   - 鏃犵櫧灞忋€佹棤宕╂簝銆佹棤 JavaScript 閿欒寮圭獥
6. **鎺掓煡锛?*
   - 濡傛灉绐楀彛鏃犳硶鎵撳紑 鈫?纭 Electron 宸插畨瑁咃細`npx electron --version`
   - 濡傛灉鐧藉睆 鈫?妫€鏌?PowerShell 缁堢鏄惁鏈夋姤閿欐棩蹇?7. 楠岃瘉瀹屾垚鍚庡叧闂?Electron 绐楀彛

## 鍦烘櫙 2锛氬悎娉?localhost Web URL 鈫?榛樿鍔犺浇 /books 鍏ュ彛

**鐩殑锛?* 纭 Desktop 鑳藉畨鍏ㄥ姞杞芥湰鏈?Web dev server 鐨?`/books` 涔︾睄鍏ュ彛椤点€?
**姝ラ锛?*

1. **缁堢 A** 鈥?鍚姩 Web dev server锛?   ```powershell
   cd E:\code\learning-agent-platform
   pnpm --filter @learning-agent-platform/web dev
   ```
   绛夊緟杈撳嚭绫讳技 "http://localhost:3000" 灏辩华銆?
2. **缁堢 B** 鈥?鍏堢‘璁?Web dev server 鍙闂紙鍙€夛級锛?   ```powershell
   curl http://localhost:3000
   # 搴旇繑鍥?HTML 鍐呭
   ```

3. **缁堢 B** 鈥?璁剧疆鐜鍙橀噺骞跺惎鍔?Desktop锛?   ```powershell
   cd E:\code\learning-agent-platform
   $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
   npx electron apps/desktop
   ```

4. **棰勬湡缁撴灉锛?*
   - Electron 绐楀彛鎵撳紑
   - 绐楀彛鍐呭鏄剧ず鐨勬槸 Web 鐨?**`/books` 涔︾睄鍏ュ彛椤?*锛堜緥濡?`http://localhost:3000/books`锛岃€岄潪鏍硅矾寰?`/`锛?   - Desktop 涓嶄細鍔犺浇鏍硅矾寰?`/`锛堝 `http://localhost:3000/`锛夛紝闄ら潪 Web 鏈韩浠?`/books` 閲嶅畾鍚戝埌 `/`
   - 鏃犲穿婧冦€佹棤瀹夊叏璀﹀憡寮圭獥
   - Electron 缁堢鏃ュ織鏄剧ず绫讳技 "[desktop] Loading local dev server /books entry: http://localhost:3000/books (hostname=localhost, port=3000)"

5. **鎺掓煡锛?*
   - 濡傛灉鏄剧ず闈欐€侀椤佃€岄潪 Web `/books` 椤甸潰 鈫?妫€鏌?`LAP_DESKTOP_WEB_URL` 鏄惁璁剧疆姝ｇ‘
   - 濡傛灉 Web 椤甸潰鍔犺浇浣嗘牱寮忎涪澶?鈫?Web dev server 鍙兘鏈畬鍏ㄥ惎鍔紝绛夊緟鍑犵鍚庨噸璇?   - 濡傛灉 Electron 缁堢鎶?"ERR_CONNECTION_REFUSED" 鈫?Web dev server 鏈惎鍔ㄦ垨绔彛涓嶅尮閰?   - 濡傛灉鎶?"Navigation blocked" 鈫?URL 鍙兘琚鍒や负闈炴硶锛堟鏌ユ槸鍚︾敤浜?https锛?   - 濡傛灉鏄剧ず鐨勬槸鏍硅矾寰?`/` 鑰岄潪 `/books` 鈫?妫€鏌?Web dev server 鏄惁鏈変粠 `/books` 鍒?`/` 鐨勯噸瀹氬悜

6. 楠岃瘉瀹屾垚鍚庡叧闂?Electron 绐楀彛銆?*涓嶈鍏抽棴 Web dev server 缁堢**锛堝満鏅?4 闇€瑕侊級銆?
## 鍦烘櫙 3锛氶潪娉曞閮?URL

**鐩殑锛?* 纭 Desktop 鎷掔粷鍔犺浇鍏綉 URL 骞跺畨鍏ㄥ洖閫€銆?
**姝ラ锛?*

1. 鎵撳紑鏂?PowerShell 缁堢锛?   ```powershell
   cd E:\code\learning-agent-platform
   $env:LAP_DESKTOP_WEB_URL="https://example.com"
   npx electron apps/desktop
   ```

2. **棰勬湡缁撴灉锛?*
   - Electron 绐楀彛鎵撳紑
   - 绐楀彛鍐呭鏄剧ず**闈欐€侀椤?*锛堜笉鏄?example.com锛?   - Electron 缁堢鏃ュ織鏄剧ず绫讳技锛?     ```
     [desktop] LAP_DESKTOP_WEB_URL protocol rejected (only http allowed): https:
     [desktop] Loading static index.html (default mode)
     ```

3. **棰濆娴嬭瘯 鈥?娴嬭瘯 http 浣嗛潪鐧藉悕鍗曚富鏈哄悕锛?*
   ```powershell
   $env:LAP_DESKTOP_WEB_URL="http://example.com:8080"
   npx electron apps/desktop
   ```
   - 棰勬湡缁堢鏃ュ織鏄剧ず hostname 琚嫆缁?   - 浠嶅洖閫€闈欐€侀椤?
4. **棰濆娴嬭瘯 鈥?娴嬭瘯鏃犵鍙ｏ細**
   ```powershell
   $env:LAP_DESKTOP_WEB_URL="http://localhost"
   npx electron apps/desktop
   ```
   - 棰勬湡缁堢鏃ュ織鏄剧ず "must include an explicit port"
   - 浠嶅洖閫€闈欐€侀椤?
5. 楠岃瘉瀹屾垚鍏抽棴 Electron 绐楀彛銆?
## 鍦烘櫙 4锛歐eb dev server 鏈惎鍔ㄦ椂鍥為€€

**鐩殑锛?* 纭 Desktop 鍦?Web 鏈嶅姟涓嶅彲鐢ㄦ椂瀹夊叏鍥為€€銆?
**姝ラ锛?*

1. 纭繚 Web dev server 宸插叧闂紙鍏抽棴鍦烘櫙 2 鐨勭粓绔?A锛?2. 纭绔彛宸查噴鏀撅細
   ```powershell
   curl http://localhost:3000
   # 搴旀姤閿?"Unable to connect"
   ```
3. 鍚姩 Desktop锛?   ```powershell
   cd E:\code\learning-agent-platform
   $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
   npx electron apps/desktop
   ```

4. **棰勬湡缁撴灉锛?*
   - Electron 绐楀彛鐭殏灏濊瘯杩炴帴 localhost:3000
   - 鍔犺浇澶辫触鍚庤嚜鍔ㄥ洖閫€
   - 鏈€缁堟樉绀洪潤鎬侀椤?   - Electron 缁堢鏃ュ織鏄剧ず绫讳技锛?     ```
     [desktop] Loading local dev server: http://localhost:3000 ...
     [desktop] Main frame load failed: ERR_CONNECTION_REFUSED ...
     [desktop] Falling back to static index.html
     ```
   - **Desktop 涓嶅穿婧冦€佷笉鐧藉睆銆佷笉寮瑰嚭閿欒瀵硅瘽妗?*

5. 楠岃瘉瀹屾垚鍏抽棴 Electron 绐楀彛銆?
## 鍦烘櫙 5锛氭柊绐楀彛 / 澶栭儴瀵艰埅鎷︽埅

**鐩殑锛?* 纭 Desktop 姝ｇ‘鎷︽埅鏂扮獥鍙ｅ拰澶栭儴瀵艰埅璇锋眰銆?
**璇存槑锛?* 褰撳墠闈欐€侀椤靛拰 Web Reader 椤甸潰涓病鏈変富鍔ㄨЕ鍙戝閮ㄩ摼鎺ユ垨鏂扮獥鍙ｇ殑鍏ュ彛銆傛鍦烘櫙閫氳繃婧愮爜瀹℃煡楠岃瘉锛?- `setWindowOpenHandler` 杩斿洖 `{ action: "deny" }` 鈥?鎵€鏈?`window.open()` 璋冪敤琚嫤鎴?- `will-navigate` 浜嬩欢涓紝闈欐€佹ā寮忛樆姝㈡墍鏈夊鑸紝寮€鍙戦瑙堟ā寮忎粎鍏佽鍚屾簮瀵艰埅
- 涓嶉渶瑕佷汉宸ラ獙璇佹搷浣滐紝浠ユ簮鐮佸鏌ョ粨璁轰负鍑?
## 鍦烘櫙 6锛堥檮鍔狅級锛氬洖褰掓鏌?
**鐩殑锛?* 纭 typecheck 鍜?lint 鍦?GUI 楠岃瘉鍚庝粛鐒堕€氳繃銆?
```powershell
cd E:\code\learning-agent-platform
bash scripts/vm-typecheck.sh
bash scripts/vm-lint.sh
```

**棰勬湡锛?*
- `typecheck passed (0 errors)`
- `VM lint complete`锛?5 涓?Reader 鏂囦欢鍧?鉁咃級

---

## 楠岃瘉娓呭崟

鍦ㄦ瘡椤归€氳繃鍚庢墦鍕撅細

- [ ] 鍦烘櫙 1锛氶粯璁ら潤鎬侀椤甸€氳繃锛堟棤鐧藉睆/鏃犲穿婧冿級
- [ ] 鍦烘櫙 2锛歭ocalhost Web URL 鍔犺浇閫氳繃锛?books 鍏ュ彛椤垫纭樉绀猴級
- [ ] 鍦烘櫙 3锛氶潪娉曞閮?URL 琚嫆缁濆苟鍥為€€闈欐€侀椤?- [ ] 鍦烘櫙 3 闄勫姞锛氶潪鐧藉悕鍗曚富鏈哄悕琚嫆缁?- [ ] 鍦烘櫙 3 闄勫姞锛氭棤绔彛 URL 琚嫆缁?- [ ] 鍦烘櫙 4锛歐eb dev server 涓嶅彲鐢ㄦ椂鍥為€€闈欐€侀椤碉紙涓嶅穿婧冿級
- [ ] 鍦烘櫙 5锛氭柊绐楀彛/瀵艰埅鎷︽埅锛堟簮鐮佸鏌ョ‘璁わ級
- [ ] 鍦烘櫙 6锛歵ypecheck 0 閿欒銆乂M lint 閫氳繃

濡傛灉浠ヤ笂鍏ㄩ儴閫氳繃锛孉191 GUI 楠岃瘉瀹屾垚銆傚皢缁撴灉濉叆 `docs/rounds/codex/A191_claude.md` 骞舵洿鏂?`docs/codex-context/CURRENT_HANDOFF.md`銆?

---

## A195 Addendum: Desktop Web Route Allow-list Validation

For rounds with route switching enabled, add these checks on top of existing scenarios:

1. Keep `LAP_DESKTOP_WEB_URL=http://localhost:3000` and set legal route:
   ```powershell
   $env:LAP_DESKTOP_WEB_ROUTE="/learning"
   npx electron apps/desktop
   ```
   Expected: Desktop loads `http://localhost:3000/learning`.

2. Test invalid route fallback (each should fall back to `/books`):
   ```powershell
   $env:LAP_DESKTOP_WEB_ROUTE="/admin"
   $env:LAP_DESKTOP_WEB_ROUTE="https://x.com"
   $env:LAP_DESKTOP_WEB_ROUTE="//evil.com"
   $env:LAP_DESKTOP_WEB_ROUTE="/books?token=1"
   $env:LAP_DESKTOP_WEB_ROUTE="/books#secret"
   npx electron apps/desktop
   ```
   Expected: route is rejected and Desktop loads `http://localhost:3000/books`.

3. Optional reset to default route behavior:
   ```powershell
   Remove-Item Env:LAP_DESKTOP_WEB_ROUTE -ErrorAction SilentlyContinue
   npx electron apps/desktop
   ```
   Expected: Desktop defaults to `/books`.

---

## A196 Addendum: Desktop Reader Preset Validation

Reader route shape in current Web app is query-based:

- `/reader?bookId=<bookId>`
- `/reader?bookId=<bookId>&chapterId=<chapterId>`

Desktop `LAP_DESKTOP_WEB_ROUTE=/reader` now requires strict reader params:

- `LAP_DESKTOP_READER_BOOK_ID` (required)
- `LAP_DESKTOP_READER_CHAPTER_ID` (optional)
- Allowed pattern for both: `[A-Za-z0-9_-]+`
- Any missing/invalid reader param falls back to `/books`.

1. Legal Reader target:
   ```powershell
   $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
   $env:LAP_DESKTOP_WEB_ROUTE="/reader"
   $env:LAP_DESKTOP_READER_BOOK_ID="sample-book"
   $env:LAP_DESKTOP_READER_CHAPTER_ID="chapter-1"
   npx electron apps/desktop
   ```
   Expected: Desktop loads `http://localhost:3000/reader?bookId=sample-book&chapterId=chapter-1`.

2. Missing required `bookId` should fallback:
   ```powershell
   $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
   $env:LAP_DESKTOP_WEB_ROUTE="/reader"
   Remove-Item Env:LAP_DESKTOP_READER_BOOK_ID -ErrorAction SilentlyContinue
   npx electron apps/desktop
   ```
   Expected: route falls back to `http://localhost:3000/books`.

3. Invalid reader params should fallback:
   ```powershell
   $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
   $env:LAP_DESKTOP_WEB_ROUTE="/reader"
   $env:LAP_DESKTOP_READER_BOOK_ID="../etc/passwd"
   npx electron apps/desktop

   $env:LAP_DESKTOP_READER_BOOK_ID="sample-book"
   $env:LAP_DESKTOP_READER_CHAPTER_ID="chapter 1"
   npx electron apps/desktop

   $env:LAP_DESKTOP_READER_CHAPTER_ID="chapter#1"
   npx electron apps/desktop
   ```
   Expected: all invalid cases fall back to `http://localhost:3000/books`.

---

## A197 Addendum: Reader Entry GUI Validation Closure

Use this sequence to close the Reader desktop-entry validation loop with
actual Electron run logs.

1. Start Web dev server (terminal A):
   ```powershell
   cd E:\code\learning-agent-platform
   pnpm --filter @learning-agent-platform/web dev
   ```

2. Legal Reader entry should load `/reader`:
   ```powershell
   cd E:\code\learning-agent-platform
   $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
   $env:LAP_DESKTOP_WEB_ROUTE="/reader"
   $env:LAP_DESKTOP_READER_BOOK_ID="sample-programming-fundamentals"
   $env:LAP_DESKTOP_READER_CHAPTER_ID="sample-chapter-variables"
   npx electron apps/desktop
   ```
   Expected log contains:
   `Loading local dev server entry: http://localhost:3000/reader?bookId=sample-programming-fundamentals&chapterId=sample-chapter-variables`

3. Invalid `bookId` values must fall back to `/books` (run each):
   ```powershell
   cd E:\code\learning-agent-platform
   $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
   $env:LAP_DESKTOP_WEB_ROUTE="/reader"

   $env:LAP_DESKTOP_READER_BOOK_ID="bad/id"
   npx electron apps/desktop

   $env:LAP_DESKTOP_READER_BOOK_ID="abc?x=1"
   npx electron apps/desktop

   $env:LAP_DESKTOP_READER_BOOK_ID="abc#x"
   npx electron apps/desktop

   $env:LAP_DESKTOP_READER_BOOK_ID=""
   npx electron apps/desktop
   ```
   Expected log contains both:
   - `Reader route requires a valid LAP_DESKTOP_READER_BOOK_ID...`
   - `Loading local dev server entry: http://localhost:3000/books`

4. Illegal external URL must fall back to static page:
   ```powershell
   cd E:\code\learning-agent-platform
   $env:LAP_DESKTOP_WEB_URL="http://example.com:8080"
   npx electron apps/desktop
   ```
   Expected log contains:
   - `hostname rejected ... example.com`
   - `Loading static index.html (default mode)`

5. Web unavailable should still fall back to static page:
   - Stop terminal A (the Web dev server) first.
   ```powershell
   cd E:\code\learning-agent-platform
   $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
   Remove-Item Env:LAP_DESKTOP_WEB_ROUTE -ErrorAction SilentlyContinue
   Remove-Item Env:LAP_DESKTOP_READER_BOOK_ID -ErrorAction SilentlyContinue
   Remove-Item Env:LAP_DESKTOP_READER_CHAPTER_ID -ErrorAction SilentlyContinue
   npx electron apps/desktop
   ```
   Expected log contains:
   - `Main frame load failed: ERR_CONNECTION_REFUSED`
   - `Falling back to static index.html`

---

## A198 Addendum: Desktop Static Home Preview Entry Guide

A198 updates `apps/desktop/index.html` static home page copy only, to clearly show three Desktop dev-preview entries:

- `Books` => `/books`
- `Learning` => `/learning`
- `Reader` => `/reader` (requires `bookId`, optional `chapterId`)

The page now also shows these environment variables directly:

- `LAP_DESKTOP_WEB_URL=http://localhost:3000`
- `LAP_DESKTOP_WEB_ROUTE=/books | /learning | /reader`
- `LAP_DESKTOP_READER_BOOK_ID`
- `LAP_DESKTOP_READER_CHAPTER_ID` (optional)

PowerShell examples are included on the static page for all three routes.
This is still **development preview only** and does **not** connect to real Agent / Tool / LLM / DB capabilities.

---

## A199 /books GUI 验证记录（Desktop）

验证时间：2026-05-25  
范围：仅验证 Desktop 加载 `/books` 与回退行为；不修改 `main.js` 安全逻辑。

### 场景 1：合法 localhost + `/books`

- 命令：
  ```powershell
  pnpm --filter @learning-agent-platform/web dev
  $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
  $env:LAP_DESKTOP_WEB_ROUTE="/books"
  pnpm --filter @learning-agent-platform/desktop dev
  ```
- 预期：
  - Electron 窗口可启动，加载 `/books`
  - 无白屏、无崩溃、无明显错误
- 实际：
  - Desktop 日志：
    - `Loading local dev server entry: http://localhost:3000/books (hostname=localhost, port=3000)`
  - Web 日志：
    - `GET /books 200`
  - 进程保持运行，未出现崩溃日志
- 结论：通过（基于日志与进程状态）。

### 场景 2：非法 URL 回退静态首页

- 命令：
  ```powershell
  $env:LAP_DESKTOP_WEB_URL="https://example.com"
  $env:LAP_DESKTOP_WEB_ROUTE="/books"
  pnpm --filter @learning-agent-platform/desktop dev
  ```
- 预期：
  - 拒绝外部 URL
  - 回退 `index.html` 静态首页
- 实际：
  - 日志：
    - `LAP_DESKTOP_WEB_URL protocol rejected (only http allowed): https:`
    - `Loading static index.html (default mode)`
- 结论：通过。

### 场景 3：Web 不可用回退静态首页

- 命令：
  ```powershell
  # 先关闭 web dev server
  $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
  $env:LAP_DESKTOP_WEB_ROUTE="/books"
  pnpm --filter @learning-agent-platform/desktop dev
  ```
- 预期：
  - 主框架加载失败后自动回退静态首页
  - 不崩溃
- 实际：
  - 日志：
    - `Loading local dev server entry: http://localhost:3000/books (hostname=localhost, port=3000)`
    - `Main frame load failed: ERR_CONNECTION_REFUSED (code=-102) ...`
    - `Falling back to static index.html`
  - 未见崩溃日志
- 结论：通过。

### A199 结论

- `node --check apps/desktop/main.js`：通过
- `pnpm typecheck`：通过（0 errors）
- `pnpm lint`：通过
- `/books` 加载路径与两类回退逻辑均符合预期日志。
- 限制说明：当前为终端会话验证，无法自动采集窗口像素级截图；GUI “可视内容”以运行日志与 Web 访问日志作为佐证。

---

## A200 Addendum: Desktop Route Noise Fix + /learning Validation

Validation date: 2026-05-25  
Scope: verify route-noise fix for `LAP_DESKTOP_WEB_ROUTE`, keep strict allow-list, and validate `/learning`.

### 1) `/books` no false rejected noise

- Setup:
  ```powershell
  $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
  $env:LAP_DESKTOP_WEB_ROUTE="/books"
  pnpm --filter @learning-agent-platform/desktop dev
  ```
- Expected:
  - Loads `/books`
  - No `LAP_DESKTOP_WEB_ROUTE rejected...` noise for legal route
- Actual:
  - Desktop log: `Loading local dev server entry: http://localhost:3000/books ...`
  - No route rejected warning in this legal case
- Result: pass.

### 2) `/learning` route validation

- Setup:
  ```powershell
  $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
  $env:LAP_DESKTOP_WEB_ROUTE="/learning"
  pnpm --filter @learning-agent-platform/desktop dev
  ```
- Expected:
  - Loads `/learning`
- Actual:
  - Desktop log: `Loading local dev server entry: http://localhost:3000/learning ...`
  - Web log: `GET /learning 200`
- Result: pass.

### 3) Invalid route fallback still enforced

- Setup:
  ```powershell
  $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
  $env:LAP_DESKTOP_WEB_ROUTE="/admin?x=1"
  pnpm --filter @learning-agent-platform/desktop dev
  ```
- Expected:
  - Reject invalid route
  - Fallback `/books`
- Actual:
  - Warning: `LAP_DESKTOP_WEB_ROUTE rejected by safety rule - falling back to default /books`
  - Desktop log: `Loading local dev server entry: http://localhost:3000/books ...`
- Result: pass.

### 4) Invalid external URL fallback unchanged

- Setup:
  ```powershell
  $env:LAP_DESKTOP_WEB_URL="https://example.com"
  $env:LAP_DESKTOP_WEB_ROUTE="/books"
  pnpm --filter @learning-agent-platform/desktop dev
  ```
- Expected/Actual:
  - URL rejected by protocol rule
  - Fallback static index page
- Result: pass.

### 5) Web unavailable fallback unchanged

- Setup:
  - Stop web dev server
  ```powershell
  $env:LAP_DESKTOP_WEB_URL="http://localhost:3000"
  $env:LAP_DESKTOP_WEB_ROUTE="/books"
  pnpm --filter @learning-agent-platform/desktop dev
  ```
- Expected/Actual:
  - Main frame fails with `ERR_CONNECTION_REFUSED`
  - Fallback to static index page
- Result: pass.

## A202 Addendum: Desktop /reader Route GUI Smoke Regression

Validation date: 2026-05-25  
Scope: post-A201 route-policy extraction regression check for `/books`, `/learning`, `/reader`, fallback behaviors.

### Command baseline

- `node --check apps/desktop/main.js` => pass
- `node --test apps/desktop/route-policy.test.mjs` => 10/10 pass
- `pnpm typecheck` => pass (`0 errors`)
- `pnpm lint` => pass

### GUI smoke result

1. `/books` route
- Env: `LAP_DESKTOP_WEB_URL=http://localhost:3000`, `LAP_DESKTOP_WEB_ROUTE=/books`
- Desktop log: `Loading local dev server entry: http://localhost:3000/books ...`
- Web log: `GET /books 200`
- Result: pass.

2. `/learning` route
- Env: `LAP_DESKTOP_WEB_ROUTE=/learning`
- Desktop log: `Loading local dev server entry: http://localhost:3000/learning ...`
- Web log: `GET /learning 200`
- Result: pass.

3. `/reader` legal params
- Env: `LAP_DESKTOP_WEB_ROUTE=/reader`, `LAP_DESKTOP_READER_BOOK_ID=sample-book`, `LAP_DESKTOP_READER_CHAPTER_ID=chapter-1`
- Desktop log: `Loading local dev server entry: http://localhost:3000/reader?bookId=sample-book&chapterId=chapter-1 ...`
- Web log: `GET /reader?bookId=sample-book&chapterId=chapter-1 200`
- Result: pass.

4. `/reader` invalid params fallback
- Tested `bookId`: empty, `bad/id`, `abc?x=1`, `abc#x`
- Desktop log each run:
  - `Reader route requires a valid LAP_DESKTOP_READER_BOOK_ID ... - falling back to /books`
  - `Loading local dev server entry: http://localhost:3000/books ...`
- Web log: 4x `GET /books 200`
- Result: pass.

5. Invalid external URL fallback
- Env: `LAP_DESKTOP_WEB_URL=https://example.com`
- Desktop log:
  - `LAP_DESKTOP_WEB_URL protocol rejected (only http allowed): https:`
  - `Loading static index.html (default mode)`
- Result: pass.

### Notes

- No code change in A202.
- Observed duplicated protocol warning line in external URL case; behavior remains correct and safe (static fallback).

---

## A203 Addendum: Duplicate External URL Warning Noise Fix

Validation date: 2026-05-25  
Scope: remove duplicated warning noise for illegal external URL while preserving all existing whitelist, fallback, and reader-route safety behavior.

### Root cause

- `getAllowedWebUrl()` was called twice during window startup:
  - once in `createWindow()` (to set `currentAllowedOrigin`)
  - once in `loadDesktopEntry()` (to decide actual load target)
- For an illegal URL like `https://example.com`, both calls emitted the same protocol-rejected warning.

### Post-fix behavior checks

1. Legal `/books` with web dev server:
- Env: `LAP_DESKTOP_WEB_URL=http://localhost:3000`, `LAP_DESKTOP_WEB_ROUTE=/books`
- Log: `Loading local dev server entry: http://localhost:3000/books ...`
- No rejected/warning noise.

2. Illegal external URL:
- Env: `LAP_DESKTOP_WEB_URL=https://example.com`
- Log:
  - `LAP_DESKTOP_WEB_URL protocol rejected (only http allowed): https:`
  - `Loading static index.html (default mode)`
- Warning appears once only.

3. Illegal route fallback remains:
- Env: `LAP_DESKTOP_WEB_URL=http://localhost:3000`, `LAP_DESKTOP_WEB_ROUTE=/admin?x=1`
- Log:
  - `LAP_DESKTOP_WEB_ROUTE rejected by safety rule - falling back to default /books`
  - `Loading local dev server entry: http://localhost:3000/books ...`

4. Legal `/learning` and legal `/reader` remain clean:
- `/learning` log: `Loading local dev server entry: http://localhost:3000/learning ...`
- `/reader` log: `Loading local dev server entry: http://localhost:3000/reader?bookId=sample-book&chapterId=chapter-1 ...`
- No rejected/warning noise.

5. Web dev server unavailable fallback remains:
- Env: `LAP_DESKTOP_WEB_URL=http://localhost:3000`, `LAP_DESKTOP_WEB_ROUTE=/books` (server stopped)
- Log:
  - `Main frame load failed: ERR_CONNECTION_REFUSED ...`
  - `Falling back to static index.html`

---

## A205 Addendum: Desktop Reader Load + Reading State Display Validation

Validation date: 2026-05-25  
Scope: verify Desktop can load `/reader`, and reading-state/progress related display or fallback remains safe under preview boundaries.

### Baseline commands

- `node --check apps/desktop/main.js` => pass
- `node --test apps/desktop/route-policy.test.mjs` => 20/20 pass
- `pnpm typecheck` => pass (`0 errors`)
- `pnpm lint` => pass

### Reader URL and demo params

- Reader route shape: `/reader?bookId=<bookId>&chapterId=<chapterId>`
- Mock fallback scenario:
  - `bookId=sample-programming-fundamentals`
  - `chapterId=sample-chapter-variables`
- DB scenario:
  - `bookId=reader-db-sync-verification-book`
  - `chapterId=sample-chapter-long-scroll`

### Desktop runtime checks

1. Legal `/reader` load (mock fallback book):
- Desktop log:
  - `Loading local dev server entry: http://localhost:3000/reader?bookId=sample-programming-fundamentals&chapterId=sample-chapter-variables ...`
- Web log:
  - `GET /reader?bookId=sample-programming-fundamentals&chapterId=sample-chapter-variables 200`
- Result: pass.

2. Legal `/reader` load (DB book):
- Desktop log:
  - `Loading local dev server entry: http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll ...`
- Web log:
  - `GET /reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll 200`
- Result: pass.

3. Missing `bookId` fallback:
- Desktop log:
  - `Reader route requires a valid LAP_DESKTOP_READER_BOOK_ID ... - falling back to /books`
  - `Loading local dev server entry: http://localhost:3000/books ...`
- Result: pass.

4. Invalid `bookId` fallback (`bad/id`):
- Desktop log:
  - `Reader route requires a valid LAP_DESKTOP_READER_BOOK_ID ... - falling back to /books`
  - `Loading local dev server entry: http://localhost:3000/books ...`
- Result: pass.

5. Illegal external URL fallback:
- Env: `LAP_DESKTOP_WEB_URL=http://example.com:8080`
- Desktop log:
  - `LAP_DESKTOP_WEB_URL hostname rejected ... example.com`
  - `Loading static index.html (default mode)`
- Result: pass.

6. Web unavailable fallback:
- Stop web dev server first, then run Desktop with localhost URL.
- Desktop log:
  - `Main frame load failed: ERR_CONNECTION_REFUSED ...`
  - `Falling back to static index.html`
- Result: pass.

### Reading-state/progress display checks

- Reader HTML response contains progress-related sections:
  - `本地已读标记`
  - `当前章节本地滚动阅读进度`
  - `阅读进度预览`
- Ask AI remains disabled placeholder:
  - `AI 问答未启用`
  - `preview-only 占位，不会调用真实模型、RAG、工具`
- DB scenario response contains database preview and progress panel fields.

### localStorage/DB fallback checks (source review)

- `ReaderScrollPositionTracker`:
  - localStorage persists independently
  - DB sync failure is caught and ignored (local fallback retained)
- `ReaderChapterCompletionToggle`:
  - localStorage optimistic update first
  - DB skipped/error shows fallback message and keeps local state
- `ReadingProgressSaveForm`:
  - non-database source disables save action with explicit message

### A205 conclusion

- Desktop `/reader` loading and fallback behavior are consistent with A204 route-policy expectations.
- Reading-state/progress related display is present and remains within preview/mock safety boundaries.
- No code changes were required in A205.

---

## A206 Addendum: Reader 阅读状态数据源提示验证

验证时间：2026-05-25  
范围：仅验证 Reader 页面新增“阅读状态数据源”提示在 Web/Desktop 下可见且语义正确；不修改 Desktop 安全逻辑。

### 1) Web /reader（mock fallback）

- 请求：
  - `/reader?bookId=sample-programming-fundamentals&chapterId=sample-chapter-variables`
- 检查结果：
  - 命中标题：`阅读状态数据源`
  - 命中文案：`开发预览：当前使用本地浏览器记录，未写入数据库或数据库暂不可用。`
  - Ask AI 仍为未启用/preview 文案
  - 未发现 `DATABASE_URL=` 泄露

### 2) Web /reader（DB 书籍）

- 请求：
  - `/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`
- 检查结果：
  - 命中标题：`阅读状态数据源`
  - 命中文案：`开发预览：已连接本地数据库同步阅读状态。`
  - 未发现 `DATABASE_URL=` 泄露

### 3) Desktop /reader 加载

- 环境变量：
  - `LAP_DESKTOP_WEB_URL=http://localhost:3000`
  - `LAP_DESKTOP_WEB_ROUTE=/reader`
  - `LAP_DESKTOP_READER_BOOK_ID=reader-db-sync-verification-book`
  - `LAP_DESKTOP_READER_CHAPTER_ID=sample-chapter-long-scroll`
- Desktop 日志：
  - `Loading local dev server entry: http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll ...`
- 结论：Desktop 仍加载同一 Web Reader 页面，新提示可随页面一并展示。

### 4) Desktop 回退（缺失 Reader bookId）

- 环境变量：
  - `LAP_DESKTOP_WEB_URL=http://localhost:3000`
  - `LAP_DESKTOP_WEB_ROUTE=/reader`
  - 移除 `LAP_DESKTOP_READER_BOOK_ID`
- Desktop 日志：
  - `Reader route requires a valid LAP_DESKTOP_READER_BOOK_ID ... - falling back to /books`
  - `Loading local dev server entry: http://localhost:3000/books ...`
- 结论：Reader 参数不合法时回退仍正确，页面不崩溃。

### A206 结论

- Reader 数据源提示在 Web/Desktop 验证链路下可用。
- 未引入新 API、未改 schema、未接真实 Agent。
- 安全边界保持：无敏感连接串泄露，Ask AI 仍 preview-only。
