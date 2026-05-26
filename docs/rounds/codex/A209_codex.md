# A209 Codex 记录

## 1. 本轮目标
在 Desktop/Electron 主进程加入一次“最小惰性 DB 探活”，验证 A208 修通 `@learning-agent-platform/db` 解析链路后，Desktop 能安全尝试数据库连通；无论成功或失败都静默回退，不阻塞 GUI、不崩溃、不弹错误对话框。

## 2. A208 前置状态
A208 已完成：
1. `packages/db/package.json` 增加 `main/types/exports` 与 `build` 脚本。
2. `apps/desktop/package.json` 声明 `@learning-agent-platform/db` workspace 依赖。
3. Desktop `dev` 脚本先 build db 再启动 Electron。
4. 已验证 `import('@learning-agent-platform/db')` 可输出 `db-import-ok`。
5. A208 仅修通包解析，尚未执行真实 DB 探活查询。

## 3. 实际阅读文件
按要求仅读取以下文件：
1. `docs/codex-context/CURRENT_HANDOFF.md`
2. `docs/codex-context/CODEX_ALWAYS_READ.md`
3. `docs/codex-context/CODEX_RULES.md`
4. `docs/codex-context/SAFETY_BOUNDARIES.md`
5. `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
6. `docs/codex-context/DOC_WORKFLOW.md`
7. `apps/desktop/package.json`
8. `apps/desktop/main.js`
9. `packages/db/package.json`
10. `packages/db/src/index.ts`

## 4. 修改文件
1. `apps/desktop/main.js`
2. `docs/rounds/codex/A209_codex.md`

## 5. DB 探活实现方式
- 在 `apps/desktop/main.js` 新增 `probePreviewDatabase`：
  - 异步函数；
  - 函数内部使用动态 `import('@learning-agent-platform/db')`；
  - 通过 `getPrismaClient()` 获取 Prisma client；
  - 尝试最小只读查询 `prisma.readingProgress.findFirst({ select: { id: true } })`；
  - 不读取/展示业务数据；
  - `catch` 中统一静默回退，不向主进程顶层抛错；
  - `finally` 尝试 `disconnectPrismaClient()`，并吞掉断开异常。
- 在 `app.whenReady()` 中以 `void probePreviewDatabase()` 方式 fire-and-forget 调用，先触发探活但不阻塞 `createWindow()`。

## 6. 成功/失败日志策略
- 成功日志：`[desktop] 预览数据库可用`
- 失败日志：`[desktop] 预览数据库不可用，继续本地回退`
- 约束：
  - 不输出数据库记录内容；
  - 不输出 `DATABASE_URL`、连接串、token、secret；
  - 不输出完整 error stack。

## 7. 三种场景验证结果
### 7.1 DB 正常连通（默认环境）
命令：`pnpm --filter @learning-agent-platform/desktop run dev`
结果：
- Desktop 启动日志出现：`[desktop] Loading static index.html (default mode)`
- 探活日志出现：`[desktop] 预览数据库可用`
- 未输出任何数据库记录数据。

### 7.2 DB 不可用 / DATABASE_URL 无效（临时环境变量）
命令：`$env:DATABASE_URL='invalid'; pnpm --filter @learning-agent-platform/desktop run dev`
结果：
- Desktop 启动日志出现：`[desktop] Loading static index.html (default mode)`
- 探活日志出现：`[desktop] 预览数据库不可用，继续本地回退`
- 进程未因探活崩溃；GUI 启动路径未被阻塞。

### 7.3 未配置 DATABASE_URL（临时环境变量模拟）
尝试命令：
1. `$env:DATABASE_URL=$null; Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; pnpm --filter @learning-agent-platform/desktop run dev`
2. `$env:PRISMA_DISABLE_ENV_LOAD='1'; $env:DATABASE_URL=$null; Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue; pnpm --filter @learning-agent-platform/desktop run dev`
结果：
- 两次均出现 `预览数据库可用`。
- 推断当前运行环境仍可通过既有配置获得可用连接（例如运行时配置来源不止当前 shell 变量）。
- 因此“严格未配置 DATABASE_URL 且触发回退”的场景在本环境未能独立复现；已如实记录，未编造结果。

## 8. typecheck/lint/build/import/Desktop 启动验证结果
1. `pnpm typecheck`：通过（0 errors）
2. `pnpm lint`：通过
3. `pnpm --filter @learning-agent-platform/db run build`：通过
4. `pnpm --filter @learning-agent-platform/desktop exec node -e "import('@learning-agent-platform/db').then(()=>console.log('db-import-ok'))"`：输出 `db-import-ok`
5. `pnpm --filter @learning-agent-platform/desktop run dev`：可启动并打印探活日志（测试结束后手动 `SIGINT` 退出）

## 9. 安全边界确认
1. 未放宽 `nodeIntegration`。
2. 未放宽 `contextIsolation`。
3. 未放宽 `sandbox`。
4. 未放宽 CSP。
5. 未放宽路由白名单与外部 URL 拒绝策略。
6. 未新增真实 LLM provider 调用。
7. 未新增真实工具执行。
8. 未启动 Agent loop。
9. 未保存 raw prompt / raw response。
10. 未输出 secrets、连接串、完整错误堆栈、完整数据库记录。

## 10. 未完成问题
- “未配置 DATABASE_URL 且一定回退”场景在当前环境下未能独立复现；仅完成了移除/清空/禁用自动加载的临时变量层面尝试。

## 11. 下一轮建议
1. 在 A209+ 中补一个显式“仅探活模式”环境开关（如 `LAP_DESKTOP_DB_PROBE_MODE=force-fallback`），用于可控演练未配置/不可用分支（仅日志，不改 UI/IPC）。
2. 若允许，补一条最小自动化 smoke 测试断言主进程日志分支（可用/回退）但不触达业务数据。
