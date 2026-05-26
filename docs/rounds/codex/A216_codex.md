# A216 Codex 执行记录

## 1. 本轮目标
在 Desktop 端新增“打开阅读器（开发预览）”业务入口，让用户无需手动设置 `LAP_DESKTOP_WEB_ROUTE`，即可从 Desktop 默认页面进入 Reader 预览页面，并沿用既有安全路由机制打开：
`/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`。

## 2. A215 后状态
1. A213 的 Reader 手动 DB 同步通路（preview-only）已完成，且保持手动触发。
2. A214 已完成代码级验收。
3. A215 已验证 Desktop 可通过环境变量/路由机制打开 Reader，且用户已完成浏览器 GUI 校验。
4. Desktop 仍缺少面向用户的可见业务入口按钮/卡片。

## 3. 实际阅读文件
1. `docs/codex-context/CURRENT_HANDOFF.md`
2. `docs/codex-context/CODEX_RULES.md`
3. `docs/codex-context/SAFETY_BOUNDARIES.md`
4. `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
5. `docs/rounds/codex/A215_codex.md`
6. `apps/desktop/package.json`
7. `apps/desktop/main.js`
8. `apps/desktop/route-policy.js`
9. `apps/desktop/index.html`
10. `apps/desktop/route-policy.test.mjs`（用于安全回归验证）
11. `apps/web/src/app/reader/page.tsx`
12. `apps/web/src/app/reader/ReaderSyncPreviewPanel.tsx`（确认同步面板仍存在）

## 4. 修改文件
1. `apps/desktop/main.js`
2. `apps/desktop/index.html`
3. `docs/rounds/codex/A216_codex.md`

## 5. Desktop Reader 入口实现方式
### 5.1 默认页面新增中文业务入口
在 `apps/desktop/index.html` 新增“阅读器（开发预览）”入口区域，包含以下文案：
- 标题：“阅读器（开发预览）”
- 描述：“打开 Reader 页面，体验本地书签、笔记、计时、统计与手动同步预览。”
- 风险说明：“当前仍为开发预览，Reader 同步需手动触发，失败不会影响本地浏览器记录。”
- 按钮：“打开阅读器”

按钮为固定内部动作链接：
- `lap://open-reader-preview`

### 5.2 主进程新增固定白名单动作（非任意 URL）
在 `apps/desktop/main.js` 新增固定 Reader 预览入口流程：
1. 新增固定参数常量：
   - `READER_PREVIEW_ROUTE = "/reader"`
   - `READER_PREVIEW_BOOK_ID = "reader-db-sync-verification-book"`
   - `READER_PREVIEW_CHAPTER_ID = "sample-chapter-long-scroll"`
2. 新增 `openReaderPreview(win)`：
   - 复用 `resolveDesktopWebTarget` 做现有安全校验（host/port/route/query 规则）。
   - 未设置 `LAP_DESKTOP_WEB_URL` 时默认尝试 `http://localhost:3000`。
   - 仅当校验通过才 `loadURL`，否则仅告警并保持安全回退。
3. 在 `will-navigate` 中新增 `handleInternalDesktopNavigation(win, url)`：
   - 仅识别 `lap://open-reader-preview`。
   - 未识别动作一律阻断。
   - 不提供任何用户可输入 URL 的能力。

## 6. 导航路径与测试参数
入口点击后目标路径固定为：
`/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`

完整 URL 由现有安全机制构造，例如：
`http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`

## 7. preload/menu/renderer 能力变更与安全说明
1. 未新增 preload。
2. 未新增任意菜单导航能力。
3. 仅在静态 renderer 页面增加固定内部动作链接（`lap://open-reader-preview`）。
4. 主进程只暴露“固定动作 -> 固定参数 Reader 路由”的能力，不支持任意 URL、任意 query。
5. 继续复用 `route-policy`，不绕过白名单与参数校验。

## 8. 验证结果
### 8.1 必执行
1. `pnpm typecheck`：通过（0 errors）
2. `pnpm lint`：通过（0 errors）

### 8.2 尽量执行
1. `pnpm --filter @learning-agent-platform/db run build`：通过。
2. `pnpm --filter @learning-agent-platform/desktop run dev`（默认模式）：
   - 日志显示 `Loading static index.html (default mode)`。
   - 说明 Desktop 默认页正常可达。
3. 使用 Reader 参数启动 Desktop（模拟目标路径构造）：
   - 日志显示成功构造并尝试加载：
     `http://localhost:3000/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`
   - 在当前执行环境中因本地 3000 服务未启动，出现 `ERR_CONNECTION_REFUSED` 后回退静态页，符合既有回退策略。
4. `node --test apps/desktop/route-policy.test.mjs`：20/20 通过（安全路由回归通过）。

### 8.3 GUI 点击级验证
当前 Codex 终端环境无法直接自动化点击 Desktop 窗口，因此本轮未完成“真实点击按钮后在窗口内跳转并观察 Reader 面板”的自动化闭环。

可复现手动步骤：
1. 启动 Web：`pnpm --filter @learning-agent-platform/web dev`
2. 启动 Desktop：`pnpm --filter @learning-agent-platform/desktop run dev`
3. 在默认首页点击“打开阅读器”。
4. 确认跳转到 `/reader?bookId=reader-db-sync-verification-book&chapterId=sample-chapter-long-scroll`。
5. 确认 Reader 页面可见同步面板“同步到云端（开发预览）/同步预演/手动同步到数据库（开发预览）”。

## 9. 安全边界确认
1. 未放宽 `nodeIntegration: false`。
2. 未放宽 `contextIsolation: true`。
3. 未放宽 `sandbox: true`。
4. 未放宽 CSP（保持 `script-src 'none'` 等限制）。
5. 未放宽 route-policy 白名单。
6. 未开放外部 URL 或任意 URL 导航。
7. 未修改 Reader 同步逻辑、字段映射、localStorage key。
8. 未引入自动 DB 同步，仍为 preview-only / 手动触发。

## 10. 未完成问题
1. 未在本轮自动化环境内完成 Desktop 窗口真实点击后的 GUI 截图级验收（需本地 GUI 手动验证）。
2. 未启动本地 Web dev server 的情况下，Reader 跳转只验证到“目标 URL 构造 + 失败回退”。

## 11. 下一轮建议
1. 若本轮手动 GUI 验证通过，优先推进 Desktop 首页更多业务入口（如 Agent 预览入口）并保持同级安全固定动作模式。
2. 或单开任务推进 Reader DB 同步字段补齐设计评审（不直接落地真实自动同步）。
3. 不建议继续做纯文案小补丁轮次。
