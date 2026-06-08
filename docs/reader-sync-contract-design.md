# Reader 真实同步输入契约设计草案

> 状态声明：**设计草案 / 开发预览 / 尚未实现 / 不触发真实同步**。  
> 本文仅用于约束未来实现方向，不构成当前功能实现指令。

## 1. 背景
A267-A273 已形成本地预演链路：

`localStatus -> validation -> sync draft -> DB payload preview -> submit plan preview`

当前能力仍全部是 preview-only / local-only：
- 无真实 DB 写入
- 无 server action
- 无网络请求
- 无真实 AI provider / 工具执行 / Agent loop

## 2. 当前本地数据来源
本地状态来源键：`lap.reader.localStatus.v1`

| 分类 | 字段 | 说明 |
| --- | --- | --- |
| 可用于预演 | `bookId` | 阅读资源标识（本地摘要） |
| 可用于预演 | `chapterId` | 章节标识（本地摘要） |
| 可用于预演 | `progressRatio` / `progressPercent` | 进度字段（`progressPercent` 仅用于换算预览） |
| 可用于预演 | `updatedAt` | 本地更新时间提示字段 |
| local-only | `noteCount` | 本地统计，不进入真实同步 payload |
| local-only | `bookmarkCount` | 本地统计，不进入真实同步 payload |
| local-only | `readingSeconds` | 本地计时，不进入真实同步 payload |
| local-only | `sessionSeconds` | 本地 legacy 计时，不进入真实同步 payload |

## 3. 未来最小同步 payload 契约草案
目标模型：`ReadingProgress`

建议最小同步输入（未来真实同步时）：

| payload 字段 | 来源 | 契约要求 |
| --- | --- | --- |
| `userId` | 服务端鉴权上下文 | 不可来自 localStorage |
| `bookId` | `localStatus.bookId` | 非空字符串 |
| `chapterId` | `localStatus.chapterId` | 非空字符串 |
| `progressRatio` | `localStatus.progressRatio`（或 `progressPercent / 100`） | 必须在 `0~1` |

`updatedAt / lastReadAt` 处理建议：
- 若沿用 Prisma `@updatedAt`（当前 `ReadingProgress.updatedAt` 已是 `@updatedAt`），前端 payload 不直接提交该字段。
- 若未来需要 `lastReadAt` 业务语义，应先发起 schema 设计评审，再决定是否入模和如何写入。

说明：以上仅为未来输入契约设计，不是当前代码实现。

## 4. userId 来源方案
- 禁止从 localStorage 读取 `userId` 作为可信身份。
- 未来 `userId` 只能来自服务端 auth/session/JWT 校验后的上下文。
- 前端本地预览不得伪造 `userId`。
- 真实同步时，server action 必须重新校验身份与资源权限。

## 5. server action 权限门设计
未来若实现 server action，至少执行以下校验：
- 用户已登录。
- 用户对 `book/chapter/readingProgress` 资源具备访问权。
- payload 中 `bookId/chapterId` 与可访问资源匹配。
- `progressRatio` 数值合法（`0~1`）。

权限失败策略：
- 必须整体拒绝（fail-closed）。
- 不允许部分写入。

## 6. 幂等键设计
- A273 的 `idempotencyKeyPreview` 仅是本地草案，不可直接作为真实幂等依据。
- 真实幂等键建议包含：
  - `userId`
  - `bookId`
  - `chapterId`
  - `progress bucket` 或 `payload hash`
  - `operation type`
- 禁止依赖纯前端随机值。
- 幂等键应由服务端确认或重建。

## 7. 审计日志草案
建议审计字段：
- `userId`
- `action`
- `targetModel`
- `bookId`
- `chapterId`
- `progressRatioBefore`
- `progressRatioAfter`
- `requestId / idempotencyKey`
- `createdAt`
- `result`
- `errorCode`

当前状态说明：
- 尚未实现审计表。
- 本轮不改 schema。

## 8. 冲突处理策略草案
建议初版冲突策略：
- 默认仅允许 `progressRatio` 单调不下降。
- 当本地进度低于 DB 进度：默认拒绝覆盖，提示冲突。
- 当 DB 进度更高：以 DB 为准，并记录冲突审计。
- 若业务需要回退进度：必须用户确认，且保留审计记录。

## 9. 失败重试策略草案
| 失败类型 | 是否可重试 | 建议策略 |
| --- | --- | --- |
| 网络失败 | 可重试 | 指数退避 + 幂等键复用 |
| 权限失败 | 不可自动重试 | 直接失败，需重新鉴权或授权 |
| payload invalid | 不可自动重试 | 修复输入后再提交 |
| DB 冲突 | 条件重试 | 先拉取最新状态/冲突决策后再试 |
| server error | 可重试（有限次） | 上限重试 + 审计失败原因 |

## 10. 回滚策略草案
- 同步失败时不得删除本地 `localStorage` 记录。
- 在服务端确认写入成功前，不得将本地状态标记为“已同步”。
- 若未来引入 `syncedAt`，仅在 server 成功响应后更新。

## 11. 安全边界
| 约束项 | 设计要求 |
| --- | --- |
| raw prompt/response | 禁止保存 |
| 真实 AI provider | 禁止调用 |
| 真实工具执行 | 禁止执行 |
| Agent loop | 禁止启动 |
| secrets | 禁止硬编码 |
| 连接串 | 禁止输出 |
| userId 信任边界 | 禁止信任客户端 userId |

## 12. 与现有代码的关系
当前仅引用本地预演模块（均为 preview-only，不触发真实同步）：
- `apps/web/src/app/reader/reader-sync-validation.ts`
- `apps/web/src/app/reader/reader-sync-draft.ts`
- `apps/web/src/app/reader/reader-sync-payload-preview.ts`
- `apps/web/src/app/reader/reader-sync-submit-plan.ts`

## 13. 后续实现前置条件
真实同步开发前需先完成以下审计/评审：
- schema 是否需要扩展（如 `lastReadAt`、审计表等）。
- repository 接口形态确认（当前未发现 `reading-progress.repository.ts` 实体文件）。
- server action 权限门设计与评审。
- 审计日志落点方案。
- 幂等策略（服务端重建/确认机制）。
- 测试计划：单测、集成、权限拒绝、幂等回放、冲突路径。
- 回滚策略：失败恢复与本地状态保全。

## 14. 明确禁止项
- 本文档不是实现指令。
- 不允许 Codex 基于本文档自动新增真实同步实现。
- 不允许未授权修改 schema/migration。
- 不允许未授权调用真实 DB。
- 不允许把 preview/local-only 描述成已上线真实能力。
