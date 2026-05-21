# Web MVP 功能补齐路线图

## 1. 路线图结论摘要

本路线图基于 A128 真实产品完成度审计，特别是 `docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md` 中对 `books`、`reader`、`import`、`learning` 和 packages 支撑能力的判断。

当前项目不能视为完整产品完成。历史上的局部“100%”只代表特定阶段或局部任务完成，不代表“编程学习网站 + AI Agent 软件端 + Skill 社区”的完整产品完成。

下一阶段应优先补齐 Web 编程学习 MVP。Desktop Agent、Agent 三层记忆压缩、后台工具调用系统和 Skill 社区都应暂缓，不应在 Web MVP 尚未形成稳定学习闭环前进入主线。

Web MVP 的最低目标是形成：

```text
books -> reader -> progress -> learning
```

也就是用户能看到书籍、选择章节、阅读内容、保存基础阅读进度，并在 `learning` 页面看到基础学习进度和下一步学习建议。

## 2. 输入依据

本轮实际读取的主线文档：

- `docs/README.md`
- `AGENTS.md`
- `docs/product/PRODUCT_SPEC.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/codex-tasks/CODEX_RULES.md`
- `docs/codex-tasks/DEVELOPMENT_ROADMAP.md`
- `docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md`

文档存在性记录：

- 上述 7 个要求读取的文档均存在。
- 本轮没有读取 `docs/archive/**`。
- 本轮没有读取外部参考项目源码：`E:\code\harness-main`、`E:\code\ccx`、`E:\code\claude-desktop-app-main`。
- 本轮没有读取 `.env`、`.env.example`、`.env.local` 或任何 secret 文件。
- 本轮没有写业务代码，没有修改 schema，没有新增依赖，没有调用真实 LLM，没有调用 Spark API。

核心依据摘要：

- A128 判断 Web app 已存在，并已有 `/books`、`/books/[bookId]`、`/reader`、`/import`、`/learning` 等学习路由。
- A128 判断纯文本导入可以生成章节和 chunk，显式保存为 Book / Chapter / ContentChunk 后能进入书库和 reader。
- A128 判断 reader 能读取数据库章节内容，并能在演示用户边界下保存 ReadingProgress，但默认尚未按已保存进度恢复阅读位置。
- A128 判断 learning 能读取 ReadingProgress、QA feedback、ProblemAttempt，并可使用 `learning-engine` 规则式计算能力画像和每日推荐，但多处仍需要显式触发，不是自动闭环。
- A128 判断 reader QA 默认是 mock / provider scaffold，不具备默认真实 LLM、RAG、embedding 或 vector search。
- A128 给出的整体产品完成度估算为 22%，Web 基础 MVP 约 45%，编程学习闭环约 30%。

## 3. Web MVP 最短用户路径

### 3.1 P0：最低可验收学习闭环

用户步骤：

1. 用户进入首页或学习入口。
2. 用户点击进入 `books`。
3. 用户看到数据库中可阅读的书籍列表。
4. 用户选择一本书，进入书籍详情。
5. 用户看到章节列表，并选择一个章节。
6. 用户进入 `reader` 阅读章节内容。
7. 用户触发或系统保存基础阅读进度。
8. 用户回到 `learning` 页面。
9. 用户看到基础学习进度、能力反馈或下一步学习建议。

系统行为：

- `books` 必须能读取已保存 Book / Chapter / ContentChunk。
- `reader` 必须能基于 `bookId` 和 `chapterId` 稳定显示章节内容。
- `reader` 必须把基础阅读状态保存到 ReadingProgress。
- `reader` 或书籍详情必须能根据已保存 ReadingProgress 形成“继续阅读”入口。
- `learning` 必须能读取 ReadingProgress，并展示清晰的学习反馈。
- 如果能力分数或推荐仍是规则式、preview 或 mock，页面必须明确标注。

P0 是 Web MVP 的最低验收线。P0 未完成时，不应转入 Desktop Agent MVP。

### 3.2 P1：导入增强闭环

用户步骤：

1. 用户进入 `/import`。
2. 用户粘贴一段文本，填写书名、作者、语言等基础信息。
3. 系统生成书籍、章节和 chunk 预览。
4. 用户确认保存。
5. 保存后的内容出现在 `/books`。
6. 用户进入 `/reader` 阅读导入内容。

系统行为：

