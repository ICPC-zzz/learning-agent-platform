# A213 Codex 记录

## 1. 本轮目标
在 Reader 中实现受控的 preview-only 手动数据库同步通路：只有在“同步到云端（开发预览）”开关开启后，用户手动点击同步按钮时，才允许调用 server action，将当前章节本地记录中的可映射字段写入现有 `ReadingProgress`；失败时本地 localStorage 记录不受影响。

## 2. A210 / A211 / A212 当前状态
- A210：已完成本地书签、笔记草稿、阅读计时、阅读统计 localStorage 闭环。
- A211：已完成“同步到云端（开发预览）”开关与本地状态摘要。
- A212：已完成“同步预演（开发预览）”纯前端 mock 交互。
- A213 前缺口：尚无真实 DB 写入通路。

## 3. 实际阅读文件
- `docs/codex-context/CODEX_ALWAYS_READ.md`
- `docs/codex-context/CODEX_RULES.md`
- `docs/codex-context/CURRENT_HANDOFF.md`
- `docs/codex-context/SAFETY_BOUNDARIES.md`
- `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
- `docs/codex-context/DOC_WORKFLOW.md`
- `apps/web/src/app/reader/reader-local-storage.ts`
- `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`
- `apps/web/src/app/reader/page.tsx`
- `apps/web/src/app/reader/actions.ts`
- `apps/web/src/app/reader/ReaderScrollPositionTracker.tsx`
- `apps/web/src/app/reader/ReaderChapterCompletionToggle.tsx`
- `apps/web/src/app/reader/ReaderReadingStatsPanel.tsx`
- `packages/db/src/repositories/reading-progress-repository.ts`
- `packages/db/src/types.ts`

## 4. 修改文件
- `apps/web/src/app/reader/actions.ts`
- `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`
- `apps/web/src/app/reader/page.tsx`
- `apps/web/src/app/reader/ReaderChapterCompletionToggle.tsx`
- `docs/rounds/codex/A213_codex.md`

## 5. 同步 action / API 设计
在 `apps/web/src/app/reader/actions.ts` 新增 server action：
- `manualSyncReaderPreviewToDbAction(input)`
- 输入：最小 JSON（`syncEnabled`、`bookId/chapterId`、bookmark/note/timer 摘要、latestLocalUpdatedAt），不包含 secrets。
- 输出结构：
  - `ok`
  - `status`: `synced | partial | disabled | invalid | fallback | noop`
  - `message`
  - `syncedFields?`
  - `skippedFields?`
- 安全校验：
  - `syncEnabled !== true` -> `disabled`
  - `bookId/chapterId` 缺失 -> `invalid`
  - 无本地记录 -> `noop`
  - 无 `DATABASE_URL` / demo 用户缺失 / DB 异常 -> `fallback`
- DB 写入：仅通过 `PrismaReadingProgressRepository.upsertReadingProgress` 写入可映射字段（`progressRatio`）。
- 错误处理：`try/catch` 安全回退，不向前端暴露连接串或堆栈。

## 6. 前端同步按钮和状态流转
在 `ReaderSyncPreviewPanel.tsx` 保留 A212 同步预演并新增“手动同步到数据库（开发预览）”流程：
- 按钮禁用条件：
  - 同步开关关闭
  - 无章节标识
  - 无本地记录
  - 正在同步
  - localStorage 不可用
- 点击后进入 loading，调用 `manualSyncReaderPreviewToDbAction`。
- 返回状态渲染：
  - 成功/部分成功：显示“开发预览同步完成…”
  - 失败回退：显示“同步预览失败，本地记录未受影响。”
  - 无数据：显示“无本地记录可同步。”
- 文案明确包含：
  - 开发预览
  - 需要手动触发
  - 失败不影响本地记录
  - 非生产级云同步

另外为确保“仅手动触发”边界：
- `page.tsx` 中将 `ReaderScrollPositionTracker` 的 `dbSyncEnabled` 显式设为 `false`，关闭滚动自动 DB 同步。
- `ReaderChapterCompletionToggle.tsx` 移除旧的直接 DB 同步调用，仅保留本地标记并提示到同步面板手动触发。

## 7. 同步字段映射（已同步 / 跳过）
已同步（可承载）：
- `readingProgress.progressRatio`（来自本地书签 `scrollPercent` / 100）

跳过（当前 schema/通路未承载）：
- 笔记正文与草稿详细内容（`noteDraft.content`）
- 阅读计时秒数（`readingTimer.totalSeconds`）
- 书签/笔记/计时/本地汇总的更新时间字段（`updatedAt` 类）
- 书签存在但无可用 `scrollPercent` 时，仅返回 partial，不强行写入不匹配字段

说明：未改 schema，不为笔记全文或计时强行加表/字段。

## 8. DB / repository 修改情况
- `packages/db` 未修改。
- 复用现有：
  - `PrismaReadingProgressRepository.upsertReadingProgress`
  - `PrismaUserRepository.getUserByEmail`
  - `PrismaBookRepository.getBookReaderData`

## 9. 失败回退策略
- 任何同步失败（配置缺失、demo 用户缺失、DB 异常）均返回 `fallback`。
- 前端统一提示“同步预览失败，本地记录未受影响。”
- 不清空 localStorage，不影响本地阅读闭环。

## 10. typecheck / lint 结果
- `pnpm typecheck`：通过（0 errors）
- `pnpm lint`：通过

## 11. 浏览器 / curl / 手动验收结果
已执行：
- 启动 Web：`pnpm dev` 成功，Next.js 本地服务启动在 `http://localhost:3000`
- `curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/reader?bookId=demo-book&chapterId=demo-chapter-1"` -> `200`

未执行自动化浏览器点击：
- 本轮未用 Playwright 自动化，未编造点击结果。

建议手动验收步骤：
1. 进入 Reader，先创建本地书签/笔记/计时记录。
2. 关闭同步开关，确认“手动同步到数据库（开发预览）”按钮禁用。
3. 开启同步开关，点击“生成同步预演”。
4. 点击“手动同步到数据库（开发预览）”。
5. 观察 `synced/partial/fallback/noop` 提示是否符合预期。
6. 断开 DB 或移除 `DATABASE_URL` 再试，确认提示 fallback 且本地记录仍在。
7. 刷新页面确认未发生页面加载即自动同步。

## 12. 安全边界确认
- 未接入真实 LLM / Agent loop / Tool 执行。
- 未保存 raw prompt / raw response。
- 未改 Prisma schema / migration / seed。
- 未输出数据库连接串或完整错误堆栈。
- DB 写入仅在手动触发且同步开关开启时发生（preview-only）。

## 13. 未完成问题
- 仅完成 `ReadingProgress.progressRatio` 的最小映射，书签时间戳/计时秒数/笔记内容仍未入库（按边界要求跳过）。
- 尚未完成端到端自动化点击验证（仅做了服务可达与静态校验）。

## 14. 下一轮建议
优先做 A213+ 验收与补齐，不继续纯文案：
1. 增强手动验收覆盖（含 DB 不可用场景）并固化为可重复清单。
2. 评估在不改 schema 前提下，是否能安全映射更多 Reader 本地字段到现有 `ReadingProgress`（例如更稳定的进度来源策略）。
3. 如需桌面端联动，再推进 Desktop Reader 入口，但保持 preview-only 与权限边界。
