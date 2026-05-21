# A138+ Codex 清理确认清单

## 1. 本轮任务

基于 A138 工作区审查结果，重新确认当前未提交改动，并输出待用户确认的清理执行清单。本轮只执行状态核对、验证命令、清单整理，以及文档工作流要求的两项文档更新：新增 `docs/rounds/codex/A138+_codex.md`，更新 `docs/codex-context/CURRENT_HANDOFF.md`。

本轮未执行实际清理，未暂存，未提交，未回滚，未删除，未移动文件，未修改业务代码。

## 2. 当前工作区状态总览

基于本轮清单生成前的状态核对：

- 暂存区：空。
- 已跟踪 modified：29 个文件。
- 已跟踪 deleted：1 个文件，`docs/status/WEB_MVP_COMPLETION_ROADMAP.md`。
- 未跟踪文件：19 个文件。
- `git diff --stat`：30 个已跟踪文件，546 行新增，833 行删除。
- `pnpm typecheck`：通过。
- `pnpm lint`：通过。

注意：本轮写入本文件后，`docs/rounds/codex/A138+_codex.md` 会成为新增未跟踪文件。

## 3. 建议保留并纳入 Git 的文件

### A134 docs 文档工作流相关文件

| 文件路径 | Git 状态 | 归属轮次 | 建议动作 | 保留理由 |
|---|---:|---|---|---|
| `docs/codex-context/ARCHITECTURE_BOUNDARIES.md` | untracked | A134 | 保留并纳入 Git | 小上下文架构边界文件，是后续 Codex 每轮安全读取基础。 |
| `docs/codex-context/CODEX_ALWAYS_READ.md` | untracked | A134 | 保留并纳入 Git | 定义默认必读上下文，避免每轮读取大量历史文档。 |
| `docs/codex-context/CODEX_RULES.md` | untracked | A134 | 保留并纳入 Git | 定义小步开发、禁止越界、验证和收尾规则。 |
| `docs/codex-context/CURRENT_HANDOFF.md` | untracked，本轮更新 | A134/A138+ | 保留并纳入 Git | 当前交接文件，记录 A138+ 只做清理确认，下一轮 A138++ 等待授权执行。 |
| `docs/codex-context/DOC_WORKFLOW.md` | untracked | A134 | 保留并纳入 Git | 定义 Codex、DeepSeek、ChatGPT 三段式文档工作流和归档规则。 |
| `docs/codex-context/SAFETY_BOUNDARIES.md` | untracked | A134 | 保留并纳入 Git | 记录 Agent、Tool、Provider、Skill 的 preview/mock/disabled 安全边界。 |
| `docs/rounds/codex/A134_codex.md` | untracked | A134 | 保留并纳入 Git | A134 Codex 轮次记录，应作为文档工作流产物保留。 |

### A135 reader progress 恢复相关文件

| 文件路径 | Git 状态 | 归属轮次 | 建议动作 | 保留理由 |
|---|---:|---|---|---|
| `apps/web/src/app/reader/actions.ts` | modified | A135 | 保留并纳入 Git | reader progress 保存后 revalidate reader/book detail，属于恢复链路。 |
| `apps/web/src/app/reader/components/ReadingProgressSaveForm.tsx` | modified | A135 | 保留并纳入 Git | 展示已保存进度、fallback 只读状态和用户边界。 |
| `apps/web/src/app/reader/page.tsx` | modified | A135 | 保留并纳入 Git | 接入 reader progress view 和 latest saved chapter，补齐阅读入口状态。 |
| `apps/web/src/components/reader/ReaderDataSourceNotice.tsx` | modified | A135 | 保留并纳入 Git | 明确 demo fallback 文案和原因标签，符合 mock/preview 安全边界。 |
| `apps/web/src/lib/reader-data.ts` | modified | A135 | 保留并纳入 Git | 显式 reader 数据加载结果，缺参或 DB 不可用时返回不可读状态。 |
| `apps/web/src/lib/reader-mock.ts` | modified | A135 | 保留并纳入 Git | fallback reason 调整为 demo fallback 语义。 |
| `apps/web/src/lib/reader-types.ts` | modified | A135 | 保留并纳入 Git | 补齐 reader load result 与 fallback reason 类型。 |
| `apps/web/src/lib/reader-progress.ts` | untracked | A135 | 保留并纳入 Git | 被 reader/page 和 ReadingProgressSaveForm 引用，是 reader progress 链路必要新增文件。 |
| `docs/rounds/codex/A135_codex.md` | untracked | A135 | 保留并纳入 Git | A135 Codex 轮次记录，应作为文档工作流产物保留。 |

