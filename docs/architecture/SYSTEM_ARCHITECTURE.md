# Learning Agent Platform System Architecture

## 1. 总体架构

本项目采用 monorepo 结构，将用户界面、桌面端、AI 核心、书籍处理、学习引擎、数据库和共享类型拆分到独立目录中。这样可以让后续 Codex 会话按模块工作，减少上下文压力和误改风险。

整体模块：

- `apps/web`：编程学习网站，负责书籍阅读、AI 问答、学习进度、题单，以及 Skill 相关占位页面或提示。
- `apps/desktop`：软件端 / Desktop client，负责后续本地对话、工具调用预览、任务日志、自主性设置和安全权限边界。
- `packages/ai-core`：AI Agent 核心，负责 LLM 调用、记忆、检索、工具、Skill、自主性和 Agent 运行机制。
- `packages/book-engine`：书籍导入、解析、切分、章节生成和 embedding 准备。
- `packages/learning-engine`：能力评分、题单推荐、题目生成或选择、学习进度模型。
- `packages/db`：数据库 schema、迁移和数据访问边界。
- `packages/shared`：跨端共享类型、常量、工具函数和协议定义。

架构原则：

- Web 和 Desktop 不直接复制复杂 AI 逻辑，统一依赖 `ai-core`。
- 书籍处理逻辑集中在 `book-engine`，避免散落在页面组件中。
- 学习评分和推荐逻辑集中在 `learning-engine`。
- 数据结构优先放在 `shared` 或 `db` 约定中，避免多端重复定义。
- 复杂能力必须先有日志、状态和权限边界，再扩大自动化范围。

## 1.1 当前阶段架构口径（A143）

长期架构仍保留 Skill 生态扩展点，但当前主线只按 **Web 网页端 + 软件端/Desktop** 推进。

- Web 网页端：优先形成书库、导入、阅读器、阅读进度、学习推荐和基础用户/数据流闭环。
- Desktop：作为后续软件端主线，当前可以是未实现或占位；未来再单独推进本地 Agent、任务面板、安全权限和工具调用预览/执行边界。
- Agent：当前以 preview-only / mock-only / disabled-by-default 方式存在，不代表真实 provider、真实工具执行或真实 Agent loop。
- Skill 社区：当前仅为 placeholder / scaffold only，不要求近期实现完整社区链路，不作为当前阶段核心路线。

不要删除 Skill scaffold，也不要在当前阶段扩展完整社区上传、下载、安装、评分、版本发布或真实执行链路。

## 2. 推荐技术栈

技术栈可以在后续阶段根据实际实现调整，但初始建议如下：

- Monorepo：pnpm workspace 或 Turborepo。
- Web：Next.js、React、TypeScript。
- Desktop：Tauri 或 Electron，优先根据后续参考项目分析决定。
- UI：Tailwind CSS 加少量组件库，保持后台工具和阅读器界面清晰。
- 数据库：PostgreSQL，开发期可用 SQLite 过渡。
- ORM：Prisma。
- AI 调用：通过 `packages/ai-core/src/llm` 封装供应商，不在业务 UI 中直接调用模型 API。
- 向量检索：开发期可用本地向量存储或数据库插件，后续再替换为专用向量库。
- 后台任务：开发期先用进程内任务队列，后续可迁移到 BullMQ、Temporal 或平台原生任务系统。
- 测试：Vitest 用于包级单元测试，Playwright 用于 Web 端关键流程测试。

## 3. apps/web

职责：

- 书籍库、阅读器、章节页面和导入入口。
- 当前章节 AI 问答界面。
- 学习进度、能力分数和每日题单展示。
- Skill 相关占位或未来入口；当前不实现完整 Skill 社区浏览、详情和安装确认链路。

不应承担：

- 不直接实现底层 LLM 调用。
- 不直接实现复杂 chunk 算法。
- 不直接实现 Agent 自主性判断。
- 不保存重复的数据类型定义。

