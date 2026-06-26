# Harness 总分析文档

本文档合并 `docs/reference-analysis/harness/*.md` 中已经完成的 Harness 分析结果，用于指导 Learning Agent Platform 后续 `ai-core`、`agent`、`tools`、`skills` 和 `autonomy` 模块设计。

本轮合并严格遵守限制：

- 未读取 `E:\code\harness-main` 的任何源码。
- 只基于已生成的 Harness 分析文档。
- 未修改业务代码。
- 只创建本文档。

## 1. 项目总体结构

基于目录地图分析，`harness-main` 是一个以后端 Go 工程为主体、包含 Web UI、CLI、代码托管、DevOps Pipeline、Gitspaces、Artifact Registry、后台任务和日志系统的复杂平台。

总体上可以拆成以下几类能力：

```text
harness-main/
  app/                 后端应用主体：API、认证、路由、服务、Gitspace、Pipeline、AI task
  cmd/                 主程序入口候选
  cli/                 命令行入口与操作分组
  web/                 前端 UI 工程
  registry/            Artifact Registry 子系统
  git/                 Git API、命令、diff、hook、storage
  store/               数据存储边界
  job/                 后台任务、调度、执行、过期、清理
  events/              事件基础设施
  pubsub/              发布订阅基础设施
  stream/              流式消息基础设施
  livelog/             实时日志
  logging/             日志基础设施
  audit/               审计候选
  lock/                锁和并发控制
  cache/               缓存
  http/ ssh/           HTTP / SSH 协议服务
  secret/ crypto/      Secret、加密和凭据相关能力
  resources/           内置资源
  charts/ scripts/     部署模板与工程脚本
  types/               跨模块领域类型和枚举
```

对本项目最有参考价值的不是完整 DevOps 平台形态，而是几个横向基础设施：

- 任务实体与事件系统分离。
- 后台执行依赖明确运行环境。
- 日志流与任务状态分开管理。
- 资源级权限通过统一入口检查。
- Template 作为可复用配置实体，有归属、解析、校验和乐观锁。

## 2. 核心模块说明

### 2.1 Gitspace / 执行环境

Harness 的 AI task 不是孤立运行，而是绑定到 Gitspace 运行环境。任务启动前会确认 Gitspace 处于可运行状态，再交给 orchestrator 触发执行。

对本项目的启发是：Agent 执行不能只看用户 prompt，还要绑定明确执行上下文，例如 workspace、cwd、文件访问范围、可用工具、凭据边界和当前自主性模式。

### 2.2 AITask / 任务模型

已分析文件中能确认 `AITask` 至少包含状态、输出、输出 metadata、错误信息和 AI usage metric 等字段。任务事件只携带最小定位信息，完整任务信息由 handler 从 store 重新读取。

这说明 Harness 把任务作为可持久化、可查询、可恢复的实体，而不是一次普通函数调用。

### 2.3 Events / PubSub / Handler

AI task 生命周期由事件驱动。事件进入 handler 后，handler 查任务、更新状态、校验运行环境，并触发 orchestrator。

对本项目来说，这适合迁移成：

```text
create AgentTask
  -> publish task event
  -> lifecycle service consumes event
  -> reload task from store
  -> permission/autonomy/workspace checks
  -> run orchestrator
  -> persist result and logs
```

### 2.4 Tool / Executor / Log

Harness 已读范围中的工具系统更像“容器内脚本工具安装与执行系统”，而不是模型可见的结构化 tool schema。

它的价值在于：

- 执行器封装容器、用户、工作目录、访问方式等运行上下文。
- 命令输出可以流式进入日志系统。
- stderr、exit code、非零退出都有明确处理。

但它缺少本项目需要的结构化工具定义、输入输出 schema、风险等级、权限声明和逐次授权。

### 2.5 Template / Resolver

Harness Template 是 space 下的持久化模板实体，主体是可解析的 YAML 配置，类型只支持 `step` 和 `stage`。Resolver kind 分为 `plugin` 和 `template`。

这更接近 pipeline 片段复用，不等同于本项目的 Skill。可迁移的是模板的归属、解析、校验、更新和乐观锁思想，而不是直接照搬 Template 结构。

### 2.6 Auth / Permission

Harness 的权限入口集中在 `app/api/auth`，通过 `scope + resource + permission` 进行统一授权判断，并区分匿名未认证与已登录无权限。

它提供了成熟的资源级授权参考，但没有在已分析范围内看到面向 AI 自主性的风险策略引擎。

## 3. Agent 执行流程

Harness 中可确认的 AI task 流程如下：

