"use client";

import React, { useCallback, useEffect, useState } from "react";

import {
  getReaderLocalStatusStorageKey,
  isReaderLocalStorageAvailable,
  subscribeReaderLocalStorageChanges,
} from "./reader-local-storage";
import {
  buildReaderSyncPreview,
  type ReaderSyncPreviewResult,
} from "./reader-sync-preview";
import {
  buildReaderSyncDraft,
  type ReaderSyncDraftResult,
} from "./reader-sync-draft";
import {
  buildReaderSyncPayloadPreview,
  type ReaderSyncPayloadPreviewResult,
} from "./reader-sync-payload-preview";
import {
  buildReaderSyncSubmitPlan,
  type ReaderSyncSubmitPlanResult,
} from "./reader-sync-submit-plan";
import {
  buildReaderSyncServerActionContractDraft,
  buildReaderSyncServerActionReadinessChecklist,
  type ReaderSyncServerActionContractDraft,
  type ReaderSyncServerActionReadinessChecklist,
} from "./reader-sync-server-action-contract";
import {
  evaluateReaderSyncReadinessGate,
  type ReaderSyncReadinessGateResult,
} from "./reader-sync-readiness-gate";
import { ReaderSyncDevTriggerPreview } from "./ReaderSyncDevTriggerPreview";
import type { ReaderSyncDevTriggerPreviewActionCallable } from "./ReaderSyncDevTriggerPreview";
import type { ReaderSyncDevTriggerProgressPayload } from "./ReaderSyncDevTriggerPreview";

export interface ReaderSyncPreviewPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
  devSyncProgressPreview?: ReaderSyncDevTriggerProgressPayload | null;
  showDevSyncTrigger?: boolean;
  devSyncEnabled?: boolean;
  allowDevOnlySyncPreview?: boolean;
  onTriggerDevSync?: ReaderSyncDevTriggerPreviewActionCallable;
}

function statusText(status: ReaderSyncPreviewResult["status"]): string {
  switch (status) {
    case "ready":
      return "可预演";
    case "partial":
      return "部分可预演";
    case "invalid":
      return "摘要无效（已降级）";
    case "empty":
    default:
      return "暂无可预演数据";
  }
}

function draftStatusText(status: ReaderSyncDraftResult["status"]): string {
  switch (status) {
    case "ready":
      return "ready";
    case "partial":
      return "partial";
    case "invalid":
      return "invalid";
    case "empty":
    default:
      return "empty";
  }
}

function payloadPreviewStatusText(status: ReaderSyncPayloadPreviewResult["status"]): string {
  switch (status) {
    case "ready":
      return "ready";
    case "partial":
      return "partial";
    case "invalid":
      return "invalid";
    case "empty":
    default:
      return "empty";
  }
}

function submitPlanStatusText(status: ReaderSyncSubmitPlanResult["status"]): string {
  switch (status) {
    case "ready":
      return "ready";
    case "blocked":
      return "blocked";
    case "partial":
      return "partial";
    case "invalid":
      return "invalid";
    case "empty":
    default:
      return "empty";
  }
}