建议子目录：

- `src/app`：路由、页面和布局。
- `src/components`：通用 UI 组件。
- `src/features/books`：书籍列表、书籍详情、导入入口。
- `src/features/reader`：阅读器、章节导航、选中文本提问。
- `src/features/tutor`：学习问答、上下文展示、回答状态。
- `src/features/problems`：每日题单、答题结果、错题回顾。
- `src/features/skills`：Skill 占位、manifest 预览或未来扩展入口。
- `src/features/community`：社区 Skill 未来扩展入口；当前不作为近期主线。
- `src/features/agent`：Web 侧 Agent 状态入口。
- `src/lib`：Web 端 API client、状态管理和轻量工具。

## 4. apps/desktop

职责：

- AI 软件端主入口。
- 对话 UI、任务执行面板、工具调用日志。
- 自主性设置页面。
- 本地 Skill 管理、运行和审查的未来扩展点；当前仍应保持 disabled-by-default。
- 与本地后端或系统能力交互。

不应承担：

- 不把工具调用权限写死在 UI 组件中。
- 不绕过 `ai-core` 的自主性判断。
- 不默认允许社区 Skill 自动执行。

关键能力：

- 对话会话管理。
- 后台任务状态展示。
- 工具调用确认弹窗。
- Skill 安装审查的占位或未来扩展。
- 记忆摘要和检索结果的可解释展示。

## 5. packages/ai-core

`ai-core` 是 Agent 能力的核心包，后续应逐步实现，不要一次性写完。

### 5.1 llm

职责：

- 封装模型供应商 API。
- 管理 prompt 输入输出协议。
- 处理流式输出、重试、错误分类。

### 5.2 memory

职责：

- 维护短期记忆、会话摘要、长期用户偏好和任务记忆。
- 支持分层压缩。
- 记录记忆来源和更新时间。

### 5.3 retrieval

职责：

- 根据当前任务检索相关书籍 chunk、历史对话、任务日志和 Skill。
- 返回带来源、分数和摘要的检索结果。

### 5.4 tools

职责：

- 定义工具注册表。
- 管理工具输入输出 schema。
- 标记工具风险等级、读写属性、所需权限。

### 5.5 skills

职责：

- 定义 Skill manifest。
- 加载、校验、安装审查和运行相关 scaffold。
- 当前不代表真实 Skill 社区、真实安装、真实执行或社区分发。

### 5.6 autonomy

职责：

- 定义自主性等级。
- 根据用户设置、工具风险、Skill 权限和任务上下文决定是否允许执行。
- 产出明确的允许、拒绝或需要确认结果。

### 5.7 agent

职责：

- 编排 LLM、memory、retrieval、tools、skills 和 autonomy。
- 管理任务状态。
- 支持低模型也能执行的可拆分任务流程。

## 6. packages/book-engine

职责：

- 导入外部文本、Markdown、网页内容和后续可能支持的 PDF/EPUB。
- 解析文档结构，识别标题、章节、代码块和正文。
- 生成章节树。
- 将内容切分为适合阅读和检索的 chunk。
- 为 embedding 或检索索引准备数据。

子目录：

- `importers`：不同来源导入器。
- `parsers`：不同格式解析器。
- `chunkers`：内容切分策略。
- `chaptering`：章节识别和章节树生成。
- `embeddings`：embedding 任务准备和索引接口。

## 7. packages/learning-engine

职责：

- 维护用户能力分数。
- 根据学习表现更新能力模型。
- 推荐每日题单。
- 生成或选择练习题。
- 记录进度和复习状态。

子目录：

- `scoring`：能力评分算法。
- `recommendation`：题单推荐策略。
- `problems`：题目结构、题目选择、答题评估。
- `progress`：阅读进度、练习进度和复习状态。

## 8. packages/db

职责：

- Prisma schema。
- 数据迁移。
- 数据访问约定。

