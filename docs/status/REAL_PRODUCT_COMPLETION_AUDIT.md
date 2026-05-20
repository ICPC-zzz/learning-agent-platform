# learning-agent-platform 真实产品完成度审计

## 1. 审计结论摘要

本文件是 A128-1 到 A128-5 的最终收束版。当前项目已有大量 Web + Agent preview + backend scaffold，但完整产品还远未完成。

最终审计结论：

- Web app 已存在，`apps/web` 有独立 `package.json`、`src` 目录和多条 Next.js App Router 页面；根 `pnpm dev` 指向 Web 的 `next dev`。
- 编程学习 Web MVP 已形成部分链路：纯文本导入可以生成章节 / chunk 并显式保存到 DB，书库 / 书籍详情 / reader 能读取已保存内容，reader 能在演示用户边界下保存阅读进度。
- 编程学习闭环仍不完整：阅读进度恢复、真实章节问答、自动能力画像更新、每日题单反馈循环、URL / 文件 / PDF / EPUB 导入和浏览器验收都没有形成稳定产品闭环。
- `/agent` 页面已经是较丰富的 Agent preview 工作台，覆盖任务计划、工具需求、权限、记忆上下文、Skill 建议、runtime history / detail、事件和审计预览。
- `/agent` 没有形成真实 Agent loop；本次审计未发现真实 runner、真实后台任务队列、真实工具执行、真实业务 LLM 调用或真实 Spark 业务接入。
- `packages` 已有 `ai-core`、`db`、`book-engine`、`learning-engine`、`shared` 五个包，提供了类型、规则式 helper、Prisma repository、preview persistence、diagnostic / scaffold 等支撑。
- `packages/db` 对 Web 学习数据的 repository 边界比纯 mock 更实，但 Agent runtime 相关记录仍强制 `previewOnly=true`、`realExecutionEnabled=false`、`llmCallEnabled=false`。
- 独立 Desktop 软件端当前基本未实现 / 不可启动；`apps/desktop` 只有空的 `src` 目录，没有 `package.json`、Electron / Tauri / Wails 配置、入口文件、启动脚本或 build 脚本。
- Skill 方向已有 `ai-core` 中的 manifest 类型、校验、内存 registry、安装审查 helper，以及 Prisma schema 中的 `Skill` / `SkillToolRequirement` 模型；但没有 Web Skill 社区页面、真实上传 / 下载 / 安装 / 执行闭环、Skill repository、版本发布流程或社区分发流程。
- 整体产品当前应视为“Web MVP 与 Agent preview 原型阶段”，不是完整成品，也不能沿用历史局部阶段中的 “100%” 作为整体完成度。

## 2. 本次审计范围与方法

A128 被拆成五轮小审计，本文件在 A128-5 收束为最终版：

- A128-1 审计了 `apps`、根 scripts、workspace 配置和 Web routes 总览。
- A128-2 审计了 `/agent` 页面、preview 持久化、runtime detail、permission preview 与真实 Agent loop 缺口。
- A128-3 审计了 `learning` / `reader` / `books` / `import` 编程学习 Web MVP 链路。
- A128-4 审计了 `packages`，包括 `ai-core`、`db`、`book-engine`、`learning-engine`、`shared` 对当前产品主线的真实支撑程度。
- A128-5 审计了 Desktop / 软件端 Agent、Skill 社区，并汇总整体完成度和后续主线建议。

A128-5 读取的主线文档：

- `docs/README.md`
- `AGENTS.md`
- `docs/product/PRODUCT_SPEC.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/codex-tasks/CODEX_RULES.md`
- `docs/codex-tasks/DEVELOPMENT_ROADMAP.md`
- `docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md`

文档存在性记录：

- 上述 7 个本轮允许读取的主线文档均存在。
- `docs/status/REAL_PRODUCT_COMPLETION_AUDIT.md` 已包含 A128-1 到 A128-4 的阶段性审计内容，本轮只在其基础上补齐 A128-5 和最终总结。

A128-5 实际检查范围：

- `apps/desktop`、`apps/desktop/src`、`apps/desktop/package.json`。
- 根 `package.json` 中 desktop 相关 scripts。
- `pnpm-workspace.yaml` 中 desktop workspace 覆盖方式。
- Electron / Tauri / Wails 相关配置、入口、preload、main process、build / dev 线索。
- `apps/web/src/app` 中 skill / skills / community / marketplace 相关 route。
- `packages` 中 skill / registry / plugin 相关文件。
- `packages/db` 中 skill 相关 repository / mapper / type 线索。
- `packages/db/prisma/schema.prisma` 中 Skill 相关 model，只做只读检查。
- 全仓库轻量搜索 `skill`、`skills`、`community`、`marketplace`、`install`、`publish`、`upload`、`download`、`registry`、`plugin` 关键词；搜索排除了 `docs/archive/**` 和 `.env*`。

A128 全程明确没有做的事：

- 没有写业务代码。
- 没有修 bug。
- 没有新增依赖。
- 没有修改 schema。
- 没有运行 migrate、db push 或 prisma generate。
- 没有读取 `.env`、`.env.example`、`.env.local` 或任何 secret 文件。
- 没有读取外部参考项目源码。
- 没有读取 `docs/archive/**`。
- 没有调用真实 LLM。
- 没有调用 Spark API。
- 没有启动 Web。
- 没有运行浏览器验收。

## 3. apps 目录盘点

| App | 路径 | package.json 是否存在 | src 是否存在 | 启动脚本 | 当前状态 | 初步结论 |
|---|---|---:|---:|---|---|---|
| Web | `apps/web` | 是 | 是 | `next dev`，由根 `pnpm dev` 间接调用 | Next.js Web app 工作区包存在 | Web 具备从 package scripts 启动的入口；真实业务闭环需 A128-3 深审 |
| Desktop | `apps/desktop` | 否 | 是 | 未发现 | 目录存在，但缺少独立 package scripts 边界 | 本轮只能确认目录和 `src` 存在，不能确认 desktop 可启动 |

## 4. 根 package scripts 盘点

| 文件 | script | 命令 | 初步用途 | 备注 |
|---|---|---|---|---|
| `package.json` | `dev` | `pnpm --filter @learning-agent-platform/web dev` | 从 monorepo 根启动 Web app | `pnpm dev` 实际指向 Web 的 `next dev` |
| `package.json` | `typecheck` | `pnpm -r typecheck` | 递归运行 workspace typecheck | 依赖各 workspace 自己提供 `typecheck` |
| `package.json` | `lint` | `eslint .` | 根级 lint | 本轮未运行 |
| `package.json` | `build` | 未发现 | 未配置根构建脚本 | 本轮不补充脚本 |
| `package.json` | `test` | 未发现 | 未配置根测试脚本 | 本轮不补充脚本 |
| `package.json` | db / prisma | 未发现 | 未配置数据库脚本 | 本轮未运行任何数据库命令 |
| `apps/web/package.json` | `dev` | `next dev` | 启动 Web Next.js 开发服务 | 被根 `pnpm dev` 间接调用 |
| `apps/web/package.json` | `typecheck` | `tsc --noEmit` | Web 类型检查 | 本轮未运行 |
| `apps/web/package.json` | `lint` | `eslint .` | Web lint | 本轮未运行 |
| `apps/web/package.json` | `build` | 未发现 | Web 未配置 build 脚本 | 本轮不补充脚本 |
| `apps/web/package.json` | `test` | 未发现 | Web 未配置 test 脚本 | 本轮不补充脚本 |
| `apps/web/package.json` | db / prisma | 未发现 | Web 未配置数据库脚本 | 本轮未运行任何数据库命令 |
| `apps/desktop/package.json` | 全部 | 文件不存在 | 无法盘点 | `apps/desktop/src` 存在，但没有 package scripts |

补充判断：

- `pnpm-workspace.yaml` 包含 `apps/*` 和 `packages/*`。
- `pnpm dev` 实际启动 `@learning-agent-platform/web`，再执行 `next dev`。
- 本轮未发现 desktop 启动脚本。
- 本轮从根和 Web package scripts / dependencies 中未发现 Electron / Tauri / Wails 迹象。

## 5. Web 路由真实功能总览

| Route | 主要文件 | 路由类型 | 初步归类 | 是否需要后续深审 | 备注 |
|---|---|---|---|---:|---|
| `/` | `apps/web/src/app/page.tsx`；`apps/web/src/app/layout.tsx` | static page + layout | 首页 / Web MVP | 是 | 根布局存在；本轮未判断首页业务闭环 |
| `/books` | `apps/web/src/app/books/page.tsx`；`book-library-loader.ts`；`components/*` | static page | 书籍 | 是 | 有书籍列表相关文件；需要 A128-3 深审 |
| `/books/[bookId]` | `apps/web/src/app/books/[bookId]/page.tsx`；`book-detail-loader.ts`；`book-detail-types.ts` | dynamic page | 书籍详情 | 是 | 存在动态路由；需要 A128-3 深审 |
| `/reader` | `apps/web/src/app/reader/page.tsx`；`actions.ts`；`reader-qa-actions.ts`；`server-providers/*`；`components/*` | static page + server action files | 阅读器 | 是 | 文件名显示存在 reader QA 与进度相关能力，但本轮不做业务判断 |
| `/import` | `apps/web/src/app/import/page.tsx`；`actions.ts`；`BookImportPreviewClient.tsx`；`book-import-*`；`components/*` | static page + server action files | 导入 | 是 | 文件名显示存在导入预览 / 保存相关能力；需要 A128-3 深审 |
| `/learning` | `apps/web/src/app/learning/page.tsx`；`actions.ts`；`learning-*`；`recommendation-*`；`components/*` | static page + server action files | 学习仪表盘 | 是 | 文件名显示存在学习、推荐、能力档案和答题状态相关文件；需要 A128-3 深审 |
| `/agent` | `apps/web/src/app/agent/page.tsx`；`actions.ts`；`page.module.css`；`agent-preview-*`；`agent-permission-*`；`agent-runtime-*` | static page + server action files | Agent preview | 是 | 本轮只做路由总览，不做 `/agent` 深度审计 |
| `/agent/tasks/[taskId]` | `apps/web/src/app/agent/tasks/[taskId]/page.tsx`；`agent-preview-task-detail.ts`；`agent-preview-task-detail-panel.tsx` | dynamic page | Agent detail | 是 | 动态任务详情页；留给 A128-2 |
| `/agent/runtime/[executionId]` | `apps/web/src/app/agent/runtime/[executionId]/page.tsx`；`_lib/runtime-preview-detail-loader.ts`；`_components/runtime-preview-detail.tsx` | dynamic page | Agent runtime detail | 是 | 动态 runtime 详情页；留给 A128-2 |
| `/agent/permissions/[permissionRequestId]` | `apps/web/src/app/agent/permissions/[permissionRequestId]/page.tsx`；`agent-permission-preview-detail.ts`；`agent-permission-preview-detail-panel.tsx` | dynamic page | Agent permission detail | 是 | 动态权限请求详情页；留给 A128-2 |

