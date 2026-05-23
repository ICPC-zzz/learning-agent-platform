# A178 — 提交遗留文档 modified/deleted 工作区清理

## 1. 本轮目标
将 A177 handoff 指出的约 40 个文档清理产生的 modified/deleted 文件 git add 并提交，清理工作区脏状态。

## 2. 初始 git status 摘要

**Modified 文件（14 个）：**
- apps/web 业务文件 7 个（globals.css, ReaderChapterCompletionToggle, ReaderReadingTimer, ReaderScrollPositionTracker, actions, page.tsx, package.json）
- docs/codex-context/CURRENT_HANDOFF.md
- docs/status/PROJECT_COMPLETION_SUMMARY.md
- package.json, packages/db/package.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig.base.json

**Deleted 文件（35 个）：**
- docs/_archive_pending_review/WEB_MVP_COMPLETION_ROADMAP.md
- docs/codex-tasks/CODEX_RULES.md
- docs/rounds/codex/ 下 21 个历史轮次文档（A134–A165）
- docs/rounds/deepseek/ 下 12 个历史轮次文档（A134–A143）

**Untracked 文件（约 20+ 个）：**
包括 apps/desktop/、Reader 新组件、新 docs/rounds/ 文件、migrations、scripts 等，本轮不处理。

**Staged 文件：无。**

## 3. 文件分类结果

### 已暂存提交的文件（36 个）

**Modified（1 个）：**
- `docs/codex-context/CURRENT_HANDOFF.md` — DeepSeek 更新 A177 handoff 内容

**Deleted（35 个）：**
- `docs/_archive_pending_review/WEB_MVP_COMPLETION_ROADMAP.md`
- `docs/codex-tasks/CODEX_RULES.md`
- `docs/rounds/codex/A134_codex.md` ～ `A165_claude.md`（21 个）
- `docs/rounds/deepseek/A134_deepseek.md` ～ `A143_deepseek.md`（12 个）

### 未暂存文件（本轮不处理）

| 类别 | 文件 | 原因 |
|------|------|------|
| 业务代码 | apps/web/ 下 7 个 modified 文件 | 禁止修改业务代码 |
| 依赖配置 | package.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig.base.json, packages/db/package.json | 禁止暂存锁文件/依赖 |
| 新文件 | apps/desktop/, Reader 新组件, migrations, scripts 等 | 本轮只处理 modified/deleted，不处理 untracked |
| 文档 | docs/status/PROJECT_COMPLETION_SUMMARY.md | DeepSeek 维护，不确定是否属于清理范围 |
| 新文档 | docs/rounds/codex/A167–A177, docs/rounds/deepseek/A134–A177 新文件 | untracked，不属于 modified/deleted |

### 需要用户确认的文件
- `docs/status/PROJECT_COMPLETION_SUMMARY.md` — 处于 modified 状态，但由 DeepSeek 维护，按指令「不确定就不要动」保留未暂存。

## 4. 安全检查结果

- 对所有候选文档文件执行了 `git diff` 敏感词扫描
- 搜索模式：`api.key|token|secret|password|credential|raw.prompt|raw.response|sk-|Bearer`
- 所有命中内容均为规则性描述、安全边界说明或脱敏引用，未发现真实凭据
- `docs/status/PROJECT_COMPLETION_SUMMARY.md` 单独扫描：NO_SENSITIVE_PATTERNS_FOUND
- 结论：已暂存文件不包含 API key、token、secret、密码或 raw prompt/response

## 5. 提交结果

- **是否提交成功**：是
- **commit hash**：见 `git log -1 --oneline`
- **commit message**：`chore(docs): stage modified/deleted legacy docs from archiving rounds`

## 6. 验证命令与结果

- `git status --short`：确认工作区状态
- `git diff --name-status`：确认 modified/deleted 文件清单
- `git diff --cached --name-status`：36 个文件（1M + 35D），全部为 docs/ 目录
- `git diff --cached --check`：仅 CURRENT_HANDOFF.md 有 trailing whitespace（DeepSeek 生成格式），无其他问题
- `git log -1 --oneline`：确认提交

## 7. 是否修改业务代码
否。本轮未修改 apps/、packages/ 下任何文件，未修改任何配置文件。

## 8. 剩余风险或遗留问题
- `docs/status/PROJECT_COMPLETION_SUMMARY.md` 仍处于 modified 状态，需用户确认是否纳入后续提交
- 工作区仍有大量 untracked 文件（新业务代码、新文档等），需后续轮次单独处理
- CURRENT_HANDOFF.md 有 trailing whitespace 警告（DeepSeek 生成格式），非功能问题

## 9. 下一步建议
- 运行 DeepSeek handoff 命令产出 A178_deepseek.md
- 后续轮次可处理 `docs/status/PROJECT_COMPLETION_SUMMARY.md` 的暂存（如确认属于文档清理）
- 后续轮次可处理新业务代码的暂存/提交

## 10. 粗略项目进度估算
工程治理状态改善（工作区文档清理提交完成），但项目功能进度不变，维持约 **36.00%**。
