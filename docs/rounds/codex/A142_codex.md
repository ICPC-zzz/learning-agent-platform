# A142 Codex 记录

## 1. 本轮任务

本轮任务是读取 `docs/rounds/codex/A141_codex.md` 中 A138++ / A141 遗留的 B/C/D 类业务源码与测试文件清单，重新核对当前 Git 工作区状态，输出一份需要用户确认的业务文件处理决策表。

本轮只做确认清单、静态校验和文档记录；不修改业务代码，不回滚，不删除，不移动业务文件，不暂存，不提交。

## 2. 工作区状态总览

已执行命令：

- `git status --short`
- `git diff --stat`
- `git diff --name-status`
- `git diff --cached --stat`
- `git diff --cached --name-status`
- `git ls-files --others --exclude-standard`

核对结果：

| 项目 | 数量 / 状态 | 说明 |
| --- | ---: | --- |
| modified 文件数量 | 29 | 其中 27 个为业务源码，2 个为文档。 |
| renamed 文件数量 | 1 | staged rename：`docs/status/WEB_MVP_COMPLETION_ROADMAP.md` -> `docs/_archive_pending_review/WEB_MVP_COMPLETION_ROADMAP.md`。 |
| deleted 文件数量 | 0 | `git status --short` 与 `git diff --name-status` 未显示 deleted。 |
| untracked 文件数量 | 29 | 当前 `git ls-files --others --exclude-standard` 显示 29 个未跟踪文件，其中 2 个为业务/测试文件。 |
| staged 文件数量 | 1 | 仅存在进入本轮前已有的 staged rename。 |
| A138++ / A141 遗留 B/C/D 类文件 | 仍存在 | 27 个 modified 业务源码 + 1 个 untracked 业务源码 + 1 个 untracked 测试文件。 |

补充说明：上述 untracked 统计来自创建 `docs/rounds/codex/A142_codex.md` 前的盘点；本轮创建 A142 文档后，工作区会额外出现该未跟踪轮次文档。`git diff --stat` 显示 29 个 unstaged modified 文件，共 `545 insertions(+), 468 deletions(-)`；未跟踪文件不计入该 stat。Git 同时输出多处 `LF will be replaced by CRLF` 工作区换行提示，本轮未处理。

## 3. B/C/D 类说明

A141 文档没有给每个文件显式标注 B/C/D 字母类别，只给出了“业务源码 / 测试文件”待确认表。本轮为便于确认，仅按状态和模块做临时归类，不代表 Codex 已替用户选择处理方向：

- B 类：已修改的 Web 业务源码文件。
- C 类：已修改的 Agent / ai-core / provider 相关源码文件，涉及 preview-only / mock-only / disabled-by-default 安全边界。
- D 类：未跟踪新增业务源码或测试文件。

所有 B/C/D 文件的最终处理动作都必须由用户确认。

可选动作统一为：

- A. 保留
- B. 回滚
- C. 补测试后保留
- D. 暂时不处理
- E. 归档到 `docs/_archive_pending_review/`，仅文档允许

## 4. B/C/D 类遗留文件决策表

### 4.1 books / import 相关

| 文件路径 | 当前 Git 状态 | 文件类型 | 疑似归属轮次 | 当前判断 | 风险 | 证据 | 用户可选动作 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/web/src/app/books/[bookId]/page.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+5/-4`；A141：书籍详情页面改动，超出文档归档范围。 | A/B/C/D |
| `apps/web/src/app/books/book-detail-loader.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+88/-1`；A141：书籍详情数据加载改动。 | A/B/C/D |
| `apps/web/src/app/books/book-detail-types.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+4/-3`；A141：书籍详情类型改动。 | A/B/C/D |
| `apps/web/src/app/books/book-library-loader.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+36/-19`；A141：书库数据加载改动。 | A/B/C/D |
| `apps/web/src/app/books/book-library-types.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+1/-1`；A141：书库类型改动。 | A/B/C/D |
| `apps/web/src/app/books/components/BookLibraryEmptyState.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 低 | diff numstat `+1/-1`；A141：书库空状态组件改动。 | A/B/C/D |
| `apps/web/src/app/books/components/BookLibraryItem.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+6/-5`；A141：书库条目组件改动。 | A/B/C/D |
| `apps/web/src/app/books/components/BookLibraryStatus.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 低 | diff numstat `+1/-1`；A141：书库状态组件改动。 | A/B/C/D |
| `apps/web/src/app/books/page.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+4/-7`；A141：书库页面改动。 | A/B/C/D |
| `apps/web/src/app/import/BookImportPreviewClient.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+15/-7`；A141：导入预览客户端改动。 | A/B/C/D |
| `apps/web/src/app/import/actions.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+9/-2`；A141：导入 action 改动。 | A/B/C/D |
| `apps/web/src/app/import/components/BookImportSaveButton.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+3/-3`；A141：导入保存按钮改动。 | A/B/C/D |
| `apps/web/src/app/import/components/BookImportSaveStatus.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 低 | diff numstat `+1/-1`；A141：导入保存状态组件改动。 | A/B/C/D |
| `apps/web/src/app/import/page.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+5/-5`；A141：导入页面改动。 | A/B/C/D |
| `apps/web/src/app/books/components/BookLibraryEmptyState.test.mjs` | untracked | 测试 | A140 | 待确认 | 低 | `git ls-files --others --exclude-standard` 显示未跟踪；A141：A140 静态测试文件。 | A/B/C/D |