路由结构补充记录：

- 本轮扫描未发现 `apps/web/src/app/**/route.ts` 或 `route.tsx`。
- 本轮扫描未发现 `loading.tsx`、`error.tsx`、`not-found.tsx`。
- 本轮确认存在动态路由：`/books/[bookId]`、`/agent/tasks/[taskId]`、`/agent/runtime/[executionId]`、`/agent/permissions/[permissionRequestId]`。
- 本轮只做路由级别盘点，不把 preview / mock / scaffold 说成真实生产能力。

## 6. /agent 页面专项审计

### 6.1 /agent 路由与文件结构

| 项目 | 路径 / 文件 | 作用 | 备注 |
|---|---|---|---|
| `/agent` 页面入口 | `apps/web/src/app/agent/page.tsx` | 组装 Agent 工作区预览页面；调用 task / tool / skill / memory / readiness / permission preview factory；加载三类 history | 主页面是 server component；未发现真实执行入口 |
| `/agent/tasks/[taskId]` 动态路由 | `apps/web/src/app/agent/tasks/[taskId]/page.tsx` | 只读展示已保存任务预览详情 | 通过 `loadAgentPreviewTaskDetail` 读取 task、snapshot、event |
| `/agent/runtime/[executionId]` 动态路由 | `apps/web/src/app/agent/runtime/[executionId]/page.tsx` | 只读展示 runtime preview detail | 明确提示不是实际运行系统；取消、超时、重试只是策略预览 |
| `/agent/permissions/[permissionRequestId]` 动态路由 | `apps/web/src/app/agent/permissions/[permissionRequestId]/page.tsx` | 只读展示权限请求预览和权限决策预览 | 明确不是真实权限请求、用户决策或授权记录 |
| server action | `apps/web/src/app/agent/actions.ts` | `saveAgentTaskPreview` 显式保存任务预览 record、snapshot、event | 仅 preview persistence；返回 `llmCalled=false`、`toolsExecuted=false` 等标记 |
| server action | `apps/web/src/app/agent/agent-permission-preview-save-action.ts` | `saveAgentPermissionPreview` 显式保存权限请求 / 决策预览 | `permissionFlowEnabled=false`、`decisionCaptured=false` |
| server action | `apps/web/src/app/agent/agent-runtime-preview-save-action.ts` | `saveMockRuntimePreviewAction` 保存 mock runtime preview record | 使用 `createRuntimeMockPreviewPlan` 与 `PrismaAgentRuntimeMockRunnerPreview.persistMockRuntimePreview` |
| runtime mock plan helper | `apps/web/src/app/agent/_lib/runtime-mock-preview-plan.ts` | 构造 mock runtime preview execution、step、tool call、LLM call、event、audit event | 工具和 LLM 均为 preview 记录，不执行 |
| history loader | `agent-preview-history.ts`、`agent-permission-preview-history.ts`、`agent-runtime-preview-history.ts` | 读取已保存 preview history | 都通过 `hasDatabaseUrl()` 和 Prisma repository 边界读取 |
| detail loader | `agent-preview-task-detail.ts`、`agent-permission-preview-detail.ts`、`runtime/[executionId]/_lib/runtime-preview-detail-loader.ts` | 读取 task / permission / runtime preview detail | runtime detail 只展示 `previewOnly=true`、`executable=false`、`realExecutionEnabled=false` 的记录 |
| UI 面板 | `agent-*-panel.tsx`、`runtime-preview-detail.tsx`、`runtime-preview-safety-labels.tsx` | 展示预览状态、保存结果、历史、详情、安全说明 | 本轮未发现从 `/agent` 直接 import `apps/web/src/components/**` |
| route handler | 未发现 | 未发现 `/agent/**/route.ts` 或 `route.tsx` | `/agent` 没有 API route handler |
| layout / loading / error / not-found | 未发现 | 未发现 `/agent/**/layout.tsx`、`loading.tsx`、`error.tsx`、`not-found.tsx` | 仅使用页面与局部组件 |

### 6.2 /agent 已有 UI 能力

| 能力 | 当前表现 | 数据来源 | 状态判断 | 备注 |
|---|---|---|---|---|
| Agent runtime preview | 可保存一条 mock runtime preview，并展示运行历史和详情 | `createRuntimeMockPreviewPlan`、`PrismaAgentRuntimeMockRunnerPreview`、runtime repository | preview persistence | 不是 runtime runner；保存的是 mock preview record |
| runtime preview history | `/agent` 展示最近 runtime preview records | `loadAgentRuntimePreviewHistory` -> `PrismaAgentRuntimeRepository.listRuntimeExecutionsByUser` | preview persistence | userId 固定为 `runtime_preview_demo_user` |
| runtime preview detail | `/agent/runtime/[executionId]` 展示 execution、steps、tool calls、LLM calls、events、audit logs、errors | `loadAgentRuntimePreviewDetail` -> runtime repository | preview persistence | 只展示 preview-only 且不可执行记录 |
| mock runtime preview save / persistence | 用户可点按钮保存 mock runtime preview | `saveMockRuntimePreviewAction` -> DB mock runner preview persistence | mock / preview persistence | 持久化步骤、工具调用预览、模型调用预览、事件和审计预览，不代表真实运行 |
| task preview | 输入 query task 后生成任务计划预览、步骤、风险、所需工具 | `createAgentTaskPlanPreview` | preview | 纯确定性 preview，`executable=false` |
| tool requirement preview | 展示工具需求审查、候选工具、风险、确认需求 | `createAgentToolRequirementReviewPreview` + disabled tool metadata | preview / disabled | 工具元数据全部 `enabled=false`，没有注册或执行真实工具 |
| Skill suggestion preview | 展示匹配到的内置 preview Skill manifest | `createAgentSkillSuggestionPreview` + 本页静态 `previewSkillManifests` | preview / scaffold | 只是建议，不生成、安装、下载或运行 Skill |
| memory context preview | 展示 profile / session / retrievable 三类候选记忆和选中摘要 | `createAgentMemoryContextPreview` + 本页静态 `previewCandidateMemorySnippets` | preview / mock | 未执行真实记忆检索、压缩或写入 |
| permission preview | 展示 permission request preview 和 decision preview | `createAgentPermissionRequestPreview`、`createAgentPermissionDecisionPreview` | preview | 不捕获真实用户决策，不授予权限 |
| permission preview save / history / detail | 可保存权限请求 / 决策预览，并查看历史和详情 | `saveAgentPermissionPreview`、`PrismaAgentPermissionRepository` | preview persistence | repository 强制 `permissionFlowEnabled=false`、`decisionCaptured=false` |
| runtime execution preview | 展示 execution readiness、blockers、warnings、missing requirements、boundary | `createAgentExecutionReadinessPreview` | preview | 不启动执行；真实执行边界全部显示已禁用 |
| tool call preview | runtime detail 可展示工具调用预览数量和每条工具调用预览 | mock runtime plan + runtime repository | preview persistence | 工具调用状态是 blocked / preview，`toolExecutionEnabled=false` |
| tool sandbox preview | runtime detail 展示 `sandboxRequired` 等沙箱需求预览标记 | mock runtime tool call preview record | preview | 只是风险与沙箱需求标记，不是实际 sandbox |
| LLM call preview | 页面展示模型提供方预览；runtime detail 展示模型调用预览记录 | `mockChapterQaProviderStatus`、mock runtime LLM call preview | preview / mock | `providerKind=mock`、`llmCallEnabled=false`，未调用真实模型 |
| Spark diagnostic 展示 | 本轮 `/agent` 范围内未发现 Spark / diagnostic 字样 | `/agent` 直接路径搜索 | 未发现 | 不能把其他页面或未来能力推断为 `/agent` 能力 |
| audit log preview | runtime detail 展示审计预览记录 | mock runtime audit event + runtime repository | preview persistence | `productionAuditEnabled=false`，不是生产级审计日志 |
| event preview | 任务预览保存会写 preview event；runtime detail 展示运行事件预览 | task repository / runtime repository | preview persistence | 不是后台任务事件或真实状态机事件 |
| safety boundary / disabled / mock 提示 | UI 多处标注仅预览、真实执行已禁用、未执行工具、未调用模型、无副作用 | 页面文案、面板文案、结果 flag | preview / disabled | 整体表达较诚实，但复杂界面仍有误解风险 |
| 用户触发真实执行 | 未发现可触发真实 Agent 执行的控件 | `/agent` 页面和直接 actions | 未发现 | 保存按钮只保存 preview record |
| 用户触发真实 LLM 业务调用 | 未发现真实业务模型调用入口 | `/agent` 页面、actions、runtime mock plan | 未发现 | mock provider / LLM preview 不等于业务 LLM 调用 |
| 用户触发真实工具调用 | 未发现真实工具调用入口 | `/agent` 页面、actions、tool metadata | 未发现 | 工具全部 disabled / preview-only |

### 6.3 /agent 数据来源与持久化

