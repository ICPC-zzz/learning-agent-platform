# Reader 真实同步 Server Action 设计草案

> **状态声明**：设计草案 / 开发预览 / 尚未实现 / 不触发真实同步。  
> 本文档仅用于约束未来 server action 实现的架构方向，不构成实现指令。  
> 当前不得基于本文档自动新增真实 server action、DB 写入、schema 变更或网络请求。

---

## 1. 背景与目标

### 1.1 当前状态

A267-A273 已完成 Reader 同步的本地预演体系，覆盖以下模块（均为 preview-only / local-only）：

| 模块 | 职责 | 边界 |
| --- | --- | --- |
| `reader-sync-validation.ts` | 本地字段分类、校验、warning 聚合 | 仅读 localStorage |
| `reader-sync-draft.ts` | 同步草稿预览 | 仅读 localStorage |
| `reader-sync-payload-preview.ts` | DB payload 映射预览 | 仅读 localStorage |
| `reader-sync-submit-plan.ts` | 提交计划预览 | 仅读 localStorage |

A274 已完成 `docs/reader-sync-contract-design.md`，定义真实同步输入契约草案（最小 payload、userId 来源、权限门、幂等键、审计、冲突、重试、回滚策略）。

A276 已完成 repository 命名与职责对齐审计 (`docs/reader-sync-repository-alignment-audit.md`)。

A277 已为 `packages/db/src/types.ts` 中的 `ReadingProgressRepository` 接口和 4 个方法补充 JSDoc 注释。

### 1.2 当前缺失的真实能力

| 能力 | 状态 |
| --- | --- |
| 真实 server action | 未实现 |
| 真实 DB 写入 | 未实现（仅存在 preview-only 最小通路，非自动化） |
| userId / auth 服务端上下文 | 未实现 |
| 权限门 | 未实现 |
| 审计日志 | 未实现 |
| 幂等执行 | 未实现 |
| 冲突检测 | 未实现 |
| 失败重试 / 回滚 | 未实现 |
| 网络请求 | 未发起 |

### 1.3 本设计文档目标

本文档仅定义未来 server action 的以下策略边界，**不实现任何代码**：

- 权限门（auth / session / resource authorization）
- 输入校验（payload validation）
- repository 调用边界
- 审计（audit log）
- 幂等（idempotency）
- 冲突处理（conflict resolution）
- 失败重试与回滚策略

---

## 2. Server Action 边界

### 2.1 Server Action 负责

| 职责 | 说明 |
| --- | --- |
| 读取服务端 auth / session 上下文 | 不信任客户端传入的 userId |
| 校验 userId | 用户必须已登录，userId 来自 session |
| 校验 payload | bookId / chapterId / progressRatio 合法性 |
| 校验资源权限 | 用户是否拥有对应 book / chapter 的访问权 |
| 调用 repository | 经过鉴权和校验后，调用 `ReadingProgressRepository` |
| 写审计日志 | 记录操作前后状态 |
| 返回结构化结果 | success / status / warnings / errorCode 等 |

### 2.2 Server Action 不负责

| 禁止事项 | 说明 |
| --- | --- |
| 直接信任 localStorage | userId 绝不可来自 localStorage |
| 执行 AI | 不调用 LLM provider |
| 执行工具 | 不触发真实工具执行 |
| 启动 Agent loop | 不启动自主 Agent |
| 暴露数据库连接串 | 错误信息中不输出连接串 |
| 暴露完整内部错误栈 | 对客户端返回安全脱敏的错误码和消息 |
| 直接接收客户端 userId | userId 只能从 session / token 解析 |

---

## 3. 输入 Payload 草案

基于 A272/A273 的最小 payload 和 A274 契约草案，定义如下：

### 3.1 最小同步 Payload

