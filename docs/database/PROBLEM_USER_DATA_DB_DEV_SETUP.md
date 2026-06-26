# Problem User Data DB Dev Setup

题目用户数据（收藏 + 练习记录）DB 持久化开发环境搭建说明。

**重要声明：所有题目用户数据 DB 持久化当前是 dev-only 开发预览能力，不是正式上线能力。**
**所有写入默认关闭，需多层显式授权才能启用。**

## 1. 前置条件

- 本地 PostgreSQL 已启动且网络可达
- `pnpm install` 已完成
- 项目依赖已就绪

## 2. 必须手动执行的命令

以下命令**本轮（A389）未执行**，需用户自行执行：

### 2.1 生成 Prisma Client

```bash
npx prisma generate
```

或通过 pnpm：

```bash
pnpm --filter @learning-agent-platform/db exec prisma generate
```

注意：`prisma generate` 不连接数据库，仅根据 `packages/db/prisma/schema.prisma` 重新生成 TypeScript 类型和 Prisma Client delegate。

当前生成的 Prisma Client 缺少以下模型（已通过 typing shim 临时兼容）：
- `BookFavorite`
- `ProblemFavorite`
- `ProblemPracticeActivity`

执行 `prisma generate` 后，`packages/db/src/generated-prisma-shim.ts` 的 module augmentation 将被真实类型替代，可安全保留或删除 shim。

### 2.2 同步 Schema 到数据库

推荐方式（开发环境）：

```bash
npx prisma db push
```

或使用 migration（如项目已有 migration 文件）：

```bash
npx prisma migrate dev
```

注意：`prisma db push` 和 `prisma migrate dev` 需要 DATABASE_URL 可连接数据库。

## 3. 需要的环境变量

以下环境变量需在 `.env` 文件中配置（`.env` 不提交到 Git）：

| 变量名 | 说明 | 示例值（仅示意） |
|--------|------|-----------------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@localhost:5432/dbname` |
| `LAP_PROBLEM_FAVORITES_DB_DEV_ENABLED` | 题目收藏 DB 持久化开关 | `true` |
| `LAP_PROBLEM_PRACTICE_DB_DEV_ENABLED` | 题目练习记录 DB 持久化开关 | `true` |
| `LAP_ALLOW_REAL_DB_INTEGRATION` | 真实 DB 集成测试开关 | `true` |
| `LAP_WEB_AUTH_DEV_ENABLED` | 开发会话认证开关 | `true` |

**不要在上述文件中写入真实密码或 token。** 建议使用本地开发专用数据库和低权限账号。

## 4. 五层显式授权门

所有题目 DB 写入受五层 guard 保护，全部通过才允许访问 DB：

1. `LAP_PROBLEM_FAVORITES_DB_DEV_ENABLED === "true"` 或 `LAP_PROBLEM_PRACTICE_DB_DEV_ENABLED === "true"`
2. `LAP_ALLOW_REAL_DB_INTEGRATION === "true"`
3. `LAP_WEB_AUTH_DEV_ENABLED === "true"`
4. 有效 dev session cookie（`lap-dev-session`）
5. 无 blocked reason（如 dangerous field）

任一不满足，写入 blocked，返回 `success: false, writesDatabase: false`。

## 5. 开发验证清单

完成 Prisma 命令后，可运行以下测试验证：

```bash
# Repository 结构验证（不连 DB）
node packages/db/src/repositories/problem-user-data-repository.test.mjs

# Action 结构验证（不连 DB）
node apps/web/src/app/user/problem-favorites-db-actions.test.mjs
node apps/web/src/app/user/problem-practice-db-actions.test.mjs

# Loader 结构验证（不连 DB）
node apps/web/src/app/user/problem-favorites-db-loader.test.mjs
node apps/web/src/app/user/problem-practice-db-loader.test.mjs

# 集成测试（需完整 env）
node apps/web/src/app/user/problem-user-data-db-integration.test.mjs
```

## 6. 当前状态

- Prisma schema 已定义 `ProblemFavorite`、`ProblemPracticeActivity` 模型（A387）
- Repository 代码已实现（A388）
- Action/Loader 代码已实现（A388）
- typing shim 已添加使 typecheck 在 Client 未生成时通过（A389）
- **未执行** `prisma generate`
- **未执行** `prisma db push`
- **未执行** `prisma migrate dev`

## 7. 安全提醒

- 所有 action 结果标注 `devOnly=true`、`productionReady=false`
- UI 文案标注"开发 DB 收藏/练习记录 · 绑定 dev session · 未接生产同步"
- 本地 localStorage fallback 不受 DB 状态影响
- 不保存提交代码、判题结果
- 不伪造 AC
- 错误信息脱敏，不暴露 SQL/stack/env