- 当前阶段优先支持纯文本或最小 Markdown-like heading 识别。
- 保存必须显式触发，不应自动写入。
- 保存成功后必须提供进入书籍详情、书库和 reader 的入口。
- URL、文件、PDF、EPUB、HTML 导入不属于 Web MVP 最短阻塞项。

### 3.3 P2：章节问答预览闭环

用户步骤：

1. 用户在 `reader` 对当前章节提问。
2. 系统基于当前章节上下文生成 mock-safe、preview 或 provider-disabled 状态下的回答。
3. UI 明确标注回答状态：mock、preview、disabled 或 provider unavailable。
4. 默认不调用真实 LLM。

系统行为：

- 默认不调用真实 LLM，不调用 Spark API。
- 问答上下文可以先使用当前章节内容，不要求 RAG、embedding 或 vector search。
- 如果未来启用 OpenAI-compatible 或 Spark provider，必须经过独立任务设计，不能在 Web MVP 中写死具体供应商。
- Spark Ultra-32K 只能作为后续测试 provider，不应成为当前 Web MVP 业务逻辑硬编码依赖。

### 3.4 P3：学习反馈增强闭环

用户步骤：

1. 用户完成章节阅读或保存阅读进度。
2. 用户进入 `learning`。
3. 系统展示能力分数、每日题单或下一步学习建议。
4. 如果推荐只是规则式或 mock，UI 明确标注。

系统行为：

- 优先复用 `learning-engine` 已有规则式 scoring / recommendation helper。
- 优先复用 `packages/db` 已有 ReadingProgress、AbilityProfile、DailyRecommendation、ProblemAttempt repository。
- 不追求复杂推荐算法、趋势分析、间隔重复或完整在线判题。

## 4. 当前能力优先级划分

| 功能 | 当前状态依据 | 优先级 | 是否阻塞 Web MVP | 处理建议 |
|---|---|---|---:|---|
| books 书籍列表 | A128：`/books` 使用 `PrismaBookRepository.listBooks`，数据库不可用时显示不可用/空状态 | P0 | 是 | 保证有稳定可演示数据路径，优先处理空态和入口一致性 |
| book detail 书籍详情 | A128：`/books/[bookId]` 读取单本书元数据、统计和章节 | P0 | 是 | 保证章节列表和继续阅读入口可靠 |
| chapter list 章节列表 | A128：详情页展示章节标题、层级、chunk 数和字符数 | P0 | 是 | 保持只读展示，避免扩展编辑/删除 |
| reader 章节阅读 | A128：`/reader` 可显示数据库章节内容，失败时 mock fallback | P0 | 是 | 优先保证 `bookId` / `chapterId` 进入 reader 稳定 |
| reading progress 保存 | A128：可保存 demo 用户 ReadingProgress，但粒度偏章节完成，恢复不完整 | P0 | 是 | 补齐保存与恢复，先接受基础章节级进度 |
| import text 导入 | A128：纯文本导入预览和保存已部分形成 | P1 | 否 | 作为增强闭环，完成后提升演示可信度 |
| import URL 导入 | A128：页面明确不会抓取 URL / HTML，未发现实现 | P2 | 否 | 后置到基础 Web MVP 稳定后 |
| import file 导入 | A128：无 file input，未发现 PDF / EPUB / HTML 解析 | P2 | 否 | 后置，不作为本阶段阻塞 |
| import preview | A128：本地页面状态展示章节和 chunk 预览 | P1 | 否 | 保持显式 preview，并标注不是后台导入任务 |
| import save to DB | A128：`saveImportedPlainTextBookAction` 写入 Book / Chapter / ContentChunk | P1 | 否 | 保证保存成功后能进 books / reader |
| reader chapter-aware QA | A128：AskAiPanel 构造当前章节上下文，默认 mock provider | P1 | 否 | 先做章节上下文 preview，不接 RAG |
| mock QA / preview QA | A128：默认 provider 为空时解析为 mock | P1 | 否 | 允许保留，但必须显式标注 mock / preview / disabled |
| real LLM QA | A128：OpenAI-compatible 分支受环境开关控制，默认不启用 | P3 | 否 | 当前阶段不做真实业务接入 |
| RAG / embedding / vector search | A128：reader 直接路径未发现 embedding 或 vector search | P3 | 否 | 后置到 Web MVP 基础闭环稳定后 |
| learning dashboard | A128：`/learning` 动态渲染，数据库优先，mock fallback | P0 | 是 | 必须展示 ReadingProgress 和基础建议 |
| ability score | A128：可规则式计算和显式保存，但非完整生产模型 | P1 | 否 | 作为基础反馈，明确规则式 / preview |
| daily recommendation | A128：可基于画像和候选题生成，需显式触发 | P1 | 否 | 先做轻量建议，不追求复杂推荐 |
| problem attempt | A128：可保存题目尝试，但不会自动重算画像和推荐 | P2 | 否 | 后置到 P0/P1 稳定后补反馈循环 |
| learning plan | A128：未发现独立学习计划模型或页面 | P2 | 否 | 后置，不阻塞 Web MVP |
| review / spaced repetition | A128：未发现复习队列、遗忘曲线或间隔重复状态 | P2 | 否 | 后置，不把每日题单说成复习系统 |
| Agent runtime preview | A128：`/agent` preview 丰富但不可执行 | P3 | 否 | 非当前阶段，只保留边界说明 |
| Desktop Agent | A128：`apps/desktop/src` 为空，无 package / 启动脚本 | P3 | 否 | Web MVP 完成后再进入 |
| Skill Community | A128：无 Web 社区页面、上传 / 下载 / 安装 / 执行闭环 | P3 | 否 | 暂缓，等 Agent 执行和权限底座稳定 |

