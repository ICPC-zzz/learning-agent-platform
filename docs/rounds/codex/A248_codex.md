# A248 Codex 记录

## 1. 本轮目标
完成 A247 Desktop「系统诊断中心（开发预览）」GUI 自动点击验证闭环；仅在发现明确 bug 时最小修复。本轮不新增功能，不做 Git 提交。

## 2. 本轮读取范围
1. `AGENTS.md`
2. `docs/product/PRODUCT_SPEC.md`
3. `docs/architecture/SYSTEM_ARCHITECTURE.md`
4. `docs/codex-tasks/DEVELOPMENT_ROADMAP.md`
5. `docs/codex-context/CODEX_RULES.md`
6. `apps/desktop/main.js`
7. `apps/desktop/index.html`
8. `apps/desktop/route-policy.js`
9. `apps/desktop/route-policy.test.mjs`
10. `docs/rounds/codex/A247_codex.md`

## 3. GUI 自动化验证方式
- 启动 Web：`pnpm --filter @learning-agent-platform/web run dev -p 3000`
- 启动 Desktop（CDP 调试）：`npx electron apps/desktop --remote-debugging-port=<port>`
- 使用 Node + Chrome DevTools Protocol（WebSocket）对 Desktop 窗口执行：
  - DOM 抽取（四入口与诊断面板摘要）
  - 自动点击「打开诊断中心」
  - 固定动作路由回归（Reader/Agent/Learning/Diagnostics）
  - Web 不可用 fallback 场景验证

## 4. 成功条件逐项结果

### 4.1 Desktop 默认首页四入口可见
通过。自动抓取到 4 个动作按钮：
1. `lap://open-reader-preview`
2. `lap://open-agent-preview`
3. `lap://open-learning-preview`
4. `lap://open-diagnostics-preview`

### 4.2 点击「打开诊断中心」触发固定动作
通过。自动点击后检测到诊断面板 `#desktop-diagnostics-panel` 被聚焦高亮（`outline` 变为 `rgb(15, 108, 207) solid 2px`），对应 `lap://open-diagnostics-preview` 动作链路生效。

### 4.3 诊断面板五项摘要可见且非空
通过，且均为非空：
1. Web 服务状态：`在线`（或 Web 不可用场景下 `不可用`）
2. 固定入口状态：4 个固定动作均显示“可用”
3. Desktop 安全配置：`nodeIntegration/contextIsolation/sandbox/URL 拒绝策略` 均有值
4. DB 探活摘要：`未配置` + 只读说明（无写入）
5. 安全边界摘要：不调用真实 LLM、不执行工具、不启动 Agent loop 等

### 4.4 只读安全展示与敏感信息保护
通过。自动检查页面文本：
- 未出现 `DATABASE_URL`、`API key`、`token`、`secret`、`sk-`
- 未出现完整错误栈文本
- 未发现 Node API 暴露迹象

### 4.5 Reader / Agent / Learning 入口回归
通过。自动回归结果：
1. `lap://open-reader-preview` -> `http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`
2. `lap://open-agent-preview` -> `http://localhost:3000/agent?mode=preview`
3. `lap://open-learning-preview` -> `http://localhost:3000/learning`
4. 每次均可再回到静态首页并继续触发 diagnostics 固定动作

### 4.6 控制台与 Web 不可用 fallback
通过。
- 常规单路径验证日志无明显异常。
- Web 不可用场景（关闭 Web 后以 `/books` dev preview 启动 Desktop）：
  - 主框架加载失败后自动回退静态首页
  - 诊断面板仍可显示
  - 状态文案为 `Web 服务不可用，请先启动 Web 开发服务。`
  - 未崩溃

## 5. 指定命令验证结果
1. `pnpm typecheck`：通过（0 errors）
2. `pnpm lint`：通过
3. `node --test apps/desktop/route-policy.test.mjs`：通过（28/28）

## 6. 是否修复 bug
未发现需要修复的明确 bug，本轮未改动 `apps/desktop` 代码。

## 7. 本轮修改文件
1. `docs/rounds/codex/A248_codex.md`（新增）

## 8. 安全边界确认
- 未开放任意 URL
- 未放宽 CSP / 外部 URL 拒绝策略 / `nodeIntegration` / `contextIsolation` / `sandbox`
- 未新增 IPC / preload 能力
- 未新增 API、未写 DB、未接真实 LLM、未执行真实工具、未启动 Agent loop

## 9. 未完成问题
无阻塞问题。本轮目标已完成。

## 10. 下一轮建议
1. 把本轮 CDP 自动化脚本沉淀为仓库内可复用诊断回归脚本（仅测试资产，不改运行时能力）。
2. 在不放宽安全策略前提下，补充 Desktop 诊断中心的最小可视化快照对比测试。

## 11. 项目总进度（口径）
保持 A247 口径：约 `50.00%`（本轮为验证闭环与质量回归，不扩展功能范围）。
