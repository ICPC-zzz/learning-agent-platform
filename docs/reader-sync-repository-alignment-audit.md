# Reader Sync — ReadingProgress Repository 命名与职责对齐审计

> 状态：**audit-only / preview-only**。本轮不实现真实同步、不写 DB、不改 schema、不新增 server action。

## 1. 审计范围

- **审计对象**：`packages/db/src/repositories/reading-progress-repository.ts`
- **对照基准**：`docs/reader-sync-contract-design.md`（A274 输出，真实同步输入契约设计草案）
- **上游链路**：A267-A273 Reader 同步预演体系（validation → sync preview → sync draft → payload mapping preview → submit plan preview）
- **审计日期**：2026-05-28（A276）
- **审计结论**：repository 核心接口已完整覆盖未来同步契约的最小 CRUD 需求；差异集中在命名风格、审计日志、幂等键、冲突策略和 `lastReadAt` 五个设计态维度。

## 2. 实际 repository 文件确认

| 项目 | 值 |
| --- | --- |
| 实际文件路径 | `packages/db/src/repositories/reading-progress-repository.ts` |
| A275 误找的目标文件名 | `packages/db/src/repositories/reading-progress.repository.ts`（不存在） |
| 命名差异 | 实际使用 `reading-progress-repository`（kebab 中无 `.`），A274/A275 契约文档引用 `reading-progress.repository`（dot-separated） |

## 3. 当前 repository 接口完整摘要

**文件导出**：
- `PrismaReadingProgressRepository`（class，实现 `ReadingProgressRepository` 接口）

**已有方法（4 个）**：

| # | 方法名 | 输入参数 | 返回类型 | 备注 |
| --- | --- | --- | --- | --- |
| 1 | `upsertReadingProgress` | `{ userId, bookId, chapterId, progressRatio, lastChunkId? }` | `Promise<ReadingProgressRecord>` | 基于 `userId_bookId_chapterId` 复合唯一键 upsert；自动设置 completedAt；progressRatio 自动归一化到 0~1 |
| 2 | `getReadingProgress` | `{ userId, bookId, chapterId }` | `Promise<ReadingProgressRecord \| null>` | 基于复合唯一键 `findUnique` |
| 3 | `listReadingProgress` | `{ userId, bookId?, limit? }` | `Promise<ReadingProgressRecord[]>` | 按 userId 过滤，可选 bookId；默认 limit 50、最大 200；按 updatedAt desc 排序 |
| 4 | `markChapterCompleted` | `{ userId, bookId, chapterId, lastChunkId? }` | `Promise<ReadingProgressRecord>` | 委托 `upsertReadingProgress`（progressRatio=1） |

**数据访问特征**：
- 所有文本输入（`userId`/`bookId`/`chapterId`）都会 trim 并拒绝空字符串。
- `progressRatio` 通过 `normalizeProgressRatio` 约束在 `[0, 1]`，非有限数直接抛错。
- `upsertReadingProgress` 使用 Prisma `upsert`，天然幂等（无显式幂等键列）。
- 内部辅助函数：`normalizeRequiredText`、`normalizeOptionalText`、`normalizeListReadingProgressLimit`、`createReadingProgressCreateData`、`createReadingProgressUpdateData`。
- 内部辅助类型：`ReadingProgressCreateDataInput`、`ReadingProgressUpdateDataInput`。

**mappers 文件**（`reading-progress-mappers.ts`）额外提供：
- `normalizeProgressRatio` — 公开导出，repository 内部使用。
- `createReadingProgressUpdateFromReaderState` — 将 Reader 本地状态映射为 `UpsertReadingProgressInput`。
- `createCompletedChapterProgress` — 将章节完成状态映射为 `MarkChapterCompletedInput`。

**接口定义位置**：`packages/db/src/types.ts` 中 `ReadingProgressRepository` interface（第 332-348 行），包含上述 4 个方法签名。

## 4. 与未来同步契约的对照分析

### 4.1 契约需求 vs 当前覆盖