function toDisplayValue(value?: string | null): string {
  if (typeof value !== "string") {
    return "-";
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "-";
}

type RealSyncAuthorizationChecklistBadge =
  | "开发预览"
  | "只读"
  | "待授权"
  | "未接入后端";

interface RealSyncAuthorizationChecklistItem {
  badge: RealSyncAuthorizationChecklistBadge;
  label: string;
  detail: string;
}

function buildRealSyncAuthorizationChecklist(
  readinessGate: ReaderSyncReadinessGateResult,
): RealSyncAuthorizationChecklistItem[] {
  const checklistById = new Map<string, ReaderSyncReadinessGateResult["readinessChecklist"][number]>(
    readinessGate.readinessChecklist.map(function (item) {
      return [item.id, item] as const;
    }),
  );

  function gateReason(id: string, fallback: string): string {
    const item = checklistById.get(id);
    if (item === undefined) {
      return fallback;
    }

    return item.reason;
  }

  return [
    {
      badge: "待授权",
      label: "服务端 auth/session 注入",
      detail:
        gateReason(
          "auth",
          "当前仍是只读预览，尚未接入真实 auth/session 上下文。",
        ) + " 当前页面不会读取真实 session/cookie/token/header。",
    },
    {
      badge: "待授权",
      label: "服务端 userId 来源可信，禁止使用前端传入 userId",
      detail:
        "userId 只能来自服务端 auth/session；当前页面不会信任前端传入的 userId，也不会从 localStorage 伪造身份。",
    },
    {
      badge: "未接入后端",
      label: "canAccessBook / canAccessChapter / canWriteProgress 权限门",
      detail:
        gateReason(
          "repository",
          "当前仍未接入真实 repository，因此资源权限门也尚未真正接通。",
        ) + " 目前仅保留只读说明，不会放行真实写入。",
    },
    {
      badge: "未接入后端",
      label: "真实 repository 实现",
      detail:
        gateReason(
          "repository",
          "当前仍未接入真实 repository，因此不会触发任何持久化调用。",
        ) + " 本卡片只做可视化预览。",
    },
    {
      badge: "未接入后端",
      label: "DB 写入灰度开关",
      detail:
        gateReason(
          "db_write",
          "当前仍未接入真实 DB 写入边界，因此写入灰度开关也尚未开放。",
        ) + " 当前面板只读，不会写入数据库。",
    },
    {
      badge: "未接入后端",
      label: "审计日志持久化",
      detail:
        gateReason(
          "audit",
          "当前仍未接入真实审计日志持久化，因此不会落库任何真实审计记录。",
        ) + " 未来需要记录 userId、action、targetModel、requestId 等字段。",
    },
    {
      badge: "未接入后端",
      label: "幂等键持久化",
      detail:
        gateReason(
          "idempotency",
          "当前仍未接入真实幂等键持久化，因此不能把前端草稿当成可信幂等依据。",
        ) + " 幂等键必须由服务端生成或确认。",
    },
    {
      badge: "未接入后端",
      label: "冲突检测与单调进度策略",
      detail:
        gateReason(
          "conflict_resolution",
          "当前仍未接入真实冲突检测，因此不能对真实进度写入做单调性判断。",
        ) + " 未来需要 read-before-write 和冲突拒绝策略。",
    },
    {
      badge: "待授权",
      label: "用户显式授权",
      detail:
        gateReason(
          "explicit_authorization",
          "当前仍缺少用户显式授权，因此真实同步路径必须保持关闭。",
        ) + " 只有用户明确授权后，未来才可能进入真实同步路径。",
    },
    {
      badge: "未接入后端",
      label: "失败回滚 / 降级策略",
      detail:
        gateReason(
          "server_action",
          "当前仍未接入真实 server action，因此失败回滚与降级策略也尚未真正实现。",
        ) + " 当前只展示预览，不会执行真实写入或回滚。",
    },
    {
      badge: "只读",
      label: "日志保留与敏感字段脱敏",
      detail:
        "当前页面只展示必要字段，不输出 token、cookie、headers、raw secret 或其他敏感信息。",
    },
    {
      badge: "开发预览",
      label: "当前页面只读预览",
      detail:
        "previewOnly=true、implemented=false、writesDatabase=false、callsRepository=false；不会发起网络请求，也不会触发真实同步。",
    },
  ];
}

export function ReaderSyncPreviewCard({
  bookId,
  chapterId,
  devSyncProgressPreview,
  showDevSyncTrigger,
  devSyncEnabled,
  allowDevOnlySyncPreview,
  onTriggerDevSync,
}: ReaderSyncPreviewPanelProps) {
  const summaryKey = getReaderLocalStatusStorageKey();
  const [preview, setPreview] = useState<ReaderSyncPreviewResult>(() =>
    buildReaderSyncPreview({
      storageAvailable: false,
      rawSummary: null,
    }),
  );
  const [draft, setDraft] = useState<ReaderSyncDraftResult>(() =>
    buildReaderSyncDraft(undefined),
  );
  const [payloadPreview, setPayloadPreview] = useState<ReaderSyncPayloadPreviewResult>(() =>
    buildReaderSyncPayloadPreview(buildReaderSyncDraft(undefined)),
  );
  const [submitPlan, setSubmitPlan] = useState<ReaderSyncSubmitPlanResult>(() =>
    buildReaderSyncSubmitPlan(buildReaderSyncPayloadPreview(buildReaderSyncDraft(undefined))),
  );
  const [contractDraft, setContractDraft] = useState<ReaderSyncServerActionContractDraft>(() =>
    buildReaderSyncServerActionContractDraft(
      buildReaderSyncSubmitPlan(buildReaderSyncPayloadPreview(buildReaderSyncDraft(undefined))),
    ),
  );
  const [readinessChecklist, setReadinessChecklist] = useState<ReaderSyncServerActionReadinessChecklist>(() =>
    buildReaderSyncServerActionReadinessChecklist(
      buildReaderSyncServerActionContractDraft(
        buildReaderSyncSubmitPlan(buildReaderSyncPayloadPreview(buildReaderSyncDraft(undefined))),
      ),
    ),
  );
  const readinessGate = evaluateReaderSyncReadinessGate();
  const blockedReadinessItems = readinessGate.readinessChecklist.filter(function (item) {
    return item.ready === false;
  });
  const explicitAuthorizationMissing = blockedReadinessItems.some(function (item) {
    return item.id === "explicit_authorization";
  });
  const realSyncAuthorizationChecklist = buildRealSyncAuthorizationChecklist(readinessGate);

  const loadPreview = useCallback(() => {
    const storageAvailable = isReaderLocalStorageAvailable();

    if (!storageAvailable || typeof window === "undefined") {
      setPreview(
        buildReaderSyncPreview({
          storageAvailable: false,
          rawSummary: null,
        }),
      );
      const fallbackDraft = buildReaderSyncDraft(undefined);
      const fallbackPayloadPreview = buildReaderSyncPayloadPreview(fallbackDraft);
      setDraft(fallbackDraft);
      setPayloadPreview(fallbackPayloadPreview);
      setSubmitPlan(buildReaderSyncSubmitPlan(fallbackPayloadPreview));
      setContractDraft(
        buildReaderSyncServerActionContractDraft(buildReaderSyncSubmitPlan(fallbackPayloadPreview)),
      );
      setReadinessChecklist(
        buildReaderSyncServerActionReadinessChecklist(
          buildReaderSyncServerActionContractDraft(buildReaderSyncSubmitPlan(fallbackPayloadPreview)),
        ),
      );
      return;
    }

    try {
      const rawSummary = window.localStorage.getItem(summaryKey);
      let draftInput: unknown = null;
      if (rawSummary !== null) {
        try {
          draftInput = JSON.parse(rawSummary) as unknown;
        } catch {
          draftInput = rawSummary;
        }
      }

      const nextDraft = buildReaderSyncDraft(draftInput);
      const nextPayloadPreview = buildReaderSyncPayloadPreview(nextDraft);
      setPreview(
        buildReaderSyncPreview({
          storageAvailable: true,
          rawSummary,
        }),
      );
      setDraft(nextDraft);
      setPayloadPreview(nextPayloadPreview);
      const nextSubmitPlan = buildReaderSyncSubmitPlan(nextPayloadPreview);
      setSubmitPlan(nextSubmitPlan);
      const nextContract = buildReaderSyncServerActionContractDraft(nextSubmitPlan);
      setContractDraft(nextContract);
      setReadinessChecklist(buildReaderSyncServerActionReadinessChecklist(nextContract));
    } catch {
      setPreview(
        buildReaderSyncPreview({
          storageAvailable: false,
          rawSummary: null,
        }),
      );
      const fallbackDraft = buildReaderSyncDraft(undefined);
      const fallbackPayloadPreview = buildReaderSyncPayloadPreview(fallbackDraft);
      setDraft(fallbackDraft);
      setPayloadPreview(fallbackPayloadPreview);
      setSubmitPlan(buildReaderSyncSubmitPlan(fallbackPayloadPreview));
      setContractDraft(
        buildReaderSyncServerActionContractDraft(buildReaderSyncSubmitPlan(fallbackPayloadPreview)),
      );
      setReadinessChecklist(
        buildReaderSyncServerActionReadinessChecklist(
          buildReaderSyncServerActionContractDraft(buildReaderSyncSubmitPlan(fallbackPayloadPreview)),
        ),
      );
    }
  }, [summaryKey]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    const unsubscribe = subscribeReaderLocalStorageChanges((changedKey) => {
      if (changedKey === null || changedKey === summaryKey) {
        loadPreview();
      }
    });

    return unsubscribe;
  }, [loadPreview, summaryKey]);

  return (
    <section aria-label="同步预演（开发预览）" className="readerReadingStats">
      <h3 className="readerReadingStatsTitle">同步预演（开发预览）</h3>
      <p className="readerReadingStatsDisclaimer">
        仅本地预演：不会写入数据库；不会调用 server action；不会发起网络请求；不会调用真实
        AI；不会执行工具；不会启动 Agent loop。
      </p>
      <p className="readerReadingStatsTimestamp">摘要 key：{summaryKey}</p>
      <p className="readerReadingStatsTimestamp">
        当前 Reader 上下文：bookId={toDisplayValue(bookId)}，chapterId={toDisplayValue(chapterId)}
      </p>

      <div className="readerReadingStatsGroup">
        <p className="readerReadingStatsLabel">预演状态</p>
        <p className="readerReadingStatsValue">{statusText(preview.status)}</p>
        <p className="readerReadingStatsTimestamp">{preview.summaryText}</p>
      </div>

      <div className="readerReadingStatsGroup">
        <p className="readerReadingStatsLabel">未来可能同步字段（仅预演）</p>
        {preview.syncableFields.length > 0 ? (
          preview.syncableFields.map((field) => (
            <p className="readerReadingStatsValue" key={`syncable-${field}`}>
              - {field}
            </p>
          ))
        ) : (
          <p className="readerReadingStatsEmpty">暂无可预演同步字段。</p>
        )}
      </div>

      <div className="readerReadingStatsGroup">
        <p className="readerReadingStatsLabel">当前仍 local-only 的字段</p>
        {preview.localOnlyFields.map((field) => (
          <p className="readerReadingStatsValue" key={`local-only-${field}`}>
            - {field}
          </p>
        ))}
      </div>

      <div className="readerReadingStatsGroup">
        <p className="readerReadingStatsLabel">预演说明 / warnings</p>
        {preview.warnings.length > 0 ? (
          preview.warnings.map((warning) => (
            <p className="readerReadingStatsTimestamp" key={warning}>
              - {warning}
            </p>
          ))
        ) : (
          <p className="readerReadingStatsTimestamp">- 当前无额外 warning。</p>
        )}
      </div>

      <details className="readerReadingStatsGroup">
        <summary className="readerReadingStatsLabel">同步草稿（开发预览）</summary>
        <p className="readerReadingStatsDisclaimer">
          仅本地草稿：不会写入数据库；不会调用 server action；不会发起网络请求；不会调用真实
          AI；不会执行工具；不会启动 Agent loop。
        </p>
        <p className="readerReadingStatsValue">状态：{draftStatusText(draft.status)}</p>
        <p className="readerReadingStatsTimestamp">
          最小 payload（只读预览）：bookId={toDisplayValue(draft.draftPayload?.bookId)}
          ，chapterId={toDisplayValue(draft.draftPayload?.chapterId)}，progressRatio=
          {draft.draftPayload?.progressRatio !== undefined
            ? String(draft.draftPayload.progressRatio)
            : "-"}
          ，updatedAt={toDisplayValue(draft.draftPayload?.updatedAt)}
        </p>
        <p className="readerReadingStatsLabel">excludedLocalOnlyFields</p>
        {draft.excludedLocalOnlyFields.map((field) => (
          <p className="readerReadingStatsTimestamp" key={`draft-excluded-${field}`}>
            - {field}
          </p>
        ))}
        <p className="readerReadingStatsLabel">草稿 warnings</p>
        {draft.warnings.length > 0 ? (
          draft.warnings.map((warning) => (
            <p className="readerReadingStatsTimestamp" key={`draft-warning-${warning}`}>
              - {warning}
            </p>
          ))
        ) : (
          <p className="readerReadingStatsTimestamp">- 当前无额外 warning。</p>
        )}
      </details>

      <details className="readerReadingStatsGroup">
        <summary className="readerReadingStatsLabel">
          DB payload 映射预览（开发预览）
        </summary>
        <p className="readerReadingStatsDisclaimer">
          仅本地映射预览：不会写入数据库；不会调用 server action；不会发起网络请求；不会调用真实
          AI；不会执行工具；不会启动 Agent loop。
        </p>
        <p className="readerReadingStatsValue">targetModel：{payloadPreview.targetModel}</p>
        <p className="readerReadingStatsValue">
          状态：{payloadPreviewStatusText(payloadPreview.status)}
        </p>
        <p className="readerReadingStatsTimestamp">
          payloadPreview：bookId={toDisplayValue(payloadPreview.payloadPreview?.bookId)}，
          chapterId={toDisplayValue(payloadPreview.payloadPreview?.chapterId)}，progressRatio=
          {payloadPreview.payloadPreview?.progressRatio !== undefined
            ? String(payloadPreview.payloadPreview.progressRatio)
            : "-"}
        </p>
        <p className="readerReadingStatsLabel">matchedFields</p>
        {payloadPreview.matchedFields.length > 0 ? (
          payloadPreview.matchedFields.map((item) => (
            <p
              className="readerReadingStatsTimestamp"
              key={`payload-match-${item.draftField}-${item.modelField}`}
            >
              - {item.draftField} → {item.modelField}（{item.valuePreview}）
              {item.note ? `：${item.note}` : ""}
            </p>
          ))
        ) : (
          <p className="readerReadingStatsTimestamp">- 当前无可映射字段。</p>
        )}
        <p className="readerReadingStatsLabel">blockedFields</p>
        {payloadPreview.blockedFields.length > 0 ? (
          payloadPreview.blockedFields.map((item) => (
            <p
              className="readerReadingStatsTimestamp"
              key={`payload-blocked-${item.field}-${item.reason}`}
            >
              - {item.field}：{item.reason}
            </p>
          ))
        ) : (
          <p className="readerReadingStatsTimestamp">- 当前无 blocked 字段。</p>
        )}
        <p className="readerReadingStatsLabel">映射 warnings</p>
        {payloadPreview.warnings.length > 0 ? (
          payloadPreview.warnings.map((warning) => (
            <p className="readerReadingStatsTimestamp" key={`payload-warning-${warning}`}>
              - {warning}
            </p>
          ))
        ) : (
          <p className="readerReadingStatsTimestamp">- 当前无额外 warning。</p>
        )}
      </details>

      <details className="readerReadingStatsGroup">
        <summary className="readerReadingStatsLabel">同步提交计划预览（开发预览）</summary>
        <p className="readerReadingStatsDisclaimer">
          仅本地提交计划预览：不会写入数据库；不会调用 server action；不会发起网络请求；不会调用真实
          AI；不会执行工具；不会启动 Agent loop。
        </p>
        <p className="readerReadingStatsValue">status：{submitPlanStatusText(submitPlan.status)}</p>
        <p className="readerReadingStatsValue">
          canSubmit：{String(submitPlan.canSubmit)}（固定不可提交，仅预览）
        </p>
        <p className="readerReadingStatsValue">targetModel：{submitPlan.targetModel}</p>
        <p className="readerReadingStatsValue">draftOperation：{submitPlan.draftOperation}</p>
        <p className="readerReadingStatsTimestamp">
          idempotencyKeyPreview：{toDisplayValue(submitPlan.idempotencyKeyPreview)}
        </p>
        <p className="readerReadingStatsLabel">rollbackNotes</p>
        {submitPlan.rollbackNotes.map((note) => (
          <p className="readerReadingStatsTimestamp" key={`submit-plan-rollback-${note}`}>
            - {note}
          </p>
        ))}
        <p className="readerReadingStatsLabel">retryNotes</p>
        {submitPlan.retryNotes.map((note) => (
          <p className="readerReadingStatsTimestamp" key={`submit-plan-retry-${note}`}>
            - {note}
          </p>
        ))}
      </details>

      <details
        className="readerReadingStatsGroup"
        data-testid="reader-sync-readiness-gate"
      >
        <summary className="readerReadingStatsLabel">
          Reader sync readiness gate（开发预览 / 只读）
        </summary>
        <p className="readerReadingStatsDisclaimer">
          这是 A303 新增的纯函数预览结果，只读展示真实 Reader 同步还缺哪些前置条件。这里不会接入
          真实 auth/session、cookie/token/header，不会读取 localStorage，不会调用 server action，
          不会写入数据库，也不会调用真实 repository。
        </p>
        <p className="readerReadingStatsValue">
          当前状态：真实 Reader 同步未开启 | status：{readinessGate.status} | canEnableRealSync：
          {String(readinessGate.canEnableRealSync)} | mustRemainPreviewOnly：
          {String(readinessGate.mustRemainPreviewOnly)}
        </p>
        <p className="readerReadingStatsValue">
          previewOnly：{String(readinessGate.previewOnly)} | implemented：
          {String(readinessGate.implemented)} | safeToExposeToClient：
          {String(readinessGate.safeToExposeToClient)} | writesDatabase：
          {String(readinessGate.writesDatabase)} | callsRepository：
          {String(readinessGate.callsRepository)} | success：{String(readinessGate.success)}
        </p>
        <p className="readerReadingStatsTimestamp">{readinessGate.summary}</p>

        <p className="readerReadingStatsLabel">blockedReasons</p>
        {readinessGate.blockedReasons.length > 0 ? (
          readinessGate.blockedReasons.map((reason) => (
            <p
              className="readerReadingStatsTimestamp"
              key={`readiness-gate-blocked-${reason}`}
            >
              - {reason}
            </p>
          ))
        ) : (
          <p className="readerReadingStatsTimestamp">- 当前无阻塞原因。</p>
        )}

        <p className="readerReadingStatsLabel">missingRequirements / checklist</p>
        {readinessGate.readinessChecklist.map((item) => (
          <p
            className="readerReadingStatsTimestamp"
            key={`readiness-gate-item-${item.id}`}
          >
            - [{item.status}] {item.label}：{item.reason}
          </p>
        ))}

        <p className="readerReadingStatsLabel">explicitUserAuthorization</p>
        <p className="readerReadingStatsTimestamp">
          {explicitAuthorizationMissing
            ? "缺失：当前结果默认不开放真实 Reader 同步，需要用户显式授权后，才可能进入未来真实同步路径。"
            : "已提供：仍保持只读预览，不会自动升级为真实同步。"}
        </p>

        <p className="readerReadingStatsLabel">nextSafeSteps</p>
        {readinessGate.nextSafeSteps.map((step) => (
          <p
            className="readerReadingStatsTimestamp"
            key={`readiness-gate-step-${step.slice(0, 40)}`}
          >
            - {step}
          </p>
        ))}

        <p className="readerReadingStatsTimestamp">
          以上 gate 内容完全来自纯函数默认输出，仅用于开发预览；不会读取真实登录态
          session/cookie/token，不会写入 DB，不会调用真实 repository，也不会触发真实 server
          action。
        </p>
      </details>

      <details
        className="readerReadingStatsGroup"
        data-testid="reader-sync-real-sync-authorization-checklist"
      >
        <summary className="readerReadingStatsLabel">
          真实同步授权前置清单（Readiness Checklist for Real Sync Authorization）
        </summary>
        <p className="readerReadingStatsDisclaimer">
          当前只读预览，不会写入数据库，不会调用 repository，不会读取
          session/cookie/token/header，不会发起网络请求，也不会把任何前置条件误写成真实同步能力。
        </p>
        <p className="readerReadingStatsTimestamp">
          标签：开发预览 / 只读 / 待授权 / 未接入后端
        </p>
        {realSyncAuthorizationChecklist.map((item) => (
          <div className="readerReadingStatsGroup" key={item.label}>
            <p className="readerReadingStatsValue">[{item.badge}] {item.label}</p>
            <p className="readerReadingStatsTimestamp">{item.detail}</p>
          </div>
        ))}
        <p className="readerReadingStatsTimestamp">
          以上仅为可视化预览，不代表真实同步能力已接入，也不会触发任何后端写入。
        </p>
      </details>

      <details
        className="readerReadingStatsGroup"
        data-testid="reader-sync-server-action-contract"
      >
        <summary className="readerReadingStatsLabel">
          Server Action 合约草案（开发预览）
        </summary>
        <p className="readerReadingStatsDisclaimer">
          仅类型草案/本地预览：server action 尚未实现；不会写入数据库；不会调用 server
          action；不会发起网络请求；不会调用真实 AI；不会执行工具；不会启动 Agent loop。
        </p>
        <p className="readerReadingStatsValue">
          implemented：{String(contractDraft.implemented)} | previewOnly：
          {String(contractDraft.previewOnly)} | status：{contractDraft.status}
        </p>

        {contractDraft.requestDraft ? (
          <>
            <p className="readerReadingStatsLabel">requestDraft 概要（仅客户端预览，不可提交）</p>
            <p className="readerReadingStatsTimestamp">
              bookId={toDisplayValue(contractDraft.requestDraft.bookId)}
              ，chapterId={toDisplayValue(contractDraft.requestDraft.chapterId)}
              ，progressRatio={contractDraft.requestDraft.progressRatio}
              ，idempotencyKeyPreview=
              {toDisplayValue(contractDraft.requestDraft.idempotencyKeyPreview)}
            </p>
            <p className="readerReadingStatsTimestamp">
              clientPreviewOnly：{String(contractDraft.requestDraft.clientPreviewOnly)}
              ，serverUserIdRequired：{String(contractDraft.requestDraft.serverUserIdRequired)}
              （userId 必须由服务端 auth/session 注入，客户端不得传入）
            </p>
            <p className="readerReadingStatsTimestamp">
              previewRequestId：{toDisplayValue(contractDraft.requestDraft.previewRequestId)}
            </p>
          </>
        ) : (
          <p className="readerReadingStatsEmpty">
            requestDraft：null（当前 submit plan 无法生成 request draft，因为本地数据不足或格式不符）
          </p>
        )}

        <p className="readerReadingStatsLabel">responseDraft 概要（未执行状态）</p>
        <p className="readerReadingStatsTimestamp">
          success：{String(contractDraft.responseDraft.success)}，status：
          {contractDraft.responseDraft.status}，previewOnly：
          {String(contractDraft.responseDraft.previewOnly)}，implemented：
          {String(contractDraft.responseDraft.implemented)}
        </p>
        <p className="readerReadingStatsTimestamp">
          errorCode：{contractDraft.responseDraft.errorCode}，message：
          {contractDraft.responseDraft.message}
        </p>
        <p className="readerReadingStatsTimestamp">
          auditId：{String(contractDraft.responseDraft.auditId)}，serverProgressRatio：
          {String(contractDraft.responseDraft.serverProgressRatio)}
        </p>
        <p className="readerReadingStatsLabel">skippedFields</p>
        {contractDraft.responseDraft.skippedFields.map((field) => (
          <p className="readerReadingStatsTimestamp" key={`contract-skipped-${field}`}>
            - {field}
          </p>
        ))}
        {contractDraft.responseDraft.warnings.length > 0 && (
          <>
            <p className="readerReadingStatsLabel">合约 warnings</p>
            {contractDraft.responseDraft.warnings.map((warning) => (
              <p className="readerReadingStatsTimestamp" key={`contract-warning-${warning}`}>
                - {warning}
              </p>
            ))}
          </>
        )}

        <p className="readerReadingStatsLabel">
          permissionGateDraft（5 项鉴权要求均为 true）
        </p>
        <p className="readerReadingStatsTimestamp">
          requiresAuth：{String(contractDraft.permissionGateDraft.requiresAuth)}
          ，requiresBookAccess：{String(contractDraft.permissionGateDraft.requiresBookAccess)}
          ，requiresChapterAccess：
          {String(contractDraft.permissionGateDraft.requiresChapterAccess)}
          ，requiresProgressValidation：
          {String(contractDraft.permissionGateDraft.requiresProgressValidation)}，requiresAudit：
          {String(contractDraft.permissionGateDraft.requiresAudit)}
        </p>

        <p className="readerReadingStatsLabel">auditDraft</p>
        <p className="readerReadingStatsTimestamp">
          action={contractDraft.auditDraft.action}，source={contractDraft.auditDraft.source}
          ，targetModel={contractDraft.auditDraft.targetModel}，previewOnly=
          {String(contractDraft.auditDraft.previewOnly)}，userIdSource=
          {contractDraft.auditDraft.userIdSource}
        </p>

        <p className="readerReadingStatsLabel">requiredContext</p>
        {contractDraft.requiredContext.map((item) => (
          <p className="readerReadingStatsTimestamp" key={`contract-ctx-${item}`}>
            - {item}
          </p>
        ))}

        <p className="readerReadingStatsLabel">blockers</p>
        {contractDraft.blockers.map((blocker) => (
          <p
            className="readerReadingStatsTimestamp"
            key={`contract-blocker-${blocker.code}-${blocker.message}`}
          >
            - [{blocker.code}] {blocker.message}
          </p>
        ))}

        <p className="readerReadingStatsTimestamp">
          以上所有内容均为类型草案 v1 的只读预览，不代表 server action 已实现。server action
          尚未实现。
        </p>
      </details>

      <details
        className="readerReadingStatsGroup"
        data-testid="reader-sync-readiness-checklist"
      >
        <summary className="readerReadingStatsLabel">
          Server Action Readiness Checklist（仅预览）
        </summary>
        <p className="readerReadingStatsDisclaimer">
          仅预览清单：不会写入数据库；不会调用 server action；不会发起网络请求；不会调用真实
          AI；不会执行工具；不会启动 Agent loop。本清单仅列出未来真实同步前必须满足的前置条件，
          不代表任何能力已上线。
        </p>
        <p className="readerReadingStatsValue">
          整体就绪状态：{readinessChecklist.overallStatus} | previewOnly：
          {String(readinessChecklist.previewOnly)} | implemented：
          {String(readinessChecklist.implemented)}
        </p>

        <p className="readerReadingStatsLabel">就绪检查项</p>
        {readinessChecklist.items.map((item) => (
          <p
            className="readerReadingStatsTimestamp"
            key={`readiness-${item.id}`}
          >
            - [{item.status}] {item.label}：{item.reason}
          </p>
        ))}

        <p className="readerReadingStatsLabel">阻塞项摘要</p>
        {readinessChecklist.blockersSummary.length > 0 ? (
          readinessChecklist.blockersSummary.map((b) => (
            <p
              className="readerReadingStatsTimestamp"
              key={`readiness-blocker-${b.slice(0, 40)}`}
            >
              - {b}
            </p>
          ))
        ) : (
          <p className="readerReadingStatsTimestamp">- 当前无阻塞项。</p>
        )}

        <p className="readerReadingStatsLabel">安全前置建议（nextSafeSteps）</p>
        {readinessChecklist.nextSafeSteps.map((step) => (
          <p
            className="readerReadingStatsTimestamp"
            key={`readiness-step-${step.slice(0, 40)}`}
          >
            - {step}
          </p>
        ))}

        <p className="readerReadingStatsTimestamp">
          以上 checklist 为纯前端只读预览，不触发任何真实同步、DB 写入、server action
          或网络请求。所有状态项均基于 contractDraft 静态分析，不代表服务端真实能力。
        </p>
      </details>

      <p className="readerReadingStatsTimestamp">
        当前卡片默认仍然只是可视化预演；只有服务器端显式 dev/test opt-in 通过时，才会进入
        test-only real DB 路径。
      </p>
      {showDevSyncTrigger === true ? (
        <p className="readerReadingStatsTimestamp">
          Dev trigger 即将同步：bookId={toDisplayValue(devSyncProgressPreview?.bookId)}，chapterId=
          {toDisplayValue(devSyncProgressPreview?.chapterId)}，progressRatio=
          {devSyncProgressPreview?.progressRatio !== undefined
            ? String(devSyncProgressPreview.progressRatio)
            : "-"}
          ，source={toDisplayValue(devSyncProgressPreview?.source)}，explicitUserAuthorization=true
        </p>
      ) : null}
      <ReaderSyncDevTriggerPreview
        bookId={bookId}
        chapterId={chapterId}
        progressPreview={devSyncProgressPreview}
        showDevSyncTrigger={showDevSyncTrigger}
        devSyncEnabled={devSyncEnabled}
        allowDevOnlySyncPreview={allowDevOnlySyncPreview}
        onTriggerDevSync={onTriggerDevSync}
      />
    </section>
  );
}

export function ReaderSyncPreviewPanel(props: ReaderSyncPreviewPanelProps) {
  return <ReaderSyncPreviewCard {...props} />;
}
