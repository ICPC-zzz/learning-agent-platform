"use client";

import { useMemo, useState } from "react";

import {
  getWebAgentToolRegistry,
  type WebAgentToolName,
} from "@learning-agent-platform/ai-core/agent/web-agent-readonly-tool-registry";
import {
  createWebAgentRunScaffold,
} from "@learning-agent-platform/ai-core/agent/web-agent-runtime";

import type { WebAgentMessageCoreResult } from "./web-agent-message-core";
import {
  buildWebAgentChatViewModel,
  type WebAgentChatViewModel,
} from "./web-agent-chat-view-model";
import { AgentCapabilityScaffoldPanel } from "./agent-capability-scaffold-panel";
import styles from "./page.module.css";

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: WebAgentMessageCoreResult["mode"];
  executionPath?: WebAgentMessageCoreResult["executionPath"];
  selectedToolId?: WebAgentToolName | null;
  toolSelectionSource?: WebAgentMessageCoreResult["toolSelectionSource"];
  toolUsed?: WebAgentToolName | null;
  toolResultPreview?: string | null;
  toolExecutionStatus?: WebAgentMessageCoreResult["toolExecutionStatus"];
  toolJob?: WebAgentMessageCoreResult["toolJob"] | null;
  toolBlockedReason?: string | null;
  toolErrorReason?: string | null;
  toolGuardEnabled?: boolean;
  toolGuardNotice?: string;
  providerMode?: string | null;
  llmUsed?: boolean;
  toolIntentValidated?: boolean | null;
  toolIntentValidationReason?: string | null;
  toolIntentReason?: string | null;
  finalAnswerSource?: WebAgentMessageCoreResult["finalAnswerSource"];
  fallbackReason?: string | null;
  guardNotice?: string;
  guardSourceLabel?: string;
  warnings?: readonly string[];
}

interface WebAgentChatPanelProps {
  initialModeLabel: string;
  initialModeDescription: string;
}

