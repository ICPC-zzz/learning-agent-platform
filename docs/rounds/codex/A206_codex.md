# A206 Codex 交付记录

## 任务目标
在 Reader 页面新增一个轻量“阅读状态数据源”提示，用中文明确当前是“开发预览 DB 同步可用”还是“本地浏览器回退”，同时兼容 Web 与 Desktop 容器；不新增 API、不改 schema、不接真实 Agent。

## 修改文件
1. apps/web/src/app/reader/page.tsx
2. apps/web/src/app/reader/ReaderReadingStateSourceNotice.tsx（新增）
3. docs/desktop-web-loader.md（追加 A206 验证记录）
4. docs/rounds/codex/A206_codex.md（本文件）
5. docs/codex-context/CURRENT_HANDOFF.md（仅追加 A206 摘要）

## 数据源判断方式
- 判断输入：`readerData.source`
- 规则：
  - `source === "database"`：展示“开发预览：已连接本地数据库同步阅读状态。”
  - 其他场景（含 mock fallback、参数缺失空态等）：展示“开发预览：当前使用本地浏览器记录，未写入数据库或数据库暂不可用。”
- 说明：仅使用现有页面可得的安全标记，不新增 API route，不返回连接串或错误堆栈。

## 文案与展示
新增组件：`ReaderReadingStateSourceNotice`
- 标题：`阅读状态数据源`
- 文案（DB 可用）：`开发预览：已连接本地数据库同步阅读状态。`
- 文案（本地回退）：`开发预览：当前使用本地浏览器记录，未写入数据库或数据库暂不可用。`

## 安全边界核对
- 未新增真实 LLM/provider、工具执行、Agent loop、RAG。
- 未输出 `DATABASE_URL`、密码、token、错误堆栈。
- 未移除 localStorage 回退。
- Desktop 仍只是加载 Web 页面（未改 `apps/desktop/main.js`）。
- 未改 DB schema / migration / packages / env 文件。

## 验证命令
1. `pnpm typecheck`
2. `pnpm lint`
3. Web 验证：启动 `pnpm --filter @learning-agent-platform/web dev` 后请求 `/reader` 页面并检查返回内容
4. Desktop 验证：
   - `LAP_DESKTOP_WEB_URL=http://localhost:3000`
   - `LAP_DESKTOP_WEB_ROUTE=/reader`
   - 合法 reader 参数启动 Desktop
   - 缺失 `LAP_DESKTOP_READER_BOOK_ID` 的回退场景启动 Desktop

## 验证结果
- `pnpm typecheck`：通过（0 errors）
- `pnpm lint`：通过
- Web `/reader`：
  - sample fallback 场景命中 `阅读状态数据源` 与“本地浏览器回退”文案
  - DB 书籍场景命中 `阅读状态数据源` 与“已连接本地数据库同步阅读状态”文案
  - Ask AI 仍为未启用/preview 文案
  - 返回内容未发现 `DATABASE_URL=` 泄露
- Desktop：
  - 合法参数日志：加载 `http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`
  - 缺失 `bookId` 日志：提示 reader 参数无效并回退 `http://localhost:3000/books`
  - 结论：Desktop 仍加载同一 Web Reader 页面并保持安全回退。

## 变更边界确认
- Desktop 安全逻辑：未修改
- DB schema/migrations：未修改
- Agent/Tool/Provider：未修改
- package.json / lock / workspace：未修改
- `.env` / `.env.example`：未读取、未修改

## Git 执行情况
未执行 `git add`、`git commit`、`git push`。

## 风险与下一步
- 风险：本轮 Desktop 以运行日志与 Web 返回内容为验收证据，未做窗口截图级别的视觉留档。
- 下一步：可在后续轮次补充 Reader 右侧本地面板（书签/笔记/计时）与该数据源提示的一致性文案收敛，继续保持 preview-only 边界。

## 项目进度
本轮 Web + Desktop 验证通过，项目总进度更新为约 **38.20%**。