### A136 agent / ai-core 静态校验修复相关文件

| 文件路径 | Git 状态 | 归属轮次 | 建议动作 | 保留理由 |
|---|---:|---|---|---|
| `apps/web/src/app/agent/page.tsx` | modified | A136 | 保留并纳入 Git | 修复 preview UI 字段名与 ai-core 类型一致性，未引入真实 Agent loop。 |
| `packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts` | modified | A136 | 保留并纳入 Git | 删除未使用类型导入，属于静态校验修复。 |
| `packages/ai-core/src/agent/runtime-policy-preview.ts` | modified | A136 | 保留并纳入 Git | 删除未使用导入，保持 preview policy 静态校验通过。 |
| `packages/ai-core/src/llm-provider-config.ts` | modified | A136 | 保留并纳入 Git | 删除未使用常量集合，未接入真实 provider。 |
| `packages/ai-core/src/spark-provider.ts` | modified | A136 | 保留并纳入 Git | 用 `void config` 保留参数并消除未使用告警，未真实调用 Spark。 |
| `docs/rounds/codex/A136_codex.md` | untracked | A136 | 保留并纳入 Git | A136 Codex 轮次记录，应作为文档工作流产物保留。 |

### A137 books / learning typecheck 修复相关文件

| 文件路径 | Git 状态 | 归属轮次 | 建议动作 | 保留理由 |
|---|---:|---|---|---|
| `apps/web/src/app/books/book-detail-types.ts` | modified | A137 | 保留并纳入 Git | 修复 `mock_fallback` 携带 `BookDetailView` 的类型问题。 |
| `apps/web/src/app/learning/components/LearningDailyRecommendationListWithAttemptStatus.tsx` | modified | A137 | 保留并纳入 Git | 修复 attempt preview 状态分支命名，属于 typecheck/lint 修复。 |
| `docs/rounds/codex/A137_codex.md` | untracked | A137 | 保留并纳入 Git | A137 Codex 轮次记录，应作为文档工作流产物保留。 |

### A138 工作区审查文档

| 文件路径 | Git 状态 | 归属轮次 | 建议动作 | 保留理由 |
|---|---:|---|---|---|
| `docs/rounds/codex/A138_codex.md` | untracked | A138 | 保留并纳入 Git | A138 工作区审查与分类结果，是 A138+ 清理确认依据。 |

### A138+ 本轮确认文档

| 文件路径 | Git 状态 | 归属轮次 | 建议动作 | 保留理由 |
|---|---:|---|---|---|
| `docs/rounds/codex/A138+_codex.md` | 本轮新增，untracked | A138+ | 保留并纳入 Git | 本轮待用户确认清理执行清单。 |
| `docs/codex-context/CURRENT_HANDOFF.md` | untracked，本轮更新 | A138+ | 保留并纳入 Git | 下一轮 A138++ 的交接入口，明确必须等待用户授权后清理。 |

## 4. 需要用户确认后再保留的文件

### books/import 行为变更