| 数据 / 动作 | 调用路径 | 是否持久化 | 持久化类型 | 是否真实业务能力 | 备注 |
|---|---|---:|---|---:|---|
| 任务计划预览 | `page.tsx` -> `createAgentTaskPlanPreview` | 否 | none | 否 | 基于任务文本和关键词生成确定性预览 |
| 工具需求审查预览 | `page.tsx` -> `createAgentToolRequirementReviewPreview` | 否 | none | 否 | 候选工具来自本页 disabled metadata |
| Skill 建议预览 | `page.tsx` -> `createAgentSkillSuggestionPreview` | 否 | none | 否 | 使用本页静态 Skill manifest，不连接社区 |
| 记忆上下文预览 | `page.tsx` -> `createAgentMemoryContextPreview` | 否 | none | 否 | 使用静态候选记忆，未执行检索或压缩 |
| execution readiness preview | `page.tsx` -> `createAgentExecutionReadinessPreview` | 否 | none | 否 | 只计算 readiness / blockers / warnings |
| permission request / decision preview | `page.tsx` -> `createAgentPermissionRequestPreview` / `createAgentPermissionDecisionPreview` | 否 | none | 否 | 不捕获真实用户确认 |
| 保存任务预览 | `AgentPreviewSavePanel` -> `saveAgentTaskPreview` -> `PrismaAgentTaskRepository.createPreviewTask`、`appendSnapshot`、`appendEvent` | 是 | runtime preview persistence / task preview persistence | 否 | 写入 preview task、combined snapshot、preview_created event |
| 读取任务预览历史 | `loadAgentPreviewHistory` -> `listRecentPreviewTasks` | 是 | preview history read | 否 | 只读 `mode=preview_only` 记录 |
| 读取任务预览详情 | `loadAgentPreviewTaskDetail` -> `getTaskById`、`listSnapshotsByTask`、`listEventsByTask` | 是 | preview detail read | 否 | 映射时保持 `realExecutionEnabled=false` |
| 保存权限预览 | `AgentPermissionPreviewSavePanel` -> `saveAgentPermissionPreview` -> `PrismaAgentPermissionRepository` | 是 | permission preview persistence | 否 | 写入 request / decision preview，不授予权限 |
| 读取权限历史 / 详情 | `loadAgentPermissionPreviewHistory` / `loadAgentPermissionPreviewDetail` -> permission repository | 是 | permission preview history/detail read | 否 | 只读 preview request / decision |
| 保存 mock runtime preview | `AgentRuntimePreviewSavePanel` -> `saveMockRuntimePreviewAction` -> `createRuntimeMockPreviewPlan` -> `PrismaAgentRuntimeMockRunnerPreview.persistMockRuntimePreview` | 是 | mock preview persistence | 否 | 可限制保存 `maxSteps=3`、`maxToolCalls=2`、`maxLlmCalls=1` 等子记录数量；不是执行控制 |
| 读取 runtime preview history | `loadAgentRuntimePreviewHistory` -> `PrismaAgentRuntimeRepository.listRuntimeExecutionsByUser` | 是 | runtime preview persistence read | 否 | 读取 demo runtime preview user 记录 |
| 读取 runtime preview detail | `loadAgentRuntimePreviewDetail` -> `getRuntimeExecutionById` + steps / tool calls / LLM calls / events / audit logs | 是 | audit/event summary / runtime preview detail read | 否 | 拒绝展示非 preview-only 或 real execution enabled 的记录 |
| LLM provider preview status | `agent-status.ts` -> `mockChapterQaProviderStatus` | 否 | none | 否 | 展示 mock provider 状态，不发起模型请求 |
| DB 可用性判断 | `hasDatabaseUrl()`、`getPrismaClient()` | 否 | unclear | 否 | 只作为 preview persistence 是否可用的边界；本轮未读取 `.env` 文件 |
| Spark / diagnostic | 本轮未发现 `/agent` 直接调用 | 否 | none | 否 | 不能视为 `/agent` 业务能力 |

### 6.4 preview / mock / scaffold 能力清单

1. Runtime preview：`/agent` 能构造和保存 mock runtime preview，并展示 runtime history/detail；但它没有 runner、没有循环、没有后台任务、没有真实工具或模型调用，因此不是完整生产 runtime。
2. Permission preview：页面能生成并保存 permission request / decision preview；但 `permissionFlowEnabled=false`、`decisionCaptured=false`，不捕获用户真实决策，也不授予权限，因此不是权限确认闭环。
3. Tool preview：页面能展示所需工具、风险、候选工具和 blocked reason；但工具元数据均为 disabled，`toolExecutionEnabled=false`，没有真实工具注册、调度或执行。
4. Tool sandbox preview：runtime tool call detail 展示 `sandboxRequired`；但只是风险标记和未来需求说明，不是实际 sandbox、隔离执行或权限沙箱。
5. LLM call preview：页面展示 mock provider status，runtime detail 可显示 LLM call preview record；但 `llmCallEnabled=false`、`providerKind=mock`，没有真实业务模型调用。
6. Spark diagnostic：本轮 `/agent` 直接范围内未发现 Spark / diagnostic 展示或调用。
7. Audit / event preview：task preview 和 runtime preview 都可写入或读取事件 / 审计预览；但 runtime detail 明确 `productionAuditEnabled=false`，这些不是生产级审计日志。
8. Save mock runtime preview record：`saveMockRuntimePreviewAction` 可以把 mock runtime preview plan 写入数据库；但保存的是预览结构，不代表 Agent 已运行，也不是执行日志闭环。
9. Memory context preview：页面展示三层记忆候选数据；但候选数据来自静态 preview，未执行真实 memory retrieval、session memory 写入、long-term memory 管理或 compaction。
10. Skill suggestion preview：页面展示可匹配的 preview Skill manifest；但不会生成、安装、下载、执行或连接 Skill 社区。

### 6.5 尚未发现的真实 Agent 能力

| 能力 | 本轮判断 | 依据 / 说明 |
|---|---|---|
| 真实 Agent loop | 未发现 | `/agent` 只调用 preview factory 和 save / load preview actions；未发现循环式 Agent 执行入口 |
| 真实 runner | 未发现 | `agent-status.ts` 明确该页面没有接入 `AgentRuntime.respond` 调用；runtime mock runner 仅持久化 mock preview |
| 自动任务循环 | 未发现 | 未发现后台自动循环、计划推进或 autonomous loop |
| step-by-step 执行循环 | 未发现 | runtime detail 展示 step preview records，但没有逐步执行器 |
| max steps | preview / mock / scaffold | `saveMockRuntimePreviewAction` 的 `maxSteps=3` 只是保存 mock child records 的上限，不是运行时执行控制 |
| cancellation | preview / scaffold | runtime detail 文案提到取消只是策略预览；未发现真实取消接口 |
| timeout | preview / scaffold | runtime detail 文案提到超时只是策略预览；未发现真实 timeout 控制 |
| retry | preview / scaffold | runtime detail 文案提到重试只是策略预览；未发现真实 retry 机制 |
| 真实工具执行 | 未发现 | 工具 metadata `enabled=false`；UI 和 actions 均返回未执行工具 |
| 后台任务队列 | 未发现 | runtime flags 中 `backgroundJobEnabled=false`；未发现 queue/job 调度 |
| 权限确认闭环 | preview / mock / scaffold | 有 permission request / decision preview 和 persistence，但 `permissionFlowEnabled=false`、`decisionCaptured=false` |
| 真实业务 LLM 对话入口 | 未发现 | `/agent` 只展示 mock provider / LLM call preview；未调用 provider |
| real LLM provider call in business path | 未发现 | `llmCalled=false`、`llmCallEnabled=false`；未发现 Spark 或其他 provider 调用 |
| 成本控制 | 未发现 | runtime LLM detail 可展示估算 token 数，但未发现成本计算、预算或账单控制 |
| rate limit | 未发现 | `/agent` 直接范围内未发现限流策略或调用 |
| memory retrieval | preview / mock / scaffold | memory context preview 使用静态候选记忆；未执行真实检索 |
| memory compaction | 未发现 | `/agent` 直接范围内未发现压缩执行逻辑 |
| context reconstruction | 未发现 | 只展示预览上下文摘要，未发现真实上下文重建流程 |
| session memory | preview / mock / scaffold | 静态候选里有 session 层预览元数据；未发现真实 session memory 写入 / 读取 |
| long-term memory | 未发现 | 本轮 `/agent` 范围内未发现长期记忆生产路径 |
| audit log production path | preview / mock / scaffold | 有 audit preview record；runtime detail 标注不是生产级审计日志，`productionAuditEnabled=false` |
| error recovery | 未发现 | runtime detail 有错误预览字段摘要；未发现恢复、重试或补偿执行机制 |

### 6.6 /agent 安全边界与用户误解风险

`/agent` UI 对 preview / mock / disabled 的表达总体较诚实：主页面、保存面板、历史面板和详情页多次标注“仅预览”“真实执行已禁用”“未执行工具”“未调用模型”“不会产生真实副作用”。任务详情、权限详情和 runtime 详情也都强调只读展示，且不会执行智能体任务、工具、模型调用、网络请求、记忆检索或 Skill 操作。

仍需记录一个用户误解风险：`/agent` 页面已经有保存按钮、历史记录、运行详情、工具调用预览、模型调用预览、审计预览和事件预览，界面形态较接近真实运行控制台。虽然文案多数已经说明 disabled / preview-only，但用户如果只看标题或列表，仍可能误以为 Agent runtime、工具调用、权限请求或 LLM 调用已经真实运行。后续可开启 A129 或专门文案任务，继续压低“预览台看起来像生产执行器”的误解风险。

### 6.7 /agent 阶段性结论

- `/agent` 已经具备较丰富的 Agent Runtime Preview 展示与部分 preview persistence。
- `/agent` 更像是 Agent 能力展示台 / 安全骨架验证台，而不是完整真实 Agent 执行器。
- 本轮范围内不能确认存在完整真实 Agent loop。
- 本轮范围内不能确认存在完整后台工具调用系统。
- 本轮范围内不能确认存在三层记忆压缩系统；页面展示的是静态候选记忆和 memory context preview。
- 本轮范围内不能把 Spark diagnostic、mock provider status 或 LLM call preview 视为真实业务 LLM 接入。
- 保存 preview record 不等于真实 Agent 执行日志闭环；runtime detail 页面也不是真实 runner。
- `/agent` 后续应在 Web MVP 打磨后，逐步进入 Desktop Agent MVP 和真实 Agent loop 设计。

## 7. 编程学习 Web MVP 审计

### 7.1 编程学习相关路由与文件结构