| 字段 | 来源 | 类型 | 校验规则 | 是否可信 | 当前是否允许 |
| --- | --- | --- | --- | --- | --- |
| `userId` | 服务端 auth / session 上下文 | `string` | 非空，已登录 | ✅ 服务端注入 | 不允许客户端传入 |
| `bookId` | `localStatus.bookId` | `string` | 非空字符串，trim 后非空 | ⚠️ 客户端数据 | 允许（需服务端校验） |
| `chapterId` | `localStatus.chapterId` | `string` | 非空字符串，trim 后非空 | ⚠️ 客户端数据 | 允许（需服务端校验） |
| `progressRatio` | `localStatus.progressRatio` 或 `progressPercent / 100` | `number` | 范围为 `[0, 1]`，有限数 | ⚠️ 客户端数据 | 允许（需服务端校验） |

### 3.2 明确不进入当前最小 Payload 的字段

| 字段 | 原因 |
| --- | --- |
| `updatedAt` | 若沿用 Prisma `@updatedAt`，由 DB 自动管理；业务语义 `lastReadAt` 需先通过 schema 评审 |
| `lastReadAt` | schema 中当前不存在此字段，需先发起 schema 设计评审 |
| `noteCount` | 本地统计，不进入真实同步 |
| `bookmarkCount` | 本地统计，不进入真实同步 |
| `readingSeconds` | 本地计时，不进入真实同步 |
| `sessionSeconds` | 本地 legacy 计时，不进入真实同步 |

### 3.3 Payload 安全约束

- payload 中**不允许**包含以下服务端字段：`userId`（应从 session 注入）、`idempotencyKey`（服务端生成/验证）、`auditId`、`requestId`、`syncedAt`
- 所有异常返回结构化错误，不输出完整栈
- 未知字段应被忽略或显式拒绝，不可被静默接受并写入

---

## 4. 输入校验规则

### 4.1 逐字段校验

| 字段 | 规则 | 违规响应 |
| --- | --- | --- |
| `bookId` | 非空字符串，trim 后长度 > 0 | 400: `INVALID_BOOK_ID` |
| `chapterId` | 非空字符串，trim 后长度 > 0 | 400: `INVALID_CHAPTER_ID` |
| `progressRatio` | `typeof === "number"`，`isFinite`，`0 <= value <= 1` | 400: `INVALID_PROGRESS_RATIO` |
| 额外字段 | 不允许覆盖 `userId` / `auditId` / `idempotencyKey` 等服务端字段 | 400: `FORBIDDEN_FIELD` |

### 4.2 校验执行顺序

1. payload 结构校验（必填字段存在性）
2. 字段类型校验
3. 字段范围/格式校验
4. 危险字段检测
5. 服务端 auth / session 上下文注入 userId
6. 权限门校验（userId + bookId + chapterId）
7. repository 调用

任何一步失败，立即终止执行，返回结构化错误，不执行后续步骤。

### 4.3 错误返回结构草案

```typescript
// 设计草案，不新增类型文件
interface SyncErrorResult {
  success: false;
  errorCode: string;       // 机器可读错误码，如 "INVALID_PROGRESS_RATIO"
  message: string;          // 人类可读消息，脱敏
  field?: string;           // 出错的字段名（如适用）
  requestId: string;        // 请求追踪 ID
}
```

---

## 5. Auth 与权限门

### 5.1 鉴权前置条件

| 条件 | 要求 | 失败响应 |
| --- | --- | --- |
| 用户已登录 | session / token 有效，可解析出 userId | 401: `UNAUTHORIZED` |
| userId 存在 | 解析出的 userId 非空 | 401: `UNAUTHORIZED` |

### 5.2 资源权限校验

| 条件 | 校验方式 | 失败响应 |
| --- | --- | --- |
| 用户拥有 book 访问权 | 检查 userId 是否对该 bookId 有读取权限 | 403: `FORBIDDEN_BOOK_ACCESS` |
| 用户拥有 chapter 访问权 | 检查 chapterId 是否属于 bookId | 403: `FORBIDDEN_CHAPTER_ACCESS` |
| bookId ↔ chapterId 关联 | chapter 属于对应 book | 400: `CHAPTER_NOT_IN_BOOK` |

