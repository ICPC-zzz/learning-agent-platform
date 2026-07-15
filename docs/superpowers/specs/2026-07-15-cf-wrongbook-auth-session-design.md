# Codeforces 错题复习计划登录会话修复设计

日期：2026-07-15

## 问题与根因

个人中心的 Codeforces 刷新动作通过统一正式会话 `lap_session` 获取数据库用户 ID，但错题复习计划动作仍读取旧开发会话 `lap-web-dev-session`，并把仅用于展示的 `userIdPreview` 当作数据库用户 ID。

因此，正式登录用户可以刷新 Codeforces 数据，却会在生成错题复习计划时被错误判定为未登录。刷新动作不会清除登录状态；两个服务端动作使用不同会话来源才是根因。

## 范围

- 只修复 `generateCfWrongBookReview` 的身份解析。
- 不修改 Codeforces 刷新、绑定、同步或评分算法。
- 不迁移其他仍处于开发会话模式的历史页面。
- 不允许客户端提交或覆盖用户 ID。
- 不提交工作区内与本问题无关的现有改动。

## 设计

错题复习计划服务端动作调用 `getCurrentAuthSession()`，仅在返回 `hasSession: true` 时使用服务端解析出的真实 `session.userId`。未登录时继续返回现有的 `NOT_LOGGED_IN` 和中文提示。

数据流如下：

1. 浏览器携带 HttpOnly 的 `lap_session` Cookie 调用 Server Action。
2. `getCurrentAuthSession()` 对 Cookie 哈希并查询有效数据库会话。
3. Server Action 使用可信 `session.userId` 查询当前用户的 Codeforces 账户和题目统计。
4. 客户端不接触 Cookie 原文，也不能指定其他用户 ID。

## 错误处理

- 无有效正式会话：返回 `NOT_LOGGED_IN`，提示“请先登录”。
- 有会话但未绑定 Codeforces：保持当前空报告行为。
- 数据或分析异常：保持当前安全中文错误，不暴露内部信息。

## 测试

新增回归测试验证：

- 错题复习计划动作必须使用统一会话解析器。
- 动作不得再读取 `lap-web-dev-session`、调用 `deserializeDevSession` 或使用 `userIdPreview`。
- Codeforces 刷新动作与复习计划动作使用同一正式会话入口。

测试先在未修复的提交上失败，再应用最小修复并通过，同时运行 Web 类型检查及相关认证、Codeforces 回归测试。

## 发布

提交并推送 GitHub `main` 后，在本地隔离工作树构建精确提交。服务器只接收构建产物并原子切换 release，不执行依赖安装或 Next.js 构建。发布后验证公网健康状态、服务 CPU，并通过真实登录会话完成一次复习计划 Server Action 验收。