| 模块 | Route | 主要文件 | 作用 | 备注 |
|---|---|---|---|---|
| 首页学习入口 | `/` | `apps/web/src/app/page.tsx` | 提供 `/books`、`/reader`、`/learning`、`/import` 入口 | 首页文案仍写有“AI 提问入口仍保持禁用”，与 reader 当前 server action / provider scaffold 状态不完全同步 |
| books / book | `/books` | `apps/web/src/app/books/page.tsx`；`book-library-loader.ts`；`components/BookLibrary*` | 数据库已保存书籍列表 | 使用 `PrismaBookRepository.listBooks`，无本地 mock 书库列表 |
| books / book | `/books/[bookId]` | `apps/web/src/app/books/[bookId]/page.tsx`；`book-detail-loader.ts`；`book-detail-types.ts` | 书籍详情、章节列表、演示用户进度摘要 | 动态路由存在；链接到 `/reader?bookId=...` 和 `/reader?bookId=...&chapterId=...` |
| books / book | `/book` | 未发现 | 单数 book 路由 | `apps/web/src/app/book` 不存在 |
| reader | `/reader` | `apps/web/src/app/reader/page.tsx`；`actions.ts`；`reader-qa-actions.ts`；`reader-ai-runtime-config.ts`；`server-providers/*`；`components/*` | 阅读器、章节导航、进度保存、章节问答入口 | 数据库优先，失败时 `mock_fallback`；无 route handler |
| import | `/import` | `apps/web/src/app/import/page.tsx`；`BookImportPreviewClient.tsx`；`actions.ts`；`book-import-*`；`components/*` | 纯文本导入预览和显式保存 | 客户端预览调用 book-engine；服务端 action 保存 Book / Chapter / Chunk |
| learning | `/learning` | `apps/web/src/app/learning/page.tsx`；`actions.ts`；`learning-*`；`reading-progress-*`；`problem-attempt-*`；`recommendation-*`；`components/*` | 学习仪表盘、能力画像、每日推荐、题目尝试信号 | `dynamic = "force-dynamic"`；数据库优先，失败时 mock fallback |

补充记录：

- 本轮未发现 `apps/web/src/app/books/**`、`reader/**`、`import/**`、`learning/**` 下的专属 `layout.tsx`、`loading.tsx`、`error.tsx`、`not-found.tsx`。
- 本轮未发现上述学习路由下的 `route.ts` / `route.tsx` route handler。
- 本轮发现的 server action 文件包括 `reader/actions.ts`、`reader/reader-qa-actions.ts`、`reader/reader-qa-feedback-actions.ts`、`import/actions.ts`、`learning/actions.ts`。

### 7.2 books / book 书籍模块审计

| 能力 | 当前表现 | 数据来源 | 状态判断 | 备注 |
|---|---|---|---|---|
| 书籍列表 | `/books` 调用 `loadBookLibrary({ limit: 20 })` 展示已保存书籍 | `PrismaBookRepository.listBooks`；依赖 `DATABASE_URL` | 部分实现 | 数据库不可用时显示不可用/空状态，不提供 mock 书库列表 |
| 书籍详情 | `/books/[bookId]` 读取单本书元数据、统计和章节 | `PrismaBookRepository.getBookReaderData` | 部分实现 | 缺少书籍 ID、数据库不可用、未找到书籍、读取失败都有状态 |
| 动态 bookId 路由 | 存在 `/books/[bookId]` | Next.js App Router 动态参数 | 已实现 | 无单数 `/book` 路由 |
| 章节列表 | 详情页按章节显示标题、层级、chunk 数和字符数 | 数据库 BookChapter / ContentChunk 映射 | 已实现 | 只读展示 |
| 章节入口 | 每章提供“打开章节”链接到 reader | `/reader?bookId=...&chapterId=...` | 已实现 | 与 reader 查询参数对接 |
| 创建书籍 | books 页面本身无创建表单；可从 `/import` 进入导入 | import server action | 部分实现 | 创建入口在 import，不在 books CRUD 中 |
| 导入后展示书籍 | import 保存成功返回详情、reader、书库链接 | `createBookImportSaveResultLinks` | 部分实现 | 依赖数据库保存成功 |
| 保存书籍 | 通过 `/import` 保存 Book / Chapter / Chunk | `PrismaBookRepository.createBookWithContent` | 部分实现 | 只支持纯文本导入结果 |
| 编辑书籍 | 未发现编辑入口或 action | 未发现 | 未发现 | 本轮未发现 update book 能力 |
| 删除书籍 | 未发现删除入口或 action | 未发现 | 未发现 | 本轮未发现 delete book 能力 |
| 持久化 | 已保存书籍、章节、chunk 可写入数据库并读取 | `packages/db` repository | 部分实现 | 没有认证用户边界；读写依赖 `DATABASE_URL` |
| “书籍 -> 章节 -> 阅读”链路 | 书库详情页可进入具体章节阅读 | DB book / chapter / chunk -> reader | 部分形成 | 对已保存数据库书籍成立；不覆盖所有导入来源和用户进度恢复场景 |

### 7.3 reader 阅读器模块审计

| 能力 | 当前表现 | 数据来源 | 状态判断 | 备注 |
|---|---|---|---|---|
| 阅读器页面 | `/reader` 存在并渲染 reader layout | `apps/web/src/app/reader/page.tsx` | 已实现 | 数据库优先，失败时 mock fallback |
| 内容展示 | 显示当前章节标题和正文段落 | DB chunks 合并为 `plainText`；或 `sampleBook` mock | 部分实现 | 数据库书籍无章节时显示不可读状态 |
| 章节内容 | 当前章节来自 query 解析后的选择结果 | `resolveReaderChapterSelection` + `readerData.chapters` | 部分实现 | 默认章节来自数据源首章；指定 `chapterId` 可切换 |
| 章节切换 | 左侧章节导航链接包含 `bookId` 和 `chapterId` | `ReaderChapterNavigation` | 已实现 | 链接式切换，不是复杂阅读状态机 |
| 阅读进度展示 | 按章节位置估算百分比；Ask AI 上下文使用 mock reading progress | `ReadingProgressSaveForm`；`getMockReadingProgress` | 部分实现 / mock | 展示值不是精确滚动位置 |
| 阅读进度保存 | 数据库来源时可保存演示用户 ReadingProgress | `saveReaderProgressAction` + `PrismaReadingProgressRepository.upsertReadingProgress` | 部分实现 | 只对 `source === "database"` 生效；当前页面传入 `progressRatio={1}`，更接近保存当前章节完成状态 |
| 阅读笔记 / 标注 / 高亮 | 未发现入口 | 未发现 | 未发现 | 本轮未发现 notes / annotations / highlights |
| 阅读时问答入口 | 右侧 `AskAiPanel` 可提交问题 | `askChapterQuestionAction` | 部分实现 | 默认 mock provider；server action 有校验和 provider 状态 |
| 问答结合当前书籍 | 问答上下文包含 `bookTitle`、`bookId` 用于保存身份 | reader page props + QA context | 部分实现 | 用于当前问题上下文，不是全书检索 |
| 问答结合当前章节 | 上下文包含 `chapterTitle`、`chapterText`、nearby chunks | `buildReaderChapterQaContext` / `buildChapterQaContext` | 部分实现 | 属于 current chapter context，不是 RAG |
| 问答结合学习进度 | 传入的是 `getMockReadingProgress` 结果 | `apps/web/src/lib/mock-learning-context.ts` | mock | 没有使用已保存 ReadingProgress 构造问答上下文 |
| 问答结合历史表现 | 传入的是 `mockAbilityProfile` | `apps/web/src/lib/mock-learning-context.ts` | mock | 没有使用真实能力画像或历史表现 |
| 真实 LLM 调用 | 存在 OpenAI-compatible provider 分支 | `AI_PROVIDER_MODE=openai`、`AI_PROVIDER_NETWORK_ENABLED=true`、`OPENAI_API_KEY`、`OPENAI_MODEL` | controlled diagnostic call / scaffold | 默认不启用；本轮未调用真实 LLM |
| 默认问答 | 默认 provider mode 为空时解析为 mock | `resolveChapterQaProviderRuntimeConfig` | mock | 安全默认：real AI disabled，network not used |
| RAG / embedding / vector search | 未发现 reader 直接路径使用 embedding 或 vector search | 未发现 | 未发现 | OpenAI provider limitation 明确写有 no RAG / embeddings |
| 问答历史保存 | 数据库 reader 且 demo 用户存在时 best-effort 保存问答历史 | `PrismaChapterQaHistoryRepository` | 部分实现 | mock reader 不保存；保存的是问答记录和安全 metadata |
| 问答反馈 | 已保存历史记录可保存 helpful / neutral / unhelpful | `PrismaChapterQaFeedbackRepository` | 部分实现 | 后续 learning 可将反馈映射为学习信号 |

### 7.4 import 导入模块审计

| 能力 | 当前表现 | 数据来源 / 处理路径 | 状态判断 | 备注 |
|---|---|---|---|---|
| 导入页面 | `/import` 存在 | `apps/web/src/app/import/page.tsx` | 已实现 | 明确“本地预览，显式保存” |
| 文本导入 | 支持粘贴纯文本、填写书名、作者、语言和 chunk 参数 | `BookImportPreviewClient` + `importPlainTextBook` | 部分实现 | 内容限制 20 到 200,000 字符 |
| Markdown 导入 | 未发现独立 Markdown 解析；纯文本 heading 可被识别 | `detectChapterHeading` / plain text chaptering | 部分实现 | 可识别类似章节标题，但不是完整 Markdown 导入体验 |
| URL 导入 | 页面明确不会抓取 URL / HTML | 无 | 未发现 | `BookSourceType` 有 `imported_url` 类型，但本轮直接路径未发现 URL 导入实现 |
| 文件导入 | 页面明确不会上传文件或解析 PDF / EPUB / HTML | 无 | 未发现 | 无 file input |
| 章节解析 | 根据 plain text heading 生成章节；无 heading 时 fallback 为单章 | `buildChaptersFromPlainText` | 部分实现 | 基于规则，不是语义章节生成 |
| chunk 切分 | 按字符长度、段落/换行/空格边界切分，并支持 overlap | `chunkChaptersByCharacters` | 部分实现 | 可用于阅读和后续上下文，但本轮未确认 embedding |
| 导入预览 | 本地页面状态展示章节和 chunk 预览 | `buildImportPreviewViewModel` | 已实现 | 只预览前若干章节和 chunk |
| 保存导入结果 | 生成预览后可显式保存 | `saveImportedPlainTextBookAction` | 部分实现 | 服务端会重新 import 同一份输入后保存 |
| 写入 DB | 写入 Book、Chapter、ContentChunk | `PrismaBookRepository.createBookWithContent` | 部分实现 | 依赖 `DATABASE_URL`；失败返回结构化状态 |
| 创建 book / chapter | 保存成功创建书籍与章节 | `createBookRepositoryInputFromImportedBook` | 部分实现 | 不保存 ReadingProgress、User、Learning、Recommendation 或 AI 数据 |
| 从导入结果进入 reader | 保存成功状态展示“开始阅读”链接 | `/reader?bookId=...` | 部分形成 | 仅保存成功后成立 |
| 错误处理 | 有表单校验、数据库不可用、保存失败状态 | client validation + server action result | 部分实现 | catch 不暴露底层细节 |
| 安全边界 | 页面明确不调用 AI、不读 URL、不上传文件、不建 migration / seed / session | UI 文案 + server action 边界 | 已实现 | 本轮未发现真实 LLM 或外部 API 调用 |

