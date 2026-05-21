# A137 Codex 记录

## 1. 本轮任务

基础校验恢复：修复 books / learning 中剩余类型错误，使全量 `pnpm typecheck` 通过，并确认 `pnpm lint` 继续通过。

## 2. 完成内容

- 修复 `BookDetailLoadResult` 对 `mock_fallback` 的类型表达，使演示 fallback 书籍详情可以携带 `BookDetailView`。
- 修复学习推荐组件中 attempt signal 状态分支名称，与当前 `LearningProblemAttemptSignalStatus` 保持一致。
- 全量运行并通过 `pnpm typecheck`。
- 全量运行并通过 `pnpm lint`。

## 3. 新增文件

- `docs/rounds/codex/A137_codex.md`

## 4. 修改文件

- `apps/web/src/app/books/book-detail-types.ts`
- `apps/web/src/app/learning/components/LearningDailyRecommendationListWithAttemptStatus.tsx`
- `docs/codex-context/CURRENT_HANDOFF.md`

## 5. 删除文件

无。

## 6. 移动文件

无。

## 7. typecheck 错误原因

- `apps/web/src/app/books/book-detail-loader.ts` 的 `createSampleBookDetailResult()` 返回 `status: "mock_fallback"` 且携带 `book: BookDetailView`，但 `BookDetailLoadResult` 原类型把除 `"loaded"` 外的所有状态都约束为 `book: null`，导致 `mock_fallback` 与现有 fallback 展示行为不匹配。
- `apps/web/src/app/learning/components/LearningDailyRecommendationListWithAttemptStatus.tsx` 中 `formatProblemAttemptPreviewStatus()` 仍匹配旧状态 `"loaded"` / `"empty"`，但当前类型为 `"attempts_loaded"` / `"attempts_empty"`，导致不可比较分支和缺失返回路径错误。

## 8. 修复方式

- 将 `BookDetailLoadResult` 调整为 `"loaded" | "mock_fallback"` 时携带 `BookDetailView`，其他错误或不可用状态仍为 `book: null`。
- 将 learning 组件 switch 分支改为 `"attempts_loaded"` 与 `"attempts_empty"`，保留原展示文案和推荐逻辑。
- 未修改数据库 schema、迁移、依赖、路由、Agent、Tool、Provider、Skill 或真实执行逻辑。

## 9. 验证命令

```bash
git status --short
pnpm typecheck
pnpm lint
```

## 10. 验证结果

- `git status --short`：工作区原本已有多处未提交改动；本轮只新增/修改允许范围内文件。
- `pnpm typecheck`：通过。
- `pnpm lint`：通过。

## 11. 未完成/风险

- 工作区仍存在 A137 之前已有的未提交改动，包含本轮禁止范围内文件；本轮未回滚、未覆盖这些既有改动。
- 本轮只恢复静态校验，不代表任何 Agent / Tool / Skill / Runtime / Provider 能力上线。

## 12. 下一轮建议

进入下一轮前先确认当前未提交改动的归属；若继续推进 Web MVP，可在校验绿灯基础上按路线图选择一个明确小任务。

## 13. 项目总进度

项目总进度：22.55%。
