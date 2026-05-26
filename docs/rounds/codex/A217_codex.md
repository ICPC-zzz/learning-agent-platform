# A217 Codex 执行记录

## 1. 本轮目标
复用 A216 的 Desktop 固定内部动作机制，在 Desktop 默认首页新增“Agent 预览（开发预览）”业务入口。点击入口后通过固定内部协议动作 `lap://open-agent-preview` 打开固定安全路由 `/agent?mode=preview`。本轮不实现真实 Agent 调用，不修改 Agent 业务逻辑，不放宽 Desktop 安全策略。

## 2. A216 后状态
1. Desktop 首页已有 Reader 入口，使用固定动作 `lap://open-reader-preview`。
2. Reader 入口通过既有 `resolveDesktopWebTarget` 与 route-policy 安全规则构造目标 URL。
3. route-policy 在 A216 时覆盖 20/20 测试通过。
4. Agent/Tool/LLM/Skill/Runtime 仍为 preview-only / mock-only / disabled-by-default。

## 3. 实际阅读文件
1. `docs/codex-context/CURRENT_HANDOFF.md`
2. `docs/codex-context/CODEX_RULES.md`
3. `docs/codex-context/SAFETY_BOUNDARIES.md`
4. `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
5. `apps/desktop/main.js`
6. `apps/desktop/index.html`
7. `apps/desktop/route-policy.js`
8. `apps/desktop/route-policy.test.mjs`
9. `apps/web/src/app/agent/page.tsx`
10. `docs/rounds/codex/A216_codex.md`

## 4. 修改文件
1. `apps/desktop/main.js`
2. `apps/desktop/index.html`
3. `apps/desktop/route-policy.js`
4. `apps/desktop/route-policy.test.mjs`
5. `docs/rounds/codex/A217_codex.md`

## 5. Agent 入口实现方式
1. 在 `apps/desktop/index.html` 新增“Agent 预览（开发预览）”卡片。
2. 卡片包含标题、描述、风险说明、按钮“打开 Agent 预览”，并显示固定目标路由 `/agent?mode=preview`。
3. Reader 入口保持不变，首页形成两个业务入口：
   - 阅读器（开发预览）
   - Agent 预览（开发预览）

## 6. 固定内部动作 lap://open-agent-preview 的处理方式
1. 在 `apps/desktop/main.js` 新增固定常量：`AGENT_PREVIEW_ROUTE="/agent"`、`AGENT_PREVIEW_MODE="preview"`。
2. 新增 `resolveAgentPreviewLaunchConfig()`，仅构造固定 Agent 预览目标参数。
3. 新增 `openAgentPreview(win)`，复用 `resolveDesktopWebTarget` 与既有安全校验后加载 URL。
4. 在 `handleInternalDesktopNavigation(win, url)` 中新增分支，仅识别 `lap://open-agent-preview`；未知 `lap://` 动作继续阻断。

## 7. Agent 预览固定路由和参数
1. 固定打开路径：`/agent?mode=preview`。
2. 仅允许 `mode=preview` 单一查询参数；不允许其它参数。
3. 不开放任意 URL、任意 query，也不将 `lap://` 扩展为通用代理。

## 8. route-policy 修改与测试
已做最小补充：
1. `route-policy` 增加受控 `"/agent"` 路由分支。
2. 新增 `buildAgentTarget`：仅当 `agentModeValue === "preview"` 时构造 `/agent?mode=preview`，否则回退 `/books` 并标记 `targetError="agent_mode_required"`。
3. 新增 `isSafeAgentSearchParams`：严格校验仅有 `mode=preview`。
4. `buildWebEntryUrl` 扩展 Agent 校验分支，拒绝非法 Agent query。
5. `resolveDesktopWebTarget` 增加 `agentModeValue` 输入。

新增测试（`apps/desktop/route-policy.test.mjs`）：
1. 允许 `"/agent"` 路由（但仅用于固定 preview 构造）。
2. Windows-like 路径归一化支持 `.../agent`。
3. 正向：`/agent` + `preview` 生成 `http://localhost:3000/agent?mode=preview`。
4. 反向：缺失或非法 mode 回退 `/books` 且标记 `agent_mode_required`。
5. 启动解析正反向测试同步补齐。

## 9. Reader 入口回归情况
1. `index.html` 中 Reader 卡片仍保留，`lap://open-reader-preview` 不变。
2. `main.js` 中 Reader 分支仍保留，`openReaderPreview(win)` 逻辑未削弱。
3. 新增 Agent 入口未影响 Reader 固定动作识别。

## 10. 验证结果
### 必须执行
1. `pnpm typecheck`：通过（0 errors）。
2. `pnpm lint`：通过。
3. `node --test apps/desktop/route-policy.test.mjs`：通过，26/26。

### 尽量执行
1. `pnpm --filter @learning-agent-platform/db run build`：通过。
2. `pnpm --filter @learning-agent-platform/desktop run dev`：已执行，日志显示
   - `[desktop] Loading static index.html (default mode)`
   - `[desktop] 预览数据库可用`

### GUI 验证
当前终端环境无法自动完成 Desktop 窗口点击验证；未编造点击结果。本轮完成源码路径审查、route-policy 测试与 Desktop 启动日志验证。

手动复现步骤：
1. 启动 Web：`pnpm --filter @learning-agent-platform/web dev`
2. 启动 Desktop：`pnpm --filter @learning-agent-platform/desktop run dev`
3. 在 Desktop 首页点击“打开 Agent 预览”，确认跳转到 `/agent?mode=preview`。
4. 确认 Agent 页面仅为预览，无真实 LLM/Tool/Agent loop 执行。
5. 再点击“打开阅读器”，确认 Reader 入口仍正常。

## 11. 安全边界确认
1. 未放宽 `nodeIntegration: false`。
2. 未放宽 `contextIsolation: true`。
3. 未放宽 `sandbox: true`。
4. 未放宽 CSP、外部 URL 拒绝策略。
5. 未新增任意 URL 导航能力。
6. 未修改 Agent 页面业务逻辑。
7. 未接入真实 LLM provider、未执行真实工具、未启动 Agent loop。
8. 未保存 raw prompt/raw response。

## 12. 未完成问题
1. 未完成 GUI 自动点击闭环（受当前执行环境限制）。
2. 需要在本地带图形界面的 Desktop 环境补做一次手动点击确认并截图留档（可在 A217+ 执行）。

## 13. 下一轮建议
1. 若 A217 手动 GUI 验证通过，优先推进 Desktop 首页“状态诊断/系统状态”入口（继续沿用固定内部动作与白名单策略）。
2. 或推进 Agent 预览页内部的安全边界可视化（不触发真实执行）。
3. 不建议继续做纯文案小补丁轮次。