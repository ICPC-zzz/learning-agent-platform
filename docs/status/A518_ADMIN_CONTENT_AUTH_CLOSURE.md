# A518 Admin Content Auth Closure

Date: 2026-06-28

## A516 回归结果

- `node --test tests/a515-*.test.mjs` 通过。
- `node --test tests/a516-*.test.mjs` 通过。
- `pnpm --filter @learning-agent-platform/ai-core typecheck` 通过。
- `pnpm --filter @learning-agent-platform/web typecheck` 通过。

## A517 migration

- `pnpm prisma migrate status --schema packages/db/prisma/schema.prisma` 初始显示 4 个旧迁移待记录。
- 本地库中对应表、索引、外键和 A517 `DailyContentSyncState` 表已经存在，迁移记录未对齐。
- 已用 Prisma `migrate resolve --applied` 对齐已存在的非破坏性迁移记录。
- 新增并执行 A518 非破坏性迁移 `20260628_a518_daily_content_kind_text`，将本地 `DailyContentItem.kind` 从旧 enum 对齐为当前 schema 的 `TEXT`，保留现有值。
- 最终 `migrate status` 为 up to date。

## 真实数据库状态

- `DailyContentSyncState` 可读。
- `DailyContentSyncState` 当前三类同步状态均为 `succeeded`。
- `DailyContentItem` 当前包含真实热点与 GitHub 日报 DB 快照。

## 每日热点同步

- `pnpm content:sync:hot` 真实执行成功。
- 后台浏览器按钮真实执行成功。
- DB 状态更新为成功，失败时不清空旧快照。

## GitHub 日报同步

- `pnpm content:sync:github-daily` 真实执行成功。
- 后台浏览器按钮真实执行成功。
- `GITHUB_TOKEN` 未作为客户端数据暴露。

## 技术文章同步

- 新增统一 job：`syncTechnicalArticles()`。
- `pnpm content:sync:articles` 真实执行成功。
- 后台浏览器按钮真实执行成功。
- 采集器使用仓库内 `services/article-feed-ingestor/.venv`，同步博客园/CSDN 公开 RSS/Atom 元数据，不抓取全文。

## 同步失败根因

- CLI 初始失败根因：`@learning-agent-platform/db` 旧 `dist` 中 `PrismaDailyContentRepository` 缺少 A517 `getSyncState()`。
- DB 写入初始失败根因：本地 `DailyContentItem.kind` 仍为旧 enum，与当前 Prisma schema `String` 不一致。
- 技术文章初始失败根因：全局 Python 缺少 `feedparser`；已改为优先使用仓库 `.venv`。
- 后台按钮初始失败根因：Server Action 后续 JSON 读取直接使用 Prisma delegate，在 Next 运行时 delegate 不可用；已改为复用 Repository。

## 后台废弃入口清理

- 后台导航移除“书籍管理”和“导入管理”。
- `/admin/books` 与 `/admin/imports` 改为 `notFound()`，不再渲染旧业务空页面。
- “题目管理”改名为“题目资源”。

## 管理员鉴权实现

- 新增 `apps/web/src/lib/admin/admin-auth.ts`。
- `/admin/**` layout 使用服务端 `isCurrentUserAdmin()`，非管理员 `notFound()`。
- Admin Server Actions 调用 `requireAdmin()`。
- 管理员判断只读取 httpOnly dev session 和服务端白名单。

## 当前账号管理员状态

- 浏览器验收使用 `dev-user-001`，通过服务端 `LAP_ADMIN_USER_IDS` 白名单授权。
- 未把管理员白名单传到浏览器。

## 普通用户验证

- 无 cookie 首页不渲染“后台”入口。
- 无 cookie 直接访问 `/admin` 返回 404。
- 非管理员 Action 绕过由 A518 服务端鉴权测试覆盖。

## 后台按钮可见性

- 用户端 App Shell 仅在服务端传入 `canAccessAdmin=true` 时渲染“后台”入口。
- 普通用户不依赖 CSS 隐藏。

## Server Action 权限

- `adminRefreshHotspots()`、`adminRefreshGitHub()`、`adminRefreshArticles()` 均先执行 `requireAdmin()`。
- 拒绝结果返回安全中文错误和 `permission_denied`。

## 测试结果

- `node --test tests/a515-*.test.mjs` 通过。
- `node --test tests/a516-*.test.mjs` 通过。
- `node --test tests/a517-*.test.mjs` 通过。
- `node --test tests/a518-*.test.mjs` 通过。
- `pnpm --filter @learning-agent-platform/ai-core typecheck` 通过。
- `pnpm --filter @learning-agent-platform/db typecheck` 通过。
- `pnpm --filter @learning-agent-platform/web typecheck` 通过。
- `pnpm run typecheck` 通过。
- scoped lint 通过。

## 未完成

- 未接入生产级 Auth v2 角色表。
- 未接入部署平台 cron。

## 未验证

- 未使用第二个真实浏览器账号切换普通用户；普通用户路径由无 cookie 请求和服务端测试验证。
