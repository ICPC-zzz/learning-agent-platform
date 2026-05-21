# Architecture Boundaries

本文件只记录长期稳定的模块职责。文档任务不得改业务架构。

## 模块职责

- `apps/web`：编程学习网站 UI、Next.js routes、server actions、view model mapping、空态和 preview / mock / disabled 标识。
- `apps/desktop`：软件端 / Desktop client 的后续主线入口，当前可以是未实现或占位；未来负责本地 Agent、任务面板、安全权限和工具调用预览 / 执行边界。
- `packages/db`：Prisma schema、repository、数据访问边界、持久化读写封装。
- `packages/ai-core`：LLM 抽象、Agent runtime、工具、Skill scaffold、记忆、自主性权限和安全策略的核心边界。
- `packages/book-engine`：书籍导入、文本解析、章节生成、chunk、embedding 准备前的纯逻辑。
- `packages/learning-engine`：能力评分、学习反馈、题单推荐、学习进度规则逻辑。
- `packages/shared`：跨端共享类型、协议、常量和工具。

## 边界规则

- Web 层不要绕过 `packages/db` repository 边界直接拼数据库细节。
- Web 层不要直接调用底层模型 API。
- AI preview 层不要直接执行真实 provider 或真实工具。
- 当前主线是 Web 网页端 + 软件端/Desktop；Skill 社区仅保留占位/scaffold，不应驱动当前主线任务。
- Skill 相关代码和文档当前属于占位或未来扩展，不能删除 scaffold，也不要扩展完整社区能力。
- Skill 社区能力不能默认自动执行。
- Agent、Tool、Skill、自主性相关能力必须优先考虑权限、日志和安全边界。
- 文档任务不得修改业务架构、schema、依赖或运行时代码。
