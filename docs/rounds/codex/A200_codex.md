# A200 Codex Round Report

## 1. 目标

1. 修复 `LAP_DESKTOP_WEB_ROUTE` 合法值被误报 rejected 的日志噪音。
2. 保持路由白名单不放宽（仅 `/books`、`/learning`、`/reader`）。
3. 验证 `/learning` 可正常加载。
4. 不改 Web/DB/Agent，不做新功能，不执行 git 提交。

## 2. 修改文件

1. `apps/desktop/main.js`
2. `docs/desktop-web-loader.md`
3. `docs/rounds/codex/A200_codex.md`（本文件）
4. `docs/codex-context/CURRENT_HANDOFF.md`（追加 A200 摘要）

## 3. 误报根因

在 `pnpm --filter @learning-agent-platform/desktop dev` 启动链路中，`LAP_DESKTOP_WEB_ROUTE="/books"` 会被 shell/toolchain 路径改写成类似 `D:/.../books`。  
该值随后命中 `schemePrefix` 安全规则（`D:`），触发：

- `LAP_DESKTOP_WEB_ROUTE rejected by safety rule - falling back to default /books`

由于默认回退也是 `/books`，表现为“实际可用但日志误报噪音”。

## 4. 修复说明（仅最小改动）

在 `apps/desktop/main.js` 中：

1. 保留原有空值默认逻辑与严格白名单逻辑。
2. 增加 `tryNormalizeConvertedAllowedRoute(route)`：
   - 仅识别 Windows 风格改写路径，且 basename 必须是 `books|learning|reader`。
   - 仅还原为 `/books`、`/learning`、`/reader` 三个固定值。
3. 仅在原“安全规则命中”分支内尝试该还原；不匹配则仍按原策略 rejected 并回退 `/books`。

安全性未放宽：

- 仍拒绝 query/hash/protocol/双斜杠/反斜杠/空白绕过。
- 仍保持 `nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`。
- 未新增 preload、webviewTag、外部导航/新窗口放行。

## 5. 验证命令与结果

### 5.1 静态检查

1. `node --check apps/desktop/main.js`：通过
2. `pnpm typecheck`：通过（`typecheck passed (0 errors)`）
3. `pnpm lint`：通过（`VM lint complete`）

### 5.2 Desktop 日志级验证

1. 合法 `/books`：
   - `LAP_DESKTOP_WEB_URL=http://localhost:3000`
   - `LAP_DESKTOP_WEB_ROUTE=/books`
   - 结果：加载 `http://localhost:3000/books`，不再出现 route rejected 噪音。通过。

2. 合法 `/learning`：
   - `LAP_DESKTOP_WEB_ROUTE=/learning`
   - 结果：加载 `http://localhost:3000/learning`；Web 日志出现 `GET /learning 200`。通过。

3. 非法 route：
   - `LAP_DESKTOP_WEB_ROUTE=/admin?x=1`
   - 结果：出现 rejected 安全日志，并回退加载 `/books`。通过。

4. 非法外部 URL：
   - `LAP_DESKTOP_WEB_URL=https://example.com`
   - 结果：协议拒绝，回退静态首页。通过。

5. Web dev server 不可用：
   - `LAP_DESKTOP_WEB_URL=http://localhost:3000` 且服务关闭
   - 结果：`ERR_CONNECTION_REFUSED` 后回退静态首页。通过。

GUI 说明：

- 本轮为日志级 GUI 验证（进程与访问日志）；未做人工像素级窗口截图比对。

## 6. 变更边界核对

1. 是否修改 Web：否
2. 是否修改 DB / Prisma：否
3. 是否修改 Agent/Tool/LLM：否
4. 是否修改 package 管理文件（`package.json`/lock/workspace）：否
5. 是否修改 `.env` / `.env.example`：否
6. 是否执行 git 提交：否（按要求未执行）

## 7. 风险与说明

1. 该修复只针对已知“路由值被路径改写”形态进行窄匹配，避免放宽安全策略。
2. 桌面进程日志里仍可见 Electron cache 权限噪音（与本任务无关，未处理）。
3. `getAllowedWebUrl()` 在创建窗口与加载入口各调用一次，非法 URL 场景会重复打印一次协议拒绝日志（既有行为，未在本轮改动）。

## 8. 下一步建议

1. 若需要，可在后续小轮次单独处理“非法 URL 重复日志一次”的降噪，不改安全策略。
2. 若继续 Desktop 路由验证，可按同样方式补齐 `/reader` 与参数边界日志回归。

## 9. 进度

本轮通过后，项目总进度更新为：**37.60%**。
