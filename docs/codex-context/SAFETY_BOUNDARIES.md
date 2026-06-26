# Safety Boundaries

当前项目有大量 Agent / Runtime / Tool / Provider 相关设计仍处于 preview-only、mock-only 或 disabled-by-default 状态。

## 当前边界

- Agent runtime 相关能力默认只是预览或 mock runtime。
- Tool 相关能力默认只是需求预览、风险标签或禁用元数据。
- Provider 相关能力默认不代表真实业务调用。
- Skill 相关能力默认只是 manifest、校验、建议或安装审查 scaffold。
- Skill 社区当前仅占位，不属于近期主线完成度目标。
- Skill 执行仍然 disabled-by-default，不能真实安装、分发或执行社区 Skill。

## 禁止事项

- 禁止真实调用 LLM provider，除非某轮任务明确要求，并且安全边界、日志和 provider gate 已准备好。
- 禁止真实执行工具，除非某轮任务明确要求，并且权限、审计、风险分级和回滚边界已准备好。
- 禁止保存 raw prompt / raw response。
- 禁止泄露或硬编码 API key、数据库密码、token、secret。
- 禁止把 preview-only、mock-only、disabled-by-default 能力描述成真实上线能力。

## UI 文案

- “预览记录”不能写成“真实执行记录”。
- “模拟运行”不能写成“已运行任务”。
- “mock runtime”不能写成“生产 runtime”。
- provider disabled 时不能暗示已经调用真实模型。
- tool disabled 时不能暗示已经执行真实工具。

## 后续推进方式

任何真实 provider、真实工具执行、真实 agent loop、真实后台任务、真实 Skill 执行都必须单独开任务推进，并先补齐权限、日志、安全边界和验证。

后续如果重新启用 Skill 社区或真实 Skill 执行，必须单独设计权限、审计、风险控制、安装审查、版本更新和撤销机制，不能沿用占位/scaffold 直接上线。