| 文件路径 | Git 状态 | 不确定原因 | 可选动作 A：保留 | 可选动作 B：回滚 | 可选动作 C：归档到 `docs/_archive_pending_review/` | 我的建议 |
|---|---:|---|---|---|---|---|
| `apps/web/src/app/books/[bookId]/page.tsx` | modified | 疑似 A131，未被本轮允许读取历史正文明确归属。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |
| `apps/web/src/app/books/book-detail-loader.ts` | modified | 疑似 A131/A137，包含 fallback detail 与 readerHref 选择逻辑，属于行为变更。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |
| `apps/web/src/app/books/book-library-loader.ts` | modified | 疑似 A131，DB 不可用/空列表时显示 demo fallback 书籍，属于行为变更。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |
| `apps/web/src/app/books/book-library-types.ts` | modified | 疑似 A131，移除 `readerHref`、新增 `summary`，改变书库入口数据模型。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |
| `apps/web/src/app/books/components/BookLibraryEmptyState.tsx` | modified | 疑似 A131，空状态按钮意图从导入新书变为返回书库。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认产品意图。 |
| `apps/web/src/app/books/components/BookLibraryItem.tsx` | modified | 疑似 A131，书库卡片从直接打开 reader 改为查看章节。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |
| `apps/web/src/app/books/components/BookLibraryStatus.tsx` | modified | 疑似 A131，文案改为 demo fallback 语义。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留。 |
| `apps/web/src/app/books/page.tsx` | modified | 疑似 A131，书库入口文案和按钮调整。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |
| `apps/web/src/app/import/BookImportPreviewClient.tsx` | modified | 疑似 A133，文本导入 fallback 章节和边界文案调整。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |
| `apps/web/src/app/import/actions.ts` | modified | 疑似 A133，保存 metadata 标记与 fallback chapter title，属于导入闭环行为调整。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |
| `apps/web/src/app/import/components/BookImportSaveButton.tsx` | modified | 疑似 A133，导入保存按钮文案调整。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留。 |
| `apps/web/src/app/import/components/BookImportSaveStatus.tsx` | modified | 疑似 A133，状态文案从数据库已保存改为开发数据源，语义更谨慎。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留。 |
| `apps/web/src/app/import/page.tsx` | modified | 疑似 A133，导入页文案收敛到文本导入最小闭环。 | 纳入 Git | A138++ 回滚 | 不适用业务源码归档 | 倾向保留，但需用户确认。 |

### DeepSeek 输出文档

| 文件路径 | Git 状态 | 不确定原因 | 可选动作 A：保留 | 可选动作 B：回滚 | 可选动作 C：归档到 `docs/_archive_pending_review/` | 我的建议 |
|---|---:|---|---|---|---|---|
| `docs/rounds/deepseek/.gitkeep` | untracked | 是否需要保留 DeepSeek 轮次目录占位由用户决定。 | 纳入 Git | 不纳入 Git | 不适合归档 `.gitkeep` | 若保留 DeepSeek 文档，则保留。 |
| `docs/rounds/deepseek/A134_deepseek.md` | untracked | DeepSeek 输出是否进入版本控制尚未确认。 | 纳入 Git | 不纳入 Git | 移至归档目录 | 建议由用户统一决定 DeepSeek 文档策略。 |
| `docs/rounds/deepseek/A135_deepseek.md` | untracked | DeepSeek 输出是否进入版本控制尚未确认。 | 纳入 Git | 不纳入 Git | 移至归档目录 | 建议由用户统一决定 DeepSeek 文档策略。 |
| `docs/rounds/deepseek/A136_deepseek.md` | untracked | DeepSeek 输出是否进入版本控制尚未确认。 | 纳入 Git | 不纳入 Git | 移至归档目录 | 建议由用户统一决定 DeepSeek 文档策略。 |
| `docs/rounds/deepseek/A137_deepseek.md` | untracked | DeepSeek 输出是否进入版本控制尚未确认。 | 纳入 Git | 不纳入 Git | 移至归档目录 | 建议由用户统一决定 DeepSeek 文档策略。 |
| `docs/rounds/deepseek/A138_deepseek.md` | untracked | 本轮按要求读取到存在；是否纳入 Git 尚需确认。 | 纳入 Git | 不纳入 Git | 移至归档目录 | 若 DeepSeek 轮次文档作为交接证据，建议保留。 |

### PROJECT_COMPLETION_SUMMARY.md