### 4.2 reader progress 相关

| 文件路径 | 当前 Git 状态 | 文件类型 | 疑似归属轮次 | 当前判断 | 风险 | 证据 | 用户可选动作 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/web/src/app/reader/actions.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+5/-0`；A141：阅读 action 改动。 | A/B/C/D |
| `apps/web/src/app/reader/components/ReadingProgressSaveForm.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+58/-13`；A141：阅读进度保存表单改动。 | A/B/C/D |
| `apps/web/src/app/reader/page.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+77/-40`；A141：阅读页面改动。 | A/B/C/D |
| `apps/web/src/components/reader/ReaderDataSourceNotice.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+10/-3`；A141：reader 数据源提示组件改动。 | A/B/C/D |
| `apps/web/src/lib/reader-data.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+64/-5`；A141：reader 数据逻辑改动。 | A/B/C/D |
| `apps/web/src/lib/reader-mock.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+1/-1`；A141：reader mock 数据改动。 | A/B/C/D |
| `apps/web/src/lib/reader-types.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+21/-1`；A141：reader 类型改动。 | A/B/C/D |
| `apps/web/src/lib/reader-progress.ts` | untracked | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | `git ls-files --others --exclude-standard` 显示未跟踪；A141：reader progress 新文件。 | A/B/C/D |

### 4.3 learning 相关

| 文件路径 | 当前 Git 状态 | 文件类型 | 疑似归属轮次 | 当前判断 | 风险 | 证据 | 用户可选动作 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/web/src/app/learning/components/LearningDailyRecommendationListWithAttemptStatus.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 中 | diff numstat `+2/-2`；A141：学习推荐组件改动。 | A/B/C/D |

### 4.4 agent / ai-core 相关

| 文件路径 | 当前 Git 状态 | 文件类型 | 疑似归属轮次 | 当前判断 | 风险 | 证据 | 用户可选动作 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `apps/web/src/app/agent/page.tsx` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+88/-88`；A141：Web/Agent 页面改动。 | A/B/C/D |
| `packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+0/-1`；A141：ai-core Agent runtime 相关改动。 | A/B/C/D |
| `packages/ai-core/src/agent/runtime-policy-preview.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+0/-1`；A141：ai-core runtime policy 相关改动。 | A/B/C/D |
| `packages/ai-core/src/llm-provider-config.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+0/-4`；A141：provider 配置改动。 | A/B/C/D |
| `packages/ai-core/src/spark-provider.ts` | modified | 业务源码 | A138++ 遗留，具体不确定 | 待确认 | 高 | diff numstat `+3/-1`；A141：provider 实现改动。 | A/B/C/D |

### 4.5 docs 文档工作流相关

以下不是 B/C/D 业务源码处理对象，但因为当前工作区存在 staged rename、untracked 轮次文档和 DeepSeek 交接文档，且用户问题包含“DeepSeek 交接文档是否纳入 Git”，本轮单独列出给用户确认。

| 文件 / 范围 | 当前 Git 状态 | 文件类型 | 疑似归属轮次 | 当前判断 | 风险 | 证据 | 用户可选动作 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `docs/status/WEB_MVP_COMPLETION_ROADMAP.md` -> `docs/_archive_pending_review/WEB_MVP_COMPLETION_ROADMAP.md` | staged renamed | 文档 | A141 前已存在 | 待确认 | 低 | `git diff --cached --name-status`：`R100`；A141：旧 Web MVP 路线图，已处于待人工复核归档目录。 | A/D/E |
| `docs/rounds/deepseek/A134_deepseek.md` 至 `A141_deepseek.md` 与 `.gitkeep` | untracked | 文档 | A134-A141 | 待确认 | 低 | `git ls-files --others --exclude-standard` 显示未跟踪；A141：DeepSeek 交接文档为正式文档流。 | A/D/E |
| `docs/rounds/codex/A134_codex.md` 至 `A141_codex.md` | untracked | 文档 | A134-A141 | 待确认 | 低 | `git ls-files --others --exclude-standard` 显示未跟踪；A141：正式 Codex 轮次总结。 | A/D/E |
| `docs/codex-context/*` | untracked | 文档 | A141 前后 | 待确认 | 低 | `git ls-files --others --exclude-standard` 显示未跟踪；A141：当前小上下文必读文件。 | A/D/E |
| `docs/README.md`、`docs/codex-tasks/CODEX_RULES.md`、`docs/status/PROJECT_COMPLETION_SUMMARY.md` | modified / untracked | 文档 | A141 前后 | 待确认 | 低 | `git diff --name-status`、`git ls-files --others --exclude-standard` 显示；A141：文档类建议保留。 | A/D/E |

