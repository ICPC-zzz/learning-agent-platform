# A251 Codex 记录（Desktop 最小导航壳能力 / 开发预览）

## 1. 本轮目标
- 在 Desktop 壳层补最小导航能力：`返回首页`、`后退`、`刷新当前预览`、`当前页面状态`。
- 保持 Reader / Agent / Learning / Diagnostics 四个固定入口可用。
- 不开放任意 URL，不放宽安全策略，不修改 Web 业务逻辑。

## 2. A250 后状态
- A250 已完成 Learning → Reader 的 `database / empty / fallback` 验证闭环。
- Desktop 仍以 Web 视图容器为主，缺少统一导航壳体验。

## 3. 实际阅读文件
1. `docs/codex-context/CURRENT_HANDOFF.md`
2. `docs/codex-context/CODEX_RULES.md`
3. `docs/codex-context/SAFETY_BOUNDARIES.md`
4. `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
5. `docs/codex-context/DOC_WORKFLOW.md`
6. `apps/desktop/index.html`
7. `apps/desktop/main.js`
8. `apps/desktop/route-policy.js`
9. `apps/desktop/route-policy.test.mjs`
10. `docs/rounds/codex/A250_codex.md`

## 4. 修改文件
- `apps/desktop/index.html`
- `apps/desktop/main.js`
- `docs/rounds/codex/A251_codex.md`

## 5. Desktop 导航壳实现方式
- 在静态首页新增“导航壳（开发预览）”区块，提供三个固定按钮：
  - `lap://desktop-home`
  - `lap://desktop-back`
  - `lap://desktop-refresh`
- 在主进程增加页面状态发布逻辑：
  - 静态首页直接更新 `#desktop-current-page-status`。
  - 当页面进入 Reader / Agent / Learning 等 Web 预览页时，主进程通过 `executeJavaScript` 注入同款极简导航条，保证可回首页/后退/刷新。

## 6. 固定内部动作设计
- 新增固定动作（无 path/query/hash）：
  - `lap://desktop-home`：仅回到本地静态首页（`index.html`）。
  - `lap://desktop-back`：仅调用 `webContents.canGoBack()/goBack()`；无历史时只记录“不可后退”并保持页面。
  - `lap://desktop-refresh`：仅刷新当前页；URL 为空时回退首页。
- `handleInternalDesktopNavigation` 对 `lap://` 增加结构校验：
  - 仅接受根路径与空 search/hash。
  - 非法或未知动作直接阻断并记录。

## 7. 当前页面状态展示方式
- 状态短文本统一为：
  - `Desktop 首页`
  - `Reader`
  - `Agent`
  - `Learning`
  - `系统诊断中心`
  - `外部页面已拒绝`
  - `Web 不可用`
- 规则：
  - Reader/Agent/Learning 根据当前受控路由判定。
  - Diagnostics 根据静态页诊断视图状态判定。
  - 外部 URL 拒绝时立即切换到“外部页面已拒绝”。
  - 静态页且 Web 探测为 offline/error 时显示“Web 不可用”。

## 8. route-policy 是否修改及测试结果
- `route-policy.js`：未修改。
- 原因：本轮导航壳动作仅在 Desktop 主进程 `lap://` 固定动作分支处理，不新增 route-policy 输入面。
- `node --test apps/desktop/route-policy.test.mjs`：通过（28 passed / 0 failed）。

## 9. Reader / Agent / Learning / Diagnostics 四入口回归情况
- 四个既有入口链接均保留：
  - `lap://open-reader-preview`
  - `lap://open-agent-preview`
  - `lap://open-learning-preview`
  - `lap://open-diagnostics-preview`
- 主进程入口函数仍通过原有安全构造逻辑加载固定目标。
- 路由策略回归测试通过，未出现放宽任意 route/query 的改动。

## 10. GUI 或替代验证结果
- 已尝试启动 Desktop：`pnpm --filter @learning-agent-platform/desktop run dev`。
- 启动日志确认：
  - Desktop 加载静态首页。
  - 本地 Web 服务诊断执行并返回 offline。
- 本环境未执行 GUI 自动化点击回放（未产出自动化点击证据），因此未声称已完成完整按钮点击闭环；采用“启动日志 + 源码路径审查 + 必跑测试”替代。
- 手动复现建议：
  1. 启动 Web：`pnpm --filter @learning-agent-platform/web run dev`（或项目现有 Web 启动命令）。
  2. 启动 Desktop：`pnpm --filter @learning-agent-platform/desktop run dev`。
  3. 依次点 Reader / Agent / Learning / Diagnostics，再点“返回首页/后退/刷新当前预览”，观察状态文本变化与页面可达性。

## 11. typecheck / lint / route-policy 结果
- `pnpm typecheck`：通过。
- `pnpm lint`：通过。
- `node --test apps/desktop/route-policy.test.mjs`：通过（28/28）。

## 12. 安全边界确认
- 未放宽 Desktop 安全策略（`nodeIntegration/contextIsolation/sandbox` 未改）。
- 未新增 preload、未开放通用 IPC、未允许任意 URL 输入。
- 未开放外部 URL；未知 `lap://` 动作仍阻断。
- 未修改 `apps/web/**` 业务逻辑。
- 未接入真实 LLM、未执行工具、未启动 Agent loop。
- 未新增 DB 写入、未改 Prisma schema/migration。

## 13. 未完成问题
- GUI 自动化级别的点击证据（逐按钮截图/录制）本轮未完成。
- 当前已具备代码与主流程日志验证，但仍建议补一轮可视化 GUI 回归。

## 14. 下一轮建议
- 优先建议：推进 Desktop 导航壳 GUI 验证补齐（按钮点击、状态切换、fallback 观测）。
- 备选建议：
  - Reader DB 同步字段 schema 设计评审（仅文档）。
  - Learning → Reader 跳转的 Desktop 内联验证补强。
- 本轮不生成提交提示词。