### 5.3 权限失败策略

- 权限失败时**不执行** repository 写入。
- 权限失败时**不返回**任何 DB 数据。
- 所有权限失败采用 **fail-closed** 策略（整体拒绝）。
- **禁止**匿名写入。

### 5.4 权限校验执行位置

```
Server Action 入口
  -> 1. session 解析 userId
  -> 2. payload 校验
  -> 3. 权限校验 (userId + bookId + chapterId)
  -> 4. repository 调用
  -> 5. 审计记录
  -> 6. 返回结果
```

---

## 6. Repository 调用边界

### 6.1 Repository 职责范围（A276 / A277 已明确）

`ReadingProgressRepository`（定义于 `packages/db/src/types.ts`）职责：

| 职责 | 说明 |
| --- | --- |
| DB 访问 | CRUD 操作（upsert / get / list / markCompleted） |
| 输入基本 normalize | progressRatio 约束到 `[0, 1]`、文本 trim + 空值拒绝 |

`ReadingProgressRepository` **不负责**：

| 非职责 | 说明 |
| --- | --- |
| 鉴权 | 不验证 userId 身份 |
| 审计日志 | 不写审计记录 |
| 幂等键维护 | 不检查 / 生成 idempotencyKey |
| 冲突检测 | 不比较 DB 现有值与输入值 |
| server action 逻辑 | 不含权限门、错误脱敏等 |

### 6.2 Server Action 与 Repository 的调用关系

```
Server Action（本设计文档定义）
  ├─ 鉴权（session -> userId）
  ├─ 输入校验（bookId / chapterId / progressRatio）
  ├─ 权限门（userId + resource access）
  ├─ 冲突检测（read-before-write，见第 8 章）
  ├─ 幂等检查（idempotencyKey，见第 7 章）
  ├─ 调用 Repository.upsertReadingProgress()   <-- 仅此一步访问 DB
  ├─ 写审计日志（见第 9 章）
  └─ 返回结构化结果

Repository（packages/db 现有实现）
  └─ Prisma upsert / findUnique / findMany  <-- 纯 DB 操作
```

### 6.3 约束

- repository **不直接接收** localStorage 原始数据。
- repository **不负责** AI、工具、Agent loop。
- Reader localStorage 预览模块（`reader-sync-*.ts`）**不得直接调用** repository，必须通过 server action 层。

---

## 7. 幂等策略

### 7.1 当前状态

A273 的 `idempotencyKeyPreview` 仅为本地草稿预览，不可直接作为真实幂等依据。其生成方式（客户端随机值）不符合服务端幂等安全要求。

### 7.2 真实幂等键设计建议

真实幂等键应由**服务端生成或验证**，建议组成维度：

| 维度 | 说明 |
| --- | --- |
| `userId` | 从 session 解析 |
| `bookId` | 从 payload 提取 |
| `chapterId` | 从 payload 提取 |
| `operation` | 操作类型标识（如 `SYNC_PROGRESS`） |
| `progress bucket` 或 `payload hash` | 将 progressRatio 分桶（如 0.01 精度）或对 payload 做 hash |

### 7.3 幂等执行流程草案

```
1. Server Action 收到请求
2. 生成/重建 idempotencyKey（基于 userId + bookId + chapterId + operation + payloadHash）
3. 检查 idempotencyKey 是否已存在
   -> 若已存在且结果成功 -> 返回已有结果（不重复写入）
   -> 若已存在且结果失败 -> 取决于失败类型决定是否重试
   -> 若不存在 -> 执行正常流程，记录幂等键和结果
```

### 7.4 当前明确不实现

- 幂等键存储表 / schema
- 幂等键生成逻辑
- 幂等键检查方法
- 幂等键在 repository 中的方法签名

---

## 8. 冲突处理策略

### 8.1 冲突场景定义