| 文件路径 | Git 状态 | 不确定原因 | 可选动作 A：保留 | 可选动作 B：回滚 | 可选动作 C：归档到 `docs/_archive_pending_review/` | 我的建议 |
|---|---:|---|---|---|---|---|
| `docs/status/PROJECT_COMPLETION_SUMMARY.md` | untracked | 用户明确禁止本轮读取正文；仅能确认其为阶段压缩摘要候选。 | 纳入 Git | 不纳入 Git | 移至归档目录 | 建议保留或至少暂不删除，由用户确认是否作为长期状态摘要。 |

### 其他无法明确归属的文档改动

| 文件路径 | Git 状态 | 不确定原因 | 可选动作 A：保留 | 可选动作 B：回滚 | 可选动作 C：归档到 `docs/_archive_pending_review/` | 我的建议 |
|---|---:|---|---|---|---|---|
| `docs/README.md` | modified | A138 判断其与 A134 文档入口迁移相关，但属于主入口文档较大改写。 | 纳入 Git | A138++ 回滚 | 不适用当前 modified 状态 | 建议用户确认后保留。 |
| `docs/codex-tasks/CODEX_RULES.md` | modified | A138 判断其被缩减为迁移提示，删除大量旧正文，需确认是否接受。 | 纳入 Git | A138++ 回滚 | 不适用当前 modified 状态 | 建议用户确认；若担心历史丢失，先恢复后归档旧文档。 |

## 5. 建议后续 A138++ 回滚的文件

本轮不执行回滚，只提出候选。A138+ 未发现 package、lockfile、Prisma schema、migration、真实 LLM provider、真实工具执行或真实 Agent loop 的未提交改动。

| 文件路径 | Git 状态 | 疑似超范围原因 | 回滚风险 | 是否需要用户确认 |
|---|---:|---|---|---|
| `apps/web/src/app/books/[bookId]/page.tsx` | modified | books 行为变更归属未明确。 | 可能丢失章节入口和 fallback 文案修正。 | 是 |
| `apps/web/src/app/books/book-detail-loader.ts` | modified | books fallback/detail loader 行为变更归属未明确。 | 可能破坏当前书籍详情 demo fallback 链路。 | 是 |
| `apps/web/src/app/books/book-library-loader.ts` | modified | 书库 fallback 行为变更归属未明确。 | 可能让书库在开发环境体验倒退。 | 是 |
| `apps/web/src/app/books/book-library-types.ts` | modified | 书库模型字段调整归属未明确。 | 可能导致依赖新字段的组件失配。 | 是 |
| `apps/web/src/app/books/components/BookLibraryEmptyState.tsx` | modified | 产品文案/按钮意图变更归属未明确。 | 可能影响空状态用户路径。 | 是 |
| `apps/web/src/app/books/components/BookLibraryItem.tsx` | modified | 书库卡片跳转行为变更归属未明确。 | 可能恢复到直接 reader 路径，影响章节详情入口。 | 是 |
| `apps/web/src/app/books/components/BookLibraryStatus.tsx` | modified | fallback 文案调整归属未明确。 | 风险较低，但可能弱化安全边界文案。 | 是 |
| `apps/web/src/app/books/page.tsx` | modified | 书库页面文案/按钮调整归属未明确。 | 风险较低，但可能影响入口一致性。 | 是 |
| `apps/web/src/app/import/BookImportPreviewClient.tsx` | modified | import 行为/文案变更归属未明确。 | 可能影响文本导入预览闭环。 | 是 |
| `apps/web/src/app/import/actions.ts` | modified | import 保存 metadata/fallback chapter 行为变更归属未明确。 | 可能影响导入保存后数据形态。 | 是 |
| `apps/web/src/app/import/components/BookImportSaveButton.tsx` | modified | import 保存文案变更归属未明确。 | 风险低。 | 是 |
| `apps/web/src/app/import/components/BookImportSaveStatus.tsx` | modified | import 保存状态文案变更归属未明确。 | 风险低，但可能恢复不够谨慎的状态表达。 | 是 |
| `apps/web/src/app/import/page.tsx` | modified | import 页面文案收敛归属未明确。 | 风险低到中。 | 是 |
| `docs/README.md` | modified | 主文档入口大幅改写，需要确认是否接受。 | 回滚可能丢失小上下文入口说明。 | 是 |
| `docs/codex-tasks/CODEX_RULES.md` | modified | 旧规则文档被缩减，需要确认是否接受。 | 回滚可能与新 `docs/codex-context` 工作流重复，但更保守。 | 是 |

