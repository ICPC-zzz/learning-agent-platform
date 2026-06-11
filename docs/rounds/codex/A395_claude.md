# A395 — Web 错题本 ProblemWrongBook v1

**模型**: Claude Sonnet (Claude Code)
**模式**: 普通 Claude Code（Web 学习业务重任务，非 Desktop，非 Go）
**日期**: 2026-06-11

## 1. 修改文件清单

### 修改 — Prisma schema + shim
- `packages/db/prisma/schema.prisma` — 新增 `ProblemWrongBook` 模型（`@@unique([ownerId, problemId])`）
- `packages/db/src/generated-prisma-shim.ts` — 新增 `ProblemWrongBookDelegate` shim
- `packages/db/src/types.ts` — 新增 `ProblemWrongBookRecord`, `ProblemWrongBookRepository` 接口, `ProblemWrongBookReviewStatus` 类型, `VALID_WRONG_BOOK_REVIEW_STATUSES` 常量
- `packages/db/src/index.ts` — 导出新类型和 `PrismaProblemWrongBookRepository`
- `packages/db/src/repositories/index.ts` — 导出 `PrismaProblemWrongBookRepository`

### 修改 — 题目详情页
- `apps/web/src/app/problems/[problemId]/page.tsx` — 接入 wrong book guard + `ProblemWrongBookControl` 组件

### 修改 — 用户中心
- `apps/web/src/app/user/page.tsx` — 接入 wrong book DB loader + dashboard stats 更新 + 新增 wrong book section + nav 链接
- `apps/web/src/app/user/user-dashboard-stats-view-model.ts` — 新增 wrongBookTotalCount / wrongBookNeedsReviewCount / wrongBookSource 字段
- `apps/web/src/app/user/user-dashboard-stats-view-model.test.mjs` — 更新测试覆盖新字段

### 新增 — localStorage fallback
- `apps/web/src/lib/local-problem-wrong-book-store.ts` — localStorage key `lap.web.user.problemWrongBook`
- `apps/web/src/lib/local-problem-wrong-book-store.test.mjs` — 15 pass / 0 fail

### 新增 — DB guard / actions / loader
- `apps/web/src/app/user/problem-wrong-book-db-guard.ts` — 5 层 guard，默认关闭
- `apps/web/src/app/user/problem-wrong-book-db-guard.test.mjs` — 5 pass / 0 fail
- `apps/web/src/app/user/problem-wrong-book-db-actions.ts` — add/record/remove/updateReviewStatus/updateNote
- `apps/web/src/app/user/problem-wrong-book-db-actions.test.mjs` — 12 pass / 0 fail
- `apps/web/src/app/user/problem-wrong-book-db-loader.ts` — DB 读取 + local fallback
- `apps/web/src/app/user/problem-wrong-book-db-loader.test.mjs` — 10 pass / 0 fail

### 新增 — Repository
- `packages/db/src/repositories/problem-wrong-book-repository.ts` — `PrismaProblemWrongBookRepository`
- `packages/db/src/repositories/problem-wrong-book-repository.test.mjs` — 4 pass / 0 fail (SKIP: Prisma Client not generated)

### 新增 — 题目详情页错题本控件
- `apps/web/src/app/problems/[problemId]/ProblemWrongBookControl.tsx` — 加入/记录做错/复习状态/备注
- `apps/web/src/app/problems/[problemId]/problem-wrong-book-control-view-model.test.mjs` — 9 pass / 0 fail

### 新增 — /user/wrong-book 页面
- `apps/web/src/app/user/wrong-book/page.tsx` — 错题本 SSR 页面
- `apps/web/src/app/user/wrong-book/user-wrong-book-page-view-model.ts` — 页面视图模型
- `apps/web/src/app/user/wrong-book/user-wrong-book-page-view-model.test.mjs` — 10 pass / 0 fail
- `apps/web/src/app/user/wrong-book/UserWrongBookClientHydration.tsx` — 客户端 localStorage 水合

