"use client";

import { useState, useTransition } from "react";

import {
  saveAgentTaskPreview,
  type SaveAgentTaskPreviewInput,
  type SaveAgentTaskPreviewResult,
  type SaveAgentTaskPreviewStatus,
} from "./actions";
import styles from "./page.module.css";

type SavePanelStatus = SaveAgentTaskPreviewStatus | "idle" | "saving";

interface AgentPreviewSavePanelProps {
  saveInput: SaveAgentTaskPreviewInput;
}

const clientFailureResult = {
  status: "failed",
  snapshotSaved: false,
  eventSaved: false,
  previewOnly: true,
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
  errorCategory: "unknown",
  message:
    "服务端动作返回结果前，预览保存已失败。预览仍可查看，且未执行任何智能体任务。",
} as const satisfies SaveAgentTaskPreviewResult;

export function AgentPreviewSavePanel({
  saveInput,
}: AgentPreviewSavePanelProps) {
  const [result, setResult] = useState<SaveAgentTaskPreviewResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const status: SavePanelStatus = isPending
    ? "saving"
    : result?.status ?? "idle";
  const statusClassName = `${styles.statusBadge} ${getStatusClassName(status)}`;

  function handleSavePreview() {
    startTransition(() => {
      void saveAgentTaskPreview(saveInput)
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
      aria-label="智能体预览保存边界"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>保存任务预览记录</h3>
          <p className={styles.planSummary}>
            该按钮只保存当前智能体任务预览记录。它不会运行智能体任务、执行工具、
            调用模型、检索记忆或执行 Skill。
          </p>
        </div>
        <span className={statusClassName}>{formatStatus(status)}</span>
      </div>

      <div className={styles.taskActions}>
        <button
          className={styles.previewButton}
          disabled={isPending}
          onClick={handleSavePreview}
          type="button"
        >
          {isPending ? "正在保存预览记录" : "保存预览记录"}
        </button>
      </div>

      <div className={styles.previewFactsGrid}>
        <SaveFact label="保存状态" value={formatStatus(status)} />
        <SaveFact
          label="预览标记 (previewOnly)"
          value={String(result?.previewOnly ?? true)}
        />
        <SaveFact
          label="可执行标记 (executable)"
          value={String(result?.executable ?? false)}
        />
        <SaveFact
          label="真实执行启用标记 (realExecutionEnabled)"
          value={String(result?.realExecutionEnabled ?? false)}
        />
      </div>

      {result === null ? (
        <p className={styles.disabledCopy}>
          当前保存状态为空闲。本页面会话中尚未保存任何预览记录。
        </p>
      ) : (
        <SaveResultDetails result={result} />
      )}

      <section className={styles.planBlock} aria-labelledby="save-boundary">
        <h4 className={styles.detailTitle} id="save-boundary">
          保存边界安全说明
        </h4>
        <ul className={styles.safetyNotes}>
          <li>保存的记录仅为预览。</li>
          <li>未执行智能体任务。</li>
          <li>未执行工具。</li>
          <li>未调用模型。</li>
          <li>未发起网络请求。</li>
          <li>未执行记忆检索。</li>
          <li>未使用 embedding、向量搜索或 RAG。</li>
          <li>未生成、安装或执行 Skill。</li>
          <li>只有点击这个显式按钮后才会尝试保存。</li>
        </ul>
      </section>
    </article>
  );
}

function SaveResultDetails({
  result,
}: {
  result: SaveAgentTaskPreviewResult;
}) {
  return (
    <>
      <div className={styles.previewFactsGrid}>
        <SaveFact label="已保存任务 ID" value={result.savedTaskId ?? "无"} />
        <SaveFact
          label="快照预览记录保存标记 (snapshotSaved)"
          value={String(result.snapshotSaved)}
        />
        <SaveFact
          label="事件预览记录保存标记 (eventSaved)"
          value={String(result.eventSaved)}
        />
        <SaveFact
          label="错误分类"
          value={result.errorCategory ?? "无"}
        />
      </div>
      <p className={styles.disabledCopy}>{result.message}</p>
      {result.status === "saved" ? null : (
        <p className={styles.disabledReason}>
          下方预览面板仍可使用；只有预览记录保存不可用或失败。
        </p>
      )}
      <div className={styles.previewFactsGrid}>
        <SaveFact
          label="工具已执行标记 (toolsExecuted)"
          value={String(result.toolsExecuted)}
        />
        <SaveFact
          label="模型已调用标记 (llmCalled)"
          value={String(result.llmCalled)}
        />
        <SaveFact
          label="网络已使用标记 (networkUsed)"
          value={String(result.networkUsed)}
        />
        <SaveFact
          label="记忆检索已执行标记 (memoryRetrievalExecuted)"
          value={String(result.memoryRetrievalExecuted)}
        />
      </div>
      <div className={styles.previewFactsGrid}>
        <SaveFact
          label="embedding 已使用标记 (embeddingsUsed)"
          value={String(result.embeddingsUsed)}
        />
        <SaveFact
          label="向量搜索已使用标记 (vectorSearchUsed)"
          value={String(result.vectorSearchUsed)}
        />
        <SaveFact label="RAG 已使用标记 (ragUsed)" value={String(result.ragUsed)} />
        <SaveFact
          label="Skill 已执行标记 (skillExecuted)"
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
