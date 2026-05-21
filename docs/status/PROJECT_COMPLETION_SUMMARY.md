# Project Completion Summary

## 1. 文档用途

这是长期项目的阶段完成度与范围口径汇总报告，主要给 DeepSeek 阶段压缩和后续 Codex 接力读取。

Codex 默认不读本文件，除非任务明确要求审计、阶段总结、文档压缩、范围重校准或全局规划。普通实现轮次应优先读取 `docs/codex-context` 下的小上下文文件。

本文件从 A143 起记录新的项目完成度口径：当前主线按 **Web 网页端 + 软件端/Desktop** 计算，Skill 社区仅保留占位/scaffold。

## 2. 当前项目范围

`learning-agent-platform` 的长期愿景仍包含编程学习网站、AI Agent 软件端和 Skill 生态，但当前阶段范围已经重校准。

当前主线范围：

- **Web 网页端**：书库、导入、阅读器、阅读进度、学习推荐、基础用户/数据流。后续可以接入 LLM/RAG，但必须通过单独任务推进。
- **软件端 / Desktop client**：作为后续软件端主线，当前可以是未实现或占位；未来围绕本地 Agent、任务面板、安全权限、工具调用预览/执行边界推进。
- **Agent 能力**：当前主要是 preview-only / mock-only / disabled-by-default，可作为 Web + Desktop 中的核心能力逐步推进，但不等同于 Skill 社区已完成。
- **Skill 社区**：当前仅保留占位/scaffold，不作为近期主线完成度分母。后续如果重新纳入产品目标，需要重新校准进度条。

旧口径是“Web 网页端 + AI Agent 软件端 + Skill 社区完整生态”。该口径不再用于当前近期主线进度。

## 3. 当前已完成模块概览

### apps/web

- 已有 Next.js Web app 工作区、`package.json`、`src` 目录和多条 App Router 页面。
- 已存在 `/books`、`/books/[bookId]`、`/reader`、`/import`、`/learning`、`/agent` 等页面方向。
- 编程学习 Web MVP 已形成部分链路：纯文本导入可以生成章节 / chunk 并显式保存到 DB；书库、书籍详情和 reader 能读取部分已保存内容；reader 能在 demo 用户边界下保存阅读进度。
- `/agent` 是 Agent preview 工作台，覆盖任务计划、工具需求、权限、记忆上下文、Skill 建议、runtime history / detail、事件和审计预览。
- 仍未形成完整稳定产品闭环：阅读进度恢复、真实章节问答、自动能力画像更新、每日题单反馈循环、浏览器验收、URL / 文件 / PDF / EPUB 导入仍需后续推进。

### packages/db

- 已有 Prisma schema 和 repository 边界。
- Web 学习数据相关 repository 比纯 mock 更实，覆盖 Book / Chapter / Chunk、ReadingProgress、AbilityProfile、DailyRecommendation、ProblemAttempt 等方向。
- Agent runtime 相关记录仍强制 preview 边界，例如 `previewOnly=true`、`realExecutionEnabled=false`、`llmCallEnabled=false`。
- 当前不能把 Agent runtime persistence 说成生产级真实执行日志闭环。

### packages/ai-core

- 已有 provider 抽象、mock provider、Spark diagnostic scaffold，以及任务、工具、权限、记忆、Skill、runtime preview helper 等类型和 helper。
- 已有 Skill manifest 类型、校验、内存 registry 和安装审查 helper。
- 未发现完整真实 Agent loop、真实工具执行、真实业务 LLM 调用、后台 runner 或生产执行状态机。

### packages/book-engine

- 已能支撑纯文本导入、规则式章节识别和字符 chunk 原型。
- 可为 Web import preview 和显式保存提供前置结构化结果。
- 不负责 DB 写入，不支持 URL / 文件 / PDF / EPUB / HTML 导入，不含后台导入任务、重试、导入状态或人工校正闭环。

### packages/learning-engine

- 已有规则式能力评分和每日题单推荐 helper。
- 可接收阅读进度、QA feedback、ProblemAttempt 等输入信号，生成能力画像或推荐结果。
- 当前仍是规则式原型，不是完整个性化推荐系统、复习系统、学习计划系统或在线判题系统。

### apps/desktop

- Desktop 软件端仍基本未实现，不可启动，也不能计为已经形成产品闭环。
- 在新口径中，Desktop 是主线分母的重要缺口，不能因为 Skill 社区暂缓而忽略。

### Skill scaffold

