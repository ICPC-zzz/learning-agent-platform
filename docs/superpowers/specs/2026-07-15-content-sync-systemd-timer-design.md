# 每日内容同步 systemd 定时器修复设计

日期：2026-07-15

## 背景与根因

生产服务器的 `/etc/cron.d/learning-agent-platform` 并未丢失，服务器时区也是 `Asia/Shanghai`。2026-07-15 的三项任务分别在 06:00、06:10、06:20 被 cron 正常触发，但都在进入业务同步代码前失败。

失败原因是 cron 执行了 `pnpm content:sync:*`。当前原子发布流程会让新 release 复用已安装的 `node_modules`，pnpm 在这种跨 release 目录中触发依赖状态检查并尝试执行安装。非交互 cron 无法确认清理依赖目录，因此以 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 退出。

另有一个直接影响页面结果的问题：`articles.generated.json` 等生成文件位于 release 内。新 release 切换后，运行时会重新看到仓库中较旧的生成文件，即使上一天的技术文章同步实际成功，页面时间仍可能倒退。

## 目标

- 每天北京时间 06:00 自动同步热点、GitHub 日报和技术文章。
- 服务器在 06:00 关机或重启时，恢复运行后自动补跑错过的任务。
- 同步任务不调用 pnpm，不安装依赖，不执行 Prisma generate、TypeScript 编译或 Next.js 构建。
- 短暂网络或上游失败时有限重试，不产生无限循环。
- 生成内容跨 release 持久保存，部署不会让同步时间或数据回退。
- 保留现有数据库租约、最小同步间隔和旧快照保护逻辑。

## 非目标

- 不改变热点、GitHub 或 RSS 的抓取算法。
- 不新增公开或内部 HTTP 同步接口。
- 不修改数据库结构。
- 不在服务器执行依赖安装或生产构建。
- 不重构管理后台的手动同步功能。

## 方案

### 1. 使用 systemd timer 取代内容同步 cron

新增两个部署模板：

- `learning-agent-platform-content-sync.service.example`
- `learning-agent-platform-content-sync.timer.example`

timer 使用带时区的日历表达式在 `06:00:00 Asia/Shanghai` 触发，并设置 `Persistent=true`。这样服务器错过 06:00 后，timer 会在下次启动时补跑。

service 以应用用户运行，工作目录固定为 `/opt/learning-agent-platform/current`，从受保护的生产环境文件加载配置。它直接执行当前 release 已安装的 `tsx` 入口和 `scripts/content-sync.ts`，不经过 pnpm。脚本不带单项参数时按现有顺序同步全部三类内容。

service 对失败进行有限重启：间隔 10 分钟，最多尝试 3 次。成功项目在后续重试中会被现有 freshness/lease 逻辑跳过，失败项目可以再次尝试。

### 2. 提供无构建同步启动脚本

新增部署脚本 `deploy/scripts/run-content-sync.sh.example`，负责：

1. 校验当前 release、`tsx` 和数据库构建产物存在。
2. 明确拒绝调用 pnpm、install、Prisma generate、tsc 或 Next build。
3. 使用 `exec` 直接启动 `scripts/content-sync.ts`。
4. 让退出码原样返回给 systemd，用于失败重试和监控。

脚本只做运行前校验与进程启动，不修改依赖和 release。

### 3. 持久化生成内容目录

生产服务器使用 `/opt/learning-agent-platform/shared/content-data` 作为持久化内容目录。安装/发布步骤会：

1. 首次安装时从当前 release 的 `apps/web/src/data` 初始化持久目录。
2. 不覆盖持久目录中更新的数据。
3. 将每个 release 的 `apps/web/src/data` 替换为指向该持久目录的目录级符号链接。

采用目录级链接是因为技术文章采集器通过临时文件加原子替换写入 `articles.generated.json`；单文件符号链接会被原子替换操作覆盖，目录级链接不会。

数据库仍是热点和 GitHub 日报的主数据源，持久 JSON 保留现有回退和管理状态用途；技术文章继续使用现有 JSON 数据源。

### 4. 迁移和防重复

- 服务器安装并启用 timer 后，删除 `/etc/cron.d/learning-agent-platform` 中三条内容同步任务，保留数据库备份任务。
- 仓库中的旧 cron 模板标记为已废弃，防止未来同时安装 cron 和 timer。
- 部署文档改为以 systemd timer 为唯一推荐生产方案。
- 安装完成后手动启动一次 service，补齐 2026-07-15 缺失的数据。

## 数据流

```text
systemd timer（每日 06:00，支持补跑）
  -> content-sync oneshot service
  -> run-content-sync.sh
  -> 当前 release 的 tsx + scripts/content-sync.ts
  -> 现有三类同步函数（数据库租约与 freshness 保护）
  -> PostgreSQL + shared/content-data
  -> 文章中心运行时读取最新数据
```

## 错误处理与观测

- 同步脚本非零退出时，systemd 将该次执行标记为失败并有限重试。
- 标准输出和错误输出进入 journal，可通过 `journalctl -u learning-agent-platform-content-sync.service` 查看。
- timer 的上次和下次触发时间可通过 `systemctl list-timers` 查看。
- 现有同步代码在抓取失败时保留上一份成功快照。
- 不记录环境变量值、数据库地址、令牌或其他密钥。

## 测试与验收

### 自动化测试

- timer 明确包含 `06:00:00 Asia/Shanghai` 和 `Persistent=true`。
- service 使用直接执行脚本，不包含 `pnpm`、`install` 或构建命令。
- 启动脚本直接调用 `tsx scripts/content-sync.ts`，并保留退出码。
- 旧 cron 模板不再包含内容同步调度行。
- 部署文档说明 timer 安装、持久目录和排障命令。

### 服务器验收

- `systemctl is-enabled` 与 `systemctl is-active` 确认 timer 已启用。
- `systemctl list-timers` 显示下一次北京时间 06:00。
- 手动启动 oneshot service，三项同步均产生成功或符合 freshness 规则的跳过结果。
- 页面显示 2026-07-15 的热点/日报同步时间，技术文章时间不再停留在 2026-06-30。
- 确认没有 `pnpm install`、`next build`、`tsc` 或 `prisma generate` 进程。
- 部署一次新 release 后再次确认生成数据时间不回退。

## 回滚

- 停止并禁用 `learning-agent-platform-content-sync.timer`。
- 恢复备份的 `/etc/cron.d/learning-agent-platform` 内容同步行。
- 持久目录保留，不删除同步数据。
- Web 服务和数据库无需回滚；本次不修改 schema 或抓取逻辑。
