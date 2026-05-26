# A214 Codex 验收报告

## 1. 本轮目标与边界
- 目标：完成 A213「Reader 手动同步到数据库（开发预览）」验收闭环。
- 边界：不重构、不扩展新功能；仅在发现明确 bug 时做 Reader 同步相关最小修复。
- 结果：未发现需要修复的明确 bug，本轮未改业务代码，仅新增本验收报告。

## 2. 验收项与结果

### 2.1 A213 同步交互
1. 同步开关关闭时按钮禁用：通过。
   - `ReaderSyncPreviewPanel` 中“手动同步到数据库（开发预览）”按钮受 `!syncEnabled` 禁用控制。
   - 服务端渲染页面（`/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`）可见按钮初始 `disabled`。
2. 无本地记录时显示 noop/无可同步记录：通过。
   - UI 在 `syncEnabled && hasIdentifiers && !hasAnyLocalRecord` 时显示“无本地记录可同步”。
   - Server action 也有 `status: "noop"` 分支（兜底保证）。
3. 有本地书签进度时可手动触发同步：通过（代码路径验证）。
   - `manualSyncReaderPreviewToDbAction` 接收本地 bookmark/note/timer 摘要，存在可映射书签进度时走 DB upsert 路径。
4. DB 不可用时 fallback 且本地记录不丢失：通过（代码路径验证）。
   - 无 `DATABASE_URL` 或 DB 异常时返回 `status: "fallback"`。
   - 本地记录存储在 localStorage，手动同步流程未删除/清空本地记录。

### 2.2 仍为开发预览（非自动生产同步）
1. 不自动后台同步：通过。
   - `page.tsx` 对 `ReaderScrollPositionTracker` 显式传入 `dbSyncEnabled={false}`，关闭滚动自动 DB 同步。
2. 不在页面加载时写 DB：通过。
   - 本轮验证请求日志仅出现 `GET`，未出现 Reader 同步 `POST` 自动写入。
3. 不同步完整笔记正文、计时秒数或敏感信息：通过。
   - 手动同步仅映射 `readingProgress.progressRatio`。
   - `noteDraft.content`、`readingTimer.totalSeconds`、各类 `updatedAt` 等在 `skippedFields` 中明确跳过。
4. 不移除“开发预览”提示：通过。
   - Reader 同步面板与相关提示文案仍保留“开发预览 / 手动触发 / 失败不影响本地”。

### 2.3 浏览器验收情况
- 已完成可脚本化页面验收（`curl` + 页面 HTML 检查 + Next dev 日志检查）。
- 未完成真实浏览器点击（本轮环境未提供可直接驱动的浏览器自动化工具链）。
- 未编造点击结果。

可复现手动点击步骤（用于补齐 GUI 验收）：
1. 启动：`pnpm dev`
2. 打开：`http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`
3. 保持开关关闭，确认“手动同步到数据库（开发预览）”按钮禁用。
4. 开启开关，在无本地记录时确认“无本地记录可同步”提示。
5. 生成本地记录（加书签/写笔记/运行计时）后点击“手动同步到数据库（开发预览）”。
6. 观察 `synced/partial/fallback/noop` 对应文案是否一致。
7. 断开 DB（或临时移除 `DATABASE_URL`）重复第 5 步，确认 fallback 且本地记录仍在。
8. 刷新页面，确认未发生“页面加载即自动同步”。

### 2.4 typecheck / lint
- `pnpm typecheck`：通过（0 errors）
- `pnpm lint`：通过（0 errors）

## 3. 本轮修复情况
- 未做代码修复（未发现需要最小修复的明确 Reader 同步 bug）。
- 修复文件：无。

## 4. 关键验证依据（代码）
- `apps/web/src/app/reader/actions.ts`
  - `manualSyncReaderPreviewToDbAction`（手动同步主通路）
  - `status` 分支覆盖：`synced | partial | disabled | invalid | fallback | noop`
  - 仅写入 `readingProgress.progressRatio`
- `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`
  - 手动同步按钮禁用条件与“无本地记录可同步”提示
  - “开发预览”与“手动触发”文案
- `apps/web/src/app/reader/page.tsx`
  - `ReaderScrollPositionTracker dbSyncEnabled={false}`
- `apps/web/src/app/reader/ReaderChapterCompletionToggle.tsx`
  - 本地已读标记提示“需在同步面板手动触发”

## 5. 安全边界确认
- 未改 schema / migration / 真实同步策略 / DB 基础配置。
- 未引入自动后台同步或页面加载自动写 DB。
- 未扩大写入字段范围（仍仅 `progressRatio`）。
- 未移除 preview-only 边界提示。

## 6. 未完成问题
- 真实浏览器点击验收尚未在本轮自动化执行（已给出可复现手动步骤）。

## 7. 下一轮建议（A214+）
1. 在可用浏览器自动化环境中补一轮 GUI 点击验收（开关关闭、noop、synced/partial、fallback 四类状态）。
2. 若需扩展同步字段（笔记正文/计时秒数等），需单独开启新对话并先做 schema 与安全边界评审，不在当前轮直接扩展。
