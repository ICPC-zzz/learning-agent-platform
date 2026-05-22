# A156 — ai-core 遗留 modified 文件审查与处理

## 元信息

| 项目 | 内容 |
|------|------|
| 轮次 | A156 |
| 执行器 | Claude Code + DeepSeek |
| 日期 | 2026-05-22 |
| 上一轮 | A155 (classify worktree leftovers) |
| 当前 commit | `002750c chore(docs): classify worktree leftovers` |

## 任务范围

审查并处理 `packages/ai-core` 下 4 个遗留 modified 文件，判断应当保留/回滚/拆分，做最小处理。

本轮不是功能开发、不是接入真实 LLM、不是启用真实 provider/tool/Agent loop。

## 目标文件

1. `packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts`
2. `packages/ai-core/src/agent/runtime-policy-preview.ts`
3. `packages/ai-core/src/llm-provider-config.ts`
4. `packages/ai-core/src/spark-provider.ts`

---

## 第一步：工作区确认

### git status --short 摘要

```
 M docs/codex-context/CURRENT_HANDOFF.md
 M docs/rounds/codex/A153_codex.md
 M docs/rounds/codex/A154_codex.md
 M docs/rounds/codex/A155_claude.md
 M docs/status/PROJECT_COMPLETION_SUMMARY.md
 M packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts
 M packages/ai-core/src/agent/runtime-policy-preview.ts
 M packages/ai-core/src/llm-provider-config.ts
 M packages/ai-core/src/spark-provider.ts
```

还有大量 `D`（deleted）文件来自 A145-A155 压缩归档，以及 4 个 `??`（untracked）deepseek 压缩报告文件。

无暂存内容（`git diff --cached` 为空）。

### 非 A156 范围遗留文件

以下 modified 文件不在 A156 范围内，本轮不处理、不暂存：

- `docs/rounds/codex/A153_codex.md` (M) — 非 A156 范围
- `docs/rounds/codex/A154_codex.md` (M) — 非 A156 范围
- `docs/rounds/codex/A155_claude.md` (M) — 非 A156 范围
- `docs/status/PROJECT_COMPLETION_SUMMARY.md` (M) — 禁止修改

---

## 第二步：4 个目标文件 diff 审查

### 1. readonly-tool-sandbox-runtime.ts

**Diff 内容**：移除一行未使用的 type-only import。

```
-  type AgentToolSandboxSideEffectLevelPreview as AgentToolSandboxSideEffectLevelPreviewValue,
```

`AgentToolSandboxSideEffectLevelPreview` 作为 value 已在第 6 行导入（用于 `typeof` 类型引用），此处移除的是类型别名导入，该别名在文件中无任何使用。

**安全审查**：

- 文件仍然是只读 sandbox skeleton，所有操作默认禁用
- `createDefaultReadOnlyToolSandboxRuntimeConfig()` 仍返回 `runtimeEnabled: false, mode: "disabled"`
- `executeReadOnlyToolSandboxSkeleton()` 仍然只返回静态 mock 数据
- 所有 forbidden operations（file_system, network, shell, llm 等）保持不变
- 无真实执行、无网络请求、无文件 I/O、无 LLM 调用

**结论**：SAFE。仅移除未使用的 import。

**决策**：✅ 保留

---

### 2. runtime-policy-preview.ts

**Diff 内容**：移除 `AgentRuntimeLifecycleStatus` 的 value import，保留 type import。

```
-  AgentRuntimeLifecycleStatus,
```

`AgentRuntimeLifecycleStatus` 作为 value（enum）在此文件中无任何运行时的值引用（如 `AgentRuntimeLifecycleStatus.Active` 等），仅在类型位置通过 `AgentRuntimeLifecycleStatusValue` 使用。type import 仍保留。

**安全审查**：

- 文件仍是 preview-only 的 runtime policy 集合
- `createRuntimePolicyBoundaryFlagsPreview()` 仍返回所有 `false` 标志
- `evaluateRuntimeAuditPolicyPreview()` 仍 `productionAuditEnabled: false`
- 所有 preview evaluation 函数仍标注 `previewOnly: true`
- 无真实执行、无网络、无 LLM 调用

**结论**：SAFE。仅移除未使用的 value import。

**决策**：✅ 保留

---

### 3. llm-provider-config.ts

**Diff 内容**：移除 `SENSITIVE_ENV_LIKE_KEY_SET` 变量及其构建逻辑。

```
-const SENSITIVE_ENV_LIKE_KEY_SET = new Set(
-  SENSITIVE_ENV_LIKE_KEYS.map(normalizeEnvKey),
-);
```

`SENSITIVE_ENV_LIKE_KEYS` 数组仍保留。`SENSITIVE_ENV_LIKE_KEY_SET` 在文件中无任何引用——`hasSensitiveEnvLikeValue()` 函数内自己构建了临时的 `requestedKeySet`。

**安全审查**：

- `loadLlmProviderConfigsFromEnv()` 仍返回 `realProviderCallsEnabled: false, networkAccessEnabled: false`
- `loadSparkProviderConfigFromEnv()` 仍返回 `effectiveEnabled: false`
- 所有 secret 值仍然通过 `redactSecretPresence()` 红化处理
- 无硬编码 key、无默认启用 provider、无真实调用

**结论**：SAFE。仅移除死代码。

**决策**：✅ 保留

---

### 4. spark-provider.ts

**Diff 内容**：将 `_config` 参数改为 `config`，添加 `void config;`。

```
-  _config: SparkProviderConfig = createDisabledSparkProviderConfig(),
+  config: SparkProviderConfig = createDisabledSparkProviderConfig(),
+  void config;
```