初期核心实体建议：

- User
- Book
- Chapter
- ContentChunk
- ReadingProgress
- QuestionSession
- AbilityScore
- Problem
- ProblemAttempt
- DailyProblemSet
- AgentConversation
- AgentMessage
- AgentTask
- ToolCallLog
- MemoryEntry
- Skill
- SkillVersion
- SkillInstall
- SkillRun
- PermissionGrant

注意：这些只是数据建模方向，当前总控文档阶段不实现 schema 内容。

## 9. packages/shared

职责：

- 跨 Web、Desktop 和 packages 共享 TypeScript 类型。
- 共享枚举：自主性等级、风险等级、任务状态、Skill 状态。
- 共享协议：AI 问答请求、工具调用结果、Skill manifest。
- 共享轻量工具函数。

原则：

- `shared` 不应依赖 Web 或 Desktop。
- `shared` 不放业务流程实现，只放可复用协议和基础工具。

## 10. 数据流

### 10.1 学习数据流

1. 用户打开书籍章节。
2. Web 读取章节内容、阅读进度和能力分数。
3. 用户阅读、提问或答题。
4. 系统记录阅读位置、问题、回答、题目表现。
5. `learning-engine` 更新能力分数和进度。
6. 推荐系统生成或刷新每日题单。

### 10.2 Agent 数据流

1. 用户在 Desktop 发起对话或任务。
2. Agent 检索相关记忆、Skill 和任务历史。
3. Agent 生成计划或回答。
4. 如果需要工具调用，进入自主性权限判断。
5. 允许执行则创建工具任务；需要确认则等待用户确认。
6. 执行结果写入任务日志和记忆候选。
7. 长对话或任务结束后触发记忆压缩。

## 11. AI 问答流程

1. 用户在阅读器中选中文本或基于当前章节提问。
2. Web 构造问答请求：书籍 ID、章节 ID、选中文本、当前位置、用户问题。
3. 服务端读取章节内容、附近 chunk、用户进度、能力分数和历史表现。
4. `ai-core/retrieval` 检索相关书籍 chunk 和学习记录。
5. `ai-core/llm` 生成回答。
6. 回答返回 Web，并记录问答会话。
7. `learning-engine` 根据问题类型和用户反馈更新学习状态。

回答约束：

- 必须标明依据来自当前章节、相关章节还是一般知识。
- 对未索引内容不应虚构。
- 对复杂概念应优先贴合当前书籍上下文解释。

## 12. 书籍导入流程

1. 用户提交文本、Markdown 或网页内容。
2. 系统创建导入任务，状态为 `pending`。
3. `book-engine/importers` 标准化输入。
4. `book-engine/parsers` 解析结构、正文、标题和代码块。
5. `book-engine/chaptering` 生成章节树。
6. `book-engine/chunkers` 切分内容。
7. 系统保存 Book、Chapter、ContentChunk。
8. 后台任务准备 embedding 或检索索引。
9. 导入完成后书籍进入可阅读状态。

失败路径：

- 输入格式不支持。
- 内容过短或无法解析。
- 章节识别质量过低。
- embedding 或索引失败。

每个失败路径都需要记录原因，允许用户重试或手动修正。

## 13. 章节生成流程

1. 解析文本中的标题、编号、Markdown heading、目录线索。
2. 如果标题线索不足，使用语义边界和长度阈值生成临时章节。
3. 对章节进行层级归并，形成章节树。
4. 为每个章节生成摘要和关键词。
5. 将章节内容切成 chunk，保留章节 ID、顺序、位置和来源片段。
6. 将结果交给阅读器和检索系统使用。

章节生成结果必须可被后续人工调整。

## 14. 每日题单推荐流程

1. 读取用户当前学习目标、最近章节、能力分数和错题记录。
2. `learning-engine/scoring` 计算薄弱维度。
3. `learning-engine/recommendation` 选择题目组合。
4. 题单按巩固题、提升题、挑战题分层。
5. 用户答题后记录结果。
6. 根据正确率、耗时、提示使用和重试次数更新能力分数。