## 5. Web MVP 补齐阶段路线

### W1：Web MVP 最短路径校准

| 项目 | 内容 |
|---|---|
| 阶段目标 | 明确 `books -> reader -> progress -> learning` 的最短闭环和数据流。只确认路径、状态、入口、字段和验收标准，不写复杂功能。 |
| 允许修改范围 | 文档优先：`docs/status/**` 或后续指定的 Web MVP 数据流文档。若进入实现任务，只允许轻量读取 `apps/web/src/app/books/**`、`reader/**`、`learning/**` 和必要 package 入口。 |
| 禁止修改范围 | 禁止修改 `apps/desktop/**`、`packages/ai-core/**` 深层实现、Skill 相关实现、schema、依赖、`.env*`、外部参考项目。 |
| 关键验收标准 | 形成一份具体到 route、数据源、server action、repository、fallback 状态和 UI 标识的最短路径说明。明确哪些是 DB 真实路径，哪些是 mock fallback 或 engine preview。 |
| 建议验证命令 | `git diff -- docs/status/<设计文档>.md`；`git status --short`。不需要启动 Web。 |
| 是否需要浏览器验收 | 否。W1 是设计校准阶段。 |
| 风险 | 如果跳过 W1 直接写代码，容易把 mock fallback、demo user、engine preview 当成真实闭环。 |
| 是否建议拆分 | 建议拆成 1 个 Codex 小任务：A130。 |

### W2：books / reader 基础阅读闭环补齐

| 项目 | 内容 |
|---|---|
| 阶段目标 | 确保用户能从书库进入书籍详情、选择章节、进入 reader、阅读内容、保存并恢复基础阅读进度。 |
| 允许修改范围 | `apps/web/src/app/books/**`、`apps/web/src/app/reader/**`、必要时 `packages/db/src/index.ts` 暴露边界或既有 repository 调用点。 |
| 禁止修改范围 | 禁止修改 `prisma/schema.prisma`、迁移、依赖、Desktop、Skill、真实 LLM、RAG、Agent runtime、外部参考项目。 |
| 关键验收标准 | `/books` 有可理解空态或可用书籍；`/books/[bookId]` 章节入口有效；`/reader?bookId=...&chapterId=...` 显示章节；保存进度后刷新或重新进入能看到继续阅读 / 已保存状态。 |
| 建议验证命令 | `pnpm --filter @learning-agent-platform/web typecheck`；若存在 lint：`pnpm --filter @learning-agent-platform/web lint`；`git diff`。 |
| 是否需要浏览器验收 | 是。优先 Edge 或 Codex 内置 @Browser；如果 @Browser 不可用，用 HTTP sanity check 替代。 |
| 风险 | 当前 demo 用户、数据库可用性和进度粒度可能导致“能保存但不像真实用户进度”。先把边界标清楚。 |
| 是否建议拆分 | 建议拆成 A131 和 A132 两个小任务。 |

### W3：import -> book/chapter -> reader 闭环补齐