| 场景 | DB 现有 progressRatio | 客户端 progressRatio | 冲突类型 |
| --- | --- | --- | --- |
| A | 0.3 | 0.8 | 正常：客户端进度更高 |
| B | 0.8 | 0.3 | 冲突：客户端进度低于 DB |
| C | 0.5 | 0.5 | 无冲突：相同值 |
| D | 无记录 | 0.5 | 首次写入：无冲突 |

### 8.2 建议初版策略：progressRatio 单调不下降

| 场景 | 策略 | 行为 |
| --- | --- | --- |
| A（客户端更高） | 接受写入 | 正常 upsert，返回成功 |
| B（客户端更低） | 拒绝覆盖 | 返回冲突结果，以 DB 值为准，记录审计 |
| C（相同） | 接受（幂等） | 不重复写入，返回已有结果 |
| D（首次写入） | 接受写入 | 正常 upsert |

### 8.3 回退进度处理

若业务需要允许回退进度（如用户主动重置章节）：

| 条件 | 策略 |
| --- | --- |
| 默认 | 不允许回退，progressRatio 单调不下降 |
| 用户主动操作 | 需用户确认（前端提供 "reset progress" 操作，含确认弹窗） |
| 审计 | 任何回退操作必须记录审计（标记为 `action: RESET_PROGRESS`） |

### 8.4 冲突检测执行位置

冲突检测在 **server action 层** 执行（非 repository 层）：

```
1. getReadingProgress(userId, bookId, chapterId)  // read-before-write
2. 比较 DB progressRatio 与输入 progressRatio
3. 根据冲突策略决策：接受 / 拒绝 / 需确认
4. 若接受 -> upsertReadingProgress(...)
5. 若拒绝 -> 返回冲突错误，不写入
```

### 8.5 当前明确不实现

- 冲突检测代码
- read-before-write 逻辑
- 回退确认流程
- monotonic 校验

---

## 9. 审计日志设计草案

### 9.1 建议审计字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userId` | `string` | 操作人 |
| `action` | `enum` | `SYNC_PROGRESS` / `RESET_PROGRESS` / `MARK_COMPLETED` |
| `targetModel` | `string` | `"ReadingProgress"` |
| `bookId` | `string` | 关联书籍 |
| `chapterId` | `string` | 关联章节 |
| `progressRatioBefore` | `number \| null` | 操作前进度（null 表示首次写入） |
| `progressRatioAfter` | `number` | 操作后进度 |
| `idempotencyKey` | `string` | 幂等追踪键 |
| `requestId` | `string` | 请求追踪 ID |
| `result` | `enum` | `SUCCESS` / `CONFLICT_REJECTED` / `PERMISSION_DENIED` / `VALIDATION_ERROR` / `SERVER_ERROR` |
| `errorCode` | `string \| null` | 机器可读错误码（成功时为 null） |
| `createdAt` | `DateTime` | 审计记录创建时间 |

### 9.2 审计记录时机

| 操作 | 审计时机 |
| --- | --- |
| 正常同步成功 | 写入 DB 后立即记录 |
| 冲突被拒绝 | 拒绝时记录（含 before/after 值） |
| 权限拒绝 | 记录尝试操作（不暴露敏感资源信息） |
| 校验失败 | 可选记录（取决于失败频率和审计需求） |

### 9.3 当前明确不实现

- 审计表 schema
- 审计 repository 方法
- 审计日志写入逻辑
- 审计查询/检索能力

---

## 10. 失败重试策略

### 10.1 失败分类与重试决策

| 失败类型 | 是否可重试 | 策略 |
| --- | --- | --- |
| Payload 校验失败（`INVALID_*`） | **不可重试** | 需用户/前端修正输入后重新提交 |
| 未登录 / 无权限（`UNAUTHORIZED` / `FORBIDDEN`） | **不可重试** | 需重新认证或授权后重新提交 |
| 网络失败 | **可重试** | 指数退避，复用幂等键防止重复写入 |
| DB 冲突（`CONFLICT`） | **条件重试** | 先拉取最新 DB 状态，重新决策后再试 |
| Server error（`SERVER_ERROR`） | **可有限重试** | 上限 3 次，每次记录审计；达到上限后返回失败 |