export function WebAgentChatPanel({
  initialModeLabel,
  initialModeDescription,
}: WebAgentChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [useExternalLlmDev, setUseExternalLlmDev] = useState(false);
  const [toolPreviewEnabled, setToolPreviewEnabled] = useState(false);
  const [lastResult, setLastResult] =
    useState<WebAgentMessageCoreResult | null>(null);

  const viewModel = useMemo<WebAgentChatViewModel>(
    () =>
      buildWebAgentChatViewModel({
        lastResult,
        isSending,
        useExternalLlmDev,
        toolPreviewEnabled,
      }),
    [isSending, lastResult, toolPreviewEnabled, useExternalLlmDev],
  );
  const toolCallRecord = viewModel.toolCallRecords[0] ?? null;

  async function submitMessage(message: string) {
    const normalized = message.trim();

    if (normalized.length === 0 || isSending) {
      return;
    }

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: "user",
      content: normalized,
    };

    setTurns((current) => [...current, userTurn]);
    setIsSending(true);

    try {
      const response = await fetch("/api/agent/send-web-agent-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: normalized,
          useExternalLlmDev,
          toolPreviewEnabled,
        }),
      });

      const result = (await response.json()) as WebAgentMessageCoreResult;
      setLastResult(result);
      setTurns((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.finalAnswer,
          mode: result.mode,
          executionPath: result.executionPath,
          selectedToolId: result.selectedToolId,
          toolSelectionSource: result.toolSelectionSource,
          toolUsed: result.toolUsed,
          toolResultPreview: result.toolResultPreview,
          toolExecutionStatus: result.toolExecutionStatus,
          toolJob: result.toolJob,
          toolBlockedReason: result.toolExecution.blockedReason,
          toolErrorReason: result.toolExecution.errorReason,
          toolGuardEnabled: result.toolGuardEnabled,
          toolGuardNotice: result.toolGuardNotice,
          providerMode: result.providerMode,
          llmUsed: result.llmUsed,
          toolIntentValidated: result.toolIntentValidated,
          toolIntentValidationReason: result.toolIntentValidationReason,
          toolIntentReason: result.toolIntentReason,
          finalAnswerSource: result.finalAnswerSource,
          fallbackReason: result.fallbackReason,
          guardNotice: result.guardNotice,
          guardSourceLabel: result.guardSourceLabel,
          warnings: result.warnings,
        },
      ]);
    } catch {
      const fallback = createClientFailureResult();
      setLastResult(fallback);
      setTurns((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: fallback.finalAnswer,
          mode: fallback.mode,
          executionPath: fallback.executionPath,
          selectedToolId: fallback.selectedToolId,
          toolSelectionSource: fallback.toolSelectionSource,
          toolUsed: fallback.toolUsed,
          toolResultPreview: fallback.toolResultPreview,
          toolExecutionStatus: fallback.toolExecutionStatus,
          toolJob: fallback.toolJob,
          toolBlockedReason: fallback.toolExecution.blockedReason,
          toolErrorReason: fallback.toolExecution.errorReason,
          toolGuardEnabled: fallback.toolGuardEnabled,
          toolGuardNotice: fallback.toolGuardNotice,
          providerMode: fallback.providerMode,
          llmUsed: fallback.llmUsed,
          toolIntentValidated: fallback.toolIntentValidated,
          toolIntentValidationReason: fallback.toolIntentValidationReason,
          toolIntentReason: fallback.toolIntentReason,
          finalAnswerSource: fallback.finalAnswerSource,
          fallbackReason: fallback.fallbackReason,
          guardNotice: fallback.guardNotice,
          guardSourceLabel: fallback.guardSourceLabel,
          warnings: fallback.warnings,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function sendCurrentDraft() {
    void submitMessage(draft);
  }

  function sendPreset(presetMessage: string) {
    setDraft(presetMessage);
    void submitMessage(presetMessage);
  }

  return (
    <section className={styles.webAgentChatPanel} aria-labelledby="web-agent-chat">
      <div className={styles.webAgentChatHeader}>
        <div>
          <p className={styles.webAgentEyebrow}>Web Agent dev-only preview</p>
          <h2 className={styles.webAgentTitle} id="web-agent-chat">
            /agent minimal chat
          </h2>
          <p className={styles.webAgentDescription}>
            {initialModeLabel} 路 {initialModeDescription}
          </p>
        </div>
        <span className={styles.webAgentModeBadge}>{viewModel.statusBadgeLabel}</span>
      </div>

      <div className={styles.webAgentControls} aria-label="Web Agent controls">
        <label className={styles.webAgentToggle}>
          <input
            type="checkbox"
            checked={useExternalLlmDev}
            onChange={(event) => setUseExternalLlmDev(event.target.checked)}
          />
          <span>
            <strong>{viewModel.externalToggleLabel}</strong>
            <small>{viewModel.externalToggleHint}</small>
          </span>
        </label>
        <label className={styles.webAgentToggle}>
          <input
            type="checkbox"
            checked={toolPreviewEnabled}
            onChange={(event) => setToolPreviewEnabled(event.target.checked)}
          />
          <span>
            <strong>{viewModel.toolToggleLabel}</strong>
            <small>{viewModel.toolToggleHint}</small>
          </span>
        </label>
      </div>

      <div className={styles.webAgentBanner}>
        <span className={styles.webAgentBannerLabel}>{viewModel.bannerLabel}</span>
        <p className={styles.webAgentBannerText}>{viewModel.bannerDescription}</p>
      </div>

      <form
        className={styles.webAgentComposer}
        onSubmit={(event) => {
          event.preventDefault();
          sendCurrentDraft();
        }}
      >
        <textarea
          className={styles.webAgentTextarea}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="输入消息，例如：列出我的书籍、查看阅读进度、查看某本书详情"
          rows={4}
          maxLength={1200}
        />
        <div className={styles.webAgentComposerFooter}>
          <div className={styles.webAgentComposerMeta}>
            <span>{draft.length}/1200</span>
            <span>{viewModel.modeLabel}</span>
          </div>
          <button
            type="submit"
            className={styles.webAgentPrimaryButton}
            disabled={viewModel.submitDisabled || draft.trim().length === 0}
          >
            {viewModel.sendLabel}
          </button>
        </div>
      </form>

      <div className={styles.webAgentPresetRow}>
        <button
          type="button"
          className={styles.webAgentSecondaryButton}
          onClick={() => sendPreset("列出我的书籍")}
          disabled={isSending}
        >
          Preview books
        </button>
        <button
          type="button"
          className={styles.webAgentSecondaryButton}
          onClick={() => sendPreset("查看阅读进度")}
          disabled={isSending}
        >
          Preview progress
        </button>
        <button
          type="button"
          className={styles.webAgentSecondaryButton}
          onClick={() => sendPreset("查看某本书详情 bookId=book-1")}
          disabled={isSending}
        >
          Preview detail
        </button>
      </div>

      <div className={styles.webAgentReplyPanel} aria-live="polite">
        <div className={styles.webAgentReplyTopLine}>
          <strong>Current mode</strong>
          <span>{viewModel.modeLabel}</span>
        </div>
        <p className={styles.webAgentReplyDescription}>{viewModel.modeDescription}</p>
          <div className={styles.webAgentToolExecutionFacts}>
            <span>loopMode: {viewModel.loopModeLabel}</span>
            <span>loopSteps: {viewModel.loopStepCount}/{viewModel.loopMaxSteps}</span>
            <span>
              loopToolCalls: {viewModel.loopToolCallCount}/{viewModel.loopMaxToolCalls}
          </span>
          <span>maxDurationMs: {viewModel.loopMaxDurationMs}</span>
          <span>selectedTool: {viewModel.selectedToolId ?? "none"}</span>
          <span>toolUsed: {viewModel.toolUsed ?? "none"}</span>
          <span>selectionSource: {viewModel.toolSelectionSource}</span>
            <span>providerMode: {viewModel.providerMode ?? "none"}</span>
            <span>llmUsed: {viewModel.llmUsed ? "yes" : "no"}</span>
            <span>
              networkPermission: {viewModel.networkGuard?.allowed ? "enabled" : "blocked"}
            </span>
            <span>
              networkGuard: {viewModel.networkGuard?.sourceLabel ?? "none"}
            </span>
            <span>
              mcpPermission: {viewModel.githubPermissionStatus}
            </span>
            <span>
              githubProviderMode: {viewModel.githubProviderMode ?? "blocked"}
            </span>
            <span>
              githubAllowedRepoStatus: {viewModel.githubAllowedRepoStatus ?? "none"}
            </span>
            <span>
              mcpGuard: {viewModel.mcpGuardEnabled ? "enabled" : "blocked"}
            </span>
            <span>
              mcpGuardLabel: {viewModel.mcpGuardSourceLabel}
            </span>
            <span>
              selectedMcpTool: {viewModel.selectedMcpToolId ?? "none"}
            </span>
            <span>
              githubResultPreview: {viewModel.githubResultPreview ?? "none"}
            </span>
            <span>
              toolIntentValidated:{" "}
              {viewModel.toolIntentValidated === null
                ? "not attempted"
                : viewModel.toolIntentValidated
                ? "yes"
                : "no"}
          </span>
          <span>toolGuard: {viewModel.toolGuardEnabled ? "enabled" : "disabled"}</span>
          <span>executionPath: {viewModel.executionPath}</span>
        </div>
        {viewModel.toolIntentValidationReason ? (
          <p className={styles.webAgentReason}>
            Intent check: {viewModel.toolIntentValidationReason}
          </p>
        ) : null}
        {viewModel.loopBlockReason ? (
          <p className={styles.webAgentReason}>
            Loop block reason: {viewModel.loopBlockReason}
          </p>
        ) : null}
        {viewModel.mcpGuardNotice ? (
          <p className={styles.webAgentReason}>
            MCP guard: {viewModel.mcpGuardNotice}
          </p>
        ) : null}
        {viewModel.fallbackReason ? (
          <p className={styles.webAgentReason}>
            Fallback reason: {viewModel.fallbackReason}
          </p>
        ) : null}
      </div>

      <AgentCapabilityScaffoldPanel scaffold={viewModel.capabilityScaffold} />

      <div className={styles.webAgentCatalogGrid}>
        <section className={styles.webAgentCatalogCard} aria-labelledby="critic-review">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="critic-review">
              Critic review
            </h3>
            <span className={styles.webAgentPreviewPill}>dev-only / preview</span>
          </div>
          {viewModel.criticReview === null ? (
            <p className={styles.webAgentSectionNote}>
              Send a message to see the critic/reviewer pass.
            </p>
          ) : (
            <>
              <div className={styles.webAgentToolExecutionFacts}>
                <span>criticDecision: {viewModel.criticReview.decision}</span>
                <span>reviewMode: {viewModel.criticReview.reviewMode}</span>
                <span>reviewedToolId: {viewModel.criticReview.reviewedToolId ?? "none"}</span>
                <span>reviewedToolName: {viewModel.criticReview.reviewedToolName ?? "none"}</span>
                <span>modelProfile: {viewModel.criticReview.reviewerModelProfileLabel}</span>
              </div>
              <p className={styles.webAgentReason}>
                {viewModel.criticReview.decisionReason}
              </p>
              <p className={styles.webAgentToolInputSummary}>
                {viewModel.criticReview.reviewSummary}
              </p>
              <ul className={styles.webAgentSkillNotes}>
                {viewModel.criticReview.findings.map((finding) => (
                  <li key={finding.findingId}>
                    <strong>
                      {finding.severity} / {finding.dimension}
                    </strong>{" "}
                    {finding.summary}
                    {finding.recommendation ? (
                      <div>{finding.recommendation}</div>
                    ) : null}
                    {finding.evidence.length > 0 ? (
                      <ul>
                        {finding.evidence.map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
              {viewModel.criticReview.revisionHints.length > 0 ? (
                <div className={styles.webAgentToolSchema}>
                  {viewModel.criticReview.revisionHints.map((hint) => (
                    <span key={hint}>{hint}</span>
                  ))}
                </div>
              ) : null}
              <div className={styles.webAgentToolExecutionFacts}>
                <span>devOnly: yes</span>
                <span>previewOnly: yes</span>
                <span>safeToExposeToClient: yes</span>
                <span>
                  reviewedToolId: {viewModel.criticReview.reviewedToolId ?? "none"}
                </span>
              </div>
            </>
          )}
        </section>

        <section className={styles.webAgentCatalogCard} aria-labelledby="loop-steps">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="loop-steps">
              Loop steps
            </h3>
            <span className={styles.webAgentPreviewPill}>
              {viewModel.loopModeLabel}
            </span>
          </div>
          <p className={styles.webAgentSectionNote}>
            {viewModel.loopModeDescription}
          </p>
          <div className={styles.webAgentToolExecutionFacts}>
            <span>maxSteps: {viewModel.loopMaxSteps}</span>
            <span>maxToolCalls: {viewModel.loopMaxToolCalls}</span>
            <span>maxDurationMs: {viewModel.loopMaxDurationMs}</span>
          </div>
          <ol className={styles.webAgentLoopStepList}>
            {viewModel.runSteps.length === 0 ? (
              <li className={styles.webAgentLoopStepItem}>
                <p className={styles.webAgentSectionNote}>
                  No bounded loop steps were recorded for this turn.
                </p>
              </li>
            ) : (
              viewModel.runSteps.map((step) => (
                <li key={step.stepId} className={styles.webAgentLoopStepItem}>
                  <div className={styles.webAgentLoopStepHeader}>
                    <strong>
                      Step {step.stepIndex}: {step.title}
                    </strong>
                    <span>
                      {step.kind} | {step.status}
                    </span>
                  </div>
                  <p className={styles.webAgentToolInputSummary}>{step.summary}</p>
                  <div className={styles.webAgentToolSchema}>
                    <span>input: {step.inputSummary}</span>
                    <span>output: {step.outputSummary}</span>
                  </div>
                  {step.toolCallIds.length > 0 ? (
                    <div className={styles.webAgentToolSchema}>
                      {step.toolCallIds.map((toolCallId) => (
                        <span key={toolCallId}>toolCall: {toolCallId}</span>
                      ))}
                    </div>
                  ) : null}
                  {step.traceEventIds.length > 0 ? (
                    <div className={styles.webAgentToolSchema}>
                      {step.traceEventIds.map((traceEventId) => (
                        <span key={traceEventId}>trace: {traceEventId}</span>
                      ))}
                    </div>
                  ) : null}
                  {step.safetyNotes.length > 0 ? (
                    <ul className={styles.webAgentSkillNotes}>
                      {step.safetyNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))
            )}
          </ol>
        </section>

        <section className={styles.webAgentCatalogCard} aria-labelledby="tool-catalog">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="tool-catalog">
              Available tools
            </h3>
            <span className={styles.webAgentPreviewPill}>dev-only / preview</span>
          </div>
          <p className={styles.webAgentSectionNote}>
            The registry is metadata-only. Every tool is read-only and disabled by default.
          </p>
          <ol className={styles.webAgentToolList}>
            {viewModel.toolRegistry.map((tool) => (
              <li key={tool.toolId} className={styles.webAgentToolListItem}>
                <div className={styles.webAgentToolListTopLine}>
                  <div>
                    <p className={styles.webAgentToolName}>{tool.displayName}</p>
                    <p className={styles.webAgentToolMeta}>
                      {tool.toolId} | {tool.riskLevel}
                    </p>
                  </div>
                  <span className={styles.webAgentFlag}>disabled by default</span>
                </div>
                <p className={styles.webAgentToolDescription}>{tool.description}</p>
                <div className={styles.webAgentToolSchema}>
                  {tool.inputSchema.fields.length === 0 ? (
                    <span>no input</span>
                  ) : (
                    tool.inputSchema.fields.map((field) => (
                      <span key={`${tool.toolId}-${field.name}`}>
                        {field.name}:{field.type}
                        {field.required ? " *" : ""}
                      </span>
                    ))
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.webAgentCatalogCard} aria-labelledby="tool-execution">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="tool-execution">
              Tool call record
            </h3>
            <span className={styles.webAgentPreviewPill}>
              {toolCallRecord?.validationStatus ?? "idle"}
            </span>
          </div>
          {toolCallRecord === null ? (
            <p className={styles.webAgentSectionNote}>
              Send a message to see the current turn tool call record.
            </p>
          ) : (
            <>
              <div className={styles.webAgentToolExecutionFacts}>
                <span>toolName: {toolCallRecord.toolName}</span>
                <span>toolId: {toolCallRecord.toolId ?? "none"}</span>
                <span>validation: {toolCallRecord.validationStatus}</span>
                <span>execution: {toolCallRecord.toolExecutionStatus}</span>
                <span>selectedBy: {toolCallRecord.selectedBy}</span>
                <span>readOnly: yes</span>
                <span>safeToExposeToClient: yes</span>
              </div>
              {toolCallRecord.blockedReason ? (
                <p className={styles.webAgentReason}>
                  Blocked reason: {toolCallRecord.blockedReason}
                </p>
              ) : null}
              {toolCallRecord.errorReason ? (
                <p className={styles.webAgentReason}>
                  Error reason: {toolCallRecord.errorReason}
                </p>
              ) : null}
              <p className={styles.webAgentToolInputSummary}>
                Input: {toolCallRecord.inputSummary}
              </p>
              {toolCallRecord.toolId === "safeWebFetch" ||
              viewModel.toolExecution?.toolId === "safeWebFetch" ? (
                <>
                  <div className={styles.webAgentToolExecutionFacts}>
                    <span>
                      finalUrl: {viewModel.toolExecution?.finalUrl ?? "none"}
                    </span>
                    <span>
                      contentType: {viewModel.toolExecution?.contentType ?? "none"}
                    </span>
                    <span>
                      truncated: {viewModel.toolExecution?.truncated ? "yes" : "no"}
                    </span>
                  </div>
                  {viewModel.toolExecution?.textPreview ? (
                    <pre className={styles.webAgentToolExecutionPreview}>
                      {viewModel.toolExecution.textPreview}
                    </pre>
                  ) : null}
                </>
              ) : null}
              {toolCallRecord.toolResultPreview ? (
                <pre className={styles.webAgentToolExecutionPreview}>
                  {toolCallRecord.toolResultPreview}
                </pre>
              ) : (
                <p className={styles.webAgentSectionNote}>
                  No tool result preview was produced for this turn.
                </p>
              )}
              {toolCallRecord.warnings.length > 0 ? (
                <details className={styles.webAgentWarnings}>
                  <summary>Tool warnings</summary>
                  <ul>
                    {toolCallRecord.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </section>

        <section className={styles.webAgentCatalogCard} aria-labelledby="tool-job">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="tool-job">
              Tool job trace
            </h3>
            <span className={styles.webAgentPreviewPill}>
              {viewModel.toolJob?.status ?? "idle"}
            </span>
          </div>
          {viewModel.toolJob === null ? (
            <p className={styles.webAgentSectionNote}>
              Send a message to create a background tool job preview.
            </p>
          ) : (
            <>
              <div className={styles.webAgentToolExecutionFacts}>
                <span>jobId: {viewModel.toolJob.jobId}</span>
                <span>status: {viewModel.toolJob.status}</span>
                <span>
                  selectedTool: {viewModel.toolJob.selectedToolId ?? "none"}
                </span>
                <span>
                  previewEnabled: {viewModel.toolJob.request.toolPreviewEnabled ? "yes" : "no"}
                </span>
              </div>
              <div className={styles.webAgentToolExecutionFacts}>
                <span>policy.enabled: {viewModel.toolJob.policy.enabled ? "yes" : "no"}</span>
                <span>timeoutMs: {viewModel.toolJob.policy.timeoutMs}</span>
                <span>maxInputBytes: {viewModel.toolJob.policy.maxInputBytes}</span>
                <span>maxPreviewBytes: {viewModel.toolJob.policy.maxPreviewBytes}</span>
              </div>
              {viewModel.toolJob.blockedReason ? (
                <p className={styles.webAgentReason}>
                  Blocked reason: {viewModel.toolJob.blockedReason}
                </p>
              ) : null}
              {viewModel.toolJob.timeoutReason ? (
                <p className={styles.webAgentReason}>
                  Timeout reason: {viewModel.toolJob.timeoutReason}
                </p>
              ) : null}
              {viewModel.toolJob.cancelledReason ? (
                <p className={styles.webAgentReason}>
                  Cancel reason: {viewModel.toolJob.cancelledReason}
                </p>
              ) : null}
              {viewModel.toolJob.errorReason ? (
                <p className={styles.webAgentReason}>
                  Error reason: {viewModel.toolJob.errorReason}
                </p>
              ) : null}
              {viewModel.toolJob.result?.resultPreview ? (
                <pre className={styles.webAgentToolExecutionPreview}>
                  {viewModel.toolJob.result.resultPreview}
                </pre>
              ) : null}
              <ul className={styles.webAgentSkillNotes}>
                {viewModel.toolJob.traceEvents.map((event) => (
                  <li key={event.traceEventId}>
                    <strong>{event.severity}</strong> {event.kind}: {event.message}
                    {event.details.length > 0 ? (
                      <div>{event.details.join(" | ")}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={styles.webAgentCatalogCard} aria-labelledby="run-trace">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="run-trace">
              Run trace
            </h3>
            <span className={styles.webAgentPreviewPill}>
              {viewModel.runTraceEvents.length} events
            </span>
          </div>
          {viewModel.runTraceEvents.length === 0 ? (
            <p className={styles.webAgentSectionNote}>
              Send a message to see the preview run trace.
            </p>
          ) : (
            <>
              <div className={styles.webAgentToolExecutionFacts}>
                <span>runId: {viewModel.runId ?? "none"}</span>
                <span>stepCount: {viewModel.runSteps.length}</span>
                <span>toolCallCount: {viewModel.toolCallRecords.length}</span>
                <span>mode: {viewModel.modeLabel}</span>
              </div>
              {viewModel.runContext ? (
                <p className={styles.webAgentReason}>
                  Context preview: {viewModel.runContext.messagePreview}
                </p>
              ) : null}
              <ul className={styles.webAgentSkillNotes}>
                {viewModel.runTraceEvents.map((event) => (
                  <li key={event.traceEventId}>
                    <strong>{event.severity}</strong> {event.kind}: {event.message}
                    {event.details.length > 0 ? (
                      <div>{event.details.join(" | ")}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={styles.webAgentCatalogCard} aria-labelledby="memory-preview">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="memory-preview">
              Memory preview
            </h3>
            <span className={styles.webAgentPreviewPill}>
              {viewModel.memoryPreview?.compressionNeeded ? "compression needed" : "no compression"}
            </span>
          </div>
          {viewModel.memoryPreview === null ? (
            <p className={styles.webAgentSectionNote}>
              Send a message to see the preview memory scaffold.
            </p>
          ) : (
            <>
              <div className={styles.webAgentToolExecutionFacts}>
                <span>productionReady: no</span>
                <span>safeToExposeToClient: yes</span>
                <span>shortTermMessages: {viewModel.memoryPreview.shortTermMessages.length}</span>
              </div>
              <p className={styles.webAgentReason}>
                Working summary: {viewModel.memoryPreview.workingSummary}
              </p>
              <p className={styles.webAgentToolInputSummary}>
                Long-term candidate: {viewModel.memoryPreview.longTermCandidate}
              </p>
              <pre className={styles.webAgentToolExecutionPreview}>
                {viewModel.memoryPreview.shortTermMessages.join("\n")}
              </pre>
              <ul className={styles.webAgentSkillNotes}>
                {viewModel.memoryPreview.safetyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={styles.webAgentCatalogCard} aria-labelledby="skill-seed">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="skill-seed">
              Skill seed preview
            </h3>
            <span className={styles.webAgentPreviewPill}>preview only</span>
          </div>
          {viewModel.skillSeed === null ? (
            <p className={styles.webAgentSectionNote}>
              Send a message to generate a skill seed preview.
            </p>
          ) : (
            <>
              <p className={styles.webAgentSkillName}>
                {viewModel.skillSeed.skillCandidate.name}
              </p>
              <p className={styles.webAgentToolDescription}>
                {viewModel.skillSeed.skillCandidate.description}
              </p>
              <div className={styles.webAgentToolExecutionFacts}>
                <span>confidence: {viewModel.skillSeed.confidence.toFixed(2)}</span>
                <span>productionReady: no</span>
              </div>
              <div className={styles.webAgentToolSchema}>
                {viewModel.skillSeed.triggerHints.map((hint) => (
                  <span key={hint}>{hint}</span>
                ))}
              </div>
              <div className={styles.webAgentToolSchema}>
                {viewModel.skillSeed.requiredTools.length === 0 ? (
                  <span>required tools: none</span>
                ) : (
                  viewModel.skillSeed.requiredTools.map((tool) => (
                    <span key={tool}>{tool}</span>
                  ))
                )}
              </div>
              <ul className={styles.webAgentSkillNotes}>
                {viewModel.skillSeed.safetyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={styles.webAgentCatalogCard} aria-labelledby="assistant-reply">
          <div className={styles.webAgentSectionHeader}>
            <h3 className={styles.webAgentSectionTitle} id="assistant-reply">
              Final assistant reply
            </h3>
            <span className={styles.webAgentPreviewPill}>preview only</span>
          </div>
          {viewModel.assistantMessage === null ? (
            <p className={styles.webAgentSectionNote}>
              Send a message to generate the final assistant reply.
            </p>
          ) : (
            <>
              <div className={styles.webAgentToolExecutionFacts}>
                <span>guard: {viewModel.toolGuardEnabled ? "enabled" : "disabled"}</span>
                <span>source: {viewModel.guardSourceLabel}</span>
                <span>providerMode: {viewModel.providerMode ?? "none"}</span>
                <span>finalAnswerSource: {viewModel.finalAnswerSource}</span>
              </div>
              <p className={styles.webAgentReason}>{viewModel.guardNotice}</p>
              {viewModel.fallbackReason ? (
                <p className={styles.webAgentReason}>
                  Fallback reason: {viewModel.fallbackReason}
                </p>
              ) : null}
              <pre className={styles.webAgentToolExecutionPreview}>
                {viewModel.finalAnswer ?? viewModel.assistantMessage}
              </pre>
            </>
          )}
        </section>

      </div>

      <div className={styles.webAgentTranscript} aria-label="Web Agent transcript">
        {turns.length === 0 ? (
          <p className={styles.webAgentEmptyTranscript}>
            Send a message to see the dev-only mock or guarded external answer here.
          </p>
        ) : (
          turns.map((turn) => (
            <article
              key={turn.id}
              className={
                turn.role === "user"
                  ? styles.webAgentUserTurn
                  : styles.webAgentAssistantTurn
              }
            >
              <div className={styles.webAgentTurnHeader}>
                <strong>{turn.role === "user" ? "You" : "Agent"}</strong>
                {turn.mode ? <span>{turn.mode}</span> : null}
              </div>
              <pre className={styles.webAgentTurnContent}>{turn.content}</pre>
              {turn.role === "assistant" ? (
                <div className={styles.webAgentToolPreview}>
                  <div className={styles.webAgentToolPreviewHeader}>
                    <strong>selectedTool</strong>
                    <span>{turn.toolSelectionSource ?? "blocked"}</span>
                  </div>
                  <p>{turn.selectedToolId ?? "none"}</p>
                  <div className={styles.webAgentToolExecutionFacts}>
                    <span>toolUsed: {turn.toolUsed ?? "none"}</span>
                    <span>
                      guard: {turn.toolGuardEnabled ? "enabled" : "disabled"}
                    </span>
                  </div>
                  {turn.toolBlockedReason ? (
                    <p className={styles.webAgentReason}>
                      Blocked reason: {turn.toolBlockedReason}
                    </p>
                  ) : null}
                  {turn.toolErrorReason ? (
                    <p className={styles.webAgentReason}>
                      Error reason: {turn.toolErrorReason}
                    </p>
                  ) : null}
                  {turn.toolResultPreview ? (
                    <pre className={styles.webAgentToolPreviewContent}>
                      {turn.toolResultPreview}
                    </pre>
                  ) : null}
                </div>
              ) : null}
              {turn.warnings && turn.warnings.length > 0 ? (
                <details className={styles.webAgentWarnings}>
                  <summary>Warnings</summary>
                  <ul>
                    {turn.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))
        )}
      </div>

      <footer className={styles.webAgentFooter}>
        <p>dev-only / preview only. No hidden prompt, hidden response, or DB write is stored.</p>
      </footer>
    </section>
  );
}

function createClientFailureResult(): WebAgentMessageCoreResult {
  const assistantMessage = "[blocked] Failed to send the dev-only Web Agent message.";
  const toolExecution: WebAgentMessageCoreResult["toolExecution"] = {
    toolId: null,
    status: "blocked",
    safeToExposeToClient: true,
    toolResultPreview: null,
    blockedReason: "client_request_failed",
    errorReason: null,
    warnings: [],
    inputSummary: "client_request_failed",
    readOnly: true,
    enabledByDefault: false,
    productionReady: false,
  };
  const runScaffold = createWebAgentRunScaffold({
    message: "client_request_failed",
    mode: "blocked",
    executionPath: "blocked",
    selectedToolId: null,
    selectedToolInput: {},
    selectedToolInputSummary: "client_request_failed",
    toolExecution,
    toolRegistry: getWebAgentToolRegistry(),
    toolSelectionSource: "blocked",
    toolGuardEnabled: false,
    toolGuardNotice: "Tool preview is disabled.",
    toolGuardSourceLabel: "blocked (client error)",
    providerMode: null,
    llmUsed: false,
    realProviderCalled: false,
    fallbackUsed: false,
    fallbackReason: null,
    toolIntentValidated: null,
    toolIntentValidationReason: null,
    toolIntentReason: null,
    toolIntentFinalAnswerHint: null,
    warnings: ["The client request failed before the server response returned."],
    blockedReasons: ["client_request_failed"],
    finalAnswerSource: "blocked",
    finalAnswer: assistantMessage,
  });
  const mcpGuard: WebAgentMessageCoreResult["mcpGuard"] = {
    enabled: false,
    nonProduction: false,
    devEnabled: false,
    allowAgentMcp: false,
    githubReadonlyEnabled: false,
    allowed: false,
    missingEnvKeys: [],
    blockedReasons: ["client_request_failed"],
    notice: "MCP connector preview is blocked because the client request failed.",
    sourceLabel: "mcp-guard-blocked (client error)",
    devOnly: true,
    productionReady: false,
  };
  const networkGuard: WebAgentMessageCoreResult["networkGuard"] = {
    enabled: false,
    nonProduction: false,
    networkDevEnabled: false,
    allowAgentNetwork: false,
    allowed: false,
    blockedReasons: ["client_request_failed"],
    notice: "Network preview is blocked because the client request failed.",
    sourceLabel: "network-guard-blocked (client error)",
    devOnly: true,
    productionReady: false,
  };

  return {
    ...runScaffold,
    ok: false,
    mode: "blocked",
    modeLabel: "blocked",
    modeDescription:
      "The chat request failed before it reached the preview API.",
    executionPath: "blocked",
    selectedToolId: null,
    selectedToolInput: {},
    toolSelectionSource: "blocked",
    toolUsed: null,
    toolGuardEnabled: false,
    toolGuardNotice: "Tool preview is disabled.",
    toolGuardSourceLabel: "tool-guard-blocked (preview disabled)",
    providerMode: null,
    llmUsed: false,
    toolIntentValidated: null,
    toolIntentValidationReason: null,
    toolIntentReason: null,
    toolIntentFinalAnswerHint: null,
    loopModeLabel: "bounded-loop-v1",
    loopModeDescription:
      "Loop preview was blocked before the dev-only bounded loop could run.",
    loopMaxSteps: 2,
    loopMaxToolCalls: 1,
    loopMaxDurationMs: 4_000,
    loopStepCount: 0,
    loopToolCallCount: 0,
    loopPlanSummary: "client_request_failed",
    loopBlockReason: "client_request_failed",
    finalAnswer: assistantMessage,
    finalAnswerSource: "blocked",
    fallbackReason: null,
    toolRegistry: getWebAgentToolRegistry(),
    mcpGuard,
    networkGuard,
    selectedMcpToolId: null,
    toolExecution,
    toolExecutionStatus: "blocked",
    toolResultPreview: null,
    toolJob: null,
    assistantMessage,
    skillCandidate: runScaffold.skillSeed.skillCandidate,
    skillSeed: runScaffold.skillSeed,
    steps: [],
    traceEvents: [],
    toolCallRecords: [],
    blockedReasons: ["client_request_failed"],
    warnings: ["The client request failed before the server response returned."],
    realProviderCalled: false,
    fallbackUsed: false,
    devOnly: true,
    productionReady: false,
    safeToExposeToClient: true,
    rawPromptStored: false,
    rawResponseStored: false,
    secretSafe: true,
    createdAt: new Date().toISOString(),
    answerPreview: assistantMessage,
    guardNotice: "Client request failed.",
    guardSourceLabel: "blocked (client error)",
    toolBlockedReasons: ["client_request_failed"],
    toolWarnings: [],
  };
}