## 5. 按模块汇总

| 模块 | 文件数量 | 当前状态 | 是否可能影响 `pnpm typecheck` | 是否可能影响 `pnpm lint` | 是否可能影响 Web MVP 路线 | 是否涉及 preview-only 安全边界 | 是否建议下一轮单独处理 |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| docs 文档工作流相关 | 多个文档范围 + 1 staged rename | modified / renamed / untracked | 否 | 一般否 | 低，主要影响项目文档流与提交边界 | 否 | 是，确认是否纳入 Git 或归档。 |
| books / import 相关 | 15 | 14 modified + 1 untracked test | 是，已通过但后续处理可能影响 | 是，已通过但后续处理可能影响 | 是，直接关联 Web MVP 书库、详情、导入闭环 | 否 | 是，建议成组处理。 |
| reader progress 相关 | 8 | 7 modified + 1 untracked source | 是，已通过但新文件归属未定 | 是，已通过但后续处理可能影响 | 是，关联阅读进度保存和恢复闭环 | 否 | 是，建议单独处理并决定是否补测试。 |
| learning 相关 | 1 | modified | 是，当前通过 | 是，当前通过 | 中，关联学习推荐展示 | 否 | 可与 Web MVP 小批处理，或单独确认。 |
| agent / ai-core 相关 | 5 | modified | 是，当前通过 | 是，当前通过 | 中，影响 Agent preview 页面与核心包 | 是，必须维持 preview-only / mock-only / disabled-by-default | 是，建议单独处理。 |
| 测试相关 | 1 | untracked | 否，当前未纳入 Git 跟踪 | 是，纳入后可能影响 lint/测试策略 | 低到中，取决于是否保留对应书库改动 | 否 | 是，需确认是否随 books/import 保留。 |
| 配置 / 环境 / 其他 | 0 | 未发现 package、lock、Prisma、migration 改动 | 否 | 否 | 否 | 否 | 否。 |

## 6. 推荐但不执行的处理顺序

1. 先确认 docs 文档工作流文件是否纳入 Git，特别是 DeepSeek 交接文档和 staged rename。
2. 再确认 books / import 相关改动是否作为一个业务包保留；若保留，建议补齐对应测试或验收记录。
3. 单独确认 reader progress 相关改动，尤其是 `apps/web/src/lib/reader-progress.ts` 是否应纳入源码。
4. 单独确认 agent / ai-core 相关静态修复，任何保留都必须继续标注 preview-only / mock-only / disabled-by-default。
5. 最后确认零散 learning 改动和 untracked 测试文件是否随对应业务包保留。

以上只是处理顺序建议，本轮不执行任何处理动作。

## 7. 需要用户确认的问题列表

请用户确认：

1. books / import 相关改动是否保留？
2. reader progress 相关改动是否保留？
3. learning 相关改动是否保留？
4. agent / ai-core 静态修复是否保留？
5. 新增测试文件 `apps/web/src/app/books/components/BookLibraryEmptyState.test.mjs` 是否保留？
6. DeepSeek 交接文档是否纳入 Git？
7. 当前 staged rename 的 `WEB_MVP_COMPLETION_ROADMAP.md` 是否保持归档？
8. 哪些文件需要 A142+ 回滚？
9. 哪些文件需要 A142+ 补测试后保留？
10. 哪些文件暂时不处理？

## 8. 验证命令

本轮执行：

- `pnpm typecheck`
- `pnpm lint`

## 9. 验证结果

- `pnpm typecheck`：通过。输出显示 `packages/ai-core`、`packages/learning-engine`、`packages/book-engine`、`packages/db`、`packages/shared`、`apps/web` 的 `tsc --noEmit` 均完成。
- `pnpm lint`：通过。输出显示执行 `eslint .`，未报错。

结论：当前遗留改动至少没有破坏基础静态校验。但这不代表这些业务改动已经完成验收，也不代表应自动保留。

## 10. 本轮未执行动作声明

- 未修改业务代码。
- 未回滚文件。
- 未删除文件。
- 未移动业务文件。
- 未执行 `git add`。
- 未执行 `git commit`。
- 未执行 `git reset`。
- 未执行 `git clean`。
- 未执行 `git restore`。
- 未执行 `git checkout --`。
- 未修改 `package.json`。
- 未修改 `pnpm-lock.yaml`.
- 未修改 Prisma schema。
- 未创建 migration。
- 未新增依赖。
- 未真实调用 LLM provider。
- 未真实执行工具。
- 未启动真实 Agent loop。
- 未保存或输出 raw prompt / raw response。
- 未输出、硬编码或复制 API key、数据库密码、token、secret。

## 11. 下一轮建议

下一轮建议命名为 A142+，只按用户确认的选项执行处理。每轮应限制在一个模块或少量文件，先处理归属方向，再决定是否补测试、保留、回滚或文档归档。

所有 Agent runtime、Tool requirement、LLM provider、Skill 相关能力仍是 preview-only / mock-only / disabled-by-default；本轮决策表不代表任何能力上线。

## 12. 项目总进度

项目总进度：22.65%。