```text
任务记录已存在或正在创建
  -> 发布 gitspace_ai_task_event
  -> handler 接收事件
  -> 按 identifier + space_id 查找 AI task
  -> 标记为 running
  -> 读取最新 Gitspace instance
  -> 根据事件类型分发
       start: 校验 Gitspace running，然后调用 orchestrator.TriggerAITask
       stop: 当前为 NOOP
  -> 成功后继续运行
  -> 失败时写入 error 状态和 error_message
```

已确认状态包括：

```text
uninitialized
running
completed
error
```

可见状态流转包括：

```text
uninitialized -> running
running -> running
error -> running
completed -> completed
running -> error
uninitialized -> error
```

值得借鉴的点：

- 任务创建和任务执行解耦。
- 事件只携带最小定位信息。
- handler 重新从 store 读取完整任务，方便重试和审计。
- 事件比任务记录先可见时，用短重试吸收异步时序问题。
- 执行前集中校验运行环境。
- 任务输出、错误和 usage metric 纳入任务模型。

不适合直接照搬的点：

- 状态过粗，缺少 `queued`、`needs_confirmation`、`canceled`、`timed_out` 等状态。
- `stop` 事件当前是 NOOP，不满足桌面 Agent 的取消和中断需求。
- 生命周期强绑定 Gitspace，不能直接搬到本项目。
- 权限、自主性、工具风险没有成为可见的任务状态分支。

## 4. 工具调用流程

Harness 已分析范围中的工具流程可以概括为：

```text
后端根据 IDE 或 AI Agent 类型选择安装/配置函数
  -> 用脚本模板和 typed payload 生成 shell 脚本
  -> Exec 在容器内运行命令
  -> stdout/stderr 进入输出流
  -> 日志写入 livelog stream
  -> exit code 决定成功或失败
  -> orchestrator 根据错误更新任务结果
```

工具系统的关键设计：

- 用 map 或 switch 注册少量内置工具安装能力。
- 用执行器封装容器名、用户、工作目录和系统架构。
- 支持在 home 目录中异步执行并流式记录日志。
- stderr 和最终 exit status 有明确标识。
- 日志系统可以支撑用户查看长任务执行过程。

对本项目的不足：

- 没有看到模型可读的 `ToolDefinition`。
- 没有看到输入 schema、输出 schema、风险等级、权限需求。
- 没有看到每次工具调用前的 autonomy policy 判断。
- 没有看到结构化 `ToolCallLog`。
- 没有看到用户确认记录和风险回放。

因此本项目应迁移“执行器封装运行环境”和“实时日志流”思想，但必须额外设计结构化工具系统。

建议的工具调用链路：

```text
Agent proposes ToolCall
  -> ToolRegistry 查找 ToolDefinition
  -> 校验 input schema
  -> AutonomyPolicyEngine 评估风险与权限
  -> allow / deny / require_confirmation
  -> ToolExecutor 执行
  -> 写入结构化 ToolCallLog
  -> ToolResult 返回 Agent
```

## 5. Skill / Template / 任务复用机制

Harness 已分析到两套相近但用途不同的机制：

- Template / Resolver：偏 CI 或 pipeline 配置复用，复用粒度是 `step` 或 `stage`。
- AITask：偏 CDE 场景中的一次性 AI Agent 任务，输入是 prompt、Gitspace 和 agent 类型。

目前没有证据表明 Harness 已经形成以下闭环：

- 从 AITask 保存为 Template。
- 从 Template 创建 AITask。
- 从对话或日志总结生成 Skill。
- Skill 自动安装、授权、运行和社区分发。

Template 创建与更新中值得迁移的设计：

- 模板必须归属于明确 space。
- 创建和更新都走服务端权限判断。
- 模板主体入库前用正式 parser 解析。
- 类型从主体内容推导，而不是信任客户端。
- 更新时使用乐观锁，避免并发覆盖。
- 更新主体时重新解析并同步类型。

对本项目 Skill 的边界判断：

- Harness Template 不能直接等同于 Skill。
- 本项目 Skill 必须声明输入、输出、工具、权限、风险、数据访问范围、写入目标、示例和运行方式。
- 自动生成 Skill 必须先成为草稿，不能默认启用。
- 社区 Skill 默认只能手动运行，自动触发需要单独授权。

## 6. 自主性 / 权限 / 风险控制机制

Harness 已确认有资源级权限系统：

```text
Session
  -> Scope
  -> Resource
  -> Permission
  -> Authorizer.Check
  -> allow / unauthorized / forbidden
```

相关设计包括：

