# Reader DB 同步最小闭环验证说明

## 1. 本验证链路目标

建立一个可复现的最小验证链路，确认 Reader 阅读进度的数据库同步代码（`syncScrollProgressAction`、`syncChapterCompletionAction`）在本地 PostgreSQL 环境下能够正常工作。

**重要声明：Reader DB 同步当前是开发预览能力，不是正式上线能力。DB 同步失败时 Reader 静默回退 localStorage，不阻塞页面。**

## 2. 前置条件

在运行验证之前，必须完成以下准备工作：

1. **本地 PostgreSQL 已启动。**
   - 确认 PostgreSQL 服务正在运行且网络可达。

2. **本地 DATABASE_URL 已配置。**
   - 通过环境变量或在项目根目录 `.env` 文件中设置。
   - `.env` 文件**不应提交到 Git**。
   - 脚本和文档绝不输出 DATABASE_URL 原文。

3. **pnpm install 已完成。**
   - 项目依赖已安装，`node_modules` 已就绪。

4. **Prisma client 已生成。**
   - 如未执行，运行：
     ```
     pnpm --filter @learning-agent-platform/db prisma:generate
     ```

5. **Prisma schema 已 push 到数据库。**
   - 如未执行，运行：
     ```
     pnpm --filter @learning-agent-platform/db prisma:migrate:dev
     ```

## 3. 如何运行验证脚本

在项目根目录打开 PowerShell 终端：

```powershell
.\scripts\verify-reader-db-sync.ps1
```

脚本会依次：

1. 检查是否在项目根目录。
2. 检查 `node` 和 `pnpm` 是否可用。
3. 检查 seed 脚本文件是否存在。
4. 检查 `DATABASE_URL` 是否已设置（绝不输出具体值）。
5. 如果 DATABASE_URL 缺失，安全退出并提示配置方法。
6. 如果已设置，运行 demo user seed。
7. 输出手动验证步骤和安全提醒。