- Skill 相关能力当前是 manifest、内存 registry、安装审查、建议和 schema scaffold。
- Skill 社区当前仅保留占位/scaffold，不作为近期主线完成度分母。后续如果重新纳入产品目标，需要重新校准进度条。
- 当前没有真实社区上传、下载、安装、执行、版本发布、审查和分发闭环。

### docs / process

- 已有产品规格、系统架构、开发路线、真实完成度审计和参考分析汇总。
- 已有 Harness 与 CCX 参考分析汇总文档，均基于已生成分析文档，不应默认读取外部参考源码。
- A134 建立了 `docs/codex-context` 小上下文目录、`docs/rounds` 轮次目录、`docs/_archive_pending_review` 待复核归档目录，以及 Codex + DeepSeek + ChatGPT 三段式文档工作流。
- A143 完成 docs-only 范围重校准，将近期主线从完整 Skill 生态口径调整为 Web + Desktop 口径。

## 4. preview-only / mock-only / disabled-by-default 能力

当前必须明确以下能力不能说成真实上线能力：

- `/agent` 的任务计划、工具需求、权限、记忆、Skill、runtime history / detail 是 preview 工作台，不是真实 Agent loop。
- mock runtime preview 只是保存 mock 运行记录，不执行真实工具，不调用真实模型。
- tool requirement preview 只是工具需求、风险和禁用元数据展示，不是真实工具注册或执行。
- LLM call preview / mock provider 不代表真实业务 LLM 调用。
- reader QA 默认应视为 mock / preview / provider-gated，不应说成真实 RAG 或真实模型问答。
- Skill 相关能力当前是 manifest、内存 registry、安装审查和 schema scaffold，不是 Skill 社区、真实安装、真实执行或社区分发。
- Desktop Agent 当前基本未实现；`apps/desktop` 不能计为可启动软件端。
- 真实 provider、真实工具执行、真实 agent loop、真实 Skill 执行仍需要单独任务设计和验收。

## 5. 进度口径说明

旧进度口径：

- Web 网页端 + AI Agent 软件端 + Skill 社区完整生态。

新进度口径：

- Web 网页端 + 软件端/Desktop 为主线，Skill 社区仅占位。

进度条解释：

- 不再因为 Skill 社区未完成而大幅压低当前主线进度。
- 仍然不能夸大真实完成度。
- Agent / Tool / Provider / Skill 相关真实执行仍然不能算完成。
- Desktop 软件端如果基本未实现，仍作为重要缺口计入新分母。
- Web MVP 如果仍未完整闭环，也必须保守计入。
- 本文件中的百分比是“按新范围重校准后的主线进度”，不能与旧完整生态口径混淆。

## 6. 当前主要缺口

- Web MVP 仍需补齐可验收的书库、阅读器、进度保存 / 恢复、learning 基础反馈闭环。
- Web 侧真实 LLM provider 接入仍需单独任务，不能默认开启。
- RAG、embedding、vector search 仍未形成产品闭环。
- Desktop 软件端仍基本未实现，不可启动，是新主线分母下的最大缺口之一。
- Agent / Tool / Provider 真实执行、安全权限、审计链路、取消 / 超时 / 重试仍需后续设计。
- Skill 社区仅占位，不做近期主线完成度目标；不能把 Skill scaffold 误写成社区生态已完成。
- UI 中文化、mock / preview / disabled 标识和浏览器验收仍需继续检查。
- 数据库真实读写已覆盖部分 Web 学习数据，但 Agent runtime 仍是 preview persistence。

## 7. 下一阶段建议

- 继续优先推进 Web MVP 最短闭环：书库 -> 导入 -> 阅读器 -> 进度保存 / 恢复 -> learning 基础反馈。
- 在 Web 最短闭环更稳定后，单独规划 Desktop client 的最小可启动骨架和任务面板。
- Agent 能力继续以 preview-only / mock-only / disabled-by-default 方式推进，真实 provider、真实工具执行、真实 Agent loop 必须拆成单独任务，并先补齐安全边界。
- Skill 社区当前只保留占位，不要扩展完整社区能力，不要删除已有 scaffold。
- 当 Codex 轮次文档累计较多时，由 DeepSeek 压缩进本文件，避免 Codex 每轮读取大量历史文档。

## 8. 项目总进度

项目总进度：30.00%

这是按 Web 网页端 + 软件端/Desktop 主线重新校准后的保守估算；Skill 社区仅保留占位，暂不计入近期完成度分母。

该估算依据是：Web MVP 已有部分数据流与页面原型，但仍未形成完整可验收闭环；Desktop 软件端基本未实现；Agent / Tool / Provider / Skill 真实执行仍然不能计入完成。后续如果 Skill 社区重新纳入产品目标，需要重新校准进度条。
