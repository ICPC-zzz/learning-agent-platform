"use client";

import { useState, useTransition } from "react";

import {
  saveAgentPermissionPreview,
  type SaveAgentPermissionPreviewInput,
  type SaveAgentPermissionPreviewResult,
  type SaveAgentPermissionPreviewStatus,
} from "./agent-permission-preview-save-action";
import styles from "./page.module.css";

type SavePanelStatus = SaveAgentPermissionPreviewStatus | "idle" | "saving";

interface AgentPermissionPreviewSavePanelProps {
  saveInput: SaveAgentPermissionPreviewInput;
}

const clientFailureResult = {
  status: "failed",
  previewOnly: true,
  permissionFlowEnabled: false,
  decisionCaptured: false,
  executable: false,
  realExecutionEnabled: false,
  toolsExecuted: false,
  llmCalled: false,
  networkUsed: false,
  memoryRetrievalExecuted: false,
  embeddingsUsed: false,
  vectorSearchUsed: false,
  ragUsed: false,
  skillGenerated: false,
  skillInstalled: false,
  skillExecuted: false,
  decisionPreviewSaved: false,
  permissionPreviewRecordSaved: false,
  dataSaved: false,
  errorCategory: "unknown",
  message:
    "服务端动作返回结果前，权限预览保存已失败。权限预览仍可查看，且未执行任何智能体任务。",
} as const satisfies SaveAgentPermissionPreviewResult;

export function AgentPermissionPreviewSavePanel({
  saveInput,
}: AgentPermissionPreviewSavePanelProps) {
  const [result, setResult] =
    useState<SaveAgentPermissionPreviewResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const status: SavePanelStatus = isPending
    ? "saving"
    : result?.status ?? "idle";
  const statusClassName = `${styles.statusBadge} ${getStatusClassName(status)}`;

  function handleSavePermissionPreview() {
    startTransition(() => {
      void saveAgentPermissionPreview(saveInput)
        .then((nextResult) => {
          setResult(nextResult);
        })
        .catch(() => {
          setResult(clientFailureResult);
        });
    });
  }

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="权限预览保存边界"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>
            权限预览保存边界
          </h3>
          <p className={styles.planSummary}>
            该按钮只保存当前权限请求和权限决策形状预览记录。它不会捕获用户决策、
            授予权限、运行智能体任务、执行工具、调用模型、检索记忆或执行 Skill。
          </p>
        </div>
        <span className={statusClassName}>{formatStatus(status)}</span>
      </div>

      <div className={styles.taskActions}>
        <button
          className={styles.previewButton}
          disabled={isPending}
          onClick={handleSavePermissionPreview}
          type="button"
        >
          {isPending ? "正在保存权限预览记录" : "保存权限预览记录"}
        </button>
      </div>

      <div className={styles.previewFactsGrid}>
        <SaveFact label="保存状态" value={formatStatus(status)} />
        <SaveFact
          label="previewOnly"
          value={String(result?.previewOnly ?? true)}
        />
        <SaveFact
          label="permissionFlowEnabled"
          value={String(result?.permissionFlowEnabled ?? false)}
        />
        <SaveFact
          label="decisionCaptured"
          value={String(result?.decisionCaptured ?? false)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <SaveFact
          label="executable"
          value={String(result?.executable ?? false)}
        />
        <SaveFact
          label="realExecutionEnabled"
          value={String(result?.realExecutionEnabled ?? false)}
        />
        <SaveFact
          label="decisionPreviewSaved"
          value={String(result?.decisionPreviewSaved ?? false)}
        />
        <SaveFact
          label="previewRecordSaved"
          value={String(result?.permissionPreviewRecordSaved ?? false)}
        />
      </div>

      {result === null ? (
        <p className={styles.disabledCopy}>
          当前保存状态为空闲。本页面会话中尚未保存任何权限预览记录。
        </p>
      ) : (
        <SaveResultDetails result={result} />
      )}

      <section
        className={styles.planBlock}
        aria-labelledby="permission-save-boundary"
      >
        <h4 className={styles.detailTitle} id="permission-save-boundary">
          权限保存边界安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          <li>保存的权限记录仅为预览。</li>
          <li>未捕获用户决策。</li>
          <li>未授予权限。</li>
          <li>未把权限决策保存为真实批准。</li>
          <li>确认流程未启用。</li>
          <li>未执行智能体任务。</li>
          <li>未执行工具。</li>
          <li>未调用模型。</li>
          <li>未发起网络请求。</li>
          <li>未执行记忆检索。</li>
          <li>只有点击这个显式按钮后才会尝试保存。</li>
        </ul>
      </section>
    </article>
  );
}

function SaveResultDetails({
  result,
}: {
  result: SaveAgentPermissionPreviewResult;
}) {
  return (
    <>
      <div className={styles.previewFactsGrid}>
        <SaveFact
          label="已保存权限请求 ID"
          value={result.savedPermissionRequestId ?? "无"}
        />
        <SaveFact
          label="已保存权限决策 ID"
          value={result.savedPermissionDecisionId ?? "无"}
        />
        <SaveFact
          label="decisionPreviewSaved"
          value={String(result.decisionPreviewSaved)}
        />
        <SaveFact
          label="错误分类"
          value={result.errorCategory ?? "无"}
        />
      </div>
      <p className={styles.disabledCopy}>{result.message}</p>
      {result.status === "saved" ? null : (
        <p className={styles.disabledReason}>
          权限请求和权限决策预览面板仍可使用；只有权限预览记录保存不可用或失败。
        </p>
      )}
      <div className={styles.previewFactsGrid}>
        <SaveFact
          label="permissionFlowEnabled"
          value={String(result.permissionFlowEnabled)}
        />
        <SaveFact
          label="decisionCaptured"
          value={String(result.decisionCaptured)}
        />
        <SaveFact label="executable" value={String(result.executable)} />
        <SaveFact
          label="realExecutionEnabled"
          value={String(result.realExecutionEnabled)}
        />
      </div>
      <div className={styles.previewFactsGrid}>
        <SaveFact
          label="toolsExecuted"
          value={String(result.toolsExecuted)}
        />
        <SaveFact label="llmCalled" value={String(result.llmCalled)} />
        <SaveFact label="networkUsed" value={String(result.networkUsed)} />
        <SaveFact
          label="memoryRetrievalExecuted"
          value={String(result.memoryRetrievalExecuted)}
        />
      </div>
      <div className={styles.previewFactsGrid}>
        <SaveFact
          label="embeddingsUsed"
          value={String(result.embeddingsUsed)}
        />
        <SaveFact
          label="vectorSearchUsed"
          value={String(result.vectorSearchUsed)}
        />
        <SaveFact label="ragUsed" value={String(result.ragUsed)} />
        <SaveFact
          label="skillExecuted"
          value={String(result.skillExecuted)}
        />
      </div>
    </>
  );
}

function formatStatus(status: SavePanelStatus): string {
  const labels: Record<SavePanelStatus, string> = {
    idle: "空闲",
    saving: "保存中",
    saved: "已保存",
    unavailable: "不可用",
    failed: "失败",
  };

  return labels[status];
}

function SaveFact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function getStatusClassName(status: SavePanelStatus): string {
  if (status === "saved") {
    return styles.boundaryReady;
  }

  if (status === "failed" || status === "unavailable") {
    return styles.disabled;
  }

  if (status === "saving") {
    return styles.previewOnly;
  }

  return styles.notStarted;
}
