"use client";

import { useCallback, useEffect, useState } from "react";

import { LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT } from "../learning-daily-task-local-storage";
import {
  createDefaultWeeklyReportExportViewModel,
  createWeeklyReportExportViewModel,
} from "../learning-daily-task-weekly-report-export";
import type { LearningDailyTaskWeeklyReportExportViewModel } from "../learning-daily-task-weekly-report-export-types";

const COPY_SUCCESS_MESSAGE = "已复制到剪贴板（本地操作）";
const COPY_FAILED_MESSAGE = "复制失败，可手动选择文本复制。";
const DOWNLOAD_SUCCESS_MESSAGE = "已生成 Markdown 下载（本地浏览器操作）。";
const DOWNLOAD_FAILED_MESSAGE = "下载失败，请稍后重试。";

export function LearningDailyTaskWeeklyReportExportPanelClient() {
  const [reportExport, setReportExport] =
    useState<LearningDailyTaskWeeklyReportExportViewModel>(() =>
      createDefaultWeeklyReportExportViewModel(),
    );
  const [hasMounted, setHasMounted] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "failed">("idle");
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "success" | "failed">(
    "idle",
  );

  const refreshExport = useCallback(() => {
    setReportExport(createWeeklyReportExportViewModel());
    setCopyStatus("idle");
    setDownloadStatus("idle");
  }, []);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    refreshExport();

    function handleStorageChange() {
      refreshExport();
    }

    function handleLocalStateChange() {
      refreshExport();
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT,
      handleLocalStateChange,
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        LEARNING_DAILY_TASK_LOCAL_STATE_CHANGED_EVENT,
        handleLocalStateChange,
      );
    };
  }, [refreshExport]);

  async function handleCopy() {
    if (!reportExport.canCopy || reportExport.markdownText.length <= 0) {
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(reportExport.markdownText);
      } else {
        copyByTextarea(reportExport.markdownText);
      }
      setCopyStatus("success");
    } catch {
      setCopyStatus("failed");
    }
  }

  function handleDownload() {
    if (!reportExport.canDownload || reportExport.markdownText.length <= 0) {
      return;
    }

    try {
      const blob = new Blob([reportExport.markdownText], {
        type: "text/markdown;charset=utf-8",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const fileDate = reportExport.weekRangeLabel
        .split(" ~ ")
        .pop()
        ?.replaceAll("/", "-") ?? "weekly-report";

      anchor.href = objectUrl;
      anchor.download = `learning-weekly-report-${fileDate}.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setDownloadStatus("success");
    } catch {
      setDownloadStatus("failed");
    }
  }

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="learning-daily-task-weekly-export-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览 / 本地导出草稿</p>
          <h2 id="learning-daily-task-weekly-export-title">
            本地周报导出预览（开发预览）
          </h2>
        </div>
        <span className="difficultyBadge">Markdown 草稿</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{reportExport.sourceLabel}</span>
        <p>{reportExport.warning}</p>
      </div>

      {!reportExport.available ? (
        <p className="panelNote">
          本地导出预览不可用。
          {reportExport.unavailableReason
            ? `（原因：${reportExport.unavailableReason}）`
            : ""}
        </p>
      ) : null}

      {reportExport.available && !reportExport.canCopy ? (
        <p className="panelNote recommendationEmptyState">
          当前浏览器暂无可导出的本地周报记录，请先勾选今日学习任务。
        </p>
      ) : null}

      <dl className="eventStats">
        <div>
          <dt>最近 7 天范围</dt>
          <dd>{reportExport.weekRangeLabel}</dd>
        </div>
        <div>
          <dt>生成时间</dt>
          <dd>{hasMounted ? formatGeneratedAt(reportExport.generatedAt) : "加载中"}</dd>
        </div>
      </dl>

      <div className="warningBlock">
        <h3>周报草稿预览</h3>
        {reportExport.markdownText.length > 0 ? (
          <pre
            className="panelNote"
            style={{ whiteSpace: "pre-wrap", maxHeight: "20rem", overflow: "auto" }}
          >
            {reportExport.markdownText}
          </pre>
        ) : (
          <p className="panelNote">当前暂无可预览的 Markdown 周报草稿。</p>
        )}
      </div>

      <div>
        <button
          className="primaryLink"
          type="button"
          disabled={!reportExport.canCopy}
          onClick={handleCopy}
        >
          复制周报草稿
        </button>{" "}
        <button
          className="primaryLink"
          type="button"
          disabled={!reportExport.canDownload}
          onClick={handleDownload}
        >
          下载 Markdown
        </button>
      </div>

      <p className="panelNote" aria-live="polite">
        {copyStatus === "success" ? COPY_SUCCESS_MESSAGE : null}
        {copyStatus === "failed" ? COPY_FAILED_MESSAGE : null}
      </p>
      <p className="panelNote" aria-live="polite">
        {downloadStatus === "success" ? DOWNLOAD_SUCCESS_MESSAGE : null}
        {downloadStatus === "failed" ? DOWNLOAD_FAILED_MESSAGE : null}
      </p>

      <p className="panelNote">
        仅使用当前浏览器 localStorage 规则汇总，不写入数据库、不调用模型、不执行工具。
      </p>
    </section>
  );
}

function copyByTextarea(text: string) {
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function formatGeneratedAt(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Date(timestamp).toLocaleString();
}
