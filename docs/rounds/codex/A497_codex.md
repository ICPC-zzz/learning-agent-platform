# A497 Codex Report - app/books 类型契约清零

## 1. 本轮范围

- 唯一任务：只修复 `apps/web/src/app/books/` 范围内的 TypeScript 错误。
- 项目进度：仍为 **61.00%**。
- 本轮只做类型契约修复，不新增功能，不恢复旧书库主导航，不修改 Prisma schema，不修改真实数据库写入能力。

## 2. 初始错误基线

命令：

```powershell
pnpm -C apps/web typecheck *> .codex_tmp/a497_web_initial.log
```

结果：

- `apps/web` 初始总错误数：**94**
- `apps/web/src/app/books/` 初始错误数：**17**
- parser 级错误：**0**

`books` 初始错误文件：

| 文件 | 错误数 |
| --- | ---: |
| `src/app/books/manage/actions.ts` | 11 |
| `src/app/books/delete-book-actions.ts` | 4 |
| `src/app/books/delete-all-imported-action.ts` | 1 |
| `src/app/books/open-library-bulk-import-actions.ts` | 1 |

`books` 初始错误代码：

| Code | Count |
| --- | ---: |
| TS2339 | 14 |
| TS2345 | 3 |

## 3. 当前 Book 契约确认

已核对当前通过导出的真实类型：

- `BookRepository.deleteBook(input)` 返回 `DeleteBookResult`
- `DeleteBookResult` 字段为 `deleted`、`bookId`、`chapterCount`、`chunkCount`
- `UpdateBookMetadataInput` 字段仅为 `bookId`、`metadata`
- `UpdateBookMetadataResult` 字段为 `updated`、`bookId`、`metadata`
- `BookListItem` 当前包含 `sourceType`、`title`、`subtitle`、`author`、`description`、`sourceUrl`、`language`、`tags`、`metadata`、时间字段

主要契约错位：

- UI/action 旧代码读取了不存在的 `success`、`deletedChapterCount`、`reasonCode`、`message`
- 管理 action 旧代码向 `updateBookMetadata` 传入了不存在的 `requestedByOwnerId`、`title`、`status`
- Open Library bulk import 旧代码向 `updateBookMetadata` 传入了不存在的顶层 `description`、`tags`

## 4. 修改文件

- `apps/web/src/app/books/delete-all-imported-action.ts`
- `apps/web/src/app/books/delete-book-actions.ts`
- `apps/web/src/app/books/manage/actions.ts`
- `apps/web/src/app/books/open-library-bulk-import-actions.ts`

未修改 package 导出。

## 5. 修改内容

- 删除流程改为使用当前 `DeleteBookResult.deleted` 判断成功，并用 `chapterCount/chunkCount` 生成安全返回信息。
- 批量删除改为使用 `r.deleted`，不再读取不存在的 `r.success`。
- `manage/actions.ts` 中 rename/archive 在当前 repository 不支持安全更新 `title/status` 时返回明确的 `rename-unavailable` / `archive-unavailable`，不伪装成功，不执行数据库写入。
- bulk import 仅把 `category/tags/description` 作为 metadata 写入，不再向 repository 传入不存在的顶层字段。
- 移除了本轮触及位置中失效的 `any` 断言和死导入。

## 6. 错误数量变化

| 阶段 | books 错误 | apps/web 总错误 |
| --- | ---: | ---: |
| 初始 | 17 | 94 |
| 对齐 BookRepository 契约后 | 0 | 77 |
| 最终复验 | 0 | 77 |

最终命令：

```powershell
pnpm -C apps/web typecheck *> .codex_tmp/a497_web_final.log
```

结果：

- 退出码：2
- `apps/web/src/app/books/` 最终错误数：**0**
- `apps/web` 最终总错误数：**77**
- parser 级错误：**0**

剩余错误均为非 `books` 范围：

| 分组 | Count |
| --- | ---: |
| `src/lib` | 36 |
| `src/app/user` | 13 |
| `src/app/reader` | 11 |
| `src/app/import` | 9 |
| `src/app/problems` | 3 |
| `src/app/agent` | 2 |
| `src/app/ai` | 1 |
| other/package scoped | 2 |

## 7. 核心包回归

| Command | Result |
| --- | --- |
| `pnpm -C packages/db typecheck` | PASS |
| `pnpm -C packages/ai-core typecheck` | PASS |
| `pnpm -C packages/book-engine typecheck` | PASS |
| `pnpm -C packages/shared typecheck` | PASS |
| `pnpm -C packages/learning-engine typecheck` | FAIL |

`packages/learning-engine` 失败已单独复跑并保存到 `.codex_tmp/a497_learning_engine_typecheck.log`。错误位于 `packages/learning-engine/src/problem-api-provider.ts`，不在本轮允许修改的 `app/books` 范围内：

- TS5097：`.ts` 扩展导入未启用 `allowImportingTsExtensions`
- TS6059：引用了 rootDir 外的 `packages/shared/src/external-api-dev-guard.ts`
- TS2345：`string | null` 传给 `string | undefined`

按本轮停止条件，未越界修改 `packages/learning-engine`。

## 8. Web 启动回归

未启动新的 dev server；当前已有 `localhost:3000` 服务正常响应。

命令：

```powershell
Invoke-WebRequest http://localhost:3000 -UseBasicParsing -TimeoutSec 10
```

结果：

- 首页 HTTP 状态：**200**
- 响应长度：`22524`
- 未执行浏览器自动化验收。

## 9. Git 状态摘要

工作区在本轮开始前已经很脏。本轮未执行任何 Git 写入命令。

`git status --short` 摘要：

- `??`：426
- ` M`：80
- `M `：11

本轮相关状态：

- `M  apps/web/src/app/books/manage/actions.ts`
- `?? apps/web/src/app/books/delete-all-imported-action.ts`
- `?? apps/web/src/app/books/delete-book-actions.ts`
- `?? apps/web/src/app/books/open-library-bulk-import-actions.ts`
- `?? docs/rounds/codex/A497_codex.md`

## 10. 安全边界

- 未恢复 `/books` 为主导航。
- 未恢复旧书库首页、旧推荐入口或旧产品文案。
- 未修改 Prisma schema。
- 未实现新的数据库删除能力。
- 未执行真实 LLM 调用。
- 未执行真实 Agent loop。
- 未执行真实工具调用。
- 未绕过权限/安全边界。

明确未执行：

- `git add`
- `git commit`
- `git push`
- `git reset`
- `git restore`
- `git stash`
- Prisma migration
- Prisma db push
- Prisma reset