- `Check` / `CheckAll` 统一权限检查入口。
- `CheckSpace`、`CheckTemplate`、`CheckGitspace` 等资源级 wrapper。
- 匿名用户和已登录无权限用户分别返回认证错误和授权错误。
- `Principal` 表达身份主体。
- `Membership` 表达 space 成员与角色关系，并记录创建者。
- `AIAgentAuth` 对 API key 做脱敏输出。

但 Harness 已分析范围内没有发现显式自主性系统。没有看到：

- 用户可配置自主性模式。
- 低风险只读自动执行。
- 低风险写入自动执行。
- 高风险操作强制确认。
- 工具调用前按风险等级决策。
- Skill 自动触发授权。
- 每步工具调用的用户确认记录。

结论：Harness 的资源授权模型适合迁移为基础权限层，但不能替代本项目的 `autonomy` 模块。

本项目需要补齐：

- 自主性模式。
- 工具和 Skill step 风险分类。
- policy decision 结构。
- 用户确认记录。
- tool call audit log。
- Skill 安装和更新授权。
- 执行时二次校验。
- 后台任务透明度。

## 7. 哪些代码思想适合迁移

以下是适合迁移的“设计思想”，不是直接复制代码。

1. 任务记录和事件触发解耦

   API 或 UI 只创建任务记录，实际执行由事件和 lifecycle service 触发。

2. 事件只带最小定位信息

   事件中只放 `task_id`、`workspace_id` 等定位字段，完整上下文从 store 重新读取。

3. 任务状态机先小后细

   先建立最小可运行生命周期，再逐步加入更多状态。

4. 异步时序短重试

   用有限重试处理“事件先到、数据后可见”的常见后台任务问题。

5. 执行前集中校验

   handler 或 lifecycle service 中统一检查运行环境、权限、自主性、工具可用性。

6. 输出、错误和 usage 结构化保存

   任务详情不仅存文本结果，也保存 metadata、模型使用指标、错误原因。

7. 执行器封装运行上下文

   把 cwd、workspace、用户、环境、日志 sink、取消信号等集中到 execution context。

8. 实时日志流

   长任务需要用户可见的日志流，同时保留结构化结果。

9. 模板主体入库前解析

   任何 Skill 或模板都不能只当字符串保存，必须经过正式 parser/schema 校验。

10. 类型由内容推导并交叉验证

    不信任客户端传入的 metadata，主体内容、manifest 和权限声明应互相校验。

11. 资源级权限统一入口

    用 `scope + resource + permission` 收敛授权逻辑。

12. 乐观锁更新

    Skill 草稿、模板和用户编辑都可能并发发生，必须避免静默覆盖。

13. Secret 脱敏

    凭据输出默认脱敏，日志和详情页不能泄露密钥。

## 8. 哪些代码不应该直接迁移

以下能力不应直接搬进本项目：

1. Gitspace 绑定模型

   本项目可以借鉴“执行环境校验”，但不应照搬 Gitspace 结构。

2. 过粗的任务状态

   `uninitialized/running/completed/error` 不足以表达权限确认、取消、超时和等待状态。

3. NOOP 的停止语义

   本项目从 MVP 起就需要取消或中断任务的设计入口。

4. 把工具定义等同于脚本模板

   本项目工具必须有 schema、风险等级、权限要求和结构化结果。

5. 只用硬编码 switch/map 作为长期 registry

   MVP 可以硬编码少量内置工具，长期必须支持 manifest、版本、安装来源和授权状态。

6. 只记录文本日志

   文本日志不能替代结构化 ToolCallLog、PolicyDecisionLog 和 ConfirmationLog。

7. 只做资源 RBAC，不做 AI 风险策略

   传统权限系统不能回答“AI 在当前自主性模式下能否执行这个写入或网络操作”。

8. 让 Template 等同于 Skill

   Harness Template 是 pipeline 配置片段，本项目 Skill 是可运行能力单元。

9. 只校验模板 `type`

   Skill 至少要校验输入、输出、工具、权限、风险、示例和安全说明。

10. 密钥作为脚本变量扩散

    应优先使用 secret handle、临时环境变量或受控 secret provider。

11. 外部 Agent 内部工具选择完全黑箱化

    外部 Agent 可以是能力之一，但本项目自己的 `ai-core` 必须保留可控 Tool Registry 和权限门。

## 9. 对 ai-core、skills、autonomy、agent 模块设计建议

### 9.1 ai-core 总体边界

`packages/ai-core` 应是所有 Agent 能力的核心边界，不让 UI 直接调用底层模型、工具或权限判断。

建议子模块：