| # | 契约需求（来自 reader-sync-contract-design.md） | 当前已有 | 当前方法名/签名 | 缺口 | 建议 |
| --- | --- | --- | --- | --- | --- |
| 1 | `upsertReadingProgress` — 基于 userId/bookId/chapterId 幂等写入 progressRatio | ✅ 已有 | `upsertReadingProgress(input: UpsertReadingProgressInput)` | 无 | 无需改动，签名已完全匹配 |
| 2 | `getReadingProgressByUserAndChapter` — 按用户+章节查询单条记录 | ✅ 已有 | `getReadingProgress(input: GetReadingProgressInput)` / `{ userId, bookId, chapterId }` | 命名风格差异：当前为 `getReadingProgress`，契约文档使用 `getReadingProgressByUserAndChapter` | 建议统一为 `getReadingProgressByUserAndChapter`（更具描述性），或保持现有命名（已足够清晰）。两种均可，由后续 Codex 轮次决定 |
| 3 | progressRatio 范围约束 `[0, 1]` | ✅ 已有 | `normalizeProgressRatio(value)` 在 repository 层自动调用 | 无 | 无需改动 |
| 4 | userId / bookId / chapterId 组合查询 | ✅ 已有 | `getReadingProgress` + `listReadingProgress` 均支持 | 无 | 无需改动 |
| 5 | 幂等键支持 | ⚠️ 部分 | `upsertReadingProgress` 使用数据库复合唯一键（`userId_bookId_chapterId`）保证幂等，但无应用层显式幂等键列 | 契约草案要求应用层幂等键（含 progress bucket、payload hash、operation type），当前 DB 复合键仅覆盖 userId/bookId/chapterId 维度，不覆盖"同一组合不同 payload"去重 | 后续需要在 schema 增加 `idempotencyKey` 列（或独立幂等表），并在 repository 层增加幂等检查逻辑。本轮不做 |
| 6 | 审计日志支持 | ❌ 缺失 | 无审计相关方法、无审计表 | 契约草案列出审计字段（userId/action/targetModel/bookId/chapterId/progressRatioBefore/progressRatioAfter/requestId/idempotencyKey/createdAt/result/errorCode），当前完全缺失 | 后续需设计审计表 schema 和对应 repository 方法。本轮不做 |
| 7 | 冲突处理 — monotonic 进度（progressRatio 单调不下降） | ❌ 缺失 | 当前 upsert 为简单 last-write-wins，不检测 DB 现有值是否更高 | 契约要求：本地进度低于 DB 进度时拒写。当前 repository 不执行 read-before-write 检查 | 建议未来在 server action 层实现冲突检测（先 get 再 compare 再 upsert），或 repository 增加带条件更新的方法。本轮不做 |
| 8 | `lastReadAt` 业务字段 | N/A | 当前 schema 无此字段，repository 无法写入 | 契约草案要求先评审再入模 | 先发起 schema 设计评审，再决定是否增加字段及如何写入 |
| 9 | `listReadingProgress` 返回多条记录 | ✅ 已有 | `listReadingProgress(input)` 支持 userId + 可选 bookId，含 limit 控制 | 无 | 无需改动 |
| 10 | `markChapterCompleted` 将章节标为完成 | ✅ 已有 | `markChapterCompleted(input)` 委托 upsert（progressRatio=1） | 无 | 无需改动 |

### 4.2 覆盖级别总结

- **完全覆盖**：upsertReadingProgress、getReadingProgress（by user+chapter）、listReadingProgress、markChapterCompleted、progressRatio 归一化、输入校验。
- **命名风格差异**：`getReadingProgress` vs `getReadingProgressByUserAndChapter` — 功能等价，命名不同。
- **设计态缺失**：幂等键显式列、审计日志（表+方法）、冲突检测逻辑、`lastReadAt` 字段。这些缺失项与契约文档预期一致——契约文档本身也未要求当前实现这些能力，仅作为设计草案。

## 5. 命名统一建议

### 5.1 文件名

