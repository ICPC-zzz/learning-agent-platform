# A250 Codex 验证记录（Learning → Reader empty/fallback 运行时闭环）

## 1. 轮次目标
- 目标：完成 A249 新增 Reader 跳转入口在 `database / empty / fallback` 三种场景下的验证闭环，仅在发现明确 bug 时做最小修复。
- 约束：不新增功能；不提交 Git；不改 Prisma schema / migration；不新增 API/server action；不改 Reader 同步逻辑；不接入真实 LLM；不执行 Agent loop。

## 2. 本轮执行范围
- 代码阅读范围：`apps/web/src/app/learning/**` 与其直接依赖（仅用于验证）。
- 运行验证范围：`/learning`、`/reader` 页面可达性与跳转行为。
- 外部参考项目：未读取 `E:\code\harness-main` / `E:\code\ccx` / `E:\code\claude-desktop-app-main`。

## 3. 验证场景与结果

### 3.1 Database 场景（真实运行）
- 启动命令：`pnpm -C apps/web dev --hostname 127.0.0.1 --port 3100`
- 页面请求：`GET /learning` 返回 `200`
- 验证结果：
  - 最近阅读进度卡片显示 Reader 深链接（文案“继续阅读”）。
  - 下一步学习建议卡片显示 Reader 深链接（文案“按建议继续阅读”）。
  - 今日学习任务卡片显示 Reader 深链接（文案“打开关联 Reader 章节”）。
  - 链接格式符合：`/reader?bookId=...&chapterId=...`（SSR HTML 中显示为 `&amp;`）。
- 取证样例（数据库真实记录）：
  - `/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`
  - `/reader?bookId=sample-programming-fundamentals&chapterId=sample-chapter-variables`

### 3.2 Reader 可达性 + 跳转副作用（真实运行）
- 请求：`GET /reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`
- 结果：`200`，Reader 页面正常渲染。
- Network/行为核对：
  - Next dev 日志仅出现页面级请求：`GET /learning`、`GET /reader?...`。
  - 未观察到因该入口触发的 `POST`、`/api/*`、server action 调用日志。
  - 结合页面文案与实现，未引入 LLM 调用、工具执行、Agent loop。

### 3.3 Fallback 场景（真实运行）
- 复现方式：使用无效 DB 连接启动独立实例。
- 启动命令：
  - `DATABASE_URL=postgresql://postgres:123456@127.0.0.1:65432/learning_agent_platform_invalid`
  - `pnpm -C apps/web dev --hostname 127.0.0.1 --port 3102`
- 页面请求：`GET /learning` 返回 `200`
- 结果：
  - 三个卡片仍渲染，但不再输出 `/reader?bookId=...` 错误深链接。
  - 出现友好提示：
    - “数据库不可用时无法生成 Reader 跳转建议，可直接从 Reader 入口进入（开发预览）”
    - “数据库不可用，显示回退建议 / 回退任务”
  - 页面不崩溃。
  - 页面仅保留 `/reader` 基础入口（无 bookId/chapterId 参数），符合 fallback 预期。

### 3.4 Empty 场景（最小安全验证）
- 说明：当前仓库的固定 demo 用户在本地 DB 中已有 ReadingProgress，直接切换到“真实 empty”会涉及演示数据改写；本轮按成功条件第 6 条采用最小安全方式验证 loader/mapping 分支。
- 执行命令（临时运行，不落地 hack）：
  - `pnpm dlx tsx -e "...createRecentReadingProgressViewModel({ records: [], limit: 3 })..."`
- 输出要点：
  - `empty.source = "empty"`
  - `empty.items = 0`
  - `empty suggestionHref = null`
  - `empty taskHref = null`
- 结合组件渲染分支确认：
  - empty 时显示“暂无同步记录，先从 Reader 保存/同步一次进度（开发预览）”等友好提示。
  - 不会渲染错误 Reader 深链接。

## 4. 链接编码与安全性验证
- 代码实现：`apps/web/src/app/learning/learning-reader-link.ts`
  - 使用 `URLSearchParams` 构造 query。
  - `bookId/chapterId` 先 `trim`，空值返回 `null`（不输出链接）。
- 特殊字符编码验证（临时命令输出）：
  - 输入：`bookId="book id/中文?"`，`chapterId="chapter#1&2"`
  - 输出：`/reader?bookId=book+id%2F%E4%B8%AD%E6%96%87%3F&chapterId=chapter%231%262`
- 结论：参数经过 URL 安全编码。

## 5. 质量门禁结果
- `pnpm typecheck`：通过（0 errors）。
- `pnpm lint`：通过。
- `node --test apps/desktop/route-policy.test.mjs`：通过（28 passed, 0 failed）。

## 6. 是否修复代码
- 本轮未发现“仅限 `apps/web/src/app/learning` 范围内”的明确 bug。
- 因此未做业务代码修复（保持最小改动原则）。

## 7. 修改文件清单
- 新增：`docs/rounds/codex/A250_codex.md`（本记录）。

## 8. 安全边界核对
- 未修改 Prisma schema / migration。
- 未新增 DB 查询/写入路径。
- 未新增 API route / server action。
- 未修改 Reader 同步逻辑。
- 未接入真实 LLM。
- 未执行工具链式 Agent loop。
- 未修改 Desktop 安全策略。

## 9. 未完成问题与下一轮建议
- 未完成项：浏览器 Console 的“可视化”抓取未通过自动化浏览器插件直接导出；本轮采用 Next dev 日志 + 请求轨迹 + 源码分支验证替代，已覆盖入口行为与副作用边界。
- 建议下一轮：
  1. 若需要更强证据，可补一轮 Playwright（或 in-app browser）自动化，导出 Console/Network 截图与 HAR。
  2. 如需真实 empty 端到端，可在隔离临时数据库创建仅含 demo user 且无 ReadingProgress 的最小数据集，再做 UI 级回归。
