# A243 Codex 轮记录

## 1. 本轮目标
- 在 Desktop 默认首页新增“学习中心（开发预览）”入口。
- 点击入口通过固定内部动作打开 Web `/learning` 页面。
- 保持 Reader / Agent 入口不变，保持安全边界不放宽。
- 补齐 route-policy 测试覆盖 Learning 入口相关约束。

## 2. A242 后状态
- Desktop 已有 Reader / Agent 入口与 Web 服务状态诊断。
- Learning 页面（`/learning`）在 Web 端已完成本地学习闭环开发预览（A234-A242）。
- 项目仍处于 preview-only / mock-only / disabled-by-default 边界。

## 3. 实际阅读文件
- `docs/codex-context/CURRENT_HANDOFF.md`
- `docs/codex-context/CODEX_RULES.md`
- `docs/codex-context/SAFETY_BOUNDARIES.md`
- `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
- `docs/codex-context/DOC_WORKFLOW.md`
- `apps/desktop/index.html`
- `apps/desktop/main.js`
- `apps/desktop/route-policy.js`
- `apps/desktop/route-policy.test.mjs`
- `apps/web/src/app/learning/page.tsx`

## 4. 修改文件
- `apps/desktop/index.html`
- `apps/desktop/main.js`
- `apps/desktop/route-policy.test.mjs`
- `docs/rounds/codex/A243_codex.md`

## 5. Desktop Learning 入口实现方式
- 在 Desktop 静态首页新增独立卡片：`学习中心（开发预览）`。
- 按钮为固定内部链接：`lap://open-learning-preview`。
- 中文说明明确为开发预览，强调“规则推断 + 本地浏览器记录”，不代表真实 AI 推荐系统。
- 保留原 Reader / Agent 卡片与 Web 服务状态诊断区域。

## 6. 固定内部动作 lap://open-learning-preview 的处理方式
- 在 `apps/desktop/main.js` 新增：
  - 常量：`LEARNING_PREVIEW_ROUTE = "/learning"`
  - 函数：`resolveLearningPreviewLaunchConfig()`
  - 函数：`openLearningPreview(win)`
- `openLearningPreview(win)` 复用既有 `resolveDesktopWebTarget` 与日志校验链路，仅构造固定 `/learning` 目标。
- `handleInternalDesktopNavigation` 新增 `open-learning-preview` 分支，仅允许该固定内部动作。
- 不接受 renderer 传入任意 path / query，不开放外部 URL。
- Web 服务不可用时保持既有 fallback 行为（返回 `false`，由现有机制处理），不抛未处理异常。

## 7. Learning 固定路由与 route-policy 变化
- `apps/desktop/route-policy.js` 无需修改：`/learning` 已在允许列表。
- 在 `apps/desktop/route-policy.test.mjs` 新增测试：
  - 允许并正确构造固定 `/learning` 目标。
  - 拒绝 `/learning` 危险 query（如外部跳转 query）并回退到 `/books`。
  - 拒绝 `javascript:` 与外部 `http://evil...` 形式 route 值并回退到 `/books`。

## 8. Reader / Agent 入口回归情况
- 代码层面未改动 Reader / Agent 既有入口参数与打开逻辑。
- `openReaderPreview` / `openAgentPreview` 流程保持原样。
- route-policy 既有 Reader / Agent 测试继续执行。

## 9. Desktop GUI 或替代验证结果
- 本轮未完成 GUI 自动点击验证（本地会话未执行可视化交互自动化）。
- 已完成源码路径审查与命令行测试验证。
- 已尽量执行 `pnpm --filter @learning-agent-platform/desktop run dev`，启动日志显示：
  - `Loading static index.html (default mode)`
  - `Diagnosing local web-service status for http://localhost:3000`
  - `Preview DB probe reachable`
  - `Web-service status: online`
- 手动复现建议：启动 Desktop 后确认首页出现三个入口，并点击 Learning 按钮跳转 `/learning`。

## 10. typecheck/lint/route-policy 结果
- `pnpm typecheck`：通过（0 errors）。
- `pnpm lint`：通过（VM lint complete）。
- `node --test apps/desktop/route-policy.test.mjs`：通过（28 passed, 0 failed）。

## 11. 安全边界确认
- 未接入真实 LLM provider。
- 未执行真实工具。
- 未启动 Agent loop。
- 未新增后端 API / server action / route handler。
- 未写数据库、未改 Prisma schema / migration。
- 未修改 Desktop sandbox / nodeIntegration / contextIsolation / CSP / 外部 URL 拒绝策略。
- 未将 `lap://` 扩展为任意 URL 代理。

## 12. 未完成问题
- GUI 点击链路（Reader / Agent / Learning 三入口）尚待人工或后续自动化可视化验证补全。

## 13. 下一轮建议
- 若本轮通过，优先推进 Desktop 系统诊断页扩展；
- 或推进 Learning 本地周报导出预览；
- 或推进 Reader DB 同步字段 schema 设计评审；
- 不生成提交提示词，等待用户明确要求提交。
