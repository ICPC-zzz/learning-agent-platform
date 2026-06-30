"use client";

import React, { useState, useCallback } from "react";
import { pdfImportServerAction } from "../../lib/pdf-import-server-action";
import type {
  PdfImportActionResult,
  PdfImportChapterPreview,
} from "../../lib/pdf-import-server-action";
import { PDF_MAX_FILE_SIZE } from "../../lib/pdf-import-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PdfImportClientState {
  status: "idle" | "uploading" | "success" | "error";
  result: PdfImportActionResult | null;
  errorMessage: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfImportClient({
  guardEnabled,
  guardReason,
  requiredEnvName,
  productionBlocked,
}: {
  guardEnabled: boolean;
  guardReason: string;
  requiredEnvName: string;
  productionBlocked: boolean;
}) {
  const [state, setState] = useState<PdfImportClientState>({
    status: "idle",
    result: null,
    errorMessage: null,
  });

  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (file) {
        setSelectedFileName(file.name);
      }
    },
    [],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!guardEnabled) {
        setState({
          status: "error",
          result: null,
          errorMessage: "PDF 导入当前被阻止。",
        });
        return;
      }

      const form = e.currentTarget;
      const formData = new FormData(form);

      setState({ status: "uploading", result: null, errorMessage: null });

      try {
        const result = await pdfImportServerAction(formData);
        if (result.success) {
          setState({ status: "success", result, errorMessage: null });
        } else {
          setState({
            status: "error",
            result,
            errorMessage: result.message,
          });
        }
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "上传失败：未知错误";
        setState({
          status: "error",
          result: null,
          errorMessage: msg,
        });
      }
    },
    [guardEnabled],
  );

  const handleReset = useCallback(() => {
    setState({ status: "idle", result: null, errorMessage: null });
    setSelectedFileName(null);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-3)",
      }}
    >
      {/* Guard status */}
      <div
        style={{
          padding: "var(--lap-space-2) var(--lap-space-3)",
          borderRadius: "var(--lap-radius-sm)",
          background: guardEnabled ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${guardEnabled ? "#bbf7d0" : "#fecaca"}`,
          fontSize: "0.8125rem",
          lineHeight: 1.6,
        }}
      >
        <strong
          style={{
            color: guardEnabled ? "#166534" : "#991b1b",
          }}
        >
          {guardEnabled ? "PDF 导入：开发预览（已启用）" : "PDF 导入：已阻止"}
        </strong>
        <p
          style={{
            margin: "4px 0 0",
            color: "var(--lap-text-muted)",
            fontSize: "0.75rem",
          }}
        >
          {guardReason}
        </p>
        {!guardEnabled && (
          <p
            style={{
              margin: "4px 0 0",
              color: "var(--lap-text-muted)",
              fontSize: "0.6875rem",
            }}
          >
            需设置环境变量：<code>{requiredEnvName}=true</code>
            {productionBlocked && "（生产环境始终阻止）"}
          </p>
        )}
      </div>

      {/* Upload form */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--lap-space-2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--lap-space-2)",
          }}
        >
          <input
            type="file"
            name="pdfFile"
            accept=".pdf,application/pdf"
            disabled={!guardEnabled || state.status === "uploading"}
            onChange={handleFileChange}
            style={{
              flex: 1,
              fontSize: "0.8125rem",
              padding: "var(--lap-space-1) 0",
            }}
          />
          <button
            type="submit"
            disabled={
              !guardEnabled ||
              state.status === "uploading" ||
              !selectedFileName
            }
            style={{
              padding: "var(--lap-space-1) var(--lap-space-3)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              borderRadius: "var(--lap-radius-sm)",
              border: "1px solid var(--lap-border-primary)",
              background:
                guardEnabled && selectedFileName
                  ? "var(--lap-bg-accent)"
                  : "var(--lap-bg-disabled)",
              color:
                guardEnabled && selectedFileName
                  ? "#fff"
                  : "var(--lap-text-disabled)",
              cursor:
                guardEnabled && selectedFileName
                  ? "pointer"
                  : "not-allowed",
              opacity:
                guardEnabled && selectedFileName ? 1 : 0.6,
            }}
          >
            {state.status === "uploading" ? "解析中..." : "上传并解析"}
          </button>
        </div>

        <div
          style={{
            fontSize: "0.6875rem",
            color: "var(--lap-text-muted)",
            display: "flex",
            gap: "var(--lap-space-3)",
            flexWrap: "wrap",
          }}
        >
          <span>仅接受 .pdf 文件</span>
          <span>大小上限：{PDF_MAX_FILE_SIZE / (1024 * 1024)} MB</span>
          <span>仅纯文本提取，不支持扫描件 OCR</span>
          <span>不调用 LLM</span>
        </div>
      </form>

      {/* Error state */}
      {state.status === "error" && state.errorMessage && (
        <div
          style={{
            padding: "var(--lap-space-2) var(--lap-space-3)",
            borderRadius: "var(--lap-radius-sm)",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            fontSize: "0.8125rem",
            color: "#991b1b",
            lineHeight: 1.5,
          }}
        >
          <strong>解析失败</strong>
          <p style={{ margin: "4px 0 0", fontSize: "0.75rem" }}>
            {state.errorMessage}
          </p>
          {state.result && !state.result.success && state.result.warnings.length > 0 && (
            <p style={{ margin: "4px 0 0", fontSize: "0.6875rem", color: "#92400e" }}>
              提示：{state.result.warnings.join("；")}
            </p>
          )}
          <button
            type="button"
            onClick={handleReset}
            style={{
              marginTop: "var(--lap-space-2)",
              padding: "var(--lap-space-1) var(--lap-space-2)",
              fontSize: "0.75rem",
              borderRadius: "var(--lap-radius-sm)",
              border: "1px solid #fecaca",
              background: "#fff",
              color: "#991b1b",
              cursor: "pointer",
            }}
          >
            重新选择文件
          </button>
        </div>
      )}

      {/* Success state */}
      {state.status === "success" && state.result?.success && (
        <PdfImportSuccessPanel
          result={state.result}
          onReset={handleReset}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Success panel sub-component
// ---------------------------------------------------------------------------

function PdfImportSuccessPanel({
  result,
  onReset,
}: {
  result: PdfImportActionResult & { success: true };
  onReset: () => void;
}) {
  return (
    <div
      style={{
        padding: "var(--lap-space-3)",
        borderRadius: "var(--lap-radius-md)",
        background: "#f0fdf4",
        border: "1px solid #bbf7d0",
        fontSize: "0.8125rem",
        lineHeight: 1.6,
      }}
    >
      <strong style={{ color: "#166534" }}>PDF 文本提取成功</strong>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--lap-space-3)",
          marginTop: "var(--lap-space-2)",
        }}
      >
        <StatItem label="提取字符数" value={result.extractedCharCount.toLocaleString()} />
        {result.pageCount !== null && (
          <StatItem label="PDF 页数" value={result.pageCount.toString()} />
        )}
        <StatItem label="识别章节" value={result.chapterCount.toString()} />
      </div>

      <p style={{ margin: "var(--lap-space-2) 0 0", fontSize: "0.75rem", color: "#166534" }}>
        书名：<strong>{result.bookTitle}</strong>
      </p>

      {result.chapterPreviews.length > 0 && (
        <div style={{ marginTop: "var(--lap-space-2)" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--lap-text-secondary)", marginBottom: "var(--lap-space-1)" }}>
            章节预览：
          </p>
          <ChapterPreviewList chapters={result.chapterPreviews} />
        </div>
      )}

      {result.warnings.length > 0 && (
        <div
          style={{
            marginTop: "var(--lap-space-2)",
            padding: "var(--lap-space-2)",
            borderRadius: "var(--lap-radius-sm)",
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            fontSize: "0.6875rem",
            color: "#92400e",
          }}
        >
          <strong>提示：</strong>
          {result.warnings.map((w, i) => (
            <span key={i}>{(i > 0 ? "；" : "") + w}</span>
          ))}
        </div>
      )}

      <p
        style={{
          marginTop: "var(--lap-space-2)",
          color: "var(--lap-text-muted)",
          fontSize: "0.6875rem",
        }}
      >
        已提取文本，可进入文本导入预览确认并保存。不支持 OCR，不调用 LLM。
      </p>

      <button
        type="button"
        onClick={onReset}
        style={{
          marginTop: "var(--lap-space-2)",
          padding: "var(--lap-space-1) var(--lap-space-2)",
          fontSize: "0.75rem",
          borderRadius: "var(--lap-radius-sm)",
          border: "1px solid #bbf7d0",
          background: "#fff",
          color: "#166534",
          cursor: "pointer",
        }}
      >
        导入另一个 PDF
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "2px",
      }}
    >
      <span style={{ fontSize: "0.6875rem", color: "var(--lap-text-muted)" }}>
        {label}
      </span>
      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#166534" }}>
        {value}
      </span>
    </div>
  );
}

function ChapterPreviewList({
  chapters,
}: {
  chapters: PdfImportChapterPreview[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-1)",
        maxHeight: "200px",
        overflowY: "auto",
      }}
    >
      {chapters.map((ch) => (
        <div
          key={ch.order}
          style={{
            padding: "var(--lap-space-1) var(--lap-space-2)",
            borderRadius: "var(--lap-radius-sm)",
            background: "#fff",
            border: "1px solid #bbf7d0",
            fontSize: "0.75rem",
          }}
        >
          <strong>
            第 {ch.order} 章：{ch.title}
          </strong>
          <span
            style={{
              marginLeft: "var(--lap-space-2)",
              color: "var(--lap-text-muted)",
              fontSize: "0.6875rem",
            }}
          >
            ({ch.estimatedLineCount} 行)
          </span>
          <p
            style={{
              margin: "2px 0 0",
              color: "var(--lap-text-secondary)",
              fontSize: "0.6875rem",
              lineHeight: 1.4,
            }}
          >
            {ch.previewText}
          </p>
        </div>
      ))}
    </div>
  );
}
