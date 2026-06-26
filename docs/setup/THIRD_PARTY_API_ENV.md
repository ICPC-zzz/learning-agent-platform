# Third-Party API 环境变量配置说明

本地开发需要配置第三方 API 环境变量才能启用真实外部调用。所有变量通过 `.env.local` 或本地环境配置，切勿提交到 Git。

A477 起，近期主线只围绕内容元数据、GitHub 公开数据、Codeforces 官方 API 和受控 AI Assistant 展开。旧的通用 Problem API、多 OJ、VJudge、Docker Judge 不再作为近期路线。

## 1. Codeforces 官方 API

用途：

- 同步题目名称、rating、tags。
- 保留 `contestId`、`index` 和原题链接所需字段。
- 读取用户公开提交记录和 rating 相关公开信息。

边界：

- 不导入完整题面。
- 不导入样例。
- 不导入题解全文。
- 不导入 VJudge 题面或第三方翻译题面。
- 不提供自建在线判题。

建议变量：

| 环境变量 | 说明 | 示例 |
|----------|------|------|
| `LAP_CODEFORCES_ENABLED` | 是否启用 Codeforces 读取能力 | `true` |
| `LAP_CODEFORCES_BASE_URL` | Codeforces API 基础 URL | `https://codeforces.com/api` |
| `LAP_CODEFORCES_USER_AGENT` | 请求标识 | `learning-agent-platform-dev` |
| `LAP_CODEFORCES_TIMEOUT_MS` | 请求超时 | `8000` |

## 2. GitHub 日报

用途：

- 读取仓库公开信息。
- 读取 Release。
- 生成项目摘要和推荐理由。
- 为用户推荐值得关注的开源项目。

边界：

- 不复制 README 全文。
- 不绕过访问限制。
- 不把 Star 数作为唯一推荐标准。
- 保留仓库链接和来源信息。

建议变量：

| 环境变量 | 说明 | 示例 |
|----------|------|------|
| `LAP_GITHUB_DAILY_ENABLED` | 是否启用 GitHub 日报数据读取 | `true` |
| `LAP_GITHUB_TOKEN` | GitHub API token，可选但建议本地使用低权限 token | `your_github_token` |
| `LAP_GITHUB_API_BASE_URL` | GitHub API 基础 URL | `https://api.github.com` |

## 3. 每日技术热点 / 文章元数据

用途：

- 读取公开 RSS / Atom 或合法公开元数据。
- 生成热点候选、专题学习资源和文章推荐。

边界：

- 不批量复制原文。
- 不抓取受限制内容。
- 不生成无来源事实摘要。
- 不把低质量营销内容当热点。

建议变量：

| 环境变量 | 说明 | 示例 |
|----------|------|------|
| `LAP_ARTICLE_FEEDS_ENABLED` | 是否启用文章/热点元数据读取 | `true` |
| `LAP_CN_BLOGS_ENABLED` | 是否启用博客园 RSS/Atom 来源 | `true` |
| `LAP_CSDN_FEEDS_ENABLED` | 是否启用 CSDN RSS/Atom 来源 | `false` |
| `LAP_ARTICLE_SYNC_INTERVAL_MINUTES` | 本地同步间隔 | `360` |

## 4. AI Assistant / LLM Provider

用途：

- 技术热点解释。
- GitHub 日报解释。
- Codeforces 题单推荐理由。
- 分层提示和复盘。

边界：

- 默认 disabled-by-default 或受显式 guard 控制。
- 不保存 raw prompt / raw response。
- 不在 UI 层直接调用底层模型 API。
- 不泄露 API key、token、secret。

建议变量：

| 环境变量 | 说明 | 示例 |
|----------|------|------|
| `LAP_ASSISTANT_PROVIDER_ENABLED` | 是否启用 Assistant provider | `true` |
| `LAP_LLM_PROVIDER` | provider 标识 | `openai-compatible` |
| `LAP_LLM_BASE_URL` | provider API 基础 URL | `https://api.example.com/v1` |
| `LAP_LLM_API_KEY` | provider API key | `your_llm_api_key` |
| `LAP_LLM_MODEL` | 模型名 | `your_model` |

## 5. 已暂停或废弃的旧变量方向

以下方向不再作为近期主线。若代码中仍有变量或 guard，只能作为旧实现兼容或待审计对象：

- 通用 Problem API。
- VJudge 完整题面导入。
- 多 OJ 抓取。
- Docker Judge。
- 普通用户在线提交评测。
- Skill 社区真实安装或执行。

## 6. 安全注意事项

1. 绝对不要把 `.env.local` 提交到 Git。
2. 绝对不要在代码中硬编码 API key、secret 或任何凭据。
3. 绝对不要把真实凭据分享给任何 AI 助手。
4. 所有示例值必须使用占位符。
5. AI 助手只需要检查变量名、布尔状态和缺失原因，不需要看到真实 secret。
6. 生产环境第三方调用必须有明确 guard 和审计边界。

## 7. 最小本地示例

```bash
# Codeforces
LAP_CODEFORCES_ENABLED=true
LAP_CODEFORCES_BASE_URL=https://codeforces.com/api
LAP_CODEFORCES_USER_AGENT=learning-agent-platform-dev
LAP_CODEFORCES_TIMEOUT_MS=8000

# GitHub Daily
LAP_GITHUB_DAILY_ENABLED=true
LAP_GITHUB_TOKEN=your_github_token
LAP_GITHUB_API_BASE_URL=https://api.github.com

# Article metadata
LAP_ARTICLE_FEEDS_ENABLED=true
LAP_CN_BLOGS_ENABLED=true
LAP_CSDN_FEEDS_ENABLED=false
LAP_ARTICLE_SYNC_INTERVAL_MINUTES=360

# Assistant provider
LAP_ASSISTANT_PROVIDER_ENABLED=true
LAP_LLM_PROVIDER=openai-compatible
LAP_LLM_BASE_URL=https://api.example.com/v1
LAP_LLM_API_KEY=your_llm_api_key
LAP_LLM_MODEL=your_model
```
