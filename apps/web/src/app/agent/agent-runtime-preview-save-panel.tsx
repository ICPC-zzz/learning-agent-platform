"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  saveMockRuntimePreviewAction,
  type SaveMockRuntimePreviewResult,
  type SaveMockRuntimePreviewStatus,
} from "./agent-runtime-preview-save-action";
import {
  RuntimePreviewSafetyLabels,
  extendedRuntimePreviewSafetyLabels,
} from "./runtime-preview-safety-labels";
import styles from "./page.module.css";

type RuntimeSavePanelStatus =
  | SaveMockRuntimePreviewStatus
  | "idle"
  | "saving";

const emptyCounts = {
  executions: 0,
  steps: 0,
  toolCalls: 0,
  llmCalls: 0,
  events: 0,
  auditEvents: 0,
  errors: 0,
} as const;

const clientFailureResult = {
  status: "failed",
  previewOnly: true,
  executable: false,
  realExecutionEnabled: false,
  toolExecutionEnabled: false,
  llmCallEnabled: false,
  permissionConfirmationEnabled: false,
  backgroundJobEnabled: false,
  streamingEnabled: false,
  productionAuditEnabled: false,
  toolsExecuted: false,
  llmCalled: false,
  networkUsed: false,
  fileToolsUsed: false,
  commandToolsUsed: false,
  realExecutionDataSaved: false,
  persistedCounts: emptyCounts,
  skippedCounts: emptyCounts,
  warnings: [],
  previewRecordSaved: false,
  errorCategory: "unknown",
  historyRefreshRecommended: false,
  message:
    "保存运行预览记录失败。保存请求返回前出现客户端侧错误；未执行工具、未调用模型，也未产生真实副作用。",
} as const satisfies SaveMockRuntimePreviewResult;

const statusLabels: Record<RuntimeSavePanelStatus, string> = {
  idle: "未保存",
  saving: "保存中",
  saved: "已保存",
  unavailable: "不可用",
  failed: "保存失败",
};