| 项目 | 内容 |
|---|---|
| 阶段目标 | 让纯文本或最小 Markdown-like 导入能生成预览、显式保存为书籍和章节，并从保存结果进入 books / reader。 |
| 允许修改范围 | `apps/web/src/app/import/**`、必要时 `packages/book-engine/src/index.ts` 或既有 plain text import helper 的轻量调用边界、`apps/web/src/app/books/**` 的入口文案。 |
| 禁止修改范围 | 禁止实现 URL 抓取、文件上传、PDF / EPUB / HTML parser、后台导入队列、schema 变更、真实 LLM、embedding、外部 API。 |
| 关键验收标准 | 用户粘贴文本后能看到章节 / chunk 预览；点击保存后写入 DB；保存结果提供书籍详情、书库、reader 入口；页面明确导入是本地预览 + 显式保存，不抓 URL、不上传文件。 |
| 建议验证命令 | `pnpm --filter @learning-agent-platform/web typecheck`；`pnpm --filter @learning-agent-platform/book-engine typecheck`；`git diff`。 |
| 是否需要浏览器验收 | 是。需要走 `/import -> /books -> /reader`。 |
| 风险 | 导入内容质量、章节识别质量和 DB 不可用状态会影响演示。不要把规则式章节识别说成语义章节生成。 |
| 是否建议拆分 | 可拆成 A133；如果保存和 UI 状态较多，再拆 A133-1 / A133-2。 |

### W4：learning dashboard 基础学习反馈补齐

| 项目 | 内容 |
|---|---|
| 阶段目标 | 让 `learning` 页面基于已保存阅读进度展示基础学习反馈，并可生成规则式能力分数或下一步学习建议。 |
| 允许修改范围 | `apps/web/src/app/learning/**`、必要时 `packages/learning-engine/src/index.ts` 既有导出边界、`packages/db/src/index.ts` 既有 repository 调用边界。 |
| 禁止修改范围 | 禁止复杂能力模型、复杂推荐系统、间隔重复系统、完整在线判题、schema 变更、真实 LLM、RAG、Desktop、Skill。 |
| 关键验收标准 | 保存阅读进度后，`/learning` 能展示对应进度；能力分数或建议若来自规则式计算 / preview，必须标注；每日推荐若候选不足，应显示可理解不可用状态。 |
| 建议验证命令 | `pnpm --filter @learning-agent-platform/web typecheck`；`pnpm --filter @learning-agent-platform/learning-engine typecheck`；`git diff`。 |
| 是否需要浏览器验收 | 是。需要从 reader 保存进度后进入 learning 检查反馈。 |
| 风险 | 显式重算和自动重算边界容易混淆；ProblemAttempt 后不自动更新画像时必须写清楚。 |
| 是否建议拆分 | 建议拆成 A134 和 A135。 |

### W5：Web MVP 验收与演示脚本

| 项目 | 内容 |
|---|---|
| 阶段目标 | 补齐中文文案、mock / preview / disabled 标识、Edge / @Browser / HTTP sanity check 验收路径和最短演示脚本。 |
| 允许修改范围 | `apps/web/src/app/books/**`、`reader/**`、`import/**`、`learning/**` 的文案和状态展示；`docs/status/**` 的验收记录或脚本说明。 |
| 禁止修改范围 | 禁止新增业务大功能、schema 变更、依赖、真实 LLM、Spark API、Desktop、Skill、Agent runtime。 |
| 关键验收标准 | 用户能按演示脚本完成首页、books、book detail、reader、progress、learning；所有 mock / preview / disabled 能力均有标识；不编造浏览器结果。 |
| 建议验证命令 | `pnpm -w typecheck`；`pnpm --filter @learning-agent-platform/web typecheck`；若存在 lint：`pnpm --filter @learning-agent-platform/web lint`；`git diff`；必要时 HTTP sanity check。 |
| 是否需要浏览器验收 | 是。用户电脑只有 Edge，优先 Edge 或 Codex 内置 @Browser；如果不可用，记录未执行并使用 HTTP sanity check。 |
| 风险 | 验收脚本可能暴露 DB 数据缺失、空态、文案误导或布局问题；发现缺陷只记录清单，不在验收任务里无边界扩修。 |
| 是否建议拆分 | 建议拆成 A136、A137、A138。 |

## 6. 后续 Codex 任务序列建议

