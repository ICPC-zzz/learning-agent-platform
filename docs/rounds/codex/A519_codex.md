# A519 Codex Round

日期：2026-06-29
任务：普通用户端视觉方案设计、样板选择与选定方案实施

## 1. 用户选择

本轮按 Product Design 工作流生成 3 个方向，用户选择方案 C。

方案 C 被定义为 Academic Technology Studio：

- 浅色学术纸感背景。
- 森林绿主色。
- 靛蓝、珊瑚、天空蓝作为功能节点色。
- 首页使用高端知识图谱视觉和轻量动效。
- 其他普通用户端页面统一继承该风格，不再逐页确认。

## 2. 实施范围

已实施普通用户端页面：

- `/`
- `/articles`
- `/problems`
- `/ai`
- `/user`
- `/auth/login`
- `/auth/register`

未实施：

- `/admin/**` 后台页面。本轮只做冒烟检查，不做视觉改造。

## 3. 主要改动

- 新增首页知识图谱资产：`apps/web/public/a519/academic-knowledge-map.png`。
- 在 `globals.css` 中新增 A519 设计系统 token、首页布局、动效、移动端规则。
- 重做登录后首页为高端第一屏：标题、入口状态、知识图谱、今日训练面板、模块区。
- 普通用户端 header/nav 改为浅色半透明工作台风格。
- 登录/注册页统一主色和卡片风格。
- 文章页修复移动端横向溢出，优化收藏按钮小屏表现。
- 题目中心、AI 助手、个人页统一使用 PageHero、MetricPill、浅色卡片和绿色当前态。
- AI 助手页调整为“最终回答优先”，调试/记忆/模型信息降级为辅助入口。

## 4. Browser QA

Browser QA 记录见：

- `docs/status/A519_FRONTEND_BROWSER_QA.md`
- `docs/status/a519-frontend-qa-screenshots/`

最终结果：

- 390px 移动端：`/`、`/articles`、`/problems`、`/ai`、`/user`、登录、注册无横向溢出。
- 1440px 桌面端：首页、文章、AI 无横向溢出。
- 控制台无 error/warn。
- `/admin` 返回 404，符合当前 A518 后状态；未发现本轮用户端 CSS 引起页面错误。

## 5. 验证

通过：

- `pnpm --filter @learning-agent-platform/web typecheck`
- A519 scoped web ESLint
- `node --test tests/a515-*.test.mjs`
- `node --test tests/a516-*.test.mjs`
- `node --test tests/a517-*.test.mjs`
- `node --test tests/a518-*.test.mjs`
- `pnpm --filter @learning-agent-platform/ai-core typecheck`
- `pnpm --filter @learning-agent-platform/db typecheck`
- `pnpm run typecheck`

未运行：

- A519 专用测试不存在：`No tests/a519-*.test.mjs files found.`

## 6. 风险

- 首页知识图谱资产为本轮生成位图，体积约 1.2MB，后续进入生产前建议压缩或替换为正式设计资产。
- 当前页面仍保留开发预览和部分真实功能边界提示；AI 仍为 mock-only 主线能力，不应包装为生产 Agent。
- 本轮全局 CSS 只按普通用户端风格扩展，后台未改造；后续如果恢复 `/admin/**` 可视页面，需要单独验证后台视觉隔离。

## 7. 项目进度

本轮完成普通用户端首轮视觉统一与浏览器验收。
项目总进度仍按当前口径记录为 **32.00%**。

## 8. 后续首页细化修正

2026-06-29 追加完成首页细化：

- 顶部导航加入 `首页`，并在 `/` 正确显示当前态。
- 首页四个核心指标去除表格式分隔线，改为无边框浅色指标卡。
- 首页知识图谱与 Canvas 动画从右侧独立区域提升为整页 ambient 背景层，背景不拦截点击。
- 增强首页动画可见度：提升轨道线、粒子、中心光晕、扫光和动效透明度。
- Codeforces 学习画像、rating 曲线、提交热力图已升级为更完整的数据可视化结构。
- 学习图谱节点默认态统一为白色，并增加 hover/focus/active 选中特效。
- 首页 `技术文章与日报` 改为展示文章库最新标题，不再复用用户收藏/最近阅读。
- 首页 `收藏与最近阅读` 改为当前 session 用户的只读 DB 查询，并移除最近阅读 7 天截断。
- 首页 `收藏与最近阅读` 追加浏览器本地 fallback 合并逻辑，和个人页一致读取 `lap.web.user.favoriteArticles`、`lap.web.user.recentArticleReading`。
- 首页顶部 `最近阅读` 指标也改为客户端合并本地最近阅读与 DB 最近阅读，避免个人页有记录但首页仍显示 0。

追加验证：

- `pnpm --filter @learning-agent-platform/web typecheck`
- `pnpm exec eslint src/app/_components/HomeHeroOrbit.tsx`
- `pnpm exec eslint src/app/home-dashboard-loader.ts src/app/user/article-recent-reading-db-loader.ts src/app/_components/AuthenticatedHome.tsx`
- Browser QA：1536px 首页无横向溢出、无 console error；ambient Canvas 存在且 `pointer-events: none`；截图见 `docs/status/a519-followup-qa-screenshots/desktop-home-v5-animation-viewport.png`。
- Browser QA：1536px 首页 5 个学习图谱节点默认背景一致；技术文章卡显示文章库标题；截图见 `docs/status/a519-followup-qa-screenshots/desktop-home-v7-articles-map-viewport.png`。
- Browser QA：通过文章页真实收藏/原文点击路径产生本地文章状态，首页卡片和顶部最近阅读均能读取；截图见 `docs/status/a519-followup-qa-screenshots/desktop-home-v8-local-article-state-viewport.png`。

追加 QA 记录：

- `docs/status/A519_FOLLOWUP_UI_FIX_QA.md`
