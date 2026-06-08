# Reader No-op Server Action 设计草案

> **状态**：设计草案 / 开发预览 / 尚未实现 / 不触发真实同步 / 不写 DB。  
> 本文档仅定义未来 no-op server action 的安全骨架设计，不构成实现指令。  
> 当前不得基于本文档自动新增真实 server action、DB 写入、schema 变更或网络请求。

---

## 1. 背景

### 1.1 前置工作

| 轮次 | 产出 | 说明 |
| --- | --- | --- |
| A281 | `reader-sync-server-action-contract.ts` | Server action 合约类型草案与 no-op builder（纯函数，preview-only） |
| A282 | `ReaderSyncPreviewPanel.tsx` | 合约草案 UI 接入（折叠区展示，纯只读） |
| A283 | 源码审查 + 119 条 node:test | 全部通过，浏览器验收因 VM 环境限制未完成 |
| A284 | `buildReaderSyncServerActionReadinessChecklist` | Server Action Readiness Checklist v1，130 条 node:test 通过 |
| A285 | 源码复查 + `data-testid` 补充 | 为两个折叠区补充定位属性；浏览器验收仍未完成（VM 缺少 styled-jsx + Chrome 未连接） |

### 1.2 当前状态

所有与 Reader 同步相关的模块均为 preview-only / local-only：

- `reader-sync-validation.ts` — 本地字段校验，仅读 localStorage
- `reader-sync-draft.ts` — 同步草稿预览，仅读 localStorage
- `reader-sync-payload-preview.ts` — DB payload 映射预览，仅读 localStorage
- `reader-sync-submit-plan.ts` — 提交计划预览，仅读 localStorage
- `reader-sync-server-action-contract.ts` — 合约草案与 readiness checklist（纯函数，no-op）
- `ReaderSyncPreviewPanel.tsx` — 前端预演面板（只读展示，无按钮，无 `"use server"`）

### 1.3 本轮动机

在真实 server action 实现之前，需要一份独立的 no-op 安全骨架设计文档，用于：

- 明确 no-op server action 的输入/输出/权限门/审计/幂等/错误码的完整草案结构
- 验证 request → response 的数据流形状正确性
- 作为未来真实实现时的安全对照清单
- 不与已有的 `docs/reader-sync-server-action-design.md`（A278，真实同步设计）混淆 —— 本文件只覆盖 no-op 骨架阶段

---

## 2. No-op Server Action 的目的

No-op server action 是未来真实同步实现之前的安全骨架。它：

- **验证 request/response 结构**：确保输入 shape、输出 shape、权限门字段、审计草稿字段的定义完整且合理
- **验证 permission gate 结构**：定义 requiresAuth / requiresBookAccess / requiresChapterAccess / requiresProgressValidation / requiresAudit 五个门控，no-op 阶段只返回门控状态，不执行真实检查
- **返回 preview-only 响应**：所有响应中 `success=false`、`implemented=false`、`previewOnly=true`
- **不调用 repository**：不访问 DB，不写数据
- **不发网络请求**：不调用外部服务、API、LLM provider
- **不启动 Agent loop**：不触发真实工具、不执行自主决策

no-op server action 的核心价值是作为**安全设计对照物**——未来真实实现时，逐一对照本草案的约束，确保每个门控、字段白名单、审计草稿都得到落实。

---

## 3. 函数签名草案（仅设计，不写实现代码）

### 3.1 输入结构

no-op server action 的输入 shape 基于 A281 中 `buildRequestDraft` 的产出结构，但不直接使用 A281 的 `requestDraft` 对象（A281 是纯客户端预览函数）。no-op 阶段单独定义一个输入结构：

| 字段 | 类型 | 来源 | 说明 |
| --- | --- | --- | --- |
| `bookId` | `string` | 客户端 localStorage（A273 payload preview） | 需服务端校验合法性 |
| `chapterId` | `string` | 客户端 localStorage | 需服务端校验合法性 |
| `progressRatio` | `number` | 客户端 localStorage | 需校验范围 `[0, 1]` |
| `idempotencyKeyPreview` | `string \| null` | 客户端生成（A273） | no-op 阶段不信任，仅作为草稿传入 |
| `clientPreviewOnly` | `boolean` | 客户端 | 固定为 `true`，标记为预览请求 |

