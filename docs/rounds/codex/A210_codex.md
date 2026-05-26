# A210 Codex 记录

## 1. 本轮目标
- 推进 Web Reader 右侧面板本地业务闭环：书签、笔记草稿、阅读计时、阅读统计从预览文案升级为可交互、可保存、可恢复的 localStorage 能力。
- 严格保持“开发预览 - 本地浏览器记录”边界，不接 DB、不新增 API、不接入真实 LLM/Agent。

## 2. 为什么本轮从基础设施小补丁转为业务闭环推进
- A206-A209 主要在 Reader 数据源提示、Desktop DB 包解析、Desktop 探活，安全边界稳定但用户可见业务增量有限。
- A210 按策略切换到“可见闭环优先”：把 Reader 右侧核心交互做成可用能力，直接提升页面可操作性与可验证性。

## 3. 实际阅读文件
必读：
- `docs/codex-context/CURRENT_HANDOFF.md`
- `docs/codex-context/CODEX_ALWAYS_READ.md`
- `docs/codex-context/CODEX_RULES.md`
- `docs/codex-context/SAFETY_BOUNDARIES.md`
- `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
- `docs/codex-context/DOC_WORKFLOW.md`
- `apps/web/src/app/reader/page.tsx`
- `apps/web/src/app/reader/ReaderBookmarksPanel.tsx`
- `apps/web/src/app/reader/ReaderNoteDraftPanel.tsx`
- `apps/web/src/app/reader/ReaderReadingStatsPanel.tsx`

额外（允许范围内）：
- `apps/web/src/app/reader/ReaderReadingTimer.tsx`
- `apps/web/src/app/reader/ReaderReadingStateSourceNotice.tsx`
- `apps/web/src/app/reader/ReaderScrollPositionTracker.tsx`
- `apps/web/src/app/reader` 目录内 localStorage 使用检索（`rg -n "localStorage|storage"`）

## 4. 修改文件
- `apps/web/src/app/reader/reader-local-storage.ts`（新增）
- `apps/web/src/app/reader/ReaderBookmarksPanel.tsx`
- `apps/web/src/app/reader/ReaderNoteDraftPanel.tsx`
- `apps/web/src/app/reader/ReaderReadingTimer.tsx`
- `apps/web/src/app/reader/ReaderReadingStatsPanel.tsx`
- `apps/web/src/app/reader/page.tsx`

## 5. localStorage key 设计
统一采用 `lap.reader.*` 前缀，并按 `bookId + chapterId` 隔离：
- `lap.reader.bookmark.<bookId>.<chapterId>`
- `lap.reader.note.<bookId>.<chapterId>`
- `lap.reader.timer.<bookId>.<chapterId>`

安全降级：
- 当 `bookId/chapterId` 缺失时，内部 key 分段降级为 `unknown-book/unknown-chapter`，组件层禁用保存动作并展示中文提示，不抛异常。
- 当 localStorage 不可用时，统一显示“本地记录不可用”提示并安全回退。

## 6. 书签功能完成情况
- 改为“当前章节单条本地书签”模式：支持保存/更新当前章节书签。
- 保存时优先记录当前滚动百分比；无法获取时记录“未捕获滚动位置”。
- 支持清除当前章节本地书签。
- 展示书签状态与最近更新时间。
- 全部文案明确标注“开发预览 - 本地浏览器记录”。

## 7. 笔记草稿功能完成情况
- Reader 右侧栏已挂载 `ReaderNoteDraftPanel`。
- 提供 textarea + “保存草稿”“清空草稿”按钮。
- 保存到章节级 localStorage，刷新后可恢复。
- 展示保存状态与最近保存时间。
- 不上传笔记、不写数据库、不新增 API。
- 文案明确标注“开发预览 - 本地浏览器记录”。

## 8. 阅读计时功能完成情况
- 支持“开始计时 / 暂停 / 重置”。
- 计时累计值持久化到章节级 localStorage，刷新后恢复。
- 显示格式为中文时长（如“12 分 30 秒”）。
- 页面关闭/刷新时会尽量把运行中计时折算并落盘，再恢复为暂停态，避免伪装后台持续计时。
- 不影响数据库。
- 文案明确标注“开发预览 - 本地浏览器记录”。

## 9. 阅读统计功能完成情况
- 统计面板改为读取当前章节本地记录汇总：
  - 本地累计阅读时长（来自计时记录）
  - 本地笔记是否存在
  - 本地书签是否存在
  - 最近本地更新时间（三类记录取最新）
- 无数据时显示中文空状态。
- 明确提示“仅保存在当前浏览器，不代表数据库同步”。

## 10. typecheck/lint/浏览器验证结果
- `pnpm typecheck`：通过（0 errors）。
- `pnpm lint`：通过（Reader 相关 TS 语法检查全部 OK）。
- 浏览器验证：本轮未完成自动化浏览器实测。
  - 原因：当前会话未提供可用的浏览器自动化工具入口（仅代码与命令执行能力），无法在本会话中可靠执行“打开页面+交互+刷新复验+控制台检查”的端到端操作。
  - 已完成替代保障：源码审查 + typecheck + lint。

## 11. 安全边界确认
- 未接入数据库同步链路。
- 未新增后端 API。
- 未修改 Prisma schema/migration/seed。
- 未接入真实 LLM provider、未执行真实工具、未启动 Agent loop。
- 所有新增文案保持“开发预览 - 本地浏览器记录”定位。

## 12. 未完成问题
- 缺少本轮强制要求中的“真实浏览器交互验证”结果（受当前会话工具能力限制）。

## 13. 下一轮建议
优先推进“Reader 本地闭环 -> 可控同步入口”而非继续 fallback 小补丁：
1. 在 Web Reader 增加受控“同步入口开关/状态提示”（仍可先 mock），把本地记录与未来 DB 同步流程的边界、失败回退和用户可见状态提前打通。
2. 并行规划 Desktop Reader 业务入口最小可见态（只做入口与状态展示，不放宽安全边界），为后续跨端同步承接做准备。
