# A212 Codex 记录

## 1. 本轮目标
- 补做 A210/A211 Reader 真实浏览器交互验收（尽量自动化）。
- 在不接入真实 DB/API 的前提下，为 Reader 增加“同步预演（开发预览）”纯前端 mock 交互。

## 2. A210/A211 已完成但缺浏览器验证状态
- A210 已完成本地书签、笔记草稿、阅读计时、阅读统计 localStorage 闭环。
- A211 已完成“同步到云端（开发预览）”开关与本地记录状态摘要。
- A210/A211 在此前仅完成静态验证，缺少本轮要求的浏览器端交互验收闭环。

## 3. 实际阅读文件
- `docs/codex-context/CURRENT_HANDOFF.md`
- `docs/codex-context/CODEX_ALWAYS_READ.md`
- `docs/codex-context/CODEX_RULES.md`
- `docs/codex-context/SAFETY_BOUNDARIES.md`
- `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
- `docs/codex-context/DOC_WORKFLOW.md`
- `docs/rounds/codex/A211_codex.md`
- `apps/web/src/app/reader/page.tsx`
- `apps/web/src/app/reader/reader-local-storage.ts`
- `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`
- 额外读取（用于 A210 回归理解）：
  - `apps/web/src/app/reader/ReaderBookmarksPanel.tsx`
  - `apps/web/src/app/reader/ReaderNoteDraftPanel.tsx`
  - `apps/web/src/app/reader/ReaderReadingTimer.tsx`
  - `apps/web/src/app/reader/ReaderReadingStatsPanel.tsx`

## 4. 修改文件
- `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`
- `docs/rounds/codex/A212_codex.md`

## 5. 同步预演 UI 实现方式
- 在 `ReaderSyncPreviewPanel.tsx` 内直接扩展，无新增碎片组件。
- 新增按钮：`生成同步预演`。
- 开关关闭时按钮禁用，并显示提示：
  - “请先开启同步到云端（开发预览）开关。本功能不会执行真实同步。”
- 开关开启时按钮可用。
- 点击按钮后进入 loading 文案：`正在生成同步预览...`。
- loading 用 `setTimeout(700ms)` 模拟，并通过 `useRef + useEffect cleanup` 清理 timer，避免泄漏。
- 完成后展示“本次预演将同步的数据”摘要卡片。

## 6. 预演状态设计
- 使用前端状态机（React state）：
  - `pending`（待预演）
  - `loading`（正在生成同步预览）
  - `completed`（预演完成：未执行真实同步）
  - `empty`（无本地记录可同步）
- 状态与文案均明确 `开发预览 / mock-only / 未执行真实同步`。

## 7. localStorage key 设计
- 本轮**未新增** `syncPreview` localStorage key。
- 原因：本轮将预演结果仅保存在组件 state，满足“纯前端 mock、刷新可不恢复”的约束，并避免引入额外持久化复杂度。
- 业务数据仍沿用 A210 既有 key（书签/笔记/计时），未新增 DB/API 通道。

## 8. A210 书签/笔记/计时/统计回归情况
- 代码层面：本轮仅修改 `ReaderSyncPreviewPanel.tsx`，未改动 A210 四个核心组件逻辑。
- 静态验证层面：`pnpm typecheck` / `pnpm lint` 通过，未发现类型或语法回退。
- 浏览器交互层面的完整回归：见第 11 节（受自动化环境限制，未完成全量实机自动化）。

## 9. A211 同步开关回归情况
- 开关逻辑保留：`readReaderSyncSwitch` / `writeReaderSyncSwitch` 仍为唯一数据来源。
- 面板仍展示本地记录状态摘要（书签、草稿、计时、最近更新时间）。
- 本轮在此基础上增加 dry-run 预演，不触发真实同步。

## 10. typecheck/lint 结果
- `pnpm typecheck`：通过（0 errors）。
- `pnpm lint`：通过（VM lint complete）。

## 11. 浏览器验证结果
- 已完成：
  - 启动开发服务：`pnpm dev`（Next.js ready）。
  - `curl -I` 访问 Reader 目标 URL 返回 `HTTP/1.1 200 OK`。
- 未完成：
  - Playwright 真实交互自动化未跑通（环境缺少已安装浏览器可执行文件；尝试 `pnpm dlx playwright install chromium` 未在本会话内得到可用结果）。
- 因此本轮无法给出“已完成真实浏览器点击级别验收”的结论。

### 手动验收步骤（按本轮目标）
1. 启动：`pnpm dev`。
2. 打开：`/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`。
3. 验证 A211 开关：默认关闭、可开启、刷新后状态恢复。
4. 验证 A212 预演：
   - 开关关闭时按钮 disabled 并显示“请先开启...”提示。
   - 开关开启后按钮可点击。
   - 点击后出现“正在生成同步预览...”。
   - 完成后出现预演摘要，并显示“未发送网络请求、未写入数据库”。
5. 验证 A210 回归：
   - 书签保存/清除与摘要变化。
   - 笔记草稿保存/清空与摘要变化。
   - 计时开始/暂停/重置与统计变化。
   - 刷新后本地记录恢复。
6. 检查 Console 无明显错误。
7. 检查 Network：预演流程不产生同步 API/fetch 请求。

## 12. 安全边界确认
- 未新增 API、route handler、server action。
- 未新增 DB 查询/写入，未改 Prisma schema/migration/seed。
- 未接入真实 LLM provider、未启动 agent loop。
- 同步预演文案明确为开发预览/mock，未伪装真实云同步。

## 13. 未完成问题
- 本轮未能在当前环境完成“真实浏览器自动化交互验收”闭环（仅完成服务可访问与静态验证）。

## 14. 下一轮建议
- 优先推进 Reader 本地记录到 DB 同步的 **preview-only API 设计**（保留明确权限与状态提示）。
- 或推进 Desktop 中打开 Reader 的业务入口联动。
- 不建议继续停留在纯文案小补丁。
