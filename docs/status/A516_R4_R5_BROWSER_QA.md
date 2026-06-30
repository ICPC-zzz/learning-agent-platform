# A516 R4/R5 Browser QA

Date: 2026-06-28

## Scope

This QA continued A516 after an interrupted run. It verified the existing `/ai` Web task chain through the real page form, `runAssistantAction`, `createAndStartAssistantMultiAgentTask`, `FileAssistantTaskRepository`, `runReliableAgentLoop`, canonical `InMemoryToolRuntime`, persisted audit timeline, and refresh recovery.

The local dev server was started with:

```powershell
LAP_AGENT_STABILITY_TEST_MODE=1
pnpm dev -- --port 3106
```

No Prisma schema, migration, `db push`, Git staging, commit, push, reset, restore, stash, or clean was performed.

## Fixes Made During QA

- Changed development stability mode labels in `AssistantChatPanel.tsx` from English to Chinese.
- Changed user-visible Reliable Agent Loop audit messages from English to Chinese.
- Changed development final-answer safety text so it no longer displays `raw prompt`, `raw provider response`, or `raw tool output` terms.

## Browser Scenarios

Verified through the browser and then checked in the persisted task repository:

| Scenario | Mode | Result |
| --- | --- | --- |
| Normal multi-tool loop | `normal` | `partial_success`; real repository events showed multiple model requests, tool result append, microcompact, final answer, and evidence. |
| Unknown tool | `tool_unknown_once` | `partial_success`; `tool_call_validation_failed`, `tool_result_appended`, and second model request persisted. |
| Large tool result | `tool_large_result_once` | `succeeded`; 2 safe artifacts persisted, budget and artifact events persisted, metadata did not expose server paths. |
| Compression failure | `context_compression_failure` | `failed`; `context_compression_paused` and `context_blocked` persisted, model calls stopped after threshold, Chinese blocking answer returned. |
| Unsupported tool calling | `tool_calling_unsupported` | `partial_success`; no Reliable Loop event, legacy compatibility path produced a deterministic Chinese summary. |
| Cancel and late result discard | `delay_task_for_cancel` | `cancelled`; cancel request and cancelled terminal state persisted, later wait did not overwrite terminal state. |
| Empty tool result | `tool_empty_once` | `succeeded`; empty result state persisted and the loop still continued to final answer. |
| Tool timeout | `tool_timeout_once` | `partial_success`; timeout event/state persisted and the loop still produced a partial answer. |
| Duplicate tool call | `tool_duplicate_once` | `partial_success`; validation failure persisted and a safe tool result was appended. |
| Max tool calls | `agent_loop_max_tool_calls` | `partial_success`; `agent_loop_limit_reached` persisted. |
| Max model turns | `agent_loop_max_turns` | `partial_success`; model-turn limit persisted. |
| Local tool internal failure | `tool_internal_error_once` | `partial_success`; tool failure persisted and second model request occurred. |

Refresh recovery was verified for normal, large result, compression blocked, cancel, and no-raw-safety scenarios. The refreshed page loaded final answers and timeline from `FileAssistantTaskRepository`, not a frontend timer.

## Security Observations

- Tool execution went through canonical runtime events.
- Timeline events came from persisted repository audit events.
- Large results were represented by safe previews and artifact IDs; task views did not expose artifact file paths.
- Final answers and audit events did not expose raw prompt, raw provider response, raw tool I/O, credentials, stack traces, or internal paths.
- The latest no-raw browser scenario confirmed the refreshed UI segment had no `raw prompt`, `raw provider`, `raw response`, `raw tool`, or `chain of thought` terms.

## Not Fully Reverified

- Real external tool-calling model QA was not run because no user-configured real CHAT provider was used in this A516 session.
- The `tool_permission_denied_once` browser mode did not trigger a Reliable Loop permission-denied event in this run. Permission-denied canonical handling remains covered by A512/A513 tests, but the Reliable Loop browser injection path should be revisited in a future small task.