### 7.5 learning 学习仪表盘审计

| 能力 | 当前表现 | 数据来源 | 状态判断 | 备注 |
|---|---|---|---|---|
| 学习仪表盘 | `/learning` 存在，动态渲染 | `getLearningDashboardPageData` | 已实现 | 数据库优先，失败时 mock fallback |
| 学习进度 | 展示 ReadingProgress 信号摘要 | `PrismaReadingProgressRepository.listReadingProgress` 或 mock | 部分实现 | 可映射为 learning event；依赖 demo 用户 |
| 能力分数 | 展示已保存 AbilityProfile，或用 learning-engine 做内存态预览 | `PrismaLearningRepository.getAbilityProfile`；`calculateAbilityProfile` | 部分实现 | 无已保存画像时可由阅读进度 / 问答反馈预览计算 |
| 能力分数真实计算 | 可从 ReadingProgress、QA feedback、ProblemAttempt 映射成事件后计算 | `calculateAbilityProfile` | 部分实现 | 仍是演示用户和手动触发保存，不是完整生产用户模型 |
| 能力画像保存 | 有显式保存按钮和 server action | `recomputeAndSaveLearningAbilityProfile` | 部分实现 | 保存前需要数据库、demo 用户和有效学习事件 |
| 每日题单 | 展示数据库已保存推荐，或 engine preview / mock fallback | `getDailyRecommendations`；`recommendDailyProblems` | 部分实现 | 无候选题或画像时不可用 |
| 每日题单真实推荐 | 可基于能力画像、候选题和最近 ProblemAttempt 计算并保存 | `recomputeAndSaveDailyRecommendation` | 部分实现 | 需要显式触发；不是自动刷新推荐闭环 |
| 结合用户历史表现 | 读取最近 ProblemAttempt 和 QA feedback 信号 | `PrismaProblemAttemptRepository`；QA feedback loader | 部分实现 | 固定 demo 用户；ProblemAttempt 保存后不会自动重算画像和推荐 |
| 结合章节学习情况 | ReadingProgress 可进入能力预览和保存流程 | ReadingProgress -> LearningEvent | 部分实现 | reader 问答上下文仍用 mock progress，但 learning 仪表盘可读 DB 进度 |
| 学习计划 | 未发现独立学习计划模型或页面 | 未发现 | 未发现 | 当前主要是仪表盘和推荐题 |
| 复习推荐 | 未发现独立复习推荐逻辑 | 未发现 | 未发现 | 每日题单可能覆盖部分练习，但非复习系统 |
| 算法题训练入口 | 每日推荐列表和题目尝试保存控件存在 | `LearningDailyRecommendationListWithAttemptStatus`；`LearningProblemAttemptSaveControls` | 部分实现 | 不是完整在线判题或训练环境 |
| 持久化 | AbilityProfile、DailyRecommendation、ProblemAttempt 可保存 | `PrismaLearningRepository`；`PrismaProblemAttemptRepository` | 部分实现 | 显式保存，且依赖 `DATABASE_URL` 与 demo 用户 |
| “阅读 -> 学习数据 -> 推荐”闭环 | ReadingProgress 可映射为能力事件，能力画像可用于推荐 | reader progress save + learning dashboard actions | 部分形成 | 需要手动保存/重算；还不是自动闭环 |

### 7.6 编程学习核心闭环判断

| 闭环 | 当前状态 | 判断依据 | 主要缺口 |
|---|---|---|---|
| 导入闭环：文本 / 网页 / 文件导入 -> 解析书籍 -> 生成章节 -> 保存 -> 展示到 books -> 可阅读 | 部分形成 | 纯文本导入可生成章节和 chunk，保存 Book / Chapter / Chunk 后可进入 `/books` 和 `/reader` | 不支持 URL / 文件 / PDF / EPUB；无后台导入任务、导入状态表、重试和人工校正闭环 |
| 阅读闭环：选择书籍 -> 进入章节 -> 阅读内容 -> 保存进度 -> 下次恢复 | 部分形成 | `/books/[bookId]` 可进入章节；reader 可显示 DB 内容；可保存 demo 用户 ReadingProgress；详情页可给继续阅读链接 | reader 默认不自动按已保存进度恢复；进度保存粒度偏章节完成；无真实用户身份和精确位置追踪 |
| 章节问答闭环：当前书籍 / 当前章节 -> 用户提问 -> 检索或构造上下文 -> LLM 回答 -> 安全记录 | UI 已有但数据未完整闭环 | AskAiPanel 构造当前章节上下文；默认 mock provider；OpenAI-compatible 分支受环境开关控制；数据库 reader 可保存问答历史和反馈 | 默认不是真实 LLM；无 RAG、embedding、vector search；学习进度和能力画像进入 QA 的部分仍是 mock |
| 学习能力闭环：阅读进度 / 做题表现 / 历史表现 -> 计算能力分数 -> 展示趋势 -> 推荐每日题单 | 部分形成 | learning 可读取 ReadingProgress、QA feedback、ProblemAttempt；可用 learning-engine 计算并显式保存 AbilityProfile；可推荐每日题 | 无趋势视图；固定 demo 用户；多个步骤需要手动触发；ProblemAttempt 后不会自动更新画像和题单 |
| 推荐闭环：用户能力模型 -> 题目/章节推荐 -> 用户反馈 -> 更新模型 | 部分形成 | DailyRecommendation 可由 AbilityProfile、候选题、ProblemAttempt history 计算；题目尝试可保存；能力画像可重算 | 没有自动反馈循环；未发现章节推荐；候选题来源和用户目标仍有限；无完整训练/判题体验 |

### 7.7 Web MVP 用户可验收程度

当前用户可实际体验的学习功能：

- 打开 Web 首页后能看到学习产品主入口，并进入书库、阅读器、学习面板和书籍导入。
- 在数据库配置且已有数据时，用户可以看到已保存书籍列表、书籍详情、章节列表，并进入对应章节阅读。
- 即使数据库不可用，reader 和 learning 也有 mock fallback，可用于展示页面骨架和交互形态。
- 用户可以在 `/import` 粘贴纯文本生成章节和 chunk 预览；数据库可用时可以保存为 Book / Chapter / Chunk，并从保存结果进入书库或阅读器。
- 用户可以在 reader 中提交章节问题；默认得到明确标记的 mock 回答，真实 OpenAI-compatible 调用必须由服务端环境显式开启。
- 数据库可用且 demo 用户存在时，用户可以保存阅读进度、问答历史、问答反馈、能力画像、每日推荐和题目尝试。

当前适合展示的能力：

- Web 学习端的主要页面骨架。
- 纯文本导入预览与数据库保存边界。
- 已保存书库、书籍详情、章节进入阅读器的数据库链路。
- reader 当前章节上下文问答的 mock / provider scaffold。
- learning-engine 在仪表盘中的能力画像和每日推荐预览。

当前仍只是 UI / mock / preview 的能力：

- reader 默认问答是 mock，不是默认真实 AI。
- reader QA 不具备 RAG / embedding / vector search。
- reader 传给 QA 的学习进度和能力画像仍是 mock context。
- learning 在数据库不可用时是 mock fallback；无已保存画像时常是 engine preview。
- 推荐和能力画像保存需要显式触发，不是自动学习闭环。

Web MVP 前必须优先补齐的能力：

- 稳定的书籍 / 章节 / chunk 数据路径：导入或 seed 后能稳定进入书库和 reader。
- reader 使用已保存 ReadingProgress 恢复阅读位置，而不只是详情页给继续阅读链接。
- reader QA 上下文改为使用真实已保存进度和能力画像摘要，至少先替换当前 mock progress / mock ability profile。
- learning 的最短闭环应固定为：阅读进度保存 -> 能力画像计算/保存 -> 每日推荐生成/保存 -> 题目尝试反馈 -> 下一轮重算。
- 明确 demo 用户、真实用户、认证缺失之间的产品边界，避免把 demo 数据误判为生产用户系统。

可以推迟到后续阶段的能力：

- URL / 文件 / PDF / EPUB / HTML 导入。
- 高质量语义章节生成和人工校正后台。
- RAG、embedding、vector search、跨章节检索。
- 完整在线判题、复习系统、学习计划系统和趋势分析。
- 多用户认证、权限、计费或社区 Skill 相关能力。

### 7.8 编程学习 Web MVP 阶段性结论

Web 已经具备编程学习相关入口和多个可运行页面骨架，并且部分路径已经接到数据库 repository 和 package 引擎接口。最值得肯定的真实路径是：纯文本导入可以生成章节和 chunk，保存为 Book / Chapter / Chunk，书库和详情页可以读取已保存书籍，阅读器可以展示数据库章节内容。

但当前仍必须严格区分四类状态：可展示 UI、mock fallback、engine preview、真实数据库路径。reader 默认 QA 不是真实 RAG；learning 仪表盘不是完整生产能力模型；import 也不是完整导入系统。

当前尚未形成完整编程学习闭环。A128-3 后的 Web MVP 最短路径应优先补齐：书籍/章节数据 -> 阅读器 -> 真实进度保存与恢复 -> 基础学习仪表盘 -> 显式重算能力画像和每日题单。章节问答、RAG、每日题单推荐和能力分数可以继续分阶段深化。

## 8. packages 审计

本节补完 A128-4 packages 专项审计。本轮只补充 `book-engine`、`learning-engine`、`shared`，并基于 A128-4 前半段已完成事实整理 `ai-core`、`db` 结论；没有进入 Desktop、Skill、A128-5 或整体完成度判断。

### 8.1 packages 总览

