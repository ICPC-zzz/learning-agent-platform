# A215 Codex 执行记录

## 1. 本轮目标
推进 Desktop Reader 入口集成并执行 GUI 验证：让 Desktop/Electron 开发模式通过现有路由机制打开 `/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`，并验证 Reader 同步面板在 Desktop 窗口内渲染与交互前提。

## 2. A214 后状态
- A213 手动 DB 同步通路（preview-only）已存在。
- A214 已做代码路径审查与脚本化可达性验证，未做真实 GUI 点击。
- Desktop 具备安全路由白名单与最小 DB 探活。

## 3. 实际阅读文件
1. `docs/codex-context/CURRENT_HANDOFF.md`
2. `docs/rounds/codex/A214_codex.md`
3. `docs/codex-context/SAFETY_BOUNDARIES.md`
4. `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
5. `docs/codex-context/CODEX_RULES.md`
6. `apps/desktop/main.js`（实际 Desktop 主进程入口）
7. `apps/desktop/route-policy.js`（实际路由/安全策略文件）
8. `apps/web/src/app/reader/page.tsx`
9. `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`
10. `apps/web/src/app/reader/actions.ts`
11. `apps/desktop/package.json`（额外读取，仅用于确认脚本）

## 4. 修改文件
- 新增：`docs/rounds/codex/A215_codex.md`
- 业务源码修改：无。

## 5. Desktop Reader 入口验证方式
### 5.1 路由机制确认（代码审查）
- `apps/desktop/main.js` 通过 `resolveDesktopWebTarget` 读取：
  - `LAP_DESKTOP_WEB_URL`
  - `LAP_DESKTOP_WEB_ROUTE`
  - `LAP_DESKTOP_READER_BOOK_ID`
  - `LAP_DESKTOP_READER_CHAPTER_ID`
- `apps/desktop/route-policy.js` 已允许 `/reader`（白名单包含 `/books`、`/learning`、`/reader`）。
- `LAP_DESKTOP_WEB_ROUTE` 不允许直接携带 `?query`（安全规则），Reader query 由独立环境变量进入并做正则校验（`[A-Za-z0-9_-]+`），未放宽安全边界。

### 5.2 启动与日志验证
使用环境变量启动 Desktop：

```powershell
$env:LAP_DESKTOP_WEB_URL='http://localhost:3000'
$env:LAP_DESKTOP_WEB_ROUTE='/reader'
$env:LAP_DESKTOP_READER_BOOK_ID='reader-db-sync-verification-book'
$env:LAP_DESKTOP_READER_CHAPTER_ID='sample-chapter-long-scroll'
pnpm --filter @learning-agent-platform/desktop dev
```

Desktop 主进程日志：
- `[desktop] Loading local dev server entry: http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll ...`
- `[desktop] 预览数据库可用`

Web dev 日志确认命中：
- `GET /reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll 200`

### 5.3 页面可达性验证（脚本化）
对目标 Reader URL 拉取 HTML，确认同步面板关键文案存在：
- “同步到云端（开发预览）”
- “同步预演（开发预览 / mock）”
- “手动同步到数据库（开发预览）”

并确认初始状态文本/按钮禁用文案可见（对应开关默认关闭）。

## 6. 使用的环境变量和测试参数
- `LAP_DESKTOP_WEB_URL=http://localhost:3000`
- `LAP_DESKTOP_WEB_ROUTE=/reader`
- `LAP_DESKTOP_READER_BOOK_ID=reader-db-sync-verification-book`
- `LAP_DESKTOP_READER_CHAPTER_ID=sample-chapter-long-scroll`

## 7. Reader 同步面板 GUI 验收结果
### 7.1 已完成
- 页面渲染：已通过 Desktop + Web 日志确认 Reader 页面被 Electron 入口加载。
- 同步面板可见：已通过页面内容检查确认关键 UI 文案存在。
- 开关默认状态：代码与初始 HTML 一致，默认关闭；对应按钮初始禁用文案可见。
- 开关关闭时按钮不可触发：从组件禁用条件与初始 DOM 状态可确认。

### 7.2 未完成（受工具限制）
以下需要真实 Electron 窗口点击才能最终闭环，本轮自动化环境无法直接驱动 Desktop 窗口：
- 开关打开后“生成同步预演”点击验证
- 无本地记录 `noop` 的点击态验证
- 产生本地记录后状态摘要变化验证
- 手动同步后 `synced/partial/fallback/noop` 的 Desktop 窗口内点击态验证
- DB 不可用 fallback 的 Desktop 窗口点击态验证（本地记录不丢失）

## 8. 未能 GUI 点击的原因与可复现步骤
原因：当前 Codex 执行环境可启动 Electron 并读取日志，但无法直接对 Desktop 窗口做可视化点击自动化（无可用的 Electron 窗口驱动链路）。

可复现手动步骤：
1. 启动 Web：`pnpm --filter @learning-agent-platform/web dev`
2. 启动 Desktop（携带上述 4 个环境变量）。
3. 在 Desktop Reader 右侧面板确认“同步到云端（开发预览）”默认关闭。
4. 关闭状态下确认“手动同步到数据库（开发预览）”不可用。
5. 打开开关后点击“生成同步预演”，观察“待预演 -> 完成/无本地记录”状态。
6. 无本地书签/笔记/计时时确认“无本地记录可同步”。
7. 先创建本地书签或阅读计时，再点击手动同步，观察状态变为 `synced` 或 `partial`（依赖本地数据）。
8. 临时使 DB 不可用后重复手动同步，确认进入 `fallback`，并刷新后本地记录仍存在。
9. 全程确认无页面加载即自动写 DB、无后台自动同步。

## 9. typecheck/lint 结果
- `pnpm typecheck`：通过（0 errors）
- `pnpm lint`：通过（0 errors）

## 10. 安全边界确认
- 未修改 Desktop 安全沙箱（`nodeIntegration/contextIsolation/sandbox`）。
- 未放宽 CSP、外部 URL、路由白名单或 query 安全规则。
- 未新增任意 URL 加载能力。
- 未修改 Reader 同步逻辑、DB 字段映射、schema/migration。
- 保持 preview-only / 手动触发 / 失败不影响本地 的既有边界。

## 11. 未完成问题
- 尚未完成“Desktop 窗口内”的自动点击级 GUI 验证闭环，只完成了入口可达性 + 日志 + 页面内容与代码路径验证。

## 12. 下一轮建议
1. 若 A215 以“入口可达 + 面板可见”验收通过，A215+ 优先推进 Desktop 侧 Reader 入口按钮/菜单，减少手工环境变量启动成本。
2. 或按计划推进 Reader DB 同步字段补齐方案（需单独评审 schema/安全边界），不要继续做纯文案小补丁。
