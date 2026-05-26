# A207 Codex 记录

## 1. 本轮目标
在 Desktop/Electron 中执行“最小化 DB 连通验证”：仅验证 Desktop 进程是否可安全通过 `@learning-agent-platform/db` 读取 `ReadingProgress` 第一条记录并输出安全日志；若前提不满足则执行备选任务。

## 2. 实际执行路径
备选任务。

原因：
- 运行时导入检查 `import('@learning-agent-platform/db')` 失败（Node 无法解析该 workspace 包名）。
- `packages/db/dist/index.js` 不存在，`packages/db/src/index.ts` 也无法被当前 Node 直接导入执行。
- 按任务约束，不执行 `prisma generate`、不迁移数据库、不强行修环境。

因此本轮按要求切换到“Reader 面板文案统一收敛”。

## 3. 修改文件
- `apps/web/src/app/reader/ReaderBookmarksPanel.tsx`
- `apps/web/src/app/reader/ReaderNoteDraftPanel.tsx`
- `apps/web/src/app/reader/ReaderReadingStatsPanel.tsx`
- `apps/web/src/app/reader/ReaderReadingTimer.tsx`
- `apps/web/src/app/reader/ReaderReadingStateSourceNotice.tsx`
- `docs/rounds/codex/A207_codex.md`

## 4. 核心改动
仅做右侧面板本地预览文案统一，未改逻辑：
- 将书签、笔记草稿、阅读时长统计、阅读计时、阅读状态来源提示中的本地预览文案统一为“开发预览 - 本地浏览器记录”风格。
- 保留“开发预览/本地回退”边界，不新增 API，不改 DB，不改 Reader 功能行为。

## 5. 验证结果
已执行：
- `pnpm typecheck`：通过（0 errors）
- `pnpm lint`：通过

主任务前提检查（只读探测）：
- `import('@learning-agent-platform/db')`：失败（当前运行时不可解析包名）
- `packages/db/dist/index.js`：不存在

## 6. 安全边界
- 未接入真实 LLM provider。
- 未执行真实工具链能力扩展。
- 未输出数据库连接串、完整记录、完整错误堆栈。
- 未修改 Desktop 安全配置（`nodeIntegration/contextIsolation/sandbox/CSP/路由白名单`）。
- 未修改 DB schema / migration / seed。
- 未改 Web 以外的业务逻辑。

## 7. 剩余问题
- A207 主任务（Desktop 最小化 DB 连通验证）仍未完成，阻塞点为 Desktop 主进程运行时无法直接解析 `@learning-agent-platform/db`。
- 需要在后续补救轮（A207+）先明确 Desktop 进程可用的 DB 包运行时入口策略（不破坏现有安全边界）。

## 8. 下一轮建议
1. 先在不变更安全策略前提下，确认 Desktop 主进程如何稳定解析 `@learning-agent-platform/db`（例如既有构建产物/既有运行时映射）。
2. 前提满足后再恢复 A207 主任务：启动时做 preview-only 的 `ReadingProgress.findFirst` 安全日志验证，失败静默回退。
3. 完成后补做 Desktop 启动日志回归和 route-policy 安全回归。