**不含 userId**：客户端不得传入 userId。userId 只能由服务端 auth/session 注入，no-op 阶段设计中明确标注 `serverUserIdRequired=true`，但不实现 session 解析逻辑。

### 3.2 输出结构

no-op server action 的输出 shape 基于 A281 的 `RESPONSE_NOT_IMPLEMENTED` 结构扩展：

| 字段 | 类型 | 固定值 |
| --- | --- | --- |
| `success` | `boolean` | `false` |
| `implemented` | `boolean` | `false` |
| `previewOnly` | `boolean` | `true` |
| `status` | `string` | `"draft_only"`、`"not_implemented"` 或 `"blocked"` |
| `errorCode` | `string` | `"SERVER_ACTION_NOT_IMPLEMENTED"` |
| `message` | `string` | 人类可读，脱敏 |
| `syncedFields` | `string[]` | `[]`（空数组） |
| `skippedFields` | `string[]` | `["bookId", "chapterId", "progressRatio"]` |
| `warnings` | `string[]` | 非致命警告列表 |
| `requestId` | `string \| null` | 预览请求 ID（格式 `"req-draft-xxxx"`）或 `null` |
| `auditId` | `null` | 固定为 `null`（no-op 不写审计） |
| `serverProgressRatio` | `null` | 固定为 `null`（no-op 不读 DB） |

---

## 4. 输入白名单

### 4.1 允许字段

| 字段 | 类型 | 校验规则 | 说明 |
| --- | --- | --- | --- |
| `bookId` | `string` | 非空，trim 后长度 > 0 | 关联书籍 ID |
| `chapterId` | `string` | 非空，trim 后长度 > 0 | 关联章节 ID |
| `progressRatio` | `number` | `isFinite`，`0 <= value <= 1` | 阅读进度比例 |
| `idempotencyKeyPreview` | `string \| null` | 可为 null | 客户端预览幂等键（不可信） |
| `clientPreviewOnly` | `boolean` | 固定为 `true` | 标记为预览请求 |

### 4.2 禁止字段

以下字段**不得**出现在 no-op server action 的输入中：

| 禁止字段 | 原因 |
| --- | --- |
| `userId` | 客户端 userId 永远不可信，必须由服务端 session 注入 |
| `role` | 客户端角色不可信 |
| `auditId` | 审计 ID 由服务端生成 |
| `serverProgressRatio` | 服务端进度由 DB 读取，非客户端传入 |
| `arbitrary metadata` | 任意附加元数据，防止注入攻击 |
| `raw localStorage dump` | 整个 localStorage 对象，防止批量数据注入 |

unknown 字段策略：no-op 阶段应忽略或显式拒绝未知字段，不可静默接受。

---

## 5. userId 安全原则

| 原则 | 说明 |
| --- | --- |
| 客户端 userId 永远不可信 | localStorage / cookie / URL 参数中的 userId 均不可作为可信源 |
| no-op 设计中也**不得接受**客户端 userId | 即使 no-op 不做真实写入，输入结构中也不允许出现 userId 字段 |
| 未来真实实现必须从 server auth/session 注入 userId | session cookie / JWT / OAuth token 解析 |
| 权限校验必须在服务端执行 | userId 的验证、资源授权必须在 server action 内部完成 |
| A281 已明确 `serverUserIdRequired=true` | 合约草案中已标注此约束 |
| A281 已明确 `auditDraft.userIdSource` | 值为 `"server-session-context-not-client"` |

**反例（禁止）**：

```
// 错误：客户端传入 userId
const result = await noopServerAction({ userId: "u123", bookId: "b1", ... });

// 正确：客户端不传 userId，服务端从 session 注入
const result = await noopServerAction({ bookId: "b1", chapterId: "c1", ... });
// server action 内部：const userId = getUserIdFromSession();
```

