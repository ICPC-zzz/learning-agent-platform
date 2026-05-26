# A211 Codex 记录

## 1. 本轮目标
- 在 Reader 右侧面板增加“同步到云端（开发预览）”开关（默认关闭、可切换、刷新可恢复）。
- 增加本地记录状态确认区域，汇总当前章节的书签、笔记草稿、阅读计时与最近更新时间。
- 不新增 API/DB/IPC，不触发任何云同步行为。
- 补做 A210 Reader 本地交互的浏览器验收（尽力自动化）。

## 2. A210 已完成但缺浏览器验证的状态
- A210 已把书签、笔记草稿、阅读计时、阅读统计升级为 localStorage 可交互能力。
- A210 已通过 `pnpm typecheck` / `pnpm lint`。
- A210 缺失真实浏览器端交互验收（开关/刷新/计时/统计等动作未完整自动化验证）。

## 3. 实际阅读文件
- `docs/codex-context/CURRENT_HANDOFF.md`
- `docs/codex-context/CODEX_ALWAYS_READ.md`
- `docs/codex-context/CODEX_RULES.md`
- `docs/codex-context/SAFETY_BOUNDARIES.md`
- `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
- `docs/codex-context/DOC_WORKFLOW.md`
- `apps/web/src/app/reader/page.tsx`
- `apps/web/src/app/reader/reader-local-storage.ts`
- `apps/web/src/app/reader/ReaderReadingStatsPanel.tsx`
- `apps/web/src/app/reader/ReaderBookmarksPanel.tsx`
- `apps/web/src/app/reader/ReaderNoteDraftPanel.tsx`（额外读取）
- `apps/web/src/app/reader/ReaderReadingTimer.tsx`（额外读取）
- `apps/web/src/app/reader/ReaderReadingStateSourceNotice.tsx`（额外读取）

## 4. 修改文件
- `apps/web/src/app/reader/reader-local-storage.ts`
- `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`（新增）
- `apps/web/src/app/reader/page.tsx`

## 5. 同步入口开关实现方式
- 新增 client 组件 `ReaderSyncPreviewPanel`，挂载在 Reader 右侧面板上方。
- 开关标题为“同步到云端（开发预览）”，使用 checkbox 交互。
- 默认关闭；切换后写入 localStorage；刷新后从 localStorage 读取并恢复。
- 开关文案：
  - 关闭：`开发预览 - 当前仅使用本地浏览器记录。`
  - 打开：`开发预览 - 同步流程尚未启用，本地记录仍保存在当前浏览器。`
- 明确提示：当前不会触发数据库写入或网络同步请求。

## 6. localStorage key 设计
- 在 `reader-local-storage.ts` 增加常量 key：`lap.reader.syncSwitch`（通过 `KEY_PREFIX + ".syncSwitch"` 生成）。
- 新增函数：
  - `getReaderSyncSwitchStorageKey()`
  - `readReaderSyncSwitch()`（读取失败或不可用时返回 `false`）
  - `writeReaderSyncSwitch(enabled: boolean)`（失败安全返回 `false`）
- 保持与 A210 既有 key 构造与安全降级风格一致。

## 7. 本地记录状态摘要实现方式
- 在 `ReaderSyncPreviewPanel` 中汇总当前章节 localStorage 数据（复用 A210 读写函数）：
  - 本地书签：有 / 无
  - 笔记草稿：有 / 无
  - 阅读计时：累计时长（`formatReaderDuration`）
  - 最近本地更新时间：有则格式化显示，无则“暂无记录”
- 缺少 `bookId`/`chapterId` 时显示安全降级提示，不崩溃。
- localStorage 不可用时显示友好提示，不抛异常。
- 全部文案保留“开发预览 - 本地浏览器记录”语义，不伪装真实同步。

## 8. A210 书签/笔记/计时/统计回归情况
- 本轮未修改 A210 四个核心交互组件的持久化逻辑。
- 新增同步开关组件仅读取/写入独立 key（`lap.reader.syncSwitch`），不干扰：
  - `ReaderBookmarksPanel`
  - `ReaderNoteDraftPanel`
  - `ReaderReadingTimer`
  - `ReaderReadingStatsPanel`
- 静态层面未发现功能回退迹象。

## 9. typecheck / lint 结果
- `pnpm typecheck`：通过（0 errors）。
- `pnpm lint`：通过（VM lint complete）。

## 10. 浏览器验证结果
- 已执行：
  - 启动 `pnpm dev`，Next.js 正常 ready。
  - 访问 `http://localhost:3000/reader`、`/books`、`/books/reader-db-sync-verification-book` 与 reader 目标链接（HTTP 200）。
  - 开发服务器日志显示 `/reader` 编译通过并成功响应。
- 未完成自动化交互验收原因：
  - 当前会话没有可直接调用的内置浏览器自动化工具；
  - 通过 `npx playwright` / `@playwright/test` 临时路径尝试后，环境中无法稳定加载测试运行依赖，未能完成交互脚本执行。
- 手动验收步骤（建议按顺序）：
  1. 启动 `pnpm dev` 并打开 `/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`。
  2. 切换“同步到云端（开发预览）”开关，确认提示文案随状态变化。
  3. 刷新页面，确认开关状态恢复。
  4. 保存书签，确认“本地记录状态确认”里的“本地书签：有”。
  5. 保存笔记草稿，确认“笔记草稿：有”。
  6. 启动计时并暂停，确认累计时长变化。
  7. 重置计时，确认累计时长与统计表现变化。
  8. 刷新页面，确认书签/草稿/计时可恢复。
  9. 打开浏览器控制台，确认无明显错误。
  10. 打开 Network 面板，确认没有用于同步的 API 请求。

## 11. 安全边界确认
- 未新增后端 API、未新增 DB 读写、未触碰 Prisma schema/migration。
- 未接入真实 LLM provider、未触发 Agent loop、未执行真实工具链调用。
- 未修改 Desktop 安全配置，不涉及 preload/renderer 暴露 DB。
- 同步入口明确为“开发预览”，不暗示真实云同步已启用。

## 12. 未完成问题
- 浏览器交互验收未能在本会话内完成自动化闭环（环境工具链限制），需手动补验或下一轮补自动化。

## 13. 下一轮建议
- 优先推进 Reader 本地记录到 DB 同步的 **preview-only** 方案设计（带明确权限/状态提示），或推进 Desktop Reader 入口联动；
- 不建议继续做纯文案小补丁，优先推进可验证的业务闭环能力。