本轮轻量确认 `packages` 下仍只有五个包：`ai-core`、`db`、`book-engine`、`learning-engine`、`shared`。五个包均有 `package.json` 和 `src` 入口；本轮在 `book-engine`、`learning-engine`、`shared` 范围内未按常见 `test` / `spec` / `__tests__` 命名发现测试文件。

| Package | 路径 | package name | src / 入口 | scripts | 初步职责 | 状态 |
|---|---|---|---|---|---|---|
| ai-core | `packages/ai-core` | `@learning-agent-platform/ai-core` | `src/index.ts`，导出 llm、memory、tools、skills、autonomy、agent、Spark diagnostic 等模块 | `typecheck`、`lint` | LLM provider、权限、安全边界、工具、记忆、Skill、Agent preview / scaffold | provider / mock / scaffold / preview helper，并非完整真实 Agent runtime |
| db | `packages/db` | `@learning-agent-platform/db` | `src/index.ts`，导出 Prisma client、repositories、mappers、runtime preview persistence | `typecheck`、`lint`、Prisma validate / format / generate / migrate / studio / seed | Prisma 数据访问边界，覆盖学习数据与 Agent runtime preview 留痕 | 真实 repository + preview persistence；Agent runtime 不是生产执行日志闭环 |
| book-engine | `packages/book-engine` | `@learning-agent-platform/book-engine` | `src/index.ts`，导出 types、plain text import、normalize、heading、chapter、chunk helper | `typecheck`、`lint` | 纯文本导入、规则式章节识别、字符 chunk 切分 | partial implementation |
| learning-engine | `packages/learning-engine` | `@learning-agent-platform/learning-engine` | `src/index.ts`，导出 scoring、chapter QA signal、recommendation helper | `typecheck`、`lint` | 规则式能力评分、学习事件映射、每日题单排序 | rule-based helper / partial support |
| shared | `packages/shared` | `@learning-agent-platform/shared` | `src/index.ts`，当前仅导出 `sharedPackage` 常量 | `typecheck`、`lint` | 预留跨端共享类型、常量、工具入口 | scaffold / constants |

### 8.2 packages/ai-core 审计

本节基于 A128-4 前半段已完成审计事实整理，未重新全量深挖 `packages/ai-core`。已确认其有 provider 抽象、mock provider、Spark scaffold / diagnostic、runtime LLM skeleton，以及权限 / 工具 / 记忆 / Skill 的基础类型和若干 preview helper；多个真实执行能力明确默认关闭或 preview-only。

| 模块 / 能力 | 代表文件 | 当前职责 | 状态判断 | 是否支撑真实业务闭环 | 备注 |
|---|---|---|---|---:|---|
| LLM Provider interface | `packages/ai-core/src/llm-provider.ts`、`packages/ai-core/src/llm/index.ts` | 定义 provider、message、result、metadata、capability 等接口 | interface / scaffold | 否 | 抽象存在不等同于真实业务调用闭环 |
| mock provider | `packages/ai-core/src/llm-provider.ts` | 提供 mock provider 与 mock completion result | mock | 否 | 可用于 preview / 测试形态，不能描述为真实 LLM 接入 |
| Spark scaffold / diagnostic | `packages/ai-core/src/spark-provider.ts`、`spark-diagnostic.ts`、`spark-controlled-diagnostic-call.ts`、`spark-diagnostic-cli.ts` | Spark provider scaffold 与受控 diagnostic 能力 | scaffold / diagnostic | 否 | diagnostic 不等同业务 Agent LLM 调用；本轮未调用 Spark API |
| config / redaction | `packages/ai-core/src/llm-provider-config.ts` | provider 配置、敏感信息处理和运行模式边界 | helper | 否 | 用于安全边界，不构成业务闭环 |
| runtime LLM skeleton | `packages/ai-core/src/runtime-llm-call.ts` | runtime LLM call 的骨架与边界标记 | skeleton / preview | 否 | 真实 LLM call 默认未形成业务执行链路 |
| safety gate | `packages/ai-core/src/agent/index.ts`、`packages/ai-core/src/autonomy/index.ts` | readiness / safety / autonomy 相关预览和基础判断 | scaffold / preview helper | 否 | 可展示安全边界，但不等同真实 runner gate |
| permission | `packages/ai-core/src/autonomy/index.ts` | 自主性与权限类型 / 判断基础 | scaffold / preview helper | 否 | 未形成真实用户确认、授权和执行接入闭环 |
| cost / rate limit | `packages/ai-core/src/llm-provider.ts`、`runtime-llm-call.ts` | usage / capability / runtime metadata 骨架 | scaffold | 否 | 未确认真实计费、限流或预算执行系统 |
| agent runner / loop | `packages/ai-core/src/agent/index.ts` | Agent preview、readiness、计划相关入口 | scaffold / preview | 否 | 未发现真实 runner、step loop、后台队列或可执行任务循环 |
| tools | `packages/ai-core/src/tools/index.ts` | 工具类型、风险和需求预览 | scaffold / preview | 否 | 工具执行默认禁用或 preview-only |
| memory | `packages/ai-core/src/memory/index.ts` | 记忆类型 / 基础接口 | scaffold | 否 | 未形成真实持久化记忆写入、压缩和检索闭环 |
| retrieval | `packages/ai-core/src/embeddings/index.ts`、`packages/ai-core/src/memory/index.ts` | embedding / retrieval 方向入口 | scaffold | 否 | 未发现完整检索、排序和来源审计闭环 |
| context reconstruction | `packages/ai-core/src/agent/memory-context-preview.ts` | memory context preview | preview helper | 否 | 是上下文预览，不是三层记忆重建系统 |

### 8.3 packages/db 审计

本节基于 A128-4 前半段已完成审计事实整理，未重新全量深挖 `packages/db`。已确认 `db` 有真实 Prisma repository，覆盖 book / chapter / chunk、阅读进度、能力档案、每日推荐、problem attempt，也覆盖 Agent runtime preview execution / step / tool / LLM / event / audit 记录。但 Agent runtime repository 写入逻辑强制 `previewOnly=true`、`realExecutionEnabled=false`、`llmCallEnabled=false`，因此不是生产级 Agent 执行日志闭环。

| 模块 / 能力 | 代表文件 | 当前职责 | 状态判断 | 是否生产级闭环 | 备注 |
|---|---|---|---|---:|---|
| book / chapter / chunk repository | `packages/db/src/repositories/book-repository.ts`、`book-mappers.ts` | 创建和读取 Book、Chapter、ContentChunk | real repository | 部分 | 可支撑纯文本导入保存和阅读读取，但不等同完整导入产品闭环 |
| reading progress | `packages/db/src/repositories/reading-progress-repository.ts`、`reading-progress-mappers.ts` | 读取 / upsert 阅读进度 | real repository | 部分 | 依赖 demo 用户与显式调用，未形成完整进度恢复系统 |
| ability profile | `packages/db/src/repositories/learning-repository.ts`、`learning-mappers.ts` | 保存和读取能力画像 | real repository | 部分 | repository 存在不等同自动学习模型闭环 |
| daily recommendation | `packages/db/src/repositories/learning-repository.ts`、`learning-mappers.ts` | 保存和读取每日推荐 | real repository | 部分 | 依赖显式生成 / 保存，不是自动推荐闭环 |
| problem attempt | `packages/db/src/repositories/problem-attempt-repository.ts`、`problem-attempt-mappers.ts` | 保存和读取题目尝试 | real repository | 部分 | 可记录尝试，但不会自动触发画像和推荐重算 |
| runtime preview persistence | `packages/db/src/repositories/agent-runtime-repository.ts`、`agent-runtime-mapper.ts` | 持久化 runtime preview execution 及关联记录 | preview persistence | 否 | 强制 preview-only / disabled 边界 |
| runtime execution / step / tool / LLM / event / audit records | `packages/db/src/repositories/agent-runtime-repository.ts`、`packages/db/src/mappers/agent-runtime-mapper.ts` | 保存 execution、step、tool call、LLM call、event、audit log 预览记录 | preview persistence | 否 | `realExecutionEnabled=false`、`llmCallEnabled=false`，不代表真实执行日志 |
| mock runtime persistence | `packages/db/src/agent-runtime-mock-runner-preview.ts` | 保存 mock runtime preview plan | mock / preview persistence | 否 | mock runner preview，不执行工具或模型 |
| Spark diagnostic persistence | `packages/db/src/spark-diagnostic-persistence.ts`、`runtime-controlled-spark-diagnostic-persistence.ts` | 保存 Spark diagnostic / controlled diagnostic preview 结果 | diagnostic persistence | 否 | diagnostic 留痕不等同业务 Agent 调用闭环 |
| mapper | `packages/db/src/mappers/index.ts`、`agent-task-record-mapper.ts`、`agent-permission-mapper.ts`、`agent-runtime-mapper.ts` | 将 preview / repository 数据转换为持久化输入或输出 | mapper / helper | 否 | mapper 存在不等同完整产品能力 |

### 8.4 packages/book-engine 审计

| 能力 | 代表文件 | 当前表现 | 状态判断 | 对 Web MVP 的意义 | 备注 |
|---|---|---|---|---|---|
| book / chapter 类型 | `packages/book-engine/src/types.ts` | 定义 `ImportedBookDocument`、`ImportedBookChapter`、`ImportedContentChunk`、`TextImportInput`、`TextImportResult` | type only | 为 Web import 预览和 DB mapper 提供结构 | 类型不等同保存、编辑、阅读闭环 |
| text import | `packages/book-engine/src/importers/plain-text.ts` | `importPlainTextBook` 校验标题和 sourceText，normalize 后生成 document、chapters、chunks、warnings | partial implementation | 支撑 `/import` 纯文本导入预览和服务端保存前重算 | 只支持 plain text；会把非 `imported_text` sourceType 降级为 warning |
| URL import | `packages/book-engine/src/types.ts` | `BookSourceType` 包含 `imported_url`，但未发现 URL fetch / HTML parse 实现 | not found | 暂不能支撑 Web URL 导入 | 不能把 source type 说成 URL 导入能力 |
| file import | 未发现 | 未发现 file input、PDF、EPUB、HTML 或文件解析 importer | not found | 暂不能支撑文件导入 | 本轮未发现文件导入 parser |
| chapter split | `packages/book-engine/src/chaptering/chapter-builder.ts`、`heading-detector.ts` | 按英文 Chapter、编号、中文章节等规则识别 heading；无 heading 时 fallback 单章 | partial implementation | 可支撑文本导入后的基础章节结构 | 规则式章节切分，不是语义章节生成或可人工校正流程 |
| validation | `packages/book-engine/src/importers/plain-text.ts`、`utils.ts`、`chunkers/character-chunker.ts` | 标题空值 / sourceText 类型抛错，空文本和 sourceType 返回 warning，chunk 参数做 clamp | partial implementation | 提供基础输入安全和可解释 warning | 错误类型仍是普通 `Error` / warning，不是完整导入任务错误体系 |
| import preview | `packages/book-engine/src/importers/plain-text.ts`、`src/index.ts` | 返回结构化 `TextImportResult`，可被 Web 本地预览消费 | helper | 支撑 Web 本地预览 | preview UI 不在 package 内；package 不保存任务状态 |
| error handling | `packages/book-engine/src/importers/plain-text.ts` | 基础异常和 warnings | partial implementation | Web 可捕获并展示失败状态 | 没有后台任务失败原因、重试或导入状态表 |
| 与 Web import / reader 的关系 | `apps/web/src/app/import/BookImportPreviewClient.tsx`、`apps/web/src/app/import/actions.ts` | Web import 直接调用 `importPlainTextBook`；reader 读取 DB 中已保存章节 / chunk，不直接依赖 book-engine | partial implementation | 支撑“纯文本导入 -> DB 保存 -> reader”链路的一段 | book-engine 本身没有 DB 写入；不能说成完整“导入 -> 保存 -> 阅读”闭环 |