`getSparkProviderAdapterStatus()` 不实际使用 config 参数的值，仅返回固定的 disabled 状态。原代码用 TypeScript 下划线前缀约定标记未使用参数，改为显式 `void` 表达式是常见的替代风格。

**安全审查**：

- `getSparkProviderAdapterStatus()` 仍返回 `enabled: false, realCallEnabled: false, networkAccessEnabled: false`
- `createSparkTestProvider()` 的 `createChatCompletion` 仍返回 `ProviderDisabled` 错误
- `createDisabledSparkProviderConfig()` 仍设置 `enabled: false, mode: TestProviderDisabled`
- 无硬编码密钥、无自动网络请求、无 raw prompt/response 保存
- 所有敏感 metadata key 仍然被过滤

**结论**：SAFE。仅代码风格调整。

**决策**：✅ 保留

---

## 第三步：决策汇总

| 文件 | 变更类型 | 安全结论 | 决策 |
|------|----------|----------|------|
| readonly-tool-sandbox-runtime.ts | 移除未使用 import | SAFE | ✅ 保留 |
| runtime-policy-preview.ts | 移除未使用 import | SAFE | ✅ 保留 |
| llm-provider-config.ts | 移除死代码 | SAFE | ✅ 保留 |
| spark-provider.ts | 代码风格调整 | SAFE | ✅ 保留 |

全部 4 个文件均为安全的最小清理改动，无需回滚。

---

## 第四步：最小修正

无需修正。所有 diff 均为安全清理，不涉及业务逻辑变更。

---

## 第五步：验证

### Typecheck

```
$ npx tsc --noEmit -p packages/ai-core/tsconfig.json
EXIT: 0
```

通过，无类型错误。

### Lint

ESLint 无法运行（VM 中 node_modules 不完整，缺少 `debug` 依赖），非代码问题。4 个文件均为 import 移除/死代码删除/风格调整，不引入新的 lint 问题。

### 测试

未发现 `packages/ai-core` 下任何 `*.test.*` 或 `*.spec.*` 文件。该包当前无最小测试。

---

## 第六步：安全边界确认

全部 12 条安全边界检查通过：

| # | 边界 | 状态 |
|---|------|------|
| 1 | 禁止真实 LLM provider 调用 | ✅ 未触发 |
| 2 | 禁止真实工具执行 | ✅ 未触发 |
| 3 | 禁止启动真实 Agent loop | ✅ 未触发 |
| 4 | 禁止接入真实 RAG | ✅ 未触发 |
| 5 | 禁止新增联网请求 | ✅ 未触发 |
| 6 | 禁止保存 raw prompt / raw response | ✅ 未触发 |
| 7 | 禁止读取、打印、提交 API key/密码/token/secret | ✅ 未触发 |
| 8 | 禁止硬编码任何 provider key | ✅ 未触发 |
| 9 | 禁止把 Spark provider 或任何 provider 变成默认启用 | ✅ 未触发 |
| 10 | 禁止让工具 sandbox 执行真实命令 | ✅ 未触发 |
| 11 | 所有 provider/tool/runtime 改动保持 preview-only / mock-only / disabled-by-default | ✅ 确认 |
| 12 | 未发现现有 diff 突破安全边界 | ✅ 确认 |

**未触碰 apps/**：本轮未读取、未修改 `apps/` 下任何文件。

**未触碰 docs/status/PROJECT_COMPLETION_SUMMARY.md**：确认未修改。

---

## 第七步 & 第八步：暂存与提交

### 暂存文件

```
git add packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts
git add packages/ai-core/src/agent/runtime-policy-preview.ts
git add packages/ai-core/src/llm-provider-config.ts
git add packages/ai-core/src/spark-provider.ts
git add docs/rounds/codex/A156_claude.md
git add docs/codex-context/CURRENT_HANDOFF.md
```

### cached 验证

cached 中不包含 `apps/`、`docs/status/`、`package.json`、`pnpm-lock.yaml`、`.env` 等范围外文件。

### Commit message

```
chore(ai-core): resolve preview provider leftovers
```

---

## 未处理遗留文件

以下文件处于 modified 状态但不在 A156 范围，未暂存、未提交：

| 文件 | 状态 | 说明 |
|------|------|------|
| docs/rounds/codex/A153_codex.md | M | A155 压缩相关，非 A156 范围 |
| docs/rounds/codex/A154_codex.md | M | A155 压缩相关，非 A156 范围 |
| docs/rounds/codex/A155_claude.md | M | A155 压缩相关，非 A156 范围 |
| docs/status/PROJECT_COMPLETION_SUMMARY.md | M | 禁止修改，应单独处理 |

另有大量 `D`（deleted）文件来自 A155 压缩归档，以及 4 个 `??`（untracked）deepseek 压缩报告，均非 A156 范围。

---

## 下一轮建议

工作区仍有文档遗留（A153/A154/A155 modified 文档 + deleted 归档文件 + untracked 压缩报告），建议下一轮（A157）处理这些文档层面的暂存/提交，或由 DeepSeek 执行阶段文档压缩收尾。

代码层面 `packages/ai-core` 4 个遗留 modified 文件已全部处理完毕，不再污染工作区。

## 项目总进度

项目总进度：**30.00%**

---

## 附录：修改文件清单

| 文件 | 操作 |
|------|------|
| `packages/ai-core/src/agent/readonly-tool-sandbox-runtime.ts` | 保留（已 staged） |
| `packages/ai-core/src/agent/runtime-policy-preview.ts` | 保留（已 staged） |
| `packages/ai-core/src/llm-provider-config.ts` | 保留（已 staged） |
| `packages/ai-core/src/spark-provider.ts` | 保留（已 staged） |
| `docs/rounds/codex/A156_claude.md` | 新建（已 staged） |
| `docs/codex-context/CURRENT_HANDOFF.md` | 更新（已 staged） |
