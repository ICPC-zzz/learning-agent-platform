# A247 Codex 记录

## 1. 本轮目标
在 Desktop 默认首页新增“系统诊断中心（开发预览）”入口，并实现本地诊断面板，集中展示 Web 服务状态、固定入口状态、Desktop 安全配置摘要、DB 探活摘要与安全边界摘要；保持 preview-only，不新增真实执行能力。

## 2. A246 后状态
- A216/A217/A243 已完成 Reader/Agent/Learning Desktop 入口。
- A222 已完成 Desktop Web 服务状态诊断。
- A222-A246 代码尚未提交（本轮按要求未执行 `git add/commit/push`）。
- 项目总进度口径约 50.00%（A246）。

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
10. `docs/rounds/codex/A246_codex.md`

补充检索（仅 `rg`）：`db health|database|probe|health|LAP_DESKTOP|web service status|route-policy`。

## 4. 修改文件
1. `apps/desktop/index.html`
2. `apps/desktop/main.js`
3. `docs/rounds/codex/A247_codex.md`

## 5. Desktop 诊断入口实现方式
- 在静态首页新增第四张入口卡片：
  - 标题：系统诊断中心（开发预览）
  - 描述：查看本地 Web 服务、固定路由入口、Desktop 安全配置和数据库探活状态。
  - 风险说明：该诊断仅用于开发预览，不会读取密钥，不会执行工具，不会写入数据库。
  - 按钮：`lap://open-diagnostics-preview`
- 在同一静态首页新增“系统诊断中心（开发预览）”诊断面板（方案 A，最小侵入，不新增 Web 业务页面）。

## 6. 固定内部动作 `lap://open-diagnostics-preview` 处理方式
- 在 `apps/desktop/main.js` 新增 `openDiagnosticsPreview(win)`。
- 处理模式与 Reader/Agent/Learning 一致：在 `handleInternalDesktopNavigation` 中识别固定 hostname 并执行固定动作，不接受 renderer 任意 path/query/url。
- 若当前在 Web 预览页（same-origin 模式），动作会安全回退到本地 `index.html`，然后聚焦诊断面板；若已在静态首页则直接聚焦诊断面板。
- 保持外部 URL 拒绝策略与 fallback 机制不变。

## 7. 诊断面板/页面展示字段
1. Web 服务状态：检测中 / 在线 / 不可用 / 检测失败（复用 A222 探测逻辑）
2. 固定入口状态：
   - Reader：固定动作可用
   - Agent：固定动作可用
   - Learning：固定动作可用
   - Diagnostics：固定动作可用
3. Desktop 安全配置摘要：
   - `nodeIntegration: false`
   - `contextIsolation: true`
   - `sandbox: true`
   - 外部 URL：拒绝
   - 任意 URL 输入：未开放
4. DB 探活摘要（只读）：
   - 可用 / 不可用 / 未配置
   - 未配置文案：未启用 DB 探活，本轮不新增数据库访问。
5. 安全边界摘要：
   - 不调用真实 LLM
   - 不执行工具
   - 不启动 Agent loop
   - 不保存 raw prompt/raw response
   - 不读取或展示密钥

## 8. 是否使用 IPC/preload；安全说明
- 本轮未新增 IPC、未新增 preload、未暴露 Node API。
- 状态更新由主进程使用 `executeJavaScript` 写入静态页面既有 DOM 节点，仅传递简短状态文本（boolean/status/短文案语义），不传连接串、密钥、完整错误栈。
- 未开放任意 fetch、任意 URL 加载或任意通道。

## 9. route-policy 是否修改及测试结果
- `apps/desktop/route-policy.js`：未修改（本轮未新增 Web 固定 route，仅新增 Desktop 内部动作）。
- `apps/desktop/route-policy.test.mjs`：未修改。
- 执行 `node --test apps/desktop/route-policy.test.mjs`：28/28 通过。

## 10. Reader / Agent / Learning 入口回归情况
- 代码层面：原有 `openReaderPreview/openAgentPreview/openLearningPreview` 逻辑保持不变，仅新增 diagnostics 分支。
- 路由安全策略未放宽，`will-navigate` 与同源守卫逻辑保持。
- 本轮未改动 `apps/web/**`，未改动 Reader/Agent/Learning 业务代码。

## 11. Desktop GUI 或替代验证结果
- 尽量执行项：已执行 `pnpm --filter @learning-agent-platform/desktop run dev`。
- 启动日志确认：
  - Desktop 启动并加载静态首页
  - DB 探活在未配置 `DATABASE_URL` 时输出“skip + 安全 fallback”
  - Web 服务状态诊断执行并给出 `offline` 结果
- 本轮未完成真实 GUI 自动点击验收（会话内未进行浏览器 GUI 自动化）；未编造点击结果。
- 可复现手动验证步骤：
  1. 运行 `pnpm --filter @learning-agent-platform/desktop run dev`
  2. 检查首页四入口是否显示（阅读器/Agent/学习中心/系统诊断中心）
  3. 点击“打开诊断中心”确认页面聚焦诊断面板
  4. 确认面板显示 Web 状态、固定入口、安全配置、DB 探活、安全边界字段
  5. 分别点击 Reader/Agent/Learning 入口确认仍可按原逻辑跳转

## 12. typecheck/lint/route-policy 结果
1. `pnpm typecheck`：通过（0 errors）
2. `pnpm lint`：通过
3. `node --test apps/desktop/route-policy.test.mjs`：28/28 通过

## 13. 安全边界确认
- 未调用真实 LLM provider。
- 未执行真实工具。
- 未启动 Agent loop。
- 未新增 DB 写入。
- 未新增 API / server action / route handler / 后台任务。
- 未读取或展示密钥、连接串、完整错误堆栈。
- 未修改 `nodeIntegration/contextIsolation/sandbox` 安全配置。
- 未放宽外部 URL 拒绝策略，未开放任意 URL 输入。

## 14. 未完成问题
- 尚缺“GUI 自动点击级别”的诊断中心完整回归（含四入口点击路径和面板可视验收）。当前只完成启动日志验证与源码路径审查。

## 15. 下一轮建议
若本轮通过，优先推进：
1. Desktop 诊断中心 GUI 验证修复与自动化沉淀（覆盖四入口点击与 fallback 场景）。
2. 或推进 Reader DB 同步字段 schema 设计评审（仅文档，不改 schema）。
3. 或推进 Learning 本地导出 e2e 测试资产固化。

不生成提交提示词（本轮未请求提交）。