export function AgentRuntimePreviewSavePanel() {
  const router = useRouter();
  const [result, setResult] =
    useState<SaveMockRuntimePreviewResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const status: RuntimeSavePanelStatus = isPending
    ? "saving"
    : result?.status ?? "idle";
  const statusClassName = `${styles.statusBadge} ${getStatusClassName(status)}`;

  function handleSaveRuntimePreview() {
    startTransition(() => {
      void saveMockRuntimePreviewAction()
        .then((nextResult) => {
          setResult(nextResult);

          if (nextResult.historyRefreshRecommended) {
            router.refresh();
          }
        })
        .catch(() => {
          setResult(clientFailureResult);
        });
    });
  }

  return (
    <article
      className={styles.planPreviewCard}
      aria-label="保存运行预览记录"
    >
      <div className={styles.planHeader}>
        <div>
          <h3 className={styles.planTitle}>保存运行预览记录</h3>
          <p className={styles.planSummary}>
            该操作只会保存一条模拟运行预览记录，用于检查未来运行时的数据结构展示。
            它不会执行工具、不会调用模型、不会产生真实副作用。
          </p>
        </div>
        <span className={statusClassName}>{statusLabels[status]}</span>
      </div>

      <RuntimePreviewSafetyLabels labels={extendedRuntimePreviewSafetyLabels} />

      <div className={styles.taskActions}>
        <button
          className={styles.previewButton}
          disabled={isPending}
          onClick={handleSaveRuntimePreview}
          type="button"
        >
          保存预览记录
        </button>
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeSaveFact label="保存状态" value={statusLabels[status]} />
        <RuntimeSaveFact
          label="预览标记 (previewOnly)"
          value={formatBooleanFlag(result?.previewOnly ?? true)}
        />
        <RuntimeSaveFact
          label="真实运行启用 (realExecutionEnabled)"
          value={formatBooleanFlag(result?.realExecutionEnabled ?? false)}
        />
        <RuntimeSaveFact
          label="工具执行启用 (toolExecutionEnabled)"
          value={formatBooleanFlag(result?.toolExecutionEnabled ?? false)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeSaveFact
          label="模型调用启用 (llmCallEnabled)"
          value={formatBooleanFlag(result?.llmCallEnabled ?? false)}
        />
        <RuntimeSaveFact
          label="权限确认启用 (permissionConfirmationEnabled)"
          value={formatBooleanFlag(result?.permissionConfirmationEnabled ?? false)}
        />
        <RuntimeSaveFact
          label="后台任务启用 (backgroundJobEnabled)"
          value={formatBooleanFlag(result?.backgroundJobEnabled ?? false)}
        />
        <RuntimeSaveFact
          label="错误分类"
          value={result?.errorCategory ?? "无"}
        />
      </div>

      {result === null ? (
        <p className={styles.disabledCopy}>
          当前页面会等你点击“保存预览记录”后才尝试保存；页面加载、定时器或后台任务不会自动创建记录。
        </p>
      ) : (
        <RuntimeSaveResultDetails result={result} />
      )}

      <section
        className={styles.planBlock}
        aria-labelledby="runtime-save-boundary"
      >
        <h4 className={styles.detailTitle} id="runtime-save-boundary">
          保存动作安全边界
        </h4>
        <ul className={styles.safetyNotes}>
          <li>保存的是模拟运行预览记录，不代表 Agent 已真实运行。</li>
          <li>保存动作只由这个显式按钮触发，不会自动保存。</li>
          <li>未执行工具，未调用模型，未访问网络。</li>
          <li>未读取或写入文件工具，未运行命令工具。</li>
          <li>未捕获真实权限确认，未启动后台任务或调度器。</li>
          <li>保存成功后会刷新当前页面，让最近运行预览记录面板重新读取数据库。</li>
        </ul>
      </section>
    </article>
  );
}

function RuntimeSaveResultDetails({
  result,
}: {
  result: SaveMockRuntimePreviewResult;
}) {
  return (
    <>
      <p
        className={
          result.status === "saved"
            ? styles.disabledCopy
            : styles.disabledReason
        }
      >
        {result.message}
      </p>

      <div className={styles.previewFactsGrid}>
        <RuntimeSaveFact
          label="运行预览记录 ID (executionId)"
          value={result.executionId ?? "无"}
        />
        <RuntimeSaveFact
          label="运行预览主记录"
          value={String(result.persistedCounts.executions)}
        />
        <RuntimeSaveFact
          label="预览记录已保存标记 (previewRecordSaved)"
          value={formatBooleanFlag(result.previewRecordSaved)}
        />
        <RuntimeSaveFact
          label="真实运行数据已保存 (realExecutionDataSaved)"
          value={formatBooleanFlag(result.realExecutionDataSaved)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeSaveFact
          label="步骤预览记录"
          value={String(result.persistedCounts.steps)}
        />
        <RuntimeSaveFact
          label="工具调用预览记录"
          value={String(result.persistedCounts.toolCalls)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeSaveFact
          label="模型调用预览记录"
          value={String(result.persistedCounts.llmCalls)}
        />
        <RuntimeSaveFact
          label="运行事件预览记录"
          value={String(result.persistedCounts.events)}
        />
        <RuntimeSaveFact
          label="审计预览记录"
          value={String(result.persistedCounts.auditEvents)}
        />
        <RuntimeSaveFact
          label="错误预览记录"
          value={String(result.persistedCounts.errors)}
        />
      </div>

      <div className={styles.previewFactsGrid}>
        <RuntimeSaveFact
          label="工具已执行标记 (toolsExecuted)"
          value={formatBooleanFlag(result.toolsExecuted)}
        />
        <RuntimeSaveFact
          label="模型已调用标记 (llmCalled)"
          value={formatBooleanFlag(result.llmCalled)}
        />
        <RuntimeSaveFact
          label="网络已使用标记 (networkUsed)"
          value={formatBooleanFlag(result.networkUsed)}
        />
        <RuntimeSaveFact
          label="命令工具已使用标记 (commandToolsUsed)"
          value={formatBooleanFlag(result.commandToolsUsed)}
        />
      </div>

      {result.warnings.length > 0 ? (
        <section className={styles.planDetailPanel} aria-label="保存提示">
          <h5 className={styles.detailTitle}>保存提示</h5>
          <ul className={styles.safetyNotes}>
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.status === "saved" && result.executionId !== undefined ? (
        <p className={styles.stepDescription}>
          <Link
            className={styles.backLink}
            href={`/agent/runtime/${encodeURIComponent(result.executionId)}`}
          >
            查看预览详情
          </Link>
        </p>
      ) : null}
    </>
  );
}

function RuntimeSaveFact({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className={styles.previewFact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

function getStatusClassName(status: RuntimeSavePanelStatus): string {
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

function formatBooleanFlag(value: boolean): string {
  return value ? "是（true）" : "否（false）";
}