| 当前实际名 | A274/A275 契约文档引用 | 建议 |
| --- | --- | --- |
| `reading-progress-repository.ts` | `reading-progress.repository.ts` | **统一为 `reading-progress-repository.ts`**（当前实际命名）。原因：项目中其他 repository 文件使用 `-repository.ts` 后缀（如 `book-repository.ts`），保持一致性。契约文档应更新引用为正确文件名 |

### 5.2 方法名

| 当前方法名 | 契约文档引用 | 建议 |
| --- | --- | --- |
| `getReadingProgress` | `getReadingProgressByUserAndChapter` | **保留 `getReadingProgress`**。输入类型 `GetReadingProgressInput` 已显式包含 `userId/bookId/chapterId`，方法名加上完整限定词会过度冗长。如需区分，可增加 overload 或注释，但不需重命名 |
| `upsertReadingProgress` | `upsertReadingProgress` | 一致，无需改动 |
| `listReadingProgress` | — | 无需改动 |
| `markChapterCompleted` | — | 无需改动 |

## 6. 建议的未来接口签名草案（不实现）

以下签名草案仅作为未来真实同步实现时的接口参考，本轮不落代码。

### 6.1 未来可能扩展的 repository 方法

```typescript
// 带冲突检测的 upsert（monotonic progressRatio）
async upsertReadingProgressWithConflictCheck(
  input: UpsertReadingProgressInput,
): Promise<{
  record: ReadingProgressRecord;
  conflict: boolean;
  dbProgressRatio: number | null;
}>;

// 幂等键检查
async getReadingProgressByIdempotencyKey(
  idempotencyKey: string,
): Promise<ReadingProgressRecord | null>;

// 审计日志写入（需先设计审计表 schema）
async createReadingProgressAuditLog(
  input: ReadingProgressAuditLogInput,
): Promise<AuditLogRecord>;
```

### 6.2 职责边界（建议）

| 层级 | 职责 | 备注 |
| --- | --- | --- |
| `repository` | DB 访问：CRUD、幂等检查、审计写入 | 不做权限判断、不做输入校验（除基本 normalize） |
| `server action` | 权限门：鉴权、资源权限、payload 校验、冲突决策 | 未来实现，本轮不做 |
| `audit service` | 审计调度：决定何时记审计、组装审计上下文 | 未来独立模块 |
| `reader-sync-submit-plan.ts` | 本地预演：不变，仍为 preview-only，不调 repository | 当前状态保持 |

## 7. 安全边界确认

| 约束项 | 本轮状态 | 说明 |
| --- | --- | --- |
| DB 写入 | ❌ 未做 | 无任何真实数据库写入 |
| server action | ❌ 未做 | 无新增 server action / API route |
| schema 变更 | ❌ 未做 | 无 Prisma schema 修改、无 migration |
| 网络请求 | ❌ 未做 | 无任何网络请求 |
| 真实 AI provider | ❌ 未做 | 无真实 LLM 调用 |
| 真实工具执行 | ❌ 未做 | 无工具执行 |
| Agent loop | ❌ 未做 | 无 Agent loop 启动 |
| Git 操作 | ❌ 未做 | 无 git add/commit/push |
| secrets/连接串 | ❌ 未泄露 | 审计文档不含任何敏感信息 |
| userId 信任边界 | 保持 | 未从 localStorage 读取 userId 作为可信身份 |

## 8. 后续实现建议（最小路径）

1. **repository 接口最小类型对齐**（A277 候选）
   - 可选：在 `types.ts` 中为 `ReadingProgressRepository` 接口增加 JSDoc 注释，明确每个方法对应哪个契约需求。
2. **server action 权限门设计**（A278 候选）
   - 设计 `syncReadingProgress` server action 签名，定义鉴权→校验→repository 调用→审计的三段式流程。
3. **真实同步实现**（A279+ 候选，需用户明确授权）
   - 先补 repository 幂等检查和冲突检测逻辑。
   - 再补 server action。
   - 最后补审计日志。

**本轮不做任何实现。**

## 9. 项目总进度

本轮为 audit-only，不构成功能实现跃迁。项目总进度保守口径维持 **45.88%**（与 A275 一致）。