---

## 6. 权限门设计

no-op 阶段定义五个权限门控字段，**只返回门控状态，不执行真实检查**。

| 门控字段 | 类型 | no-op 固定值 | 未来真实实现行为 |
| --- | --- | --- | --- |
| `requiresAuth` | `boolean` | `true` | 验证 session / token，解析 userId |
| `requiresBookAccess` | `boolean` | `true` | 检查 userId 对 bookId 的访问权限 |
| `requiresChapterAccess` | `boolean` | `true` | 检查 chapterId 属于 bookId，且 userId 有权限 |
| `requiresProgressValidation` | `boolean` | `true` | 校验 progressRatio 范围和合法性 |
| `requiresAudit` | `boolean` | `true` | 写审计日志 |

no-op 阶段这五个字段全部为 `true`，表示"未来必须检查"，但当前不执行任何检查逻辑。在响应草稿中，它们作为 `permissionGateDraft` 的一部分返回，供前端展示和对照。

---

## 7. No-op 响应结构

### 7.1 固定响应

no-op server action 在所有输入场景下均返回以下固定值：

| 字段 | 固定值 |
| --- | --- |
| `success` | `false` |
| `implemented` | `false` |
| `previewOnly` | `true` |
| `syncedFields` | `[]`（空数组） |
| `skippedFields` | `["bookId", "chapterId", "progressRatio"]` |
| `auditId` | `null` |
| `serverProgressRatio` | `null` |

### 7.2 可变响应字段

| 字段 | 可能值 | 触发条件 |
| --- | --- | --- |
| `status` | `"draft_only"` | 输入完整，可生成 request draft |
| `status` | `"blocked"` | 输入为 null/undefined 或 status 为 empty/invalid/partial/blocked |
| `status` | `"not_implemented"` | 通用未实现状态 |
| `errorCode` | `"SERVER_ACTION_NOT_IMPLEMENTED"` | 所有场景（no-op 不执行真实操作） |
| `errorCode` | `"INVALID_PAYLOAD"` | 输入格式不合法 |
| `message` | 人类可读消息 | 描述具体阻塞原因 |
| `warnings` | `string[]` | 非致命警告（如 "idempotencyKey 来自客户端预览，不可信"） |
| `requestId` | `"req-draft-xxxx"` 或 `null` | 有有效 request draft 时生成预览 ID |

### 7.3 错误码映射

no-op 阶段定义以下错误码，所有错误码均已在 A281 的 `READER_SYNC_SERVER_ACTION_ERROR_CODES` 数组中注册：

| 错误码 | 含义 | no-op 阶段是否触发 |
| --- | --- | --- |
| `AUTH_REQUIRED` | 需要鉴权 | 不触发（no-op 不执行鉴权） |
| `PERMISSION_DENIED` | 权限不足 | 不触发（no-op 不执行权限检查） |
| `INVALID_PAYLOAD` | 输入 payload 不合法 | 触发（输入为 null/empty/invalid 时） |
| `CONFLICT_DETECTED` | 进度冲突 | 不触发（no-op 不读 DB） |
| `IDEMPOTENCY_REQUIRED` | 需要幂等键 | 不触发（no-op 不执行幂等） |
| `AUDIT_REQUIRED` | 需要审计 | 不触发（no-op 不写审计） |
| `REPOSITORY_UNAVAILABLE` | repository 不可用 | 不触发（no-op 不调 repository） |
| `SERVER_ACTION_NOT_IMPLEMENTED` | server action 未实现 | **始终触发**（no-op 的核心错误码） |

---

## 8. 幂等策略草案

### 8.1 当前状态

A273 中 `idempotencyKeyPreview` 的生成方式为客户端随机值（`Math.random().toString(36).slice(2, 10)`），不可作为真实幂等依据。A281 合约草案中已标注 `"client preview only, not real server idempotency"`。

