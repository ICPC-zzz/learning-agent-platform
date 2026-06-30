<!-- Updated by Codex at 2026-06-30 after A523 -->

# CURRENT_HANDOFF

## 1. 当前状态

- 主线：Web 网页端 + 软件端/Desktop（Desktop 仍为门禁状态）。
- Skill 社区仅保留占位 scaffold，不计入近期完成度。
- 基础设施：6 包 typecheck 0 错误，生产构建通过。
- 核心页面：Articles、Problems、Personal、AI Assistant 可构建；AI/Agent/Tool 仍保持 preview-only / mock-only / disabled-by-default。
- Auth：A523 修复了 Resend Provider 配置解析和 OTP 发送失败清理；数据库 session、HttpOnly cookie、RBAC 基础保持可用。但本机缺少真实邮件 Provider 配置，真实邮件 OTP 收信/验证闭环仍未完成。
- 安全：所有 Agent/Tool/Provider/Skill/Runtime 仍是 preview-only / mock-only / disabled-by-default。

## 2. 最近一轮结果（A523）

**已完成**：
- 邮件 Provider 配置解析兼容 `LAP_EMAIL_API_KEY`/`RESEND_API_KEY` 和 `LAP_EMAIL_FROM`/`RESEND_FROM_EMAIL`/`EMAIL_FROM`。
- Provider 发送失败会消费本次 OTP 记录并记录安全审计，不会留下可用验证码或伪造成成功。
- `.env.example` 补充邮件 Provider 占位变量，没有写入真实密钥。
- `/articles` 正式路径不再把收藏/最近阅读写入 localStorage 作为业务真相源。
- `/ai` 客户端会话 store 不再使用 localStorage，客户端不再向 server action 提交 localStorage 学习上下文。
- 新增 A523 六个源码契约测试。
- typecheck、生产 build、A515-A518/A522/A523 回归测试全部通过（76 个测试）。
- `@Browser` 在生产 `next start` 下完成 1440x900 与 390x844 smoke：登录页、未登录跳转、缺 Provider OTP 安全失败。

**未完成**：
- 本机 `.env` / `.env.local` 未配置有效邮件 Provider，无法真实发送 OTP。
- 真实 OTP 收信/验证、Browser 登录保持、重启恢复、登出撤销、管理员 Browser flow、两用户 A/B Browser 隔离未闭合。
- books、reader、import、部分 user subpages 等历史 preview/localStorage/dev-session 模块仍未清理。

## 3. 下一轮 Codex 必读

- 本文件。
- `AGENTS.md`。
- `docs/codex-context/CODEX_ALWAYS_READ.md`
- `docs/codex-context/CODEX_RULES.md`
- `docs/codex-context/SAFETY_BOUNDARIES.md`
- `docs/codex-context/ARCHITECTURE_BOUNDARIES.md`
- `docs/codex-context/DOC_WORKFLOW.md`
- 最新轮次：`docs/rounds/codex/A523_codex.md`
- Auth 状态：`docs/status/A523_EMAIL_OTP_AUTH_CLOSURE.md`
- Browser QA：`docs/status/A523_AUTH_MULTI_USER_BROWSER_QA.md`
- Desktop 门禁：`docs/status/A520_DESKTOP_ENTRY_GATE.md`

## 4. 下一轮 Codex 禁止

- 禁止修改 `apps/desktop` 或解除 Desktop 门禁。
- 禁止把 preview-only / mock-only / dev-only 能力描述为生产可用。
- 禁止真实 LLM provider / 工具执行，除非单独开任务并补齐权限、日志、审计。
- 禁止无边界扩大 Auth 改造到全站历史模块。
- 禁止顺手清理全仓 lint、历史文档或无关业务问题。
- 禁止读取大型参考项目，除非用户明确要求。
- 禁止 Git reset/restore/stash/clean/rebase/force push。

## 5. 安全边界

- `lap_session` 必须保持 HttpOnly。
- 数据库只存 session token 的 SHA-256 哈希，不存原始 token。
- Admin 授权唯一来源为数据库 `User.role = ADMIN`，不再使用 `LAP_ADMIN_EMAILS` 作为运行时绕过。
- `LAP_ADMIN_EMAILS` 仅用于 bootstrap 已存在用户。
- 生产邮件响应和日志不得泄漏 OTP。
- Provider 失败不得创建可用 session，不得把失败标成成功。
- 所有 Agent/Tool/Skill 相关 UI 必须标记“开发预览”，不可暗示真实上线。

## 6. 文档处理分工

- **Codex**：只写代码、修 bug、跑验证；每轮更新 `Axxx_codex.md` 和本文件。
- **DeepSeek**：负责长文档压缩、文档整理、阶段总结（更新 `PROJECT_COMPLETION_SUMMARY.md`），并生成 `Axxx_deepseek.md`。
- Codex 默认不读长历史、`PROJECT_COMPLETION_SUMMARY.md`、`reference-analysis`，除非任务明确要求审计或阶段总结。

## 7. 下一步唯一建议

**A524：配置真实邮件 Provider 并完成 Browser Auth 闭环**

- 配置真实 Resend Provider：`RESEND_API_KEY` + `RESEND_FROM_EMAIL` 或兼容别名，确保发件人/域名已验证。
- 在 Browser 中完成注册/登录/刷新保持/登出的完整验证。
- 创建真实 admin 用户并验证 admin 授权路径。
- 用两个独立用户验证收藏、最近阅读、AI 会话、长期记忆、Codeforces 绑定等核心数据隔离。
- 待 Auth 闭环完成后，再分批清理历史模块的 dev-session/localStorage fallback。

在闭环前，继续禁止进入 Desktop。

## 8. 项目总进度

项目总进度：**48%**

说明：A523 修复了邮件 Provider 代码路径和正式 `/articles`、`/ai` 的关键 fallback，但真实邮件收信/验证和完整 Browser Auth 闭环仍被外部 Provider 配置阻塞，故只小幅上调。

```text
desktopEntryAllowed = false
```