```text
packages/ai-core/src/
  llm/             模型调用抽象
  agent/           任务生命周期、编排、状态机
  tools/           工具定义、注册、执行、结果
  skills/          Skill manifest、加载、校验、运行
  autonomy/        自主性策略和权限决策
  memory/          记忆摘要与检索，后续实现
  retrieval/       资料、任务、Skill 检索，后续实现
  logs/            结构化日志协议
```

### 9.2 agent 模块

建议先实现最小可运行生命周期：

```text
AgentTask
AgentTaskState
AgentTaskEvent
AgentTaskStore
AgentTaskEventBus
AgentTaskLifecycleService
AgentOrchestrator
```

建议最小状态：

```text
created
queued
running
needs_confirmation
succeeded
failed
canceled
timed_out
```

最小流程：

```text
createTask(input)
  -> 写入 created/queued
  -> 记录创建日志
  -> 发布 task event
  -> lifecycle service 消费事件
  -> 校验 workspace、权限、自主性、确认状态
  -> orchestrator 执行
  -> 写入 succeeded/failed/canceled/timed_out
  -> 保存输出、错误、usage 和可恢复建议
```

### 9.3 tools 模块

建议先实现结构化工具系统：

```text
ToolDefinition
ToolRegistry
ToolCall
ToolExecutionContext
ToolExecutor
ToolResult
ToolRunLogger
ToolCallLog
```

每个工具至少声明：

- name
- description
- inputSchema
- outputSchema
- riskLevel
- requiredAutonomy
- requiredPermissions
- capabilities

执行前必须经过 `autonomy` 模块，执行后必须写入结构化日志。

### 9.4 skills 模块

建议 SkillManifest 最小包含：

- id / name / description / version
- ownerScope
- inputSchema / outputSchema
- requiredTools
- requiredPermissions
- requiredAutonomy
- execution kind / steps
- safety.dataAccess
- safety.writeTargets
- safety.riskSummary
- examples

Skill 运行流程：

```text
load SkillManifest
  -> validate manifest
  -> validate input
  -> check installed grants
  -> check runtime autonomy
  -> create SkillRun
  -> execute steps through ToolRuntime
  -> stream logs
  -> persist structured output/error/usage
```

### 9.5 autonomy 模块

`autonomy` 不应只是 RBAC。它应综合用户设置、工具风险、Skill 权限、任务来源、目标资源和历史授权。

建议自主性模式：

```text
answer_only
confirm_all
auto_read_low
auto_write_low
high_autonomy
```

建议风险分类：

```text
read_low
write_low
network
credential
destructive
external_publish
background_long_running
```

建议决策输出：

```text
allow
deny
require_confirmation
require_scope_grant
require_admin
```

每次决策应记录：

- taskRunId / skillRunId
- toolName 或 operation
- riskLevel
- affectedResources
- decision
- reason
- policyVersion
- user confirmation id，如果有

## 10. 推荐迁移顺序

推荐迁移顺序从“可运行闭环”和“安全边界”开始，而不是从复杂自动化开始。

1. 定义共享枚举和协议

   包括任务状态、工具风险等级、自主性模式、policy decision、Skill 状态。

2. 建立 AgentTask 最小生命周期

   先做 create、queue、run、succeed、fail、cancel 的内存或简单持久化闭环。

3. 建立结构化任务日志

   记录任务创建、状态变化、输出、错误和 usage 占位。

4. 建立 ToolDefinition / ToolRegistry / ToolExecutor

   先支持少量低风险只读工具或模拟工具。

5. 接入 AutonomyPolicyEngine

   所有工具调用前必须经过 policy 判断。

6. 增加用户确认状态

   让 `needs_confirmation` 成为任务生命周期中的正式状态。

7. 设计 SkillManifest schema

   先做本地 Skill manifest 校验，不做社区、不做自动生成。

8. 实现本地 Skill 手动运行

   SkillRun 通过 ToolRuntime 执行，并写入日志。

9. 增加 Skill 安装授权和更新差异提示

   required tools、write targets、risk level 变化时重新确认。

10. 最后再做 Skill 草稿生成

    从任务日志总结重复流程，但只生成草稿，不自动启用。

## 11. MVP 阶段应该只实现哪些部分

MVP 阶段应只实现最小安全闭环：

1. AgentTask 基础状态机

   支持 `created`、`queued`、`running`、`needs_confirmation`、`succeeded`、`failed`、`canceled`。

2. 任务日志

   记录输入摘要、状态变化、输出摘要、错误原因和 usage 占位。

3. ToolRegistry 原型

   只注册少量内置工具，优先只读或模拟工具。