### 8.2 No-op 阶段约束

| 规则 | 说明 |
| --- | --- |
| 不得创建真实幂等记录 | no-op 阶段无 DB 访问，无法也不应创建任何幂等记录 |
| `idempotencyKeyPreview` 仅为本地预览 | 仅用于前端展示和设计对照 |
| 未来真实幂等键必须由服务端生成或验证 | 建议组成维度：userId + bookId + chapterId + operation + payloadHash |
| 不得信任前端随机值 | `Math.random()` 生成的 key 不保证唯一性，不可用于去重 |

### 8.3 未来真实幂等键设计建议（仅参考）

真实幂等键建议由服务端基于以下维度生成：

| 维度 | 说明 |
| --- | --- |
| `userId` | 从 session 解析 |
| `bookId` | 从 payload 提取 |
| `chapterId` | 从 payload 提取 |
| `operation` | 操作类型（如 `SYNC_PROGRESS`） |
| `payloadHash` | 对 progressRatio 做固定精度 hash（如 0.01 精度分桶） |

---

## 9. 审计草案

### 9.1 No-op 阶段约束

| 规则 | 说明 |
| --- | --- |
| 不写审计表 | no-op 阶段无 DB 访问 |
| 只返回 `auditDraft` | `auditDraft` 为纯数据结构，描述未来审计字段 |
| `auditId` 固定为 `null` | 响应中不生成审计 ID |

### 9.2 未来审计字段草案（仅参考）

A281 的 `AUDIT_DRAFT` 常量已定义以下字段模板：

| 字段 | 当前值（draft） | 未来真实来源 |
| --- | --- | --- |
| `action` | `"reader.progress.sync.server-action"` | 操作类型常量 |
| `source` | `"localStorage-preview"` | 数据来源标识 |
| `targetModel` | `"ReadingProgress"` | 目标数据模型 |
| `previewOnly` | `true` | 未来改为 `false` |
| `userIdSource` | `"server-session-context-not-client"` | 来源标识（保持不变） |

未来真实实现中，审计字段应扩展为：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | `string` | 操作人（来自 session） |
| `action` | `enum` | `SYNC_PROGRESS` / `RESET_PROGRESS` / `MARK_COMPLETED` |
| `targetModel` | `string` | `"ReadingProgress"` |
| `bookId` | `string` | 关联书籍 |
| `chapterId` | `string` | 关联章节 |
| `progressBefore` | `number \| null` | 操作前进度 |
| `progressAfter` | `number` | 操作后进度 |
| `result` | `enum` | `SUCCESS` / `CONFLICT_REJECTED` / 等 |
| `errorCode` | `string \| null` | 机器可读错误码 |

---

## 10. 与现有模块关系

| 现有模块 | 路径 | 职责 | 与 no-op 设计的关系 |
| --- | --- | --- | --- |
| `reader-sync-server-action-contract.ts` | `apps/web/src/app/reader/` | A281 合约类型草案与 no-op builder | 本设计文档的参考源，定义了 PERMISSION_GATE / AUDIT_DRAFT / REQUIRED_CONTEXT / RESPONSE_NOT_IMPLEMENTED 等常量 |
| `reader-sync-submit-plan.ts` | `apps/web/src/app/reader/` | A273 提交计划预览 | no-op 的输入来源（submitPlan → requestDraft） |
| `reader-sync-payload-preview.ts` | `apps/web/src/app/reader/` | A273 DB payload 映射预览 | no-op 的字段来源（bookId / chapterId / progressRatio） |
| `ReaderSyncPreviewPanel.tsx` | `apps/web/src/app/reader/` | A282 前端预演面板 | 合约草案和 readiness checklist 的展示载体 |
| `buildReaderSyncServerActionReadinessChecklist` | `apps/web/src/app/reader/` | A284 readiness checklist | 10 项就绪检查的参考对照 |

**所有这些模块均为 preview-only，不触发真实同步。本 no-op 设计文档也不改变它们的 preview-only 属性。**

---