### 10.2 重试约束

- 幂等键在重试中保持不变（同一请求的多次重试共享一个 idempotencyKey）。
- 指数退避建议间隔：1s → 2s → 4s（或更长）。
- 达到重试上限后，向客户端返回最终失败结果，并记录审计。

### 10.3 当前明确不实现

- 重试队列
- 指数退避逻辑
- 重试审计跟踪

---

## 11. 回滚策略

### 11.1 回滚原则

| 原则 | 说明 |
| --- | --- |
| 同步失败不删除 localStorage | 本地数据作为 fallback，不可因同步失败而丢失 |
| Server 未确认成功前不标记已同步 | 若未来引入 `syncedAt`，必须由 server 成功响应驱动 |
| 部分写入禁止 | 不允许部分字段写入成功、部分失败 |
| 无自动回滚 DB | 若 DB 写入成功但后续审计失败，审计失败不应回滚已写入的进度数据（审计为异步旁路） |

### 11.2 当前明确不实现

- syncedAt 字段和管理逻辑
- 回滚机制代码
- 分布式事务协调

---

## 12. 返回结果结构草案

### 12.1 成功响应草案

```typescript
// 设计草案，不新增类型文件
interface SyncSuccessResult {
  success: true;
  status: "synced" | "skipped";          // synced=已写入, skipped=幂等命中/相同值
  syncedFields: string[];                 // 实际同步的字段，如 ["progressRatio"]
  skippedFields?: string[];               // 未同步的字段（如幂等跳过）
  warnings?: string[];                    // 非致命警告
  serverProgressRatio: number;            // DB 中当前进度
  auditId?: string;                       // 审计记录 ID（如已实现审计）
  requestId: string;                      // 请求追踪 ID
}
```

### 12.2 失败响应草案

```typescript
interface SyncErrorResult {
  success: false;
  errorCode: string;                      // 机器可读：INVALID_PROGRESS_RATIO / UNAUTHORIZED / FORBIDDEN / CONFLICT / SERVER_ERROR
  message: string;                        // 人类可读，脱敏
  field?: string;                         // 出错字段（校验失败时）
  serverProgressRatio?: number;           // 冲突时返回 DB 中当前进度
  requestId: string;
}
```

### 12.3 当前明确不实现

- 新增类型文件
- 响应序列化逻辑
- 客户端错误状态映射

---

## 13. 安全边界

| 约束项 | 设计要求 | 当前状态 |
| --- | --- | --- |
| 真实 AI provider | 禁止调用 | 未调用 |
| 真实工具执行 | 禁止执行 | 未执行 |
| Agent loop | 禁止启动 | 未启动 |
| raw prompt / response | 禁止保存 | 未保存 |
| secrets / API key / token | 禁止硬编码 | 未硬编码 |
| 数据库连接串 | 禁止输出 | 未输出 |
| 客户端 userId 信任 | 禁止信任 | userId 仅来自 session |
| 完整错误栈暴露 | 禁止暴露 | 脱敏返回 |
| 匿名写入 | 禁止 | 须先鉴权 |
| localStorage 作为可信源 | 禁止 | 所有 localStorage 数据视为不可信输入 |

---

## 14. 与现有 Preview 模块的关系

### 14.1 现有模块位置与职责

| 模块 | 路径 | 职责 | 与本设计关系 |
| --- | --- | --- | --- |
| `reader-sync-validation.ts` | `apps/web/src/app/reader/` | 本地字段分类、校验、warning 聚合 | preview-only，不调 server action |
| `reader-sync-draft.ts` | `apps/web/src/app/reader/` | 同步草稿预览 | preview-only，不调 server action |
| `reader-sync-payload-preview.ts` | `apps/web/src/app/reader/` | DB payload 映射预览 | preview-only，不调 server action |
| `reader-sync-submit-plan.ts` | `apps/web/src/app/reader/` | 提交计划预览 | preview-only，不调 server action |