## 6. 建议后续 A138++ 归档的 docs 文件

| 文件路径 | 当前 Git 状态 | 建议后续动作 | 原因 | 本轮是否执行 |
|---|---:|---|---|---|
| `docs/status/WEB_MVP_COMPLETION_ROADMAP.md` | deleted | 先恢复到受跟踪状态，再用 `git mv` 移动到 `docs/_archive_pending_review/WEB_MVP_COMPLETION_ROADMAP.md` | 文档工作流要求不直接删除不用的文档，应归档等待人工复核。 | 否 |
| `docs/rounds/deepseek/A134_deepseek.md` | untracked | 如用户决定 DeepSeek 输出不进主线，则后续移动到 `docs/_archive_pending_review/` | DeepSeek 输出策略尚未确认。 | 否 |
| `docs/rounds/deepseek/A135_deepseek.md` | untracked | 同上 | DeepSeek 输出策略尚未确认。 | 否 |
| `docs/rounds/deepseek/A136_deepseek.md` | untracked | 同上 | DeepSeek 输出策略尚未确认。 | 否 |
| `docs/rounds/deepseek/A137_deepseek.md` | untracked | 同上 | DeepSeek 输出策略尚未确认。 | 否 |
| `docs/rounds/deepseek/A138_deepseek.md` | untracked | 同上 | DeepSeek 输出策略尚未确认。 | 否 |

特别说明：如果 `docs/status/WEB_MVP_COMPLETION_ROADMAP.md` 当前显示 deleted，A138++ 不能直接提交删除。后续执行时应先恢复到受跟踪状态，再用 `git mv` 移动到 `docs/_archive_pending_review/WEB_MVP_COMPLETION_ROADMAP.md`。

## 7. 不应提交文件清单

| 路径 | 状态 | 风险类型 | 建议动作 |
|---|---:|---|---|
| `.idea/` | ignored | 本地 IDE 配置 | 不提交 |
| `apps/web/.next/` | ignored | Next.js 构建产物/缓存 | 不提交 |
| `apps/web/node_modules/` | ignored | 依赖目录 | 不提交 |
| `apps/web/tsconfig.tsbuildinfo` | ignored | TypeScript 增量构建产物 | 不提交 |
| `node_modules/` | ignored | 依赖目录 | 不提交 |
| `packages/db/node_modules/` | ignored | 依赖目录 | 不提交 |
| `.env.example` | tracked clean | 示例环境文件，不是未提交改动 | 无需处理 |
| `packages/db/.env.example` | tracked clean | 示例环境文件，不是未提交改动 | 无需处理 |

本轮未发现 `.env`、`.env.local`、日志、临时输出或疑似真实 secret 文件处于未提交状态。

## 8. 敏感信息风险检查

执行了路径级和命中文件级检查，未输出任何具体 secret 值：

- `rg --files -g ".env*" -g "*.env"`：仅发现 `.env.example` 与 `packages\db\.env.example`。
- `git diff --name-only -G"API_KEY|api[_-]?key|token|secret|password|DATABASE_URL|database_url"`：命中文件包括 books/reader 文案或边界相关文件，以及 deleted 的旧 roadmap 文件；未输出具体值。
- `rg -l "API_KEY|api[_-]?key|token|secret|password|DATABASE_URL|database_url" apps/web/src/lib/reader-progress.ts docs/codex-context docs/rounds docs/status/PROJECT_COMPLETION_SUMMARY.md`：命中若干文档和 reader-progress 路径，风险类型为安全边界说明、示例或文案关键字；未输出具体值。

