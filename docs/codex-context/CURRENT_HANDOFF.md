<!-- Generated at 2026-06-11 (A404 maintenance round) -->

# CURRENT_HANDOFF

## 1. 当前状态
- **主线**：Web 网页端 + 软件端/Desktop。Skill 社区仅占位/scaffold，不计入近期完成度分母。
- **最近确认完成轮**：A403（Open Library dev-only provider + Import 页面外部书源预览入口）
- **当前轮**：A404 维护提交轮（代码提交 + 文档治理 + 阅读入口规范化，不做新业务功能开发）
- **Web 端**：内置书库浏览、纯文本导入（多层 guard）、用户中心（收藏/题目/学习报告/复习/每日挑战）、Reader 书签/笔记/活动/计时/章节问答（mock + 安全摘要）。Auth 仅 dev session。A399–A403 新增：Daily Challenge v1（6-tier 确定性推荐）、Daily Challenge completion DB 写入（dev-only guarded）、Book Source Provider 抽象、Open Library dev-only provider 及 Import 页面预览入口（4 层 guard，外部 API 默认关闭）。
- **Desktop**：所有面板只读预览，标注"开发预览"，不连接 DB/AI。
- **数据库**：已扩展 Book、Favorite、Progress、LearningActivity 等模型，所有写入依赖多层 `LAP_*` 环境变量显式开启。
- **Agent/AI**：全部 preview-only / mock-only / disabled-by-default。章节问答默认 mock，真实 AI 调用需显式环境变量授权。Reader QA external LLM 尚未正式接入（目录上有 WIP 草稿代码，计划 A405 正式推进）。
- **测试**：累计 970+ 条测试通过，lint 0 错误，typecheck 预存 VM 环境错误（非业务代码问题）。

## 2. 最近完成轮（A403）
**A403** — Open Library dev-only provider + Import 页面外部书源预览入口
- `open-library-book-source-provider.ts`：4 层 guard，搜索+详情 API adapter，安全字段提取
- Import 页面新增 `BookApiPreviewClient` 预览入口
- 测试：47 条 pass（book-engine）+ 68 条 pass（import 模块）
- 所有外部 API 调用默认关闭

## 3. 本轮 A404（维护提交）
- 修复 2 个受损文件（import/page.tsx 截断、wrong-book/page.tsx 截断和中文引号语法错误）
- 创建 `docs/status/A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md` 压缩总结
- 更新 `CODEX_ALWAYS_READ.md` 阅读指南
- 归档过时文档到 `docs/_archive_pending_review/docs-cleanup/A404/`
- 代码提交 checkpoint：包含目录上 A404 LLM WIP 草稿代码（reader-qa-provider-selection.ts/test.mjs，untracked→committed 作为 checkpoint，**不代表该功能已完成验收**）

## 4. 下一轮 Codex 必读
- `docs/codex-context/CURRENT_HANDOFF.md`
- `docs/codex-context/CODEX_ALWAYS_READ.md`
- `docs/codex-context/CODEX_RULES.md`
- `docs/codex-context/SAFETY_BOUNDARIES.md`
- `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
- 最近 1 轮 `docs/rounds/codex/A404_claude.md`
- 若涉及 Web 能力接入背景：`docs/status/A394-A403_WEB_REAL_CAPABILITY_COMPRESSION.md`
- 若任务涉及 Reader 同步：`docs/modules/reader-sync-current-state.md`
- **不要默认读取 A394–A403 原始轮次文档**

## 5. 下一轮 Codex 禁止
- 禁止解锁生产环境 DB 同步或删除 disabled/blocked 语义。
- 禁止绕过任何 `LAP_*` 等多层 guard。
- 禁止接入真实 auth provider（密码/OAuth）、暴露公开 API。
- 禁止将 preview-only / mock-only / disabled-by-default 能力描述为真实上线能力。
- 禁止真实调用 LLM provider、工具执行、保存/输出 raw prompt/response 或任何密钥。
- 禁止超范围重构、顺手修无关问题、修改 Desktop 业务逻辑。
- 禁止执行 `prisma migrate dev` / `prisma db push`（由用户手动执行）。
- 禁止修改 Prisma schema（除非单独开 migration 轮次授权）。
- Claude Code 阶段不做浏览器验收，除非用户切回 Codex 或明确授权。
- 禁止继续做纯 localStorage 小功能（项目已过该阶段，应推进 dev-only guarded DB/external 接入）。

## 6. 安全边界
- Agent / Runtime / Tool / Provider / Skill 全部处于 preview-only / mock-only / disabled-by-default。
- 所有数据库写入默认关闭，需多重