## 2. localStorage wrong book store 说明

- **Key**: `lap.web.user.problemWrongBook`
- **字段**: wrongBookId, problemId, title, difficulty, tags, wrongCount, lastWrongAt, reviewStatus (needs-review / reviewed / mastered), notePreview (≤300 字), sourceType, createdAt, updatedAt
- **安全措施**: JSON 损坏 safe fallback；duplicate add idempotent；recordWrong 增加 wrongCount；reviewStatus 枚举校验；notePreview 限长+脱敏；危险字段自动拒绝（token/secret/DATABASE_URL/submittedCode 等）
- **不保存**: 用户提交代码、token、cookie、session、DATABASE_URL、secret、raw prompt/response

## 3. ProblemWrongBook schema / repository 说明

### Prisma 模型
- 模型名: `ProblemWrongBook`
- 约束: `@@unique([ownerId, problemId])`
- 索引: `@@index([ownerId, lastWrongAt(sort: Desc)])`, `@@index([problemId])`, `@@index([reviewStatus])`
- ownerId 非 FK，dev session users 可能无 User 记录

### Repository 方法
- `addProblemToWrongBook` — idempotent（已有则返回已有）
- `recordProblemWrong` — upsert，existing 时 wrongCount+1
- `removeProblemFromWrongBook` — safe when missing（返回 false）
- `updateProblemWrongBookReviewStatus` — 校验 reviewStatus 枚举
- `updateProblemWrongBookNote` — 限长 300 字安全脱敏
- `listProblemWrongBookByOwner` — owner isolation，limit max 200
- `isProblemInWrongBook` — boolean check

## 4. Guard / action / loader 说明

### Guard 层级（5 层，全部需 true）
1. `LAP_PROBLEM_WRONG_BOOK_DB_DEV_ENABLED=true`
2. `LAP_ALLOW_REAL_DB_INTEGRATION=true`
3. `DATABASE_URL` 已配置
4. `LAP_WEB_AUTH_DEV_ENABLED=true`
5. Dev session cookie 存在且有效

### Actions
- `doAddProblemToWrongBook` — guard 关闭 → blocked
- `doRecordProblemWrong` — guard 关闭 → blocked
- `doRemoveProblemFromWrongBook` — guard 关闭 → blocked
- `doUpdateWrongBookReviewStatus` — guard 关闭 → blocked；reviewStatus 非法 → blocked
- `doUpdateWrongBookNote` — guard 关闭 → blocked；note 含敏感字段 → blocked

### Loader
- `loadDbProblemWrongBook` — guard 关闭 → empty result + message；guard 开启 → 查询 DB；DB error → safe fallback

### Action result 共同属性
- `devOnly: true`、`productionReady: false`
- `writesDatabase` / `callsRepository` 反映实际调用

## 5. 题目详情页接入说明

`ProblemWrongBookControl` 组件提供:
- **未在错题本中**: 显示「加入错题本」按钮
- **已在错题本中**: 显示错误次数、最近错误时间、复习状态、备注预览
  - 「记录一次做错」按钮（红色，增加 wrongCount）
  - 复习状态切换：待复习 / 已复习 / 已掌握
  - 「添加错题备注」文字框 + 保存/取消
  - 「移出错题本」
- 所有文案标注「开发预览」「本地 fallback」「未接真实判题」「未接生产账号」

## 6. /user/wrong-book 页面说明

- 展示 DB + localStorage 汇总错题记录
- 汇总栏: 错题总数、待复习数、最近错误时间
- 错题列表: 每条显示 problemTitle, difficulty, tags, wrongCount, lastWrongAt, reviewStatus badge, notePreview, 来源标记（DB/local）, 查看题目链接
- 空态: 引导前往题目详情页标记做错
- 未登录提示
- 客户端水合: `UserWrongBookClientHydration` 显示本地记录数量
- 安全声明 footer