| 任务编号 | 任务名称 | 任务目标 | 是否写代码 | 预计修改范围 | 验收方式 | 停止条件 |
|---|---|---|---:|---|---|---|
| A130 | Web MVP 最短用户路径与数据流设计文档 | 把 P0 路径具体落到 route、数据源、repository、server action、fallback、UI 标识 | 否 | `docs/status/WEB_MVP_DATA_FLOW_PLAN.md` 或同类状态文档 | `git diff`、`git status --short` | 文档完成即停止，不进入实现 |
| A131 | books / reader 当前实现对齐与最小闭环补齐 | 修正书库、详情、章节入口到 reader 的最小链路问题 | 是 | `apps/web/src/app/books/**`、`apps/web/src/app/reader/**` | typecheck、Edge / @Browser 或 HTTP sanity check | `/books -> /books/[bookId] -> /reader` 可走通即停止 |
| A132 | 阅读进度保存与恢复补齐 | 让 reader 使用已保存 ReadingProgress 形成基础恢复 / 继续阅读体验 | 是 | `apps/web/src/app/reader/**`，必要时轻量触及 `apps/web/src/app/books/**` | typecheck、浏览器验收、`git diff` | 保存和恢复基础状态可验证即停止 |
| A133 | import 文本导入最小闭环补齐 | 确保文本导入预览、显式保存、进入 books / reader 稳定 | 是 | `apps/web/src/app/import/**`，必要时 `packages/book-engine/src/index.ts` 既有导出 | web 和 book-engine typecheck、浏览器验收 | `/import -> save -> /books -> /reader` 可走通即停止 |
| A134 | learning dashboard 基础进度展示补齐 | 让 learning 明确展示 reader 保存的基础阅读进度 | 是 | `apps/web/src/app/learning/**` | web typecheck、浏览器验收 | 保存进度后 learning 可见即停止 |
| A135 | 基础能力分数 / 学习建议规则补齐 | 用已有 `learning-engine` 规则式能力画像和推荐形成轻量建议 | 是 | `apps/web/src/app/learning/**`、必要时 `packages/learning-engine/src/index.ts` | web / learning-engine typecheck、状态文案检查 | 规则式建议可见且标注清楚即停止 |
| A136 | Web MVP 中文文案与 preview/mock/disabled 标识校正 | 校正首页、reader、learning、import 中可能误导的文案 | 是 | `apps/web/src/app/{books,reader,import,learning}/**`，必要时首页文案 | typecheck、人工文案审阅、`git diff` | mock / preview / disabled 均清晰标注即停止 |
| A137 | Web MVP Edge / @Browser 验收脚本与缺陷清单 | 执行或编写最短验收脚本，记录缺陷，不做大修 | 可少量 | `docs/status/**`，如需只做极小文案修正需另行确认范围 | Edge / @Browser 或 HTTP sanity check；不编造结果 | 缺陷清单和验收记录完成即停止 |
| A138 | Web MVP 阶段总结与 Desktop Agent MVP 入口判断 | 汇总 Web MVP 是否达到可展示、可学习、可验收，并判断能否进入 Desktop | 否 | `docs/status/WEB_MVP_COMPLETION_SUMMARY.md` | `git diff`、引用真实验收结果 | 明确 go / no-go 后停止，不自动进入 Desktop |

拆分建议：

- 如果 A131 涉及 reader 数据选择和 UI 状态过多，可拆为 A131-1 书籍详情入口、A131-2 reader 查询参数和不可读状态。
- 如果 A132 涉及保存、恢复、继续阅读入口三件事，可拆为 A132-1 保存语义、A132-2 恢复语义。
- 如果 A135 涉及能力画像和每日推荐两条链路，可拆为 A135-1 能力分数、A135-2 学习建议。

## 7. 当前阶段暂缓事项

- 真实 LLM 业务问答：当前 reader 默认应保持 mock / disabled / provider-gated，不在 Web MVP 中默认调用真实模型。
- RAG：当前 P0 不需要跨章节检索，先用当前章节内容和已保存进度建立学习闭环。
- embeddings：当前不生成 embedding，不运行向量化任务，不新增向量依赖。
- vector search：当前不接向量数据库或向量搜索。
- 复杂能力分数模型：当前只允许规则式、可解释、可标注的基础能力反馈。
- 复杂推荐系统：当前只做基础下一步建议或规则式每日推荐，不做动态个性化大系统。
- 真实 Agent loop：当前 `/agent` 是 preview，不进入真实 runner、step loop、工具执行。
- Desktop Agent：当前 Desktop 基本为空，必须等 Web MVP 达到可展示可验收后再进入。
- 三层记忆压缩系统：当前不实现 working / episodic / long-term memory compaction。
- 后台工具调用系统：当前不实现 tool registry 执行、sandbox、后台任务队列、取消 / 重试闭环。
- Skill 社区：当前没有上传 / 下载 / 安装 / 执行 / 分发闭环，继续暂缓。
- Spark 真实业务接入：Spark Ultra-32K 只能作为后续测试 provider；当前 Web MVP 不把业务逻辑写死到 Spark，不读取、输出、硬编码任何 secret。

