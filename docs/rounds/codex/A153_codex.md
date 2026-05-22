# A153 Codex

## 1. 轮次
- A153

## 2. 当前任务
- 审查并稳定化 `/learning` 页面整体 preview 文案边界。
- 只处理 `apps/web/src/app/learning/`、其直接组件、直接 view model / mock / helper，以及 `/learning` 直接引用的 learning 展示组件。
- 不开发真实推荐系统、能力画像闭环、题单反馈闭环、LLM/RAG/provider/tool/agent loop。

## 3. 实际修改文件
- `apps/web/src/app/learning/page.tsx`
- `apps/web/src/app/learning/components/LearningAbilityProfileSaveControls.tsx`
- `apps/web/src/app/learning/components/LearningDailyRecommendationListWithAttemptStatus.tsx`
- `apps/web/src/app/learning/components/LearningDailyRecommendationSaveControls.tsx`
- `apps/web/src/app/learning/components/LearningProblemAttemptSaveControls.tsx`
- `apps/web/src/app/learning/components/LearningProblemAttemptSignalSummary.tsx`
- `apps/web/src/app/learning/components/LearningReadingProgressSignalSummary.tsx`
- `apps/web/src/app/learning/components/LearningRecentProblemAttemptHistoryPanel.tsx`
- `apps/web/src/app/learning/components/ManualLearningCycleStatusPanel.tsx`
- `apps/web/src/app/learning/learning-ability-profile-save.ts`
- `apps/web/src/app/learning/learning-daily-recommendation-save.ts`
- `apps/web/src/app/learning/learning-problem-attempt-save.ts`
- `apps/web/src/app/learning/manual-learning-cycle-status.ts`
- `apps/web/src/app/learning/problem-attempt-history-loader.ts`
- `apps/web/src/app/learning/problem-attempt-history-mapper.ts`
- `apps/web/src/app/learning/problem-attempt-signal-loader.ts`
- `apps/web/src/app/learning/reading-progress-signal-loader.ts`
- `apps/web/src/app/learning/recommendation-problem-attempt-status-loader.ts`
- `apps/web/src/app/learning/recommendation-problem-attempt-status-mapper.ts`
- `apps/web/src/components/learning/AbilityBreakdown.tsx`
- `apps/web/src/components/learning/AbilityScoreCard.tsx`
- `apps/web/src/components/learning/LearningDataSourceNotice.tsx`
- `apps/web/src/components/learning/LearningEventSummary.tsx`
- `apps/web/src/components/learning/LearningQaFeedbackSignalSummary.tsx`
- `apps/web/src/lib/learning-db.ts`
- `apps/web/src/lib/learning-mock.ts`
- `apps/web/src/lib/learning-qa-feedback-signal-loader.ts`
- `docs/codex-context/CURRENT_HANDOFF.md`

## 4. 新增文件
- `docs/rounds/codex/A153_codex.md`

## 5. 删除文件
- 无。

## 6. 移动文件
- 无。

## 7. 核心改动说明
- 将 `/learning` 页面标题、说明和当前限制明确改为“学习仪表盘预览”“演示数据边界”“不会调用真实 AI”“不会自动生成学习闭环”。
- 将 AbilityProfile、DailyRecommendation、ProblemAttempt 的保存控件文案收紧为“开发演示保存”“预览快照”“手动触发”，避免暗示真实推荐系统、真实能力画像闭环或自动反馈闭环已上线。
- 将每日推荐列表和卡片级 ProblemAttempt 状态改为“每日推荐预览”“只读记录”“尝试状态预览”，并中文化直接用户可见的 tags / reasons aria 文案。
- 将 ReadingProgress、ProblemAttempt、问答反馈信号摘要改为“预览读取”“纳入本次预览”“仅汇总预览”，并说明不会写入数据库或触发自动闭环。
- 将数据源、空态、fallback、helper / loader 返回消息统一补充“演示用户”“开发数据库”“模拟回退”“内存态预览”“只读展示”等边界。
- 未实现新算法、未新增依赖、未修改 schema、未接入真实 LLM/RAG/provider/tool/agent loop。

## 8. 安全边界确认
- 推荐、尝试状态、能力评分、学习反馈、题单状态均标注为预览、演示、模拟回退、只读或开发环境数据源。
- 保存按钮仍为已有显式 server action 入口，本轮只补充文案边界；未新增真实自动闭环。
- 未读取 `.env` 或真实凭据。
- 未新增联网请求。
- 未调用真实 LLM provider。
- 未执行真实工具或 Agent loop。

## 9. 验证命令和结果
- `git status --short`：确认存在 A153 范围内 learning 修改，同时存在范围外遗留改动，未处理。
- `git diff --stat`：确认 A153 修改集中在 `/learning` 及其直接依赖文案文件，另有范围外遗留改动。
- `git diff --name-status`：确认 A153 文件和范围外遗留文件并存。
- `pnpm typecheck`：通过。
- `pnpm lint`：通过。
- `Get-ChildItem -Recurse apps/web/src/app/learning -Include *.test.*,*.spec.* | Select-Object FullName`：未发现 learning 相关最小测试。
- `Get-ChildItem -Recurse apps/web/src/components/learning -Include *.test.*,*.spec.* | Select-Object FullName`：未发现 learning 相关最小测试。

## 10. 浏览器验证结果
- 启动 `pnpm dev`，访问 `http://localhost:3000/learning`。
- 页面正常打开，不崩溃。
- console error 数为 0。
- 页面可见“学习仪表盘预览”“不会调用真实 AI”“不会自动生成学习闭环”等边界说明。
- 未检测到“真实个性化推荐已启用”“真实能力画像已完成”“真实 AI 反馈已接入”“完整题单反馈闭环已上线”等误导文本。

## 11. git add / commit 情况
- 待精确暂存 A153 范围文件和本轮文档。
- 禁止使用 `git add .` 或 `git add -A`。

## 12. commit hash
- 提交后以最终输出中的 `git log -1 --oneline` 为准。

## 13. 未处理遗留文件
- `docs/_archive_pending_review/WEB_MVP_COMPLETION_ROADMAP.md`
- `docs/codex-tasks/CODEX_RULES.md`
- `docs/rounds/codex/A134_codex.md` 至 `docs/rounds/codex/A143_codex.md` 及 A138/A142/A143 的 `+` 变体删除项
- `docs/rounds/deepseek/A134_deepseek.md` 至 `docs/rounds/deepseek/A143_deepseek.md` 删除项
- `docs/status/PROJECT_COMPLETION_SUMMARY.md`
- `packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts`
- `packages/ai-core/src/agent/runtime-policy-preview.ts`
- `packages/ai-core/src/llm-provider-config.ts`
- `packages/ai-core/src/spark-provider.ts`
- 未跟踪的 `docs/rounds/codex/A148_codex.md` 至 `A152_codex.md`
- 未跟踪的 `docs/rounds/deepseek/A134-A144_archive_report.md`、`A134-A144_compression.md`、`A145_deepseek.md` 至 `A152_deepseek.md`

## 14. 下一轮建议
- 新开 A154，只选择一个明确小任务。
- 建议继续按页面边界审查模式处理另一个 Web 页面，或单独授权处理工作区遗留文件；不要混合执行。

## 15. 项目总进度
- 项目总进度：30.00%。