## 11. 后续实现前置条件

在 no-op server action 的骨架代码可以被实现之前，以下前置条件必须逐一满足：

| 前置条件 | 当前状态 | 说明 |
| --- | --- | --- |
| auth/session 基础设施 | 未实现 | 需 session cookie / JWT / OAuth 中至少一种 |
| server action test plan | 未编写 | 需定义 no-op 阶段的测试策略和验收标准 |
| repository 调用边界 | 已有接口（A277 JSDoc） | 需确认 server action 与 repository 的调用协议 |
| 审计日志 schema 设计 | 未设计 | 需定义审计表结构 |
| 幂等存储设计 | 未设计 | 需定义幂等键的存储和查询方式 |
| 冲突检测策略 | 已有草案（A278 第 8 章） | 需确认 progressRatio 单调不下降策略 |
| 用户明确授权 | 未获得 | 任何真实实现必须经用户单独授权 |

**所有前置条件均不满足时，不得开始任何实现。**

---

## 12. 明确禁止项

| 禁止事项 | 说明 |
| --- | --- |
| 不允许根据本文档自动实现真实 server action | 本文档是设计参考，不是实现指令 |
| 不允许未授权写 DB | 包括 repository 写入、数据变更、upsert |
| 不允许未授权修改 schema | 包括 Prisma schema / migration |
| 不允许添加真实同步按钮 | 如"立即同步""保存到数据库""提交到数据库" |
| 不允许信任客户端 userId | userId 只能来自服务端 session |
| 不允许调用真实 AI / 工具 / Agent loop | 所有 AI/工具/Agent 能力保持 preview-only/mock-only/disabled-by-default |
| 不允许把 no-op / preview-only 描述为真实上线能力 | 所有文案必须标注"设计草案""尚未实现" |
| 不允许绕过权限门 | 未来实现必须包含所有五个门控的实际检查 |
| 不允许新增 API route | 同步入口必须通过 server action（Next.js App Router） |

---

## 13. Claude Code 验收策略说明

自 A286 起，Claude Code 阶段采用以下验收策略：

| 验收方式 | Claude Code 执行 | 说明 |
| --- | --- | --- |
| 源码审查 | ✅ 执行 | 逐一检查新增/修改文件的源码正确性和安全边界 |
| node:test | ✅ 执行 | 运行项目内已有测试套件 |
| lint / typecheck | ✅ 执行 | 运行 lint 和 typecheck 命令 |
| GUI / 手动验收记录 | ✅ 可选 | 用户本地完成 GUI 验收后反馈结果，Claude Code 记录 |
| 浏览器自动化验收 | ❌ 不强制 | VM 环境缺少 styled-jsx 等依赖 + Chrome 扩展未连接 |

浏览器验收等 Codex 额度恢复后补做。Claude Code 阶段以源码审查和测试验证为主，不因浏览器验收环境限制而阻塞业务推进。

---

## 14. 参考文档

| 文档 | 关联说明 |
| --- | --- |
| `docs/reader-sync-server-action-design.md` | A278 真实同步 server action 设计草案 |
| `apps/web/src/app/reader/reader-sync-server-action-contract.ts` | A281 合约类型草案与 no-op builder |
| `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx` | A282 前端预演面板（含 data-testid） |
| `apps/web/src/app/reader/reader-sync-server-action-contract.test.mjs` | A281 合约草案测试（21 条） |
| `docs/codex-context/CURRENT_HANDOFF.md` | 当前项目状态与交接信息 |
| `docs/codex-context/SAFETY_BOUNDARIES.md` | 全局安全边界约束 |
| `docs/codex-context/ARCHITECTURE_BOUNDARIES.md` | 模块职责与边界规则 |

---

> **文档版本**：v1（A286）  
> **状态**：设计草案 / 未授权实现  
> **编写日期**：2026-05-28  
> **执行器**：Claude Code（非 Codex）  
> **下轮候选**：no-op server action 类型与设计文档交叉校对；或回到业务代码推进