结论：未发现真实 API key、token、secret、数据库密码或 `.env` 文件处于未提交状态。

## 9. 验证命令

```bash
git status --short
git diff --stat
git diff --name-status
git diff --cached --stat
git diff --cached --name-status
git ls-files --others --exclude-standard
git status --ignored --short
rg --files -g ".env*" -g "*.env"
git diff --name-only -G"API_KEY|api[_-]?key|token|secret|password|DATABASE_URL|database_url"
rg -l "API_KEY|api[_-]?key|token|secret|password|DATABASE_URL|database_url" apps/web/src/lib/reader-progress.ts docs/codex-context docs/rounds docs/status/PROJECT_COMPLETION_SUMMARY.md
pnpm typecheck
pnpm lint
```

## 10. 验证结果

- `git status --short`：已执行，显示 29 个 modified、1 个 deleted、若干 untracked 目录/文件。
- `git diff --stat`：已执行，30 个已跟踪文件，546 行新增，833 行删除。
- `git diff --name-status`：已执行，列出 29 个 `M` 与 1 个 `D`。
- `git diff --cached --stat`：已执行，无输出，暂存区为空。
- `git diff --cached --name-status`：已执行，无输出，暂存区为空。
- `git ls-files --others --exclude-standard`：已执行，展开 19 个未跟踪文件。
- `git status --ignored --short`：已执行，确认 `.idea/`、`.next/`、`node_modules/`、`tsconfig.tsbuildinfo` 为 ignored。
- `rg --files -g ".env*" -g "*.env"`：已执行，只发现 example 文件。
- `git diff --name-only -G...`：已执行，仅输出命中文件路径。
- `rg -l ...`：已执行，仅输出命中文件路径。
- `pnpm typecheck`：已执行，通过。
- `pnpm lint`：已执行，通过。

## 11. 本轮未执行的动作说明

本轮未执行：

- 未执行 `git add`。
- 未执行 `git commit`。
- 未执行 `git reset`。
- 未执行 `git checkout --`。
- 未执行 `git restore`。
- 未执行 `git clean`。
- 未删除文件。
- 未移动文件。
- 未修改业务代码。
- 未修改 `package.json`。
- 未修改 `pnpm-lock.yaml`。
- 未修改 Prisma schema。
- 未创建 migration。
- 未接入真实 LLM provider。
- 未执行真实工具。
- 未启动真实 Agent loop。
- 未把 preview-only / mock-only / disabled-by-default 能力改成真实能力。
- 未提出 `git add -A` 或“全部提交”方案。

## 12. 明确等待用户确认的问题

请用户确认以下选择：

1. 是否保留 A134-A138 明确成果文件？
2. 是否将 DeepSeek 输出文档纳入 Git？
3. 是否将 `docs/status/PROJECT_COMPLETION_SUMMARY.md` 纳入 Git？
4. 是否恢复并归档 `docs/status/WEB_MVP_COMPLETION_ROADMAP.md`，而不是删除？
5. 哪些 B 类 / D 类文件应该保留？
6. 哪些 C 类文件允许在 A138++ 中回滚？
7. books/import 行为变更是否作为 A131/A133 成果保留？
8. `docs/README.md` 与 `docs/codex-tasks/CODEX_RULES.md` 的文档入口迁移是否接受？

## 13. 下一轮建议

下一轮建议为 A138++：必须按用户确认执行清理。A138++ 可执行的动作应严格来自用户确认结果，尤其是：

- 只保留用户确认的 A134-A138 成果文件。
- 对 `docs/status/WEB_MVP_COMPLETION_ROADMAP.md` 先恢复再归档，不直接提交删除。
- 对 DeepSeek 输出文档按用户选择保留、忽略或归档。
- 对用户确认回滚的 B/C 类文件逐个处理，不使用粗暴批量方案。
- 清理后再次运行 `git status --short`、`pnpm typecheck`、`pnpm lint`。

## 14. 项目总进度

项目总进度：22.55%。
