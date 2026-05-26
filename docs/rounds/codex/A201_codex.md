# A201 Codex 轮次记录

## 1. 轮次目标
- 任务：Desktop 路由白名单策略抽离与测试。
- 目标：将 `apps/desktop/main.js` 中 URL/route/reader 参数校验逻辑抽成可测试纯函数模块，并增加最小测试，保持运行时行为不变。

## 2. 代码改动

### 2.1 新增纯函数模块
- 新增文件：`apps/desktop/route-policy.js`
- 抽离函数：
  - `getAllowedWebUrlFromValue(value)`
  - `getAllowedWebRouteFromValue(value)`
  - `validateReaderParam(value)`
  - `buildWebEntryUrl(allowedWebUrl, route, readerParams)`
- 纯函数约束：
  - 不依赖 Electron
  - 不读取 `process.env`
  - 不做 IO
- 安全规则保持不变：
  - 仅允许 `http://localhost:<port>`、`http://127.0.0.1:<port>`、`http://[::1]:<port>`
  - route 仅允许 `/books`、`/learning`、`/reader`
  - `/reader` 缺失或非法 `bookId` 回退 `/books`
  - `chapterId` 可选，参数字符集 `[A-Za-z0-9_-]+`
  - 禁止 query/hash/protocol/双斜杠/反斜杠/空白绕过
  - 不继承 `LAP_DESKTOP_WEB_URL` 的 path/search/hash/credentials

### 2.2 main.js 调整（行为不变）
- 修改文件：`apps/desktop/main.js`
- 保留职责：
  - 读取 `process.env`
  - 创建窗口与安全配置（`nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`）
  - `loadURL/loadFile`
  - 导航守卫与新窗口拦截
- 变化：改为调用 `route-policy.js`，并在 `main.js` 保留原有日志语义与 fallback 流程。

### 2.3 新增最小测试
- 新增文件：`apps/desktop/route-policy.test.mjs`
- 使用：Node 原生 `node:test + assert`（无新依赖）
- 覆盖点：
  1. 合法 `localhost/127.0.0.1/[::1]` + 端口通过
  2. `https`、公网域名、无端口、携带 `username/password` 拒绝
  3. route 未设置默认 `/books`
  4. `/books`、`/learning` 合法
  5. `/reader` 缺 `bookId` 回退 `/books`
  6. `/reader` 合法 `bookId/chapterId` 生成目标 URL
  7. 非法 reader 参数 `bad/id`、`abc?x=1`、`abc#x`、空白拒绝
  8. 原 URL 的 path/query/hash 不继承
  9. 非法 route `/admin?x=1` 回退 `/books`

## 3. 验证命令与结果

1. `node --check apps/desktop/main.js`
- 结果：通过。

2. `node --test apps/desktop/route-policy.test.mjs`
- 结果：通过（10/10）。

3. `pnpm typecheck`
- 结果：通过（`typecheck passed (0 errors)`）。

4. `pnpm lint`
- 结果：通过（`VM lint complete`）。

## 4. GUI Smoke
- 本轮未执行 Electron GUI smoke。
- 原因：本轮目标是纯函数抽离 + 单元测试防护，且在当前终端会话中以命令验证为主，不阻塞交付。

## 5. 变更边界检查
- 是否修改 `apps/web`：否。
- 是否修改 `packages/*`：否。
- 是否修改 Prisma schema/migrations：否。
- 是否修改 `package.json` / lock / workspace：否。
- 是否修改 `.env` / `.env.example`：否。
- 是否触及 Agent/真实 Provider/真实工具执行：否。

## 6. Git
- 本轮未执行 `git add`、`git commit`、`git push`。

## 7. 风险与下一步
- 风险：当前测试集中在策略函数层；与 Electron 进程的集成行为依赖后续 smoke 回归。
- 下一步建议：
  1. 可在有 GUI 条件时补跑 `/books` 与 `/reader` 快速 smoke，确认日志与回退路径与 A200 一致。
  2. 若后续继续扩展路由策略，优先在 `route-policy.test.mjs` 先加用例再改实现。

## 8. 项目总进度
- 更新为：**37.65%**。
