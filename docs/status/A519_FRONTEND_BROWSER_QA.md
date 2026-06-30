# A519 Frontend Browser QA

日期：2026-06-29
本地地址：http://127.0.0.1:3110

## 1. QA 范围

使用内置 Browser 验证普通用户端页面：

- `/`
- `/articles`
- `/problems`
- `/ai`
- `/user`
- `/auth/login`
- `/auth/register`

后台仅做冒烟检查：

- `/admin`
- `/admin/settings`

截图目录：

- `docs/status/a519-frontend-qa-screenshots/`

## 2. 关键截图

最终复核截图：

- `mobile-home-final4.png`
- `mobile-articles-final2.png`
- `mobile-ai-final2.png`
- `mobile-problems-final.png`
- `mobile-user-final.png`
- `desktop-home-final2.png`
- `desktop-articles-final2.png`
- `desktop-ai-final2.png`
- `desktop-admin-root-final2.png`

## 3. 发现与修复

第一轮 QA 发现：

- 移动端首页 CTA 和标题存在视觉裁切风险。
- 移动端文章页存在横向溢出，主要来自长日期指标、日期徽章和收藏按钮。
- AI 页移动端标题和辅助入口偏挤。

已修复：

- 首页标题强制分成两行。
- 首页第二 CTA 缩短为“问 AI 教练”。
- `PageHero` 指标区从 `.homeActions` 解耦为 `.learningHeroActions`。
- `MetricPill` 允许换行。
- 文章卡片头部允许换行。
- 收藏按钮在小屏变为紧凑图标按钮。

## 4. 最终 Browser 结果

390px 移动端最终检查：

- 首页：无横向溢出。
- 文章：无横向溢出。
- AI 助手：无横向溢出。
- 题目中心：无横向溢出。
- 个人页：无横向溢出。
- 登录/注册：无横向溢出。

1440px 桌面端最终检查：

- 首页：无横向溢出。
- 文章：无横向溢出。
- AI 助手：无横向溢出。
- `/admin`：404，符合 A518 后的管理员入口状态；未发现本轮用户端样式导致的控制台错误。

控制台：

- 最终 `tab.dev.logs({ levels: ["error", "warning", "warn"] })` 无页面错误或警告。

## 5. 命令验证

已通过：

```bash
pnpm --filter @learning-agent-platform/web typecheck
pnpm --filter @learning-agent-platform/web exec eslint src/app/_components/AuthenticatedHome.tsx src/app/_components/AppHeader.tsx src/app/_components/AppNav.tsx src/app/_components/HomeLoginEntry.tsx src/app/_components/UserUiComponents.tsx src/app/auth/login/page.tsx src/app/auth/register/page.tsx src/app/articles/components/ArticleCenterTabs.tsx src/app/articles/components/ArticleLibraryClient.tsx src/app/ai/AiAssistantTabs.tsx src/app/ai/page.tsx src/app/user/page.tsx src/app/user/CodeforcesDashboardClient.tsx src/app/problems/page.tsx src/components/articles/FavoriteArticleButton.tsx
node --test tests/a515-*.test.mjs
node --test tests/a516-*.test.mjs
node --test tests/a517-*.test.mjs
node --test tests/a518-*.test.mjs
pnpm --filter @learning-agent-platform/ai-core typecheck
pnpm --filter @learning-agent-platform/db typecheck
pnpm run typecheck
```

A519 专用测试：

```text
No tests/a519-*.test.mjs files found.
```
