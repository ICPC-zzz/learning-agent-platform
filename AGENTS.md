# Learning Agent Platform

## 项目一句话说明

Learning Agent Platform 是一个“编程学习网站 + AI Agent 软件端 + Skill 社区”的长期复杂项目，目标是把编程学习、个性化练习、可控 AI 自动化和 Skill 生态连接起来。

## 当前开发原则

- 分阶段小步开发，先做可运行闭环，再做复杂智能化。
- 每次 Codex 会话只处理一个明确任务。
- 修改前先说明计划，修改后总结改动、运行方式和测试方式。
- 不写与当前任务无关的代码。
- 不做无边界重构。
- 不一次性实现整个系统。
- 不一次性读取大型参考项目。
- 不复制参考项目代码，只提炼设计思路。
- 涉及 Agent、工具调用、Skill 和自主性时，必须优先考虑权限、日志和安全边界。

## 目录规划

```text
learning-agent-platform/
  apps/
    web/                  编程学习网站
    desktop/              AI 软件端 / Agent 端
  packages/
    ai-core/              LLM、记忆、检索、工具、Skill、自主性、Agent 核心
    book-engine/          书籍导入、解析、章节生成、chunk、embedding 准备
    learning-engine/      能力评分、题单推荐、题目、学习进度
    shared/               跨端共享类型、协议、常量和工具
    db/                   Prisma schema、迁移和数据访问边界
  docs/
    product/              产品规格和范围
    architecture/         系统架构和流程
    codex-tasks/          Codex 开发规则和路线图
    reference-analysis/   后续分批分析参考项目的输出
  scripts/                工程脚本
  tests/                  跨包或端到端测试
```

## 编码规范

当前仓库还未初始化具体技术栈，后续默认规范如下：

- 使用 TypeScript 作为主要开发语言。
- Web 优先使用 React / Next.js。
- 数据库优先使用 Prisma 管理 schema。
- 跨端类型放在 `packages/shared`。
- LLM、工具调用、记忆、Skill 和权限判断放在 `packages/ai-core`。
- 书籍导入和切分逻辑放在 `packages/book-engine`。
- 能力评分和题单推荐放在 `packages/learning-engine`。
- UI 层不直接调用底层模型 API。
- UI 层不直接绕过自主性权限判断。
- 社区 Skill 不能默认自动执行。

## 测试命令占位

当前尚未初始化 package manager 和测试框架，命令暂定为占位：

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

后续初始化工程后，必须更新本节为真实可运行命令。

## 后续 Codex 工作规则

每次 Codex 会话开始时：

1. 先阅读本文件。
2. 再按任务读取必要文档：
   - 产品范围：`docs/product/PRODUCT_SPEC.md`
   - 系统架构：`docs/architecture/SYSTEM_ARCHITECTURE.md`
   - 开发路线：`docs/codex-tasks/DEVELOPMENT_ROADMAP.md`
   - 工作约束：`docs/codex-tasks/CODEX_RULES.md`
3. 只读取和当前任务相关的目录。
4. 修改前说明计划。
5. 完成后说明改动、运行方式、测试方式和后续建议。

## 参考项目读取规则

本地参考项目：

- `E:\code\harness-main`
- `E:\code\ccx`
- `E:\code\claude-desktop-app-main`

规则：

- 只有用户明确要求时才读取参考项目。
- 一次会话只读取一个参考项目。
- 读取前先说明分析目标和范围。
- 分析结果写入 `docs/reference-analysis`。
- 不允许一次性读取三个参考项目。
- 不允许复制参考项目代码到当前项目。
- 不允许把参考项目结构原样搬进当前项目。

## 禁止事项

- 禁止一次性实现整个系统。
- 禁止一次性读取大型参考项目。
- 禁止在没有计划的情况下大规模修改文件。
- 禁止删除或覆盖用户已有文件，除非用户明确要求。
- 禁止把 LLM 调用散落在 UI 组件里。
- 禁止绕过自主性权限判断执行工具。
- 禁止让社区 Skill 默认自动执行。
- 禁止在当前仅要求文档时编写业务代码。

## 当前阶段状态

当前阶段为项目总控文档阶段。已建立产品规格、系统架构、开发路线和 Codex 工作规则。后续应先按路线图分批分析参考项目，再进入工程初始化和 MVP 开发。