推荐原则：

- 不只推荐用户已经会的题。
- 不连续推送过多超出能力范围的题。
- 题目应尽量关联最近阅读内容。

## 15. Skill 生成流程

1. 系统从任务日志和对话历史中识别重复任务候选。
2. Agent 总结重复任务的目标、输入、步骤、工具和风险。
3. 生成 Skill 草案。
4. 用户审查用途、参数、工具需求、权限等级和安全说明。
5. 用户确认后保存为本地 Skill。
6. Skill 初始状态建议为手动运行，不默认自动触发。

Skill 草案必须包含：

- 名称。
- 用途。
- 触发条件。
- 输入参数。
- 执行步骤。
- 所需工具。
- 所需自主性等级。
- 风险等级。
- 安全说明。
- 测试样例。

## 16. Skill 执行流程

当前阶段本流程仅作为长期架构设计与安全边界参考。A143 后 Skill 社区仅保留 placeholder / scaffold only，不要求近期实现完整执行链路。

1. 用户手动触发 Skill，或系统提出运行建议。
2. 读取 Skill manifest 和用户授权记录。
3. 检查所需工具是否可用。
4. 进入自主性权限判断。
5. 如果允许执行，创建 SkillRun 和 AgentTask。
6. 执行每一步工具调用。
7. 每一步写入任务日志。
8. 成功后记录输出摘要。
9. 失败后记录失败原因、已完成步骤和可恢复建议。

社区 Skill 默认只能手动触发，除非用户显式授权自动运行。

## 17. 自主性权限判断流程

输入：

- 用户当前自主性等级。
- 任务来源：用户直接指令、Agent 建议、Skill 自动触发、社区 Skill。
- 工具风险等级。
- 工具读写属性。
- 目标资源范围。
- Skill 所需权限。
- 历史授权记录。

输出：

- `allow`：允许执行。
- `deny`：拒绝执行。
- `require_confirmation`：需要用户确认。

判断原则：

- 高风险任务必须确认。
- 社区 Skill 不能默认自动执行。
- 写入任务比只读任务需要更高权限。
- 超出项目范围或用户授权范围的操作必须确认或拒绝。
- 权限判断结果必须写入日志。

## 18. 记忆压缩与检索流程

### 18.1 记忆压缩

1. 对话或任务达到长度阈值。
2. Agent 提取事实、偏好、任务结果、失败原因、长期计划。
3. 将内容分为短期摘要、项目记忆、用户偏好和 Skill 候选。
4. 为每条记忆记录来源、时间、可信度和适用范围。
5. 旧记忆根据策略合并、降权或归档。

### 18.2 记忆检索

1. 根据当前问题或任务生成检索查询。
2. 检索相关对话摘要、任务日志、Skill、书籍 chunk 和用户偏好。
3. 按相关性、时间、可信度和权限过滤排序。
4. 将检索结果作为上下文提供给 LLM 或 Agent。
5. 记录本次使用了哪些记忆，便于审计和调试。

## 19. 架构落地顺序

推荐顺序：

1. 建立 monorepo 基础配置。
2. 建立 shared 类型和 db schema 初稿。
3. 做书籍阅读最小闭环。
4. 做章节问答最小闭环。
5. 做学习评分和每日题单原型。
6. 做 Desktop 对话和任务日志原型。
7. 做自主性权限判断原型。
8. 做本地 Skill manifest 和手动运行。
9. 做 Skill 生成草案。
10. 做社区 Skill 安装审查。

每一步都必须有明确验收标准，不能跨太多模块同时开发。

A143 起，近期落地顺序优先停留在 Web MVP 与 Desktop 最小骨架；第 8-10 步仅保留为未来方向，不驱动当前主线任务。
