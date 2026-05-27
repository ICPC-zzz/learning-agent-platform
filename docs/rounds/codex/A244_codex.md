# A244 Codex 验证记录

## 1. 目标与范围
- 目标：完成 A243 Desktop 三入口 GUI 验证闭环，仅在发现明确问题时做 `apps/desktop` 范围最小修复。
- 范围限制：不新增功能、不改 Web Reader/Learning/Agent 业务逻辑、不放宽安全策略、不做 Git 提交。

## 2. 本轮执行环境与前置说明
- 工作目录：`E:\code\learning-agent-platform`
- Web 启动端口：`3000` 已被占用，`next dev` 自动切换为 `http://localhost:3001`。
- GUI 自动化限制：当前环境未安装 Playwright Electron 自动化依赖（`PLAYWRIGHT_MISSING`），无法在本轮对 Desktop 窗口内按钮执行可重复脚本点击。
- 按要求采用替代闭环：Desktop 启动日志 + 源码路径审查 + 页面可达性验证 + 手动验收步骤说明（不编造点击结果）。

## 3. 源码审查（入口绑定与安全链路）
### 3.1 Desktop 首页三入口
- 文件：`apps/desktop/index.html`
- 结果：默认静态首页包含三入口与固定动作：
  - 阅读器（开发预览） -> `lap://open-reader-preview`
  - Agent 预览（开发预览） -> `lap://open-agent-preview`
  - 学习中心（开发预览） -> `lap://open-learning-preview`
- 结果：保留 `Web 服务状态（开发预览）` 诊断卡片。

### 3.2 lap 内部动作与固定路由
- 文件：`apps/desktop/main.js`
- 结果：`handleInternalDesktopNavigation` 仅接受三种 `lap://open-*` 内部动作，并分别调用：
  - `openReaderPreview()` -> 固定 `/reader` + 固定 preview book/chapter
  - `openAgentPreview()` -> 固定 `/agent?mode=preview`
  - `openLearningPreview()` -> 固定 `/learning`
- 结果：未知 `lap://` 动作会被阻断并记录告警。

### 3.3 route-policy 安全边界
- 文件：`apps/desktop/route-policy.js`
- 结果：仍仅允许本地 `http://localhost|127.0.0.1|[::1]:port`，拒绝凭证、非 http、外部域名。
- 结果：路由白名单仍是 `/books`、`/learning`、`/reader`、`/agent`。
- 结果：`/agent` 强制 `mode=preview`；`/reader` 强制合法 `bookId`（`chapterId` 可选且需合法）；危险 query/hash 会被拒绝。

## 4. 运行验证结果
### 4.1 Web 可达性（3001）
- `GET /learning` -> `200`
- `GET /reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll` -> `200`
- `GET /agent?mode=preview` -> `200`
- `GET /learning` 页面命中文案：
  - 最近阅读进度（开发预览）
  - 下一步学习建议（开发预览）
  - 今日学习任务（开发预览）
  - 今日任务完成统计（开发预览）
  - 本地任务历史趋势（开发预览）
  - 本地任务周报预览（开发预览）

### 4.2 Desktop 启动日志验证
#### 默认模式（未设置 `LAP_DESKTOP_WEB_URL`）
- 关键日志：
  - `[desktop] Loading static index.html (default mode)`
  - `[desktop] Diagnosing local web-service status for http://localhost:3000`
  - `[desktop] Web-service status: online`
- 结论：默认进入 Desktop 静态首页，且 Web 服务诊断机制生效。

#### 三入口目标路由回归（通过同一路由解析链）
- 设置 `LAP_DESKTOP_WEB_URL=http://localhost:3001` 并分别启动：
  - `LAP_DESKTOP_WEB_ROUTE=/learning` -> 日志加载 `http://localhost:3001/learning`
  - `LAP_DESKTOP_WEB_ROUTE=/reader` + Reader 参数 -> 日志加载 `http://localhost:3001/reader?bookId=...&chapterId=...`
  - `LAP_DESKTOP_WEB_ROUTE=/agent` + `LAP_DESKTOP_AGENT_MODE=preview` -> 日志加载 `http://localhost:3001/agent?mode=preview`
- 结论：Learning/Reader/Agent 目标路由均保持固定安全构造，不受新增入口影响。

#### Web 不可用 fallback 回归
- 设置 `LAP_DESKTOP_WEB_URL=http://localhost:3999`、`LAP_DESKTOP_WEB_ROUTE=/learning`。
- 关键日志：
  - `ERR_CONNECTION_REFUSED`
  - `[desktop] Falling back to static index.html`
  - `[desktop] Web-service status: offline`
- 结论：Web 不可用时安全回退到静态首页，不崩溃。

## 5. 明确问题与最小修复
- 发现问题：Web 在线状态提示文案遗漏 Learning 入口（显示为“Reader / Agent 入口可尝试打开”）。
- 修复范围：`apps/desktop/main.js`（1 行文案）。
- 修复内容：更新为“Web 服务在线，Reader / Agent / Learning 入口可尝试打开。”
- 影响：仅提示文案一致性修复，不影响路由、安全策略或功能行为。

## 6. 测试结果
- `pnpm typecheck`：通过
- `pnpm lint`：通过
- `node --test apps/desktop/route-policy.test.mjs`：通过（`28/28`）

## 7. 安全边界复核
- 未放宽 URL 白名单。
- 未放宽 CSP。
- 未修改 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。
- 未新增 Desktop API。
- 未接入真实 LLM、未执行真实工具、未启动 Agent loop。
- 未修改 Web Learning/Reader/Agent 业务逻辑。

## 8. 本轮修改文件
- `apps/desktop/main.js`（文案最小修复）
- `docs/rounds/codex/A244_codex.md`（本记录）

## 9. 未完成项与限制
- 受限于本轮环境自动化能力，未提供 Desktop 窗口内“真实点击”脚本录像/截图证据。
- 已按要求提供替代闭环证据与手动验收步骤，不编造点击结果。

## 10. 手动验收步骤（供下一轮或人工复核）
1. 启动 Web：`pnpm --filter @learning-agent-platform/web run dev`（记下实际端口）。
2. 启动 Desktop 默认模式：`pnpm --filter @learning-agent-platform/desktop run dev`，确认首页出现三入口与 Web 服务状态卡。
3. 点击“打开学习中心”，确认跳转 `/learning` 并看到最近阅读进度、下一步建议、今日任务、统计、历史趋势、周报卡片。
4. 返回后点击“打开阅读器”，确认跳转固定 Reader 预览路由。
5. 返回后点击“打开 Agent 预览”，确认跳转固定 `/agent?mode=preview`，且仅预览态。
6. 关闭 Web 服务重试，确认 Desktop 回退静态首页且显示 offline/error，不崩溃。

## 11. 下一轮建议
- 若需要强证据化 GUI 回归，可在仓库引入独立 Electron UI 自动化方案（Playwright Electron 或等价方案）并补充 A244 的可重复点击脚本。
