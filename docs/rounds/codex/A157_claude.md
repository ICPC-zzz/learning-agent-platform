# A157: Reader Demo Mode Notice Banner

## 轮次信息
- **轮次**: A157
- **执行器**: Claude Code + DeepSeek
- **日期**: 2026-05-22
- **当前任务**: 为 reader 页面顶部添加演示模式通知横幅

## 当前 git commit
- `b32248c chore(ai-core): resolve preview provider leftovers`

## 初始 git status 摘要
工作区存在大量历史遗留文档（deleted/modified/untracked），来自 A153-A155 的文档压缩操作。本次任务不处理这些遗留文件。

## 修改文件
1. `apps/web/src/app/reader/page.tsx` — 新增 `DemoModeNotice` 静态组件，插入三个渲染路径顶部
2. `apps/web/src/app/globals.css` — 新增 `.demoModeNotice` 和 `.demoModeBadge` CSS 类（33行）

## 新增文件
- `docs/rounds/codex/A157_claude.md`（本文件）

## 删除文件
无

## 移动文件
无

## 横幅文案
- **标题（badge）**: 演示模式
- **正文**: 当前阅读器使用演示/预览数据。阅读进度仅恢复到章节级，暂不包含滚动位置；AI 问答、RAG 与真实模型 provider 均未启用。当前展示不代表真实学习闭环已完成。
- **样式**: 黄色/琥珀色警告色调（border: #e6d48a, background: #fffbe6, badge: #856404），与现有 readerDataSourceNotice 系列风格一致

## 安全边界确认
- [x] 横幅仅为静态 UI 提示，未绑定任何真实开关、provider 调用、后台任务或数据写入
- [x] 未引入 useEffect、server action 或 API 调用
- [x] 未新增客户端状态
- [x] 未新增依赖
- [x] 未修改 package.json / pnpm-lock.yaml
- [x] 未修改 Prisma schema / migrations
- [x] 未修改 packages/ai-core
- [x] 未修改 docs/status/PROJECT_COMPLETION_SUMMARY.md
- [x] 未删除项目文件
- [x] 未使用 git add . 或 git add -A

## 是否触碰业务逻辑
否。仅在三个已有渲染路径的 `<main>` 顶部插入静态 `<DemoModeNotice />` 组件，未修改 reader 业务逻辑、数据流、状态管理或任何功能行为。

## 是否触碰 provider/tool/runtime
否。未触碰任何 provider、tool、runtime 配置或调用。

## 是否触碰 packages/ai-core
否。

## 验证命令和结果

### Typecheck
执行 `npx tsc --noEmit --project apps/web/tsconfig.json`。所有错误均为预先存在的环境问题（node_modules 缺失、Next.js 内部类型无法解析），与本轮改动无关。reader/page.tsx 和 globals.css 未产生新的类型错误。

### Lint
未执行。环境缺少 pnpm 和 node_modules，无法运行 `pnpm lint`。但改动仅涉及静态 JSX 结构和纯 CSS，无 lint 风险。

### Reader 测试搜索
执行 `find apps/web/src -path '*reader*' -name '*.test.*' -o -name '*.spec.*'`，未发现 reader 相关最小测试。

### JSX 标签平衡验证
通过 node 脚本验证 page.tsx 中 `<main>`、`<header>`、`<div>`、`<section>` 等标签的开闭数量完全匹配。

### 浏览器验证
未执行。原因：
1. 开发服务器未运行（localhost:3000 不可达）
2. Claude in Chrome 扩展未连接
3. 环境缺少 pnpm 无法安装依赖启动 dev server

## git add / commit 情况
暂存文件：
- `apps/web/src/app/reader/page.tsx`
- `apps/web/src/app/globals.css`
- `docs/rounds/codex/A157_claude.md`
- `docs/codex-context/CURRENT_HANDOFF.md`

## commit hash
待提交

## 未处理遗留文件
以下文件属于 A153-A155 历史遗留（文档压缩/清理操作产生），本轮不处理、不暂存、不提交：
- `D docs/_archive_pending_review/WEB_MVP_COMPLETION_ROADMAP.md`
- `D docs/codex-tasks/CODEX_RULES.md`
- `D docs/rounds/codex/A134_codex.md` 至 `D docs/rounds/codex/A143_codex.md`（共14个）
- `M docs/rounds/codex/A153_codex.md`
- `M docs/rounds/codex/A154_codex.md`
- `M docs/rounds/codex/A155_claude.md`
- `D docs/rounds/deepseek/A134_deepseek.md` 至 `D docs/rounds/deepseek/A143_deepseek.md`（共13个）
- `M docs/status/PROJECT_COMPLETION_SUMMARY.md`
- `M docs/codex-context/CURRENT_HANDOFF.md`（A156 修改残留）
- `?? docs/rounds/deepseek/A134-A144_archive_report.md`
- `?? docs/rounds/deepseek/A134-A144_compression.md`
- `?? docs/rounds/deepseek/A145-A155_archive_report.md`
- `?? docs/rounds/deepseek/A145-A155_compression.md`
- `?? docs/rounds/deepseek/A156_deepseek.md`

## 下一轮建议
1. (文档) 处理 A153-A155 遗留文档的 git 暂存/提交收尾
2. (功能) 根据需求继续 reader 或 web 端 UI 增强
3. (验证) 在具备 pnpm 环境后运行 typecheck + lint 确认无回归

## 项目总进度
30.00%