### 8.5 packages/learning-engine 审计

| 能力 | 代表文件 | 当前表现 | 状态判断 | 对 Web MVP 的意义 | 备注 |
|---|---|---|---|---|---|
| progress calculation | `packages/learning-engine/src/scoring/types.ts`、`ability-scorer.ts` | 支持 `reading_progress` 事件，按 progressRatio、timeSpent 和 recency 参与 reading score | rule-based helper | 可把阅读进度映射为能力画像输入 | 不负责读取 / 保存进度，也不恢复 reader 位置 |
| ability score | `packages/learning-engine/src/scoring/ability-scorer.ts`、`score-utils.ts`、`config.ts` | `calculateAbilityProfile` 计算 overall、algorithm、debugging、systemDesign、reading 分数与 confidence | rule-based helper | 支撑学习仪表盘的能力画像预览 / 显式保存 | 不是完整生产用户能力系统；依赖调用方提供事件 |
| recommendation | `packages/learning-engine/src/recommendation/recommender.ts`、`problem-ranker.ts`、`difficulty.ts` | 根据 AbilityProfile、候选题、最近尝试排序推荐题目 | rule-based helper | 支撑每日题单原型 | 候选题来源、保存、反馈循环在 package 外 |
| daily problem set | `packages/learning-engine/src/recommendation/types.ts`、`recommender.ts` | `recommendDailyProblems` 返回推荐题、目标难度、弱项和 warnings | rule-based helper | 可生成每日题单结果 | 不是自动每日任务，也不含调度 |
| learning plan | 未发现 | 未发现独立学习计划模型、路径或计划生成器 | not found | 暂不支撑学习计划系统 | 当前主要是 scoring + recommendation |
| review / spaced repetition | 未发现 | 未发现复习队列、遗忘曲线、间隔重复状态 | not found | 暂不支撑复习系统 | 每日题单不能等同 spaced repetition |
| history / performance model | `packages/learning-engine/src/scoring/event-normalizer.ts`、`recommendation/types.ts`、`chapter-qa-feedback-signal.ts` | 支持 ProblemAttempt、ReadingProgress、ChapterQuestion 与 recent attempts 输入 | rule-based helper | 能利用历史事件作为计算输入 | 没有真实用户数据闭环、趋势模型或自动重算 |
| 与 Web learning 的关系 | `apps/web/src/app/learning/learning-ability-profile-save.ts`、`learning-daily-recommendation-save.ts`、`problem-attempt-ability-preview.ts` | Web learning 直接调用 `calculateAbilityProfile` 和 `recommendDailyProblems` | partial implementation | 支撑 learning 页面预览和显式保存 | Web 侧仍依赖 demo 用户、DB repository 和手动触发 |

### 8.6 packages/shared 审计

| 能力 / 内容 | 代表文件 | 当前职责 | 状态判断 | 备注 |
|---|---|---|---|---|
| package 入口 | `packages/shared/src/index.ts` | 导出 `sharedPackage = "shared"` | constants | 当前只是最小入口 |
| 共享类型 | 未发现 | 未发现跨端共享类型导出 | unclear | 当前没有产品协议类型可审计 |
| 常量 | `packages/shared/src/index.ts` | 包名常量 | constants | 不是业务能力 |
| 工具函数 | 未发现 | 未发现共享工具函数 | unclear | 目前未承担 utility 职责 |
| 是否被其他 package 使用 | `packages/shared/src/index.ts`、包内搜索结果 | 本轮在 `packages` 范围内未发现其他包 import shared | scaffold | 不能说成当前主线核心依赖 |
| 是否支撑当前主线 | `packages/shared/package.json`、`src/index.ts` | 作为 workspace 包边界存在 | partial support | 支撑结构预留，不支撑真实业务闭环 |

`shared` 当前更接近共享包占位和常量入口，不包含产品核心业务能力，也不应被夸大为跨端协议层已经完成。

### 8.7 packages 对产品主线的支撑判断

| 主线能力 | packages 支撑程度 | 关键依据 | 主要缺口 |
|---|---|---|---|
| Web 编程学习 MVP | partial support | `book-engine` 支撑纯文本导入、章节和 chunk；`db` 有 Book / Chapter / Chunk、ReadingProgress、AbilityProfile、DailyRecommendation、ProblemAttempt repository；`learning-engine` 有规则式评分和推荐 | URL / 文件导入缺失；reader 进度恢复、真实 QA 上下文、自动学习反馈和推荐重算尚未闭环 |
| `/agent` preview | preview support | `ai-core` 有任务、工具、权限、记忆、runtime preview helper；`db` 可保存 preview execution / step / tool / LLM / event / audit | 仍是 preview-only / disabled；不是真实执行 |
| 真实 Agent loop | not enough | A128-4 前半段未发现真实 runner、step loop、后台队列、真实工具执行或业务 LLM call | 需要真实 runner、权限 gate 接入、工具执行器、LLM 调用链路、状态机和执行日志闭环 |
| Desktop Agent MVP | scaffold only | `ai-core` 和 `db` 有可复用类型、preview helper、persistence scaffold | 本轮未审计 Desktop；当前 packages 不能证明桌面端壳子、对话 UI 或真实执行已完成 |
| 三层记忆压缩 | scaffold only | `ai-core` 有 memory / context preview 相关入口 | 未发现 retrieval / compaction / reconstruction / source tracing 的完整闭环 |
| 后台工具调用 | preview support | `ai-core` 有 tool requirement preview；`db` 有 runtime tool call preview record | 未发现真实工具执行、后台任务队列、取消 / 重试 / 权限确认闭环 |
| Skill 社区 | scaffold only | `ai-core` 有 skills 入口和 preview suggestion 方向 | 未发现真实上传 / 下载 / 安装 / 执行 / update authorization / community review 闭环；最终 Skill 社区结论见第 10 节 |

### 8.8 packages 阶段性结论

packages 已经提供了较多类型、接口、mock、preview persistence 和 diagnostic scaffold，说明项目已经从纯文档阶段进入了若干包级边界和原型能力阶段。但这些能力必须按边界区分，不能把 interface、mapper、mock、scaffold 或 preview 说成完整产品能力。

`db` 的 repository 能力比纯 mock 更实，尤其是 book / chapter / chunk、阅读进度、能力画像、每日推荐和 problem attempt 已有 Prisma 数据访问边界；但 Agent runtime 相关写入仍强制 `previewOnly=true`、`realExecutionEnabled=false`、`llmCallEnabled=false`，因此不等同生产级 Agent 执行日志闭环。

`ai-core` 有 provider 抽象、mock provider 和 Spark diagnostic scaffold，也有权限、工具、记忆、Skill、runtime LLM 方向的基础类型和 preview helper；但未发现完整真实 Agent loop、真实工具执行、真实业务 LLM 调用和后台 runner。

`book-engine` 当前足以支撑 Web MVP 中“纯文本粘贴导入 -> 规则式章节 -> 字符 chunk”的原型链路，并能被 Web import 直接使用；但它不支持 URL / 文件导入，不做 DB 写入，不含后台导入任务、重试、导入状态或人工校正闭环。

`learning-engine` 当前足以支撑 Web learning 的规则式能力画像预览和每日题单原型；但它依赖外部传入事件和候选题，不负责真实用户数据闭环、自动重算、学习计划、复习系统或完整个性化推荐系统。

`shared` 当前只是共享包边界和常量入口，未发现共享协议、核心类型或工具函数在主线中承担真实核心依赖作用。

真实 Agent loop、三层记忆压缩、后台工具系统和 Skill 社区闭环在 packages 范围内均未完整发现。A128-5 已在第 9 到第 13 节补齐 Desktop、Skill、整体完成度和后续主线建议。

## 9. Desktop 软件端审计

### 9.1 Desktop 目录与配置检查

| 检查项 | 当前状态 | 判断 | 备注 |
|---|---|---|---|
| `apps/desktop` 是否存在 | 存在 | 仅有目录占位 | 目录下只发现 `src` 子目录 |
| `apps/desktop/src` 是否存在 | 存在 | 仅有源码目录占位 | 本轮递归列出未发现文件 |
| `apps/desktop/src` 是否为空 | 为空 | 未实现源码 | 不能因为 `src` 存在就判断 Desktop 已完成 |
| `apps/desktop/package.json` 是否存在 | 不存在 | 不是独立可启动 app | 无法声明 desktop package 名称、依赖、dev / build scripts |
| 是否有 Electron | 未发现 | 尚未落地 | 未发现 Electron 依赖、main / preload、配置或脚本 |
| 是否有 Tauri | 未发现 | 尚未落地 | 未发现 `src-tauri`、`tauri.conf.json`、`Cargo.toml` |
| 是否有 Wails | 未发现 | 尚未落地 | 未发现 `wails.json`、`app.go` |
| 是否有桌面端入口文件 | 未发现 | 未实现 | 未发现 `main.ts` / `main.js` / renderer 入口 |
| 是否有 preload / main process 配置 | 未发现 | 未实现 | 没有 Electron 主进程和 preload 边界 |
| 是否有启动脚本 | 未发现 | 不可启动 | 根 `package.json` 只有 Web `dev`、`typecheck`、`lint` |
| 是否有 build 脚本 | 未发现 | 不可构建 | 根和 desktop 范围都未发现 desktop build |
| 是否纳入 workspace | `pnpm-workspace.yaml` 包含 `apps/*` | 目录模式覆盖，但无独立 package | 没有 `apps/desktop/package.json`，实际不能作为 workspace package 运行 |
| 是否可启动 | 未发现可启动入口 | 不可启动 | 本轮没有启动 Desktop，也没有可启动命令可验收 |

