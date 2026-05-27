# A253 Codex 记录（Desktop 壳内 Learning → Reader GUI 闭环）

## 1. 本轮目标
- 完成 Desktop 壳内 `Learning -> Reader` 核心跳转链路 GUI 验证闭环。
- 仅在发现明确 bug 时做最小修复。
- 不执行 `git add / git commit / git push`。

## 2. 读取文件
1. `docs/codex-context/CODEX_ALWAYS_READ.md`
2. `docs/codex-context/CODEX_RULES.md`
3. `docs/codex-context/CURRENT_HANDOFF.md`
4. `docs/codex-context/SAFETY_BOUNDARIES.md`
5. `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
6. `docs/codex-context/DOC_WORKFLOW.md`
7. `docs/rounds/codex/A252_codex.md`
8. `apps/desktop/main.js`
9. `apps/desktop/route-policy.test.mjs`
10. `apps/desktop/route-policy.js`
11. `apps/desktop/index.html`
12. `apps/web/src/app/learning/page.tsx`
13. `apps/web/src/app/learning/learning-reader-link.ts`
14. `apps/web/src/app/learning/components/LearningRecentReadingProgressPanel.tsx`
15. `apps/web/src/app/learning/components/LearningNextStepSuggestionPanel.tsx`
16. `package.json`

## 3. 实际修改文件
1. `apps/desktop/main.js`
2. `docs/rounds/codex/A253_codex.md`

## 4. GUI 验证步骤与结果
### 4.1 启动环境
- Web：`npm -w @learning-agent-platform/web run dev -- -p 3000`
- Desktop：`npx electron apps/desktop --remote-debugging-port=9333`
- 使用临时 CDP 自动化脚本（位于工作区 `.tmp/`，不纳入仓库）执行 Desktop 壳内验证。

### 4.2 验证项
1. 从 Desktop 静态首页进入 Learning（`lap://open-learning-preview`）
- 结果：通过，URL 为 `http://localhost:3000/learning`。
- 导航壳存在，状态为 `当前页面：Learning`。

2. 在 Learning 页面点击 Reader 入口（实际命中 href）
- 结果：通过，入口为 `/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`。
- 跳转后 URL 为 `http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`。

3. Reader 页面可见性与内容
- 结果：通过，`readerContentState = preview`（可见“阅读器预览”内容）。
- 导航壳仍可见，状态为 `当前页面：Reader`。

4. 后退（Reader -> Learning）
- 结果：通过，后退后 URL 回到 `http://localhost:3000/learning`。
- 状态回到 `当前页面：Learning`。

5. 刷新当前预览（Reader）
- 结果：通过，刷新前后 URL 完全一致。
- 无白屏，导航壳保持可见。

6. 返回首页
- 结果：通过，回到 `file:///E:/code/learning-agent-platform/apps/desktop/index.html`。
- 状态为 `当前页面：Desktop 首页`。

7. 控制台与网络
- 结果：通过。
- Runtime exception：0。
- 新增业务控制台错误：0。
- 可疑网络请求（外部域名、`/api`、`/actions`、`/llm`、`/tool`、写方法）：0。

## 5. typecheck/lint/route-policy 结果
1. `pnpm typecheck`：通过（`✅ typecheck passed (0 errors)`）
2. `pnpm lint`：通过（`VM lint complete`）
3. `node --test apps/desktop/route-policy.test.mjs`：通过（`28/28`）

## 6. 是否发现并修复 bug
- 发现并修复：是。
- Bug：`did-fail-load` 将 `errorCode = -3 (ERR_ABORTED)` 误判为主框架加载失败，触发不必要的静态首页回退，影响 Learning -> Reader 跳转稳定性。
- 最小修复：在 `apps/desktop/main.js` 的 `did-fail-load` 处理里忽略 `errorCode === -3`。

## 7. 安全边界确认
- 未开放任意 URL。
- 未新增用户可输入 URL 的能力。
- 未放宽 CSP / `nodeIntegration` / `contextIsolation` / `sandbox`。
- 未接入真实 LLM provider，未调用真实 LLM API。
- 未执行真实工具，未启动 Agent loop。
- 未修改 Prisma schema / migration，未执行 `prisma migrate`。
- 未输出连接串、密钥、token、完整敏感错误栈。

## 8. 未完成事项
- 本轮目标范围内无阻塞未完成项。
- 按本轮限制，未更新 `docs/codex-context/CURRENT_HANDOFF.md`；建议由 DeepSeek 在 handoff 流程中同步 A253 结论。

## 9. 下一轮建议
1. 将本轮临时 CDP 验证脚本沉淀为仓库内可复用的 Desktop GUI 回归脚本（仅测试资产，不改运行时能力）。
2. 在 CI 增加最小壳层回归断言：Learning -> Reader 跳转后壳层可见、后退回 Learning、刷新不白屏。

## 10. 项目总进度估算
- 本轮验证完全通过并完成最小修复后：**约 50.20%**（按 Web + Desktop 主线口径）。