### 14.2 未来集成路径（仅设计）

```
1. 用户在 Reader 前端完成阅读
2. reader-sync-validation / draft / payload-preview 完成本地预演
3. 用户确认提交计划
4. [未来] 前端调用 server action（本设计定义）
   -> server action 执行鉴权、校验、权限门、冲突检测、repository 调用
   -> 返回结构化结果
5. 前端根据结果更新 localStorage（如 syncedAt）
```

### 14.3 约束

- 所有现有 preview 模块**不变**。
- 现有模块**不直接调用** server action。
- 现有模块**不直接调用** repository。
- 在 server action 未实现前，所有提交计划仅为预览展示。

---

## 15. 后续实现分阶段建议

### 15.1 分阶段授权要求

**每阶段必须单独授权，不允许一次性打开真实同步。** 各阶段需独立评审并确认前置条件满足后方可推进。

### 15.2 阶段规划

| 阶段 | 内容 | 前置条件 | 产出 |
| --- | --- | --- | --- |
| **阶段 1** | Server action 类型草案与 no-op 骨架 | 本设计文档评审通过 | 类型文件 + 空实现 server action（不做真实写入） |
| **阶段 2** | 权限门 mock / no-op 验证 | 阶段 1 完成 | session mock + 权限校验 no-op 验证 |
| **阶段 3** | Repository 调用封装 | 阶段 2 完成 | server action 经 repository 写入 DB（需用户授权） |
| **阶段 4** | 审计与幂等 | 阶段 3 完成 + schema 评审 | 审计表 + 幂等键存储 + 审计写入 |
| **阶段 5** | 真实同步灰度 | 阶段 4 完成 + 集成测试 | 端到端真实同步通路，逐步扩大灰度范围 |

### 15.3 阶段 1 前置条件（近期最低门槛）

- 本设计文档（A278）已完成内部评审并标记为 "ready for implementation planning"
- `ReadingProgressRepository` 接口 JSDoc（A277 已完成）
- `reader-sync-contract-design.md`（A274 已完成）
- 用户明确授权进入阶段 1

---

## 16. 明确禁止项

| 禁止事项 | 说明 |
| --- | --- |
| 本文档不是实现指令 | 不可基于本文档自动新增真实 server action |
| 不允许未授权修改 schema | 包括 Prisma schema / migration |
| 不允许未授权写 DB | 包括 repository 写入、数据变更 |
| 不允许把 preview-only 文案改成真实上线文案 | 当前所有预览标记必须保持 |
| 不允许根据本文档新增"立即同步""保存到数据库"等 UI 入口 | 所有 UI 入口需单独授权 |
| 不允许自动生成实现代码 | 本文档是设计参考，不是代码生成模板 |
| 不允许绕过权限门 | 任何未来实现必须包含鉴权和资源权限校验 |
| 不允许匿名写入 | 所有 DB 写入必须绑定已鉴权的 userId |

---

## 17. 参考文档

| 文档 | 关联说明 |
| --- | --- |
| `docs/reader-sync-contract-design.md` | A274 真实同步输入契约设计草案 |
| `docs/reader-sync-repository-alignment-audit.md` | A276 Repository 命名与职责对齐审计 |
| `packages/db/src/types.ts` | ReadingProgressRepository 接口定义（含 A277 JSDoc） |
| `packages/db/src/repositories/reading-progress-repository.ts` | Repository 实际实现（PrismaReadingProgressRepository） |
| `docs/codex-context/CURRENT_HANDOFF.md` | 当前项目状态与交接信息 |
| `docs/codex-context/SAFETY_BOUNDARIES.md` | 全局安全边界约束 |

---

> **文档版本**：v1（A278）  
> **状态**：设计草案 / 未授权实现  
> **编写日期**：2026-05-28  
> **下轮候选**：server action 类型草案 / no-op 骨架（阶段 1）