## 8. Web MVP 验收标准草案

### 8.1 静态验证

建议命令：

```bash
pnpm -w typecheck
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/web lint
git diff
git status --short
```

说明：

- 如果某个 lint 或 test script 不存在，应记录真实输出，不要临时新增依赖或脚本。
- 如果 typecheck 失败，按任务范围判断是否修复；验收任务中不得无边界修业务代码。
- 文档任务只需要 `git diff` 和 `git status --short`。

### 8.2 HTTP sanity check

建议流程：

1. 运行 `pnpm dev` 启动 Web。
2. 访问首页 `/`。
3. 访问 `/books`。
4. 访问 `/reader`。
5. 访问 `/learning`。
6. 访问 `/import`。
7. 如果已有数据库书籍，访问 `/books/[bookId]` 和 `/reader?bookId=...&chapterId=...`。
8. 如果完成 W3，执行 `/import -> save -> /books -> /reader`。

HTTP sanity check 只能记录真实访问结果，不得编造浏览器验收。

### 8.3 Edge / @Browser 验收

用户电脑只有 Edge，没有 Chrome。因此后续验收优先级为：

1. Edge 手动验收。
2. Codex 内置 @Browser 验收本地 URL。
3. 如果 @Browser 不可用，使用 HTTP sanity check 和 typecheck 替代。

不要默认使用 Chrome 插件，不要编造浏览器验收结果。

浏览器验收重点：

- 首页入口是否清晰。
- `/books` 是否有可理解空态或书籍列表。
- `/books/[bookId]` 章节列表和 reader 链接是否可用。
- `/reader` 内容是否加载，章节切换是否有效。
- 阅读进度保存后是否能在 reader、book detail 或 learning 中体现。
- `/learning` 是否展示基础学习反馈和下一步建议。
- `/import` 是否明确“本地预览 + 显式保存”，并在 W3 完成后能保存进入 reader。
- mock / preview / disabled 标识是否清楚。

### 8.4 用户演示脚本

最短演示流程：

1. 打开首页。
2. 进入 `/books`。
3. 选择一本书。
4. 在书籍详情页查看章节列表。
5. 进入 `/reader` 阅读某个章节。
6. 保存或触发基础阅读进度。
7. 返回或进入 `/learning`。
8. 查看学习进度、基础能力反馈或下一步学习建议。
9. 如果 W3 已完成，再进入 `/import`，粘贴文本，生成预览，保存，回到 `/books`，再进入 `/reader` 阅读导入内容。

演示边界：

- 默认不演示真实 LLM。
- 默认不演示 RAG / embedding / vector search。
- 默认不演示 Desktop Agent。
- 默认不演示 Skill 社区。
- 所有 mock / preview / disabled 能力必须现场说明。

## 9. 项目总进度更新建议

基于 A128 的静态审计和本路线图判断，建议当前项目总进度仍按谨慎估算记录为：

```text
项目总进度：22.00%
```

说明：

- 这是基于静态审计和路线图判断的粗略估算。
- 它不代表完整产品接近完成。
- 当前项目更准确的状态是“Web MVP 与 Agent preview 原型阶段”。
- Web 基础 MVP 已有一定页面和 repository 支撑，但 Web 编程学习闭环仍需补齐。
- Desktop Agent、真实 Agent loop、三层记忆压缩、后台工具调用系统和 Skill 社区距离完整产品仍有明显距离。
- Web MVP 是下一阶段核心增量；只有 P0 闭环达到可展示、可学习、可验收后，才应评估是否提升整体完成度。

## 10. A129 结论

A129 的结论是：下一步应进入 A130。

A130 推荐不直接写功能代码，而是把 Web MVP 最短用户路径和数据流落成更具体的实现边界，明确：

- 哪些 route 参与 P0。
- 哪些数据来自 DB repository。
- 哪些状态仍是 mock fallback 或 engine preview。
- reader 进度保存与恢复的最小语义。
- learning 页面读取进度并展示建议的最小语义。
- 后续代码任务的允许修改范围和验收标准。

如果用户想更快进入代码，也可以让 A130 直接变为 books / reader 最小闭环补齐任务，但推荐先做 A130 设计小步。这样更符合当前项目“小步开发、先闭环、再复杂智能化”的规则，也能降低把 preview / mock / scaffold 误当成真实能力的风险。

本文件完成后应立即停止，不自动进入 A130。
