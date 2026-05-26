# A202 - Desktop /reader 路由 GUI smoke 回归验证

## 任务目标
1. 运行静态检查和 `route-policy` 单元测试。
2. 在 Electron 可用时验证 Desktop 路由回归：`/books`、`/learning`、`/reader` 合法参数、`/reader` 非法参数回退、非法外部 URL 回退静态首页。
3. 仅记录验证结果，不做无关改动。

## 验证命令

### 1) 静态检查与单测
- `node --check apps/desktop/main.js`
- `node --test apps/desktop/route-policy.test.mjs`
- `pnpm typecheck`
- `pnpm lint`

结果：全部通过。
- `node --check`：通过（exit 0）
- `node --test`：10/10 通过，0 fail
- `pnpm typecheck`：`typecheck passed (0 errors)`
- `pnpm lint`：`VM lint complete`

### 2) GUI smoke（Electron）
Web dev server：`pnpm --filter @learning-agent-platform/web dev`（`http://localhost:3000` ready）

#### 场景 1：`/books`
- 环境：
  - `LAP_DESKTOP_WEB_URL=http://localhost:3000`
  - `LAP_DESKTOP_WEB_ROUTE=/books`
- Desktop 日志：
  - `Loading local dev server entry: http://localhost:3000/books ...`
- Web 日志：
  - `GET /books 200`
- 结论：通过。

#### 场景 2：`/learning`
- 环境：
  - `LAP_DESKTOP_WEB_URL=http://localhost:3000`
  - `LAP_DESKTOP_WEB_ROUTE=/learning`
- Desktop 日志：
  - `Loading local dev server entry: http://localhost:3000/learning ...`
- Web 日志：
  - `GET /learning 200`
- 结论：通过。

#### 场景 3：`/reader` 合法参数
- 环境：
  - `LAP_DESKTOP_WEB_URL=http://localhost:3000`
  - `LAP_DESKTOP_WEB_ROUTE=/reader`
  - `LAP_DESKTOP_READER_BOOK_ID=sample-book`
  - `LAP_DESKTOP_READER_CHAPTER_ID=chapter-1`
- Desktop 日志：
  - `Loading local dev server entry: http://localhost:3000/reader?bookId=sample-book&chapterId=chapter-1 ...`
- Web 日志：
  - `GET /reader?bookId=sample-book&chapterId=chapter-1 200`
- 结论：通过（入口路由与参数拼接正确）。

#### 场景 4：`/reader` 缺参/非法参数回退 `/books`
- 测试值：
  - `LAP_DESKTOP_READER_BOOK_ID=''`（空）
  - `LAP_DESKTOP_READER_BOOK_ID='bad/id'`
  - `LAP_DESKTOP_READER_BOOK_ID='abc?x=1'`
  - `LAP_DESKTOP_READER_BOOK_ID='abc#x'`
- Desktop 日志（每次均出现）：
  - `Reader route requires a valid LAP_DESKTOP_READER_BOOK_ID ... - falling back to /books`
  - `Loading local dev server entry: http://localhost:3000/books ...`
- Web 日志：
  - 4 次 `GET /books 200`
- 结论：通过（均按预期回退）。

#### 场景 5：非法外部 URL 回退静态首页
- 环境：
  - `LAP_DESKTOP_WEB_URL=https://example.com`
- Desktop 日志：
  - `LAP_DESKTOP_WEB_URL protocol rejected (only http allowed): https:`
  - `Loading static index.html (default mode)`
- 结论：通过。

## Bug 与改动结论
- 是否发现明确 bug：否。
- 是否修改代码：否。
- 是否修改 Web/DB/Agent/package/env：否。
- 是否执行 git 操作：未执行（未 `git add` / 未 `git commit` / 未 `git push`）。

## 风险与说明
- 本轮 GUI 回归通过启动 Electron 并采集 Desktop/Web 日志完成；未做像素级截图比对。
- 观察到非法 URL 场景存在重复 protocol warning（同一次启动打印两次），不影响安全回退与功能正确性，暂记为日志噪声。

## 进度
- 本轮完成 GUI smoke 回归，项目总进度更新为：**37.70%**。

## 下一步建议
1. 若要清理日志噪声，可在后续独立小任务中评估是否合并重复 `getAllowedWebUrl` 告警路径（不改变安全行为）。
2. 继续保持 Desktop 仅路由容器定位，不引入真实 Agent/Tool/Provider 执行路径。