4. ToolCallLog

   每次工具调用都写入结构化日志。

5. AutonomyPolicyEngine 原型

   覆盖 `answer_only`、`confirm_all`、`auto_read_low` 三种模式即可。

6. 用户确认流程

   高风险或写入操作进入 `needs_confirmation`，确认后继续执行。

7. 本地 SkillManifest 校验

   只支持本地 manifest，默认手动运行。

8. SkillRun 最小闭环

   手动触发、校验输入、检查权限、执行步骤、记录结果。

9. 日志详情页或调试视图的数据协议

   即使 UI 后做，也要先把数据结构设计清楚。

10. Secret 脱敏和日志保护

    任何凭据字段默认不能直接进入日志。

## 12. 暂时不应该实现哪些 Harness 能力

以下能力暂时不应在 MVP 实现：

1. 完整 Gitspace / 云开发环境

   本项目不应先做 Harness 级别的远程开发环境编排。

2. 完整 Pipeline / Template Resolver

   当前目标不是 DevOps pipeline 平台，暂不实现 step/stage resolver。

3. Artifact Registry

   与当前学习平台和 Agent MVP 无关。

4. 复杂 CLI 生态

   可以后续补命令行入口，MVP 先保持 Web/Desktop 闭环。

5. 多 Agent 类型安装与配置

   MVP 不需要支持 Claude Code、Cursor、Windsurf、JetBrains 等环境安装逻辑。

6. 容器内 shell 执行全能力

   高风险较大，MVP 只做受控工具或模拟工具。

7. 高自主性后台长任务

   没有完整权限、取消、日志和确认前，不做高自主性。

8. 自动生成并自动启用 Skill

   只允许生成草稿，用户确认后手动运行。

9. 社区 Skill 自动执行

   社区 Skill 默认不能自动执行，安装后也只能手动运行。

10. 复杂组织 RBAC

    可以先做个人 workspace 和本地授权，团队权限后置。

11. 大规模实时日志基础设施

    MVP 可以先用简单日志 store，后续再做 livelog 级别流式系统。

12. 外部 Agent 黑箱工具执行

    外部 Agent 可以后续接入，但 MVP 应先建立自己的可控工具边界。

## 13. 后续需要进一步验证的问题

后续如果继续分析 Harness，需要新开对话并按小范围读取源码。当前仍需验证的问题包括：

1. AITask 创建入口在哪里

   需要确认后端创建 AI task 时如何校验权限、写入任务、发布事件。

2. `completed` 状态如何写入

   当前分析中未确认任务成功完成由哪个模块负责。

3. `StartAITask` 具体执行逻辑

   需要确认容器内 Agent 如何启动、输入如何传递、输出如何回写。

4. stop / cancel 是否在其他路径实现

   当前看到的 stop event 是 NOOP，但可能存在其他取消路径。

5. AI task 是否有更细的权限检查

   需要确认创建、启动、日志查看、取消是否分别有权限。

6. Tool 执行是否有隐藏的结构化审计

   当前只看到运行日志，没有看到 ToolCallLog 级审计。

7. Template resolver 的实际展开入口

   需要确认 `ResolverKindTemplate` 如何变成可执行 pipeline 配置。

8. Template 是否有参数和版本选择

   当前只确认 `step/stage` 类型和主体解析，没有确认参数化能力。

9. Permission 枚举粒度

   需要确认 Harness 是否区分 read、edit、delete、execute、approve 等权限。

10. 日志读取权限边界

    需要确认用户查看任务日志时按什么资源授权。

11. Secret 传递与日志保护

    需要确认 API key 注入脚本时是否有额外防泄露机制。

12. AITask 是否支持 rerun、clone 或保存为模板

    当前没有看到任务复用闭环，需要进一步验证。

13. Gitspace action 权限和状态限制

    需要确认 start/stop/action 是否有执行权限、状态限制或风险确认。

## 结论

Harness 对本项目最有价值的是“后台任务生命周期、事件驱动执行、运行环境校验、实时日志、资源级权限、模板解析校验”这些工程化思想。

但 Harness 不是一个可直接复制的 AI Skill 平台。它缺少本项目必须优先建立的自主性策略、工具风险分级、结构化工具审计、Skill 安装授权、社区 Skill 默认保守运行等安全边界。

因此后续设计应采用“借鉴基础设施思想，重建 AI 安全边界”的路线：先做小而完整的 `AgentTask + ToolRegistry + AutonomyPolicyEngine + SkillManifest` 闭环，再逐步引入更强的任务复用和自动化能力。
