import Link from "next/link";
import type { ReactNode } from "react";

import type { BookImportSaveActionState } from "../book-import-save-types";

interface BookImportSaveStatusProps {
  state: BookImportSaveActionState;
  isSaving: boolean;
}

export function BookImportSaveStatus({
  state,
  isSaving,
}: BookImportSaveStatusProps) {
  const status = isSaving ? "saving" : state.status;
  const message = isSaving
    ? "正在将导入结果保存到数据库..."
    : state.message;

  return (
    <div
      aria-live="polite"
      className="readerDataSourceNotice"
      style={{ marginTop: "14px" }}
    >
      <span className="readerDataSourceBadge">{formatSaveStatus(status)}</span>
      <div>
        <p>{message}</p>
        {state.status === "database_saved" && !isSaving ? (
          <dl className="scoreMeta" style={{ marginTop: "12px" }}>
            <SummaryRow label="数据状态" value={formatSaveStatus(state.status)} />
            <SummaryRow label="已保存书籍 ID" value={state.bookId} />
            <SummaryRow label="已保存标题" value={state.bookTitle} />
            <SummaryRow label="已保存章节数" value={state.chapterCount} />
            <SummaryRow label="已保存 chunk 数" value={state.chunkCount} />
            <SummaryRow label="保存时间" value={state.savedAt} />
          </dl>
        ) : null}
        {state.status === "database_saved" && !isSaving ? (
          <div className="homeActions" style={{ marginTop: "12px" }}>
            <Link className="secondaryLink" href={state.detailHref}>
              查看详情
            </Link>
            <Link className="primaryLink" href={state.readerHref}>
              开始阅读
            </Link>
            <Link className="secondaryLink" href={state.libraryHref}>
              返回书库
            </Link>
          </div>
        ) : null}
        {state.status === "validation_error" &&
        state.fieldErrors !== undefined &&
        state.fieldErrors.length > 0 &&
        !isSaving ? (
          <ul>
            {state.fieldErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatSaveStatus(
  status: BookImportSaveActionState["status"] | "saving",
): string {
  const labels: Record<BookImportSaveActionState["status"] | "saving", string> = {
    database_saved: "数据库已保存",
    database_unavailable: "数据库不可用",
    local_preview: "本地预览",
    save_failed: "保存失败",
    saving: "保存中",
    validation_error: "校验失败",
  };

  return labels[status];
}
