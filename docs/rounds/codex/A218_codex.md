# A218 Codex 执行记录

## 1. 本轮目标
完成 A217 Desktop「Agent 预览（开发预览）」入口的 GUI 验证闭环；仅在发现明确 bug 时做 `apps/desktop` 最小修复。本轮不新增第三个 Desktop 入口，不扩展 Agent 功能，不重构业务代码。

## 2. 本轮读取与审查范围
1. `AGENTS.md`
2. `docs/product/PRODUCT_SPEC.md`
3. `docs/architecture/SYSTEM_ARCHITECTURE.md`
4. `docs/codex-tasks/DEVELOPMENT_ROADMAP.md`
5. `apps/desktop/index.html`
6. `apps/desktop/main.js`
7. `apps/desktop/route-policy.js`
8. `apps/desktop/route-policy.test.mjs`
9. `apps/web/src/app/agent/page.tsx`
10. `apps/web/src/app/agent/actions.ts`
11. `apps/web/src/app/agent/_lib/runtime-mock-preview-plan.ts`

补充：`docs/codex-tasks/CODEX_RULES.md` 在当前仓库不存在（目录下仅有 `DEVELOPMENT_ROADMAP.md`）。

## 3. 验收项结果

### 3.1 默认首页双入口（Reader + Agent）
结果：通过（源码 + 启动日志）。

证据：
1. `apps/desktop/index.html` 同时存在
   - `阅读器（开发预览）` 卡片，`href="lap://open-reader-preview"`
   - `Agent 预览（开发预览）` 卡片，`href="lap://open-agent-preview"`
2. Desktop 默认启动日志：
   - `[desktop] Loading static index.html (default mode)`

### 3.2 点击 Agent 入口走固定内部动作并落到固定安全路由
结果：通过（源码 + 启动日志）。

证据：
1. `apps/desktop/main.js` 中 `handleInternalDesktopNavigation` 仅识别
   - `lap://open-agent-preview` -> `openAgentPreview(win)`
2. `openAgentPreview` 固定传入
   - `routeValue: "/agent"`
   - `agentModeValue: "preview"`
3. 启动日志（设置 `LAP_DESKTOP_WEB_ROUTE=/agent`、`LAP_DESKTOP_AGENT_MODE=preview`）：
   - `[desktop] Loading local dev server entry: http://localhost:3000/agent?mode=preview ...`

### 3.3 Agent 页面仅 preview/mock，禁真实 LLM/Tool/Loop，且不存 raw prompt/raw response
结果：通过（源码路径审查 + Web 可达性验证）。

证据：
1. `apps/web/src/app/agent/actions.ts`
   - `previewOnly: true`
   - `executable: false`
   - `realExecutionEnabled: false`
   - `toolsExecuted: false`
   - `llmCalled: false`
2. `apps/web/src/app/agent/_lib/runtime-mock-preview-plan.ts`
   - `toolExecutionEnabled: false`
   - `llmCallEnabled: false`
   - `previewOnly: true`
3. `packages/ai-core` / `packages/db` 相关安全字段审查显示 raw 存储标记持续为 false（仅保存 summary，不保存 raw prompt/raw response）。
4. 页面可达性：`GET /agent?mode=preview` 返回 `200`。

### 3.4 A216 Reader 入口回归不受影响
结果：通过（源码 + 启动日志 + 页面可达性）。

证据：
1. `apps/desktop/main.js` 仍保留 `lap://open-reader-preview` 分支。
2. Reader 固定参数构造逻辑未变（`bookId` + `chapterId`）。
3. 启动日志（`LAP_DESKTOP_WEB_ROUTE=/reader`）：
   - `[desktop] Loading local dev server entry: http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll ...`
4. 页面可达性：`GET /reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll` 返回 `200`。

### 3.5 指定命令回归
结果：通过。

1. `pnpm typecheck`：通过（`0 errors`）。
2. `pnpm lint`：通过。
3. `node --test apps/desktop/route-policy.test.mjs`：通过（`26/26`）。

### 3.6 GUI 点击工具限制说明
结果：已满足限制分支要求。

说明：
1. 本次执行环境无法对 Electron 原生窗口进行自动化点击验收（无可用 Electron GUI 点击工具链接入本会话）。
2. 已完成替代闭环：
   - 源码路径审查
   - Desktop 启动日志验证
   - Web 页面可达性验证
3. 未编造任何点击结果。

### 3.7 明确问题与最小修复
结果：未发现需要修复的明确 bug；未改动 `apps/desktop` 业务代码。

### 3.8 输出 A218 文档
结果：已完成（本文档）。

## 4. 本轮修改文件
1. `docs/rounds/codex/A218_codex.md`（新增）

说明：未修改 `apps/desktop` 与 Reader/Agent 业务逻辑。

## 5. 安全边界确认
1. 未放宽 Desktop URL 白名单与路由白名单。
2. 未放宽 `nodeIntegration: false` / `contextIsolation: true` / `sandbox: true`。
3. 未引入任意 URL 导航能力。
4. 未接入真实 LLM Provider、未执行真实 Tool、未启动 Agent loop。
5. 未保存 raw prompt/raw response。

## 6. 手动验收步骤（用户可复现）
1. 启动 Web：`pnpm dev`（或 `pnpm -w @learning-agent-platform/web run dev`）。
2. 启动 Desktop：`pnpm --filter @learning-agent-platform/desktop run dev`。
3. 在 Desktop 默认首页确认同时看到：
   - `阅读器（开发预览）`
   - `Agent 预览（开发预览）`
4. 点击 `打开 Agent 预览`，确认跳转目标为 `/agent?mode=preview`。
5. 在 Agent 页确认仅为预览状态（不执行真实 Tool/LLM/Loop）。
6. 返回首页点击 `打开阅读器`，确认 Reader 入口仍可正常打开。

## 7. 剩余问题
1. Electron 运行日志中存在 Chromium cache 权限告警（`Unable to move the cache` / `Gpu Cache Creation failed`），不影响本轮入口与路由验收，但建议后续单独排查运行环境权限。
2. `docs/codex-tasks/CODEX_RULES.md` 缺失（若这是预期，应在总控文档中同步说明）。

## 8. 下一轮建议
1. 在有图形界面与可交互环境下补一轮“真实点击+截图留档”验收（仅验证，不扩展功能）。
2. 若要提升稳定性，可单独开 A218+ 会话排查 Electron cache 权限告警（不触碰 Agent/Reader 业务逻辑）。