### 9.2 Desktop Agent 能力检查

| 能力 | 当前状态 | 判断 | 备注 |
|---|---|---|---|
| Agent 对话入口 | 未发现 | 未实现 | `apps/desktop/src` 为空 |
| 任务预览 | 未发现 | 未实现 | Web `/agent` 有 preview，不代表 Desktop 有入口 |
| 工具调用入口 | 未发现 | 未实现 | 未发现桌面端工具调用 UI 或 runtime 接入 |
| 权限确认 | 未发现 | 未实现 | 未发现桌面端 confirmation dialog 或授权记录入口 |
| 记忆系统入口 | 未发现 | 未实现 | 未发现桌面端 memory panel、retrieval 或 compaction 入口 |
| 后台任务入口 | 未发现 | 未实现 | 未发现任务队列、后台生命周期、取消 / 超时入口 |
| 审计日志入口 | 未发现 | 未实现 | Web `/agent` 有 preview audit，不代表 Desktop 有审计日志产品能力 |
| 真实执行能力 | 未发现 | 未实现 | 未发现真实 runner、工具执行、LLM 调用或 Desktop 执行闭环 |

### 9.3 Desktop 阶段性结论

独立桌面软件端当前基本未实现 / 不可启动。

`apps/desktop` 当前只能证明项目预留了 Desktop 目录，不能证明已完成 AI 软件端、Agent 对话入口、任务执行面板、工具权限确认、记忆系统、后台工具调用或 Skill 运行。当前也没有 Electron / Tauri / Wails 技术栈落地痕迹，没有 package 边界，没有启动命令，没有构建命令。

因此 Desktop Agent 不应被计入已完成产品能力。后续应先做技术选型和最小可启动壳子，再接入 Agent preview 与权限边界，最后才进入真实执行。

## 10. Skill 社区审计

### 10.1 Skill 相关代码与路由检查

| 检查项 | 当前状态 | 判断 | 备注 |
|---|---|---|---|
| Skill 页面 | 未发现独立 `/skills` route | 未实现社区页面 | `apps/web/src/app` 中未发现 `skill` / `skills` route |
| marketplace | 未发现 route | 未实现 | 未发现 marketplace 页面或目录 |
| community | 未发现 route | 未实现 | 首页文案提到占位入口，但没有社区闭环页面 |
| Skill package | 未发现独立 `packages/skills` | 未实现独立包 | Skill 相关能力集中在 `packages/ai-core/src/skills` |
| Skill 类型定义 | 存在 | scaffold / 类型边界 | `packages/ai-core/src/skills/types.ts` 提供 manifest / runtime / review 类型 |
| Skill registry | 存在内存实现 | scaffold | `InMemorySkillRegistry` 支持 register / get / list，但不是社区 registry |
| Skill install review | 存在 helper | scaffold / 安装审查预览 | `createSkillInstallReview` 可生成 warnings / blockers / confirmations |
| Skill runtime | 存在内存 runtime | scaffold | 可解析 manifest 和生成安装审查，不等于真实执行引擎 |
| Skill DB model | 存在 | schema 层占位 / 初步模型 | `Skill`、`SkillToolRequirement` 存在于 `packages/db/prisma/schema.prisma` |
| Skill repository | 未发现 | 未实现 | `packages/db` 文件名搜索未发现 skill repository / mapper |
| plugin | 未发现产品闭环 | 未实现 | 关键词未形成 plugin / Skill 社区产品能力 |

### 10.2 Skill 核心闭环检查

| 闭环能力 | 当前状态 | 判断 | 主要缺口 |
|---|---|---|---|
| 上传 | 未发现 | 未实现 | 没有上传页面、API、审核、存储或发布流程 |
| 下载 | 未发现 | 未实现 | 没有社区来源、下载接口、包格式或安全检查 |
| 安装 | 只有安装审查 helper | 未形成真实安装 | 没有安装持久化、授权记录、依赖落地或本地启用流程 |
| 执行 | 未发现真实执行 | 未实现 | `ai-core` preview 明确不执行 Skill；缺少 runner、工具接入和日志 |
| 权限 | 有保守审查 helper | 未形成闭环 | 缺少用户确认、授权持久化、执行前 gate 和撤销流程 |
| 审计 | 未发现 Skill 审计闭环 | 未实现 | 缺少 SkillRun、执行步骤、工具调用和授权审计的真实产品链路 |
| 版本管理 | schema 有 `version` 字段 | 未形成版本发布流程 | 缺少发布、升级、diff、权限变更提示和兼容策略 |
| 社区分发 | 未发现 | 未实现 | 没有 marketplace、作者、评分、下载量、审核、举报或精选流程 |

### 10.3 Skill 阶段性结论

Skill 社区当前未形成上传 / 下载 / 安装 / 执行闭环。

当前 Skill 相关成果更接近 `ai-core` 内的类型、manifest 校验、内存 registry、安装审查 helper 和 preview metadata。Prisma schema 中已有 `Skill` / `SkillToolRequirement` 模型，但没有对应 repository、Web 社区页面、真实安装持久化、真实运行时、权限授权闭环、审计日志闭环和社区分发流程。

Skill 社区当前不应作为主线优先级。它应该等 Web MVP 与 Desktop Agent MVP 稳定后再进入主线，否则会把尚未完成的 Agent 执行、权限、工具、记忆和审计问题提前放大。

## 11. 真实完成度判断

以下百分比是基于 A128 静态审计的粗略估算，不是绝对事实；它们只用于帮助后续排优先级，不能替代真实运行、浏览器验收、typecheck、lint 和端到端测试。

| 模块 | 估算完成度 | 判断理由 |
|---|---:|---|
| Web 基础 MVP | 45% | Web app、Next.js routes、书库 / reader / import / learning 页面和部分 DB repository 已存在，但仍缺真实浏览器验收、完整错误态、稳定演示链路和打磨 |
| 编程学习闭环 | 30% | 纯文本导入 -> 章节 / chunk -> 保存 -> reader 读取已有部分链路，但阅读进度恢复、真实章节问答、自动能力画像、每日题单反馈循环仍未闭合 |
| Agent Preview | 60% | `/agent` preview 工作台较丰富，包含任务、工具、权限、记忆、Skill、runtime history / detail 和审计预览，但明确不可执行 |
| 真实 Agent Loop | 10% | 未发现真实 runner、后台队列、工具执行、业务 LLM 调用、状态机和执行日志闭环 |
| Desktop Agent | 2% | 只有空 `apps/desktop/src` 目录，没有 package、技术栈、入口、脚本或可启动 app |
| 三层记忆压缩系统 | 10% | 有 memory / context preview 方向和类型边界，但未形成 working memory、episodic memory、长期压缩、retrieval、compaction、context reconstruction 闭环 |
| 后台工具调用系统 | 12% | 有 tool requirement preview、风险标签和 preview persistence，但没有真实 tool registry 执行、permission gate 接入、sandbox / dry-run、后台生命周期、取消 / 超时闭环 |
| Skill Community | 5% | 有 manifest 类型、内存 registry、安装审查 helper 和 schema model，但没有页面、repository、上传 / 下载 / 安装 / 执行 / 社区分发闭环 |
| 整体产品 | 22% | 当前是 Web MVP + Agent preview + backend scaffold 原型阶段，离“编程学习网站 + AI Agent 软件端 + Skill 社区”的完整产品仍有明显距离 |

## 12. 后续主线建议

### 12.1 第一优先级：Web MVP 功能补齐与验收

先把 Web 编程学习端打成可演示、可验收、可回归的最短闭环：

- 书籍 / 章节 / 阅读最短链路。
- 阅读进度保存与恢复。
- 基础学习仪表盘。
- import 到 reader 的闭环。
- mock / preview 文案校正，避免把预览说成真实能力。
- Edge / @Browser / HTTP sanity check 验收。

### 12.2 第二优先级：Desktop / 软件端 Agent MVP

Desktop 当前几乎为空，应从最小可启动壳子开始：

- 技术选型文档：Electron / Tauri / Wails。
- 最小可启动壳子。
- Agent 最小对话入口。
- Agent 任务预览。
- 执行边界与权限确认。
- 先 mock / preview，再真实执行。

### 12.3 第三优先级：Agent 三层记忆压缩系统

记忆系统应在真实 Agent loop 前后分阶段落地：

- working memory。
- session / episodic memory。
- compressed long-term memory。
- retrieval。
- compaction。
- context reconstruction。

### 12.4 第四优先级：后台工具调用系统

后台工具调用必须先建安全边界，再扩工具数量：

- tool registry。
- permission gate。
- sandbox / dry-run。
- audit。
- background task lifecycle。
- cancellation / timeout。
- risk classification。

### 12.5 第五优先级：Skill 社区

Skill 社区暂缓。它应等 Web MVP + Desktop Agent MVP 稳定后再做，不要现在作为主线优先级。

原因是 Skill 社区依赖真实 Agent 执行、工具权限、审计日志、安装授权、版本管理和分发安全；这些底座当前都没有形成完整产品闭环。

## 13. 建议的下一轮任务

A129：Web MVP 功能补齐路线图。

A129 应基于本审计结果，制定 Web 编程学习 MVP 补齐路线图。A129 不写业务代码，只做路线图和任务拆分。A129 应继续小步拆分，避免上下文再次膨胀。

建议拆分为：

- A129-1：Web MVP 最短用户路径定义。
- A129-2：books / reader / import 闭环补齐计划。
- A129-3：learning dashboard / progress / recommendation 补齐计划。
- A129-4：Web MVP 验收标准与演示脚本。
- A129-5：后续 Codex 实现任务拆分。

如果 A128-5 文档审计已经干净完成，可以进入 A129；不要在本轮自动进入 A129。
