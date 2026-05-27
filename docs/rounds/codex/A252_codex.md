# A252 Codex 记录（Desktop 导航壳 GUI 验证闭环）

## 1. 本轮目标
- 完成 A251 Desktop「导航壳（开发预览）」GUI 验证闭环。
- 仅在发现明确 bug 时做最小修复（仅限 `apps/desktop`）。
- 不新增功能，不做 Git 提交。

## 2. 本轮读取范围
1. `AGENTS.md`
2. `docs/product/PRODUCT_SPEC.md`
3. `docs/architecture/SYSTEM_ARCHITECTURE.md`
4. `docs/codex-tasks/DEVELOPMENT_ROADMAP.md`
5. `docs/codex-context/CODEX_RULES.md`
6. `apps/desktop/index.html`
7. `apps/desktop/main.js`
8. `apps/desktop/route-policy.test.mjs`
9. `docs/rounds/codex/A251_codex.md`

## 3. GUI 验证方式
- 启动 Web（在线场景）：`npm -w @learning-agent-platform/web run dev -- -p 3000`
- 启动 Desktop（CDP 调试）：`npx electron apps/desktop --remote-debugging-port=9333`
- 使用临时自动化运行时（不改仓库依赖）连接 CDP 执行点击验证：
  - 目录：`E:\code\_tmp\a252-playwright-runtime`
  - 关键验证脚本：`a252-home.js` / `a252-reader.js` / `a252-agent.js` / `a252-learning.js` / `a252-diagnostics.js` / `a252-network.js` / `verify-a252-offline.js`

## 4. 发现并修复的明确 bug（最小修复）
### 4.1 Bug 1：Agent/Learning 等 Web 预览页中导航壳偶发消失
- 现象：`#desktop-navigation-shell` 在 Web 预览页会被页面渲染过程移除，导致固定动作不可见（命中“注入导航条隐藏”风险）。
- 修复：在 `createWindow` 内增加轻量壳层同步心跳，周期性调用 `refreshDesktopPageStatus(win)`，仅用于重注入导航壳与页面状态，不改安全边界。
- 文件：`apps/desktop/main.js`

### 4.2 Bug 2：后退 API 弃用告警
- 现象：控制台出现 `webContents.canGoBack/goBack` deprecation warning。
- 修复：优先改用 `webContents.navigationHistory.canGoBack/goBack`，保留旧 API 兜底。
- 文件：`apps/desktop/main.js`

## 5. 成功条件逐项结果

### 5.1 默认首页四入口与导航壳可见
通过（自动化输出）：
- URL：`file:///E:/code/learning-agent-platform/apps/desktop/index.html`
- 状态：`当前页面：Desktop 首页`
- 四入口：
  - `lap://open-reader-preview`
  - `lap://open-agent-preview`
  - `lap://open-learning-preview`
  - `lap://open-diagnostics-preview`
- 导航壳三按钮：
  - `lap://desktop-home`（返回首页）
  - `lap://desktop-back`（后退）
  - `lap://desktop-refresh`（刷新当前预览）

### 5.2 Reader 入口 + 返回首页
通过：
- Reader 状态：`当前页面：Reader`
- 点击返回首页后：URL 回到静态首页，状态恢复 `当前页面：Desktop 首页`

### 5.3 Agent 入口 + 后退/返回首页
通过：
- Agent 路由：`http://localhost:3000/agent?mode=preview`
- 导航壳存在：`hasShell: true`
- 状态：`当前页面：Agent`
- 点击后退后：回到静态首页（`file:///.../apps/desktop/index.html`），状态 `当前页面：Desktop 首页`
- 未触发真实 LLM、工具执行或 Agent loop（见第 5.7 / 5.8）

### 5.4 Learning 入口 + 刷新当前预览
通过：
- Learning 路由：`http://localhost:3000/learning`
- 刷新前后 URL 保持一致：`/learning -> /learning`
- 刷新前后状态均为：`当前页面：Learning`

### 5.5 系统诊断中心可见且摘要非空
通过：
- 导航状态：`当前页面：系统诊断中心`
- Web 服务状态：`在线`
- 固定入口状态条目数：5（Reader/Agent/Learning/Diagnostics/导航壳）
- DB 探活摘要：`未配置` + 只读说明
- 安全边界摘要条目数：5（不调用真实 LLM、不执行工具、不启动 Agent loop 等）

### 5.6 Web 不可用 fallback 场景
通过（停止 Web 后验证）：
- 当前页面状态：`当前页面：Web 不可用`
- Web 状态文案：`Web 服务不可用，请先启动 Web 开发服务。`
- 诊断面板状态同步：`不可用`
- 页面无崩溃，导航壳仍可见
- 未暴露连接串、密钥或完整错误栈（敏感词扫描为空）

### 5.7 控制台检查
通过（无明显业务错误）：
- Desktop 日志仅包含预期的开发预览路由/状态日志。
- 修复后未再出现 `canGoBack/goBack` 弃用告警。
- fallback 场景出现 `ERR_CONNECTION_REFUSED` 属于预期离线回退日志。

### 5.8 Network 检查（导航壳相关）
通过：
- 采集请求数：32（页面加载与静态资源）
- 可疑请求（`/api`、`/actions`、`/llm`、`/tool`、写方法 POST/PUT/PATCH/DELETE）：0
- 未发现导航壳新增 API、server action、DB 写入、LLM 调用或工具执行。

## 6. 指定命令验证结果
1. `pnpm typecheck`：通过（`✅ typecheck passed (0 errors)`）
2. `pnpm lint`：通过（`VM lint complete`）
3. `node --test apps/desktop/route-policy.test.mjs`：通过（28/28）

> 备注：本轮中途 `pnpm` 曾因依赖状态与 `electron` 目录状态触发 install 检查失败；执行 `pnpm install --ignore-scripts` 后恢复，再次执行上述命令均通过。

## 7. 本轮修改文件
1. `apps/desktop/main.js`
2. `docs/rounds/codex/A252_codex.md`

## 8. 安全边界确认
- 未开放任意 URL。
- 未允许用户输入 URL。
- 未放宽 CSP / 外部 URL 拒绝策略 / `nodeIntegration` / `contextIsolation` / `sandbox`。
- 未新增通用 IPC / preload。
- 未修改 `apps/web` Reader / Agent / Learning 业务代码。
- 未写 DB。
- 未接真实 LLM。
- 未执行真实工具。
- 未启动 Agent loop。

## 9. 未完成问题
- 无阻塞未完成项。

## 10. 下一轮建议
1. 将 A252 使用的临时 CDP 自动化脚本收敛为仓库内可复用的 Desktop GUI 回归脚本（仅测试资产，不改运行时能力）。
2. 在 CI 中补一个最小 Desktop 壳层可视回归（至少验证 `#desktop-navigation-shell` 在 Reader/Agent/Learning 页面持续可见）。
