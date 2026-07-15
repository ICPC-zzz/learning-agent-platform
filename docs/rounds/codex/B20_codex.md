# B20 Codex：每日内容同步定时器可靠性修复

日期：2026-07-15

## 本轮目标

修复生产服务器每日 06:00 内容同步未更新的问题，确保任务不会因原子 release 复用依赖而触发包管理器安装，并保证生成内容在发布后不回退。

## 根因证据

- `/etc/cron.d/learning-agent-platform` 原有三条任务仍存在，服务器时区为 `Asia/Shanghai`。
- 2026-07-15 06:00、06:10、06:20 三项任务都被 cron 准时触发。
- 三份日志均在进入同步代码前报错：`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`。
- 原因是 cron 调用 `pnpm content:sync:*`，pnpm 对跨 release 复用的 `node_modules` 做依赖自检并尝试安装，非交互任务拒绝清理目录。
- 技术文章生成文件原来位于 release 内，发布切换会重新看到仓库旧文件，因此页面的文章同步时间可能倒退。
- 去除 pnpm/构建后，文章采集器归并阶段仍出现约 60% 瞬时 CPU；本轮将完整同步 cgroup 限制为单核 25%。

## 实现

- 新增 `learning-agent-platform-content-sync.timer`：每天 `06:00:00 Asia/Shanghai` 触发，`Persistent=true`，错过后开机补跑。
- 新增 oneshot service：失败后每 10 分钟重试，1 小时最多 3 次，`CPUQuota=25%`。
- 新增无构建启动脚本，直接运行当前 release 的 `node_modules/.bin/tsx scripts/content-sync.ts`。
- 启动脚本校验 `tsx`、同步入口和 `packages/db/dist/index.js`，缺失时安全失败；不会调用 pnpm、依赖安装、Prisma generate、tsc 或 Next build。
- 新增持久数据准备脚本，将 `apps/web/src/data` 目录链接到 `/opt/learning-agent-platform/shared/content-data`。
- 使用目录级链接兼容技术文章采集器的临时文件加原子替换写入方式。
- 旧 cron 内容同步模板已退役；生产服务器只保留 03:20 PostgreSQL 备份 cron。
- 修正 A524 中已经过期的“Web systemd 必须通过 pnpm 启动”断言，改为检查现行直接 Node 启动。

## TDD 与本地验证

- RED：`tests/b020-content-sync-systemd-timer.test.mjs` 首次运行因新 service 模板不存在而 `ENOENT` 失败。
- 历史契约 RED：A524/A526 更新后同样因 systemd 同步模板缺失而失败。
- CPU 契约 RED：新增 `CPUQuota=25%` 断言后，模板缺少限额，2 项按预期失败。
- GREEN：B20、A524、A526 共 13 项测试全部通过，0 失败。
- 两个 Bash 脚本 `bash -n` 均通过。
- `systemd-analyze calendar '*-*-* 06:00:00 Asia/Shanghai'` 解析成功，下一次为 2026-07-16 06:00 CST。
- Web TypeScript `tsc --noEmit` 通过。
- Next.js 15.5.18 生产构建成功，生成 40 个页面；仅有既有 CSS `end`/`flex-end` 兼容性警告。

## 生产迁移与验收

- 原 cron 已备份到 `/etc/cron.d/learning-agent-platform.before-content-timer`。
- 三条内容同步 cron 已删除，PostgreSQL 备份任务保留。
- timer 状态：`enabled`、`active`、`Persistent=yes`。
- 下一次执行：2026-07-16 06:00 CST。
- 立即补跑结果：
  - 热点：获取 85 条，去重并保存 84 条。
  - GitHub 日报：获取并保存 41 条。
  - 技术文章：新增 181 篇，当前 2134 篇。
- service 运行约 2 分 21 秒，CPU 时间 18.590 秒，内存峰值 210.6 MB，退出码 0，无重启。
- 运行时 CPU 配额为 25%；任务完成后 Next 进程约 0.1% CPU。
- 数据库 2026-07-15 快照：`TECH_HOTSPOT=84`、`GITHUB_REPOSITORY=41`。
- `apps/web/src/data` 已解析到 `/opt/learning-agent-platform/shared/content-data`。
- 文章页同步标签已更新为 `2026/07/15 14:39`，不再停留在 6 月 30 日。
- `https://cfagent.fun/api/health` 返回 HTTP 200，数据库状态为 `ok`。

## 修改文件

- `deploy/systemd/learning-agent-platform-content-sync.service.example`
- `deploy/systemd/learning-agent-platform-content-sync.timer.example`
- `deploy/scripts/run-content-sync.sh.example`
- `deploy/scripts/prepare-content-data.sh.example`
- `deploy/cron/content-sync.example`
- `docs/deployment/ALIYUN_UBUNTU_DEPLOYMENT.md`
- `tests/a524-deployment-assets.test.mjs`
- `tests/a526-content-scheduler-contract.test.mjs`
- `tests/b020-content-sync-systemd-timer.test.mjs`
- `docs/superpowers/specs/2026-07-15-content-sync-systemd-timer-design.md`
- `docs/superpowers/plans/2026-07-15-content-sync-systemd-timer.md`
- `docs/codex-context/CURRENT_HANDOFF.md`
- `docs/rounds/codex/B20_codex.md`

## 运维与回滚

- 查看 timer：`systemctl list-timers learning-agent-platform-content-sync.timer --all`
- 查看日志：`journalctl -u learning-agent-platform-content-sync.service`
- 手动补跑：`systemctl start learning-agent-platform-content-sync.service`
- 回滚调度：禁用 timer，再恢复 cron 备份；不得删除 shared 内容目录。
- 发布新 release 时必须先执行 `prepare-content-data.sh <release-path>`，再切换 `current`。

## 已知边界

- 本轮已验证 timer 计算出的下一次时间、手动 oneshot 执行和持久数据读写；2026-07-16 06:00 的首次自然触发需要届时通过 timer/journal 继续观察。
- 本轮未修改抓取算法、数据库 schema、公开路由或管理后台手动同步逻辑。
- 项目总体功能完成度保持约 59.5%，本轮属于 Web 生产维护修复。