如果 PowerShell 执行策略阻止运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-reader-db-sync.ps1
```

## 4. 如何运行 demo seed

脚本会自动运行，等效于手动执行：

```
pnpm --filter @learning-agent-platform/db seed:demo-user
```

这会创建或重用 `demo@example.com` 演示用户。

如果 demo 用户已存在，seed 命令可能报告冲突但不是阻塞性错误，可继续后续验证。

## 5. 如何检查 `/api/dev/db-health`

1. 先启动 Web dev server（在另一个终端）：
   ```
   pnpm dev
   ```
   或：
   ```
   pnpm --filter @learning-agent-platform/web dev
   ```

2. 打开浏览器访问：
   ```
   http://localhost:3000/api/dev/db-health
   ```

3. **预期响应（连接正常）：**
   ```json
   { "ok": true, "status": "connected", "mode": "development-preview" }
   ```

4. **预期响应（连接失败）：**
   ```json
   { "ok": false, "status": "unavailable", "mode": "development-preview" }
   ```

如果返回 `ok: false`，检查：
- PostgreSQL 是否已启动。
- DATABASE_URL 是否正确。
- Prisma client 是否已 generate。
- DB schema 是否已 push。

## 6. 如何在 Reader 页面手动触发同步

### 6.1 滚动进度同步

1. 启动 Web dev server 后，在浏览器打开任意书籍章节，例如：
   ```
   http://localhost:3000/reader?bookId=<book_id>&chapterId=<chapter_id>
   ```

2. 滚动页面内容。`ReaderScrollPositionTracker` 会在 5 秒无滚动后自动触发 `syncScrollProgressAction`。

3. 打开浏览器 DevTools → Network 面板，观察是否有 POST 请求。

4. 滚动位置也同时保存在 localStorage（独立于 DB），作为回退机制。

### 6.2 本章已读同步

1. 在同一章节页面，找到「标记本章已读」按钮并点击。

2. 页面会提示同步状态消息：
   - 成功：「已读状态已同步到数据库（开发预览）。」
   - 跳过：「数据库不可用，已读状态仅保存在当前浏览器。」
   - 失败：「数据库同步失败，已读状态仅保存在当前浏览器。」

3. 刷新页面，确认已读状态是否持久化。

4. 已读状态也保存在 localStorage 中（DB 同步失败时的回退）。

## 7. 如何确认 DB 写入

### 方式 A：Prisma Studio

```
pnpm --filter @learning-agent-platform/db prisma:studio
```

打开后在 ReadingProgress 表中查看记录。

### 方式 B：psql 命令行

```sql
SELECT * FROM "ReadingProgress" ORDER BY "updatedAt" DESC LIMIT 10;
```

### 方式 C：编写查询脚本（不在本轮范围）

可以基于 `packages/db` 的 repository 编写一次性查询脚本，但不属于本轮验证建立范围。

## 8. 安全说明

1. **不提交 .env** — 数据库凭据仅通过本地环境变量注入，不纳入版本控制。
2. **不打印 DATABASE_URL** — 脚本和文档中只判断变量是否已设置，绝不输出具体值。
3. **不把开发预览能力描述成上线能力** — Reader DB 同步在当前阶段是开发预览功能。
4. **DB 同步失败时 Reader 应回退 localStorage** — `ReaderScrollPositionTracker` 和 `ReaderChapterCompletionToggle` 均已实现静默回退。
5. **不修改任何业务代码** — 本轮只新增验证脚本和文档，不触碰 Reader 源码。
6. **不修改 .env 或 .env.example** — 脚本不会写入或修改任何配置文件。

## 9. 常见失败原因

| 失败现象 | 可能原因 | 排查方法 |
|---------|---------|---------|
| DATABASE_URL is missing | 环境变量未设置 | 检查 `$env:DATABASE_URL` (PowerShell) 或 `.env` 文件 |
| seed 脚本报错 | PostgreSQL 未启动 | 检查 PostgreSQL 服务状态 |
| seed 脚本报错 | Prisma client 未 generate | 运行 `pnpm --filter @learning-agent-platform/db prisma:generate` |
| seed 脚本报错 | DB schema 未 push | 运行 `pnpm --filter @learning-agent-platform/db prisma:migrate:dev` |
| seed 脚本报错 | demo 用户已存在 | 非阻塞性错误，可继续验证 |
| /api/dev/db-health 返回 ok: false | Web dev server 未启动 | 启动 `pnpm dev` |
| /api/dev/db-health 返回 ok: false | 数据库连接失败 | 检查 PostgreSQL 状态和 DATABASE_URL |
| Reader 页面 DB 同步无请求 | DB 同步在后台静默执行 | 打开 DevTools Network 面板观察 |
| DB 同步返回 skipped | DATABASE_URL 未配置 | 检查环境变量 |

## 11. 长章节滚动同步验证（A185）

A184 已确认已读状态 DB 同步通过，但滚动同步因示例章节过短（页面无滚动条）未触发。A185 在 seed 脚本中新增了长章节用于验证滚动同步。

### 11.1 前置条件

1. 已运行更新后的 seed 脚本（包含长章节）：
   ```
   pnpm --filter @learning-agent-platform/db seed:demo-user
   ```
   成功后应看到 `long-scroll chapter seeded` 和 `long-scroll chunk seeded` 日志。

2. Web dev server 已启动。

### 11.2 验证步骤

1. 打开长章节 Reader 页面：
   ```
   http://localhost:3000/reader?bookId=sample-programming-fundamentals&chapterId=sample-chapter-long-scroll
   ```

2. 确认页面出现滚动条（约 20 段文本，~8500 字符，约 4-5 个视口高度）。

3. 滚动到页面中部或底部。

4. 等待至少 5 秒（DB 同步防抖时间为 5 秒）。

5. 可选：打开 DevTools Network 面板，观察 `syncScrollProgressAction` POST 请求。

6. 确认 DB 写入：
   - 打开 Prisma Studio：`pnpm --filter @learning-agent-platform/db prisma:studio`
   - 在 ReadingProgress 表中找到 `userId = demo user id`、`bookId = sample-programming-fundamentals`、`chapterId = sample-chapter-long-scroll` 的记录
   - 确认 `progressRatio > 0`

### 11.3 预期结果

- 页面有明显滚动条
- 无 React 错误
- `ReadingProgress.progressRatio > 0`
- `ReadingProgress.updatedAt` 有变化
- DATABASE_URL 全程不打印

### 11.4 失败排查

| 现象 | 可能原因 | 排查方法 |
|------|---------|---------|
| 页面无滚动条 | seed 未执行或 ContentChunk 未创建 | 检查 seed 输出，确认 `long-scroll chunk seeded` |
| 页面无内容 | ContentChunk.plainText 为空 | Prisma Studio 查看 `scroll-test-chunk-0` 的 `plainText` 字段 |
| 无 DB 写入 | 防抖时间未到 | 等待 > 5 秒后不滚动再检查 |
| 无 DB 写入 | demo user 不存在 | 先运行 seed |
| progressRatio 仍为 0 | 页面高度不足或无实际滚动 | 检查 `document.body.scrollHeight > window.innerHeight` |
| Network 无请求 | DB 同步被跳过 | 检查 DATABASE_URL 是否配置 |

1. 用户在本机配置 DATABASE_URL 后，运行 `scripts/verify-reader-db-sync.ps1` 完成闭环验证。
2. 验证通过后，DB 同步可从「代码就位」推进至「验证通过」状态。
3. 后续可考虑：为 Desktop Electron 应用接入 Reader DB 同步。
4. 后续可考虑：将 DB 同步从 demo 用户扩展至真实用户认证体系。
5. 如验证失败，记录具体错误信息，开 A181+ 补救轮次。