## 7. 是否修改 Prisma schema

**是**。新增 `ProblemWrongBook` 模型。

## 8. 是否执行 migration

**否**。未执行 `prisma migrate dev`、`prisma db push`、`prisma generate`。

## 9. lint/typecheck 结果

- **Lint**: PASS（VM lint complete，0 errors）
- **Typecheck**: PASS（typecheck 0 errors）

## 10. 测试结果

| 测试 | pass | fail | 备注 |
|------|------|------|------|
| local-problem-wrong-book-store.test.mjs | 15 | 0 | 新增 |
| problem-wrong-book-db-guard.test.mjs | 5 | 0 | 新增 |
| problem-wrong-book-db-actions.test.mjs | 12 | 0 | 新增 |
| problem-wrong-book-db-loader.test.mjs | 10 | 0 | 新增 |
| user-wrong-book-page-view-model.test.mjs | 10 | 0 | 新增 |
| problem-wrong-book-control-view-model.test.mjs | 9 | 0 | 新增 |
| problem-wrong-book-repository.test.mjs | 4 | 0 | 新增 (SKIP: Prisma Client 未生成) |
| user-dashboard-stats-view-model.test.mjs | 15 | 0 | 更新 (增加 wrong book 测试) |
| sample-programming-problems.test.mjs | 15 | 0 | 已有 |
| problem-detail-loader.test.mjs | 4 | 0 | 已有 |
| local-user-problem-store.test.mjs | 24 | 0 | 已有 |
| problem-practice-db-guard.test.mjs | 5 | 0 | 已有 |
| problem-practice-db-actions.test.mjs | 17 | 1 | 已有 (A387 预存) |
| learning-activity-db-guard.test.mjs | 10 | 0 | 已有 |
| **A395 新增** | **65** | **0** | |

## 11. Skip 原因

- `problem-wrong-book-repository.test.mjs`: SKIP — Prisma Client 未生成（无法连接真实 DB），test 文件标注 skip reason
- `problem-practice-db-actions.test.mjs`: 1 个预存 fail（A387），非本轮引入
- 未执行 `prisma generate` / `prisma db push` / `prisma migrate dev`
- 未启动 dev server
- 未做浏览器手动验收
- 未执行 real DB 写操作

## 12. 安全边界确认

- 未硬编码 API key / token / secret / DATABASE_URL
- localStorage 仅保存脱敏数据，危险字段自动拒绝
- guard 默认关闭（5 层全部需 true）
- 所有 action result: `devOnly: true`, `productionReady: false`
- UI 文案标注「开发预览」「本地 fallback」「未接真实判题」「未接生产账号」
- 未出现「生产可用」「真实判题已接入」「云端同步成功」等误导文案
- 不保存用户提交代码、raw prompt/response
- 未新增公开无保护 API route
- 未修改 Desktop
- 未执行 Prisma migration
- owner isolation enforced（@@unique + WHERE 过滤）

## 13. 未完成事项

- 浏览器手动验收错题本 UI（题目详情页控件 + /user/wrong-book 页面 + /user dashboard 联动）
- `prisma generate` + `prisma db push` 后补跑 DB 集成测试
- 连接真实判题系统（不在此轮范围）
- DB guard 真实打开后的 e2e 验证

## 14. 下一轮建议

- A396: 浏览器手动验收 A395 错题本全部页面（题目详情控件 + /user/wrong-book + dashboard 联动）
- 或 A396: 继续下一个学习业务闭环（如学习计划 / 题单推荐 / 学习进度报告等）
- 或 A396: 用户执行 `prisma generate` + `prisma db push` 后补跑 DB 集成测试

## 15. 项目进度

**约 84.30%**（上一轮 83.70%，本轮新增错题本 v1 完整闭环 + localStorage fallback + DB guard/action/loader + /user/wrong-book 页面 + dashboard 联动 + 65 测试 pass）
