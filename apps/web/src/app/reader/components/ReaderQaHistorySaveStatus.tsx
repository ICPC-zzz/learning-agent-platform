"use client";

import type { ReaderQaHistorySaveResult } from "../reader-qa-history-save-types";

interface ReaderQaHistorySaveStatusProps {
  result: ReaderQaHistorySaveResult;
}

export function ReaderQaHistorySaveStatus({
  result,
}: ReaderQaHistorySaveStatusProps) {
  return (
    <dl className="aiProviderNotice" aria-label="问答历史保存状态">
      <div>
        <dt>历史保存状态</dt>
        <dd>{formatHistorySaveStatus(result.status)}</dd>
      </div>
      <div>
        <dt>历史保存消息</dt>
        <dd>{getDisplayMessage(result)}</dd>
      </div>
      {result.historyRecordId === undefined ? null : (
        <div>
          <dt>历史记录 ID</dt>
          <dd>{result.historyRecordId}</dd>
        </div>
      )}
    </dl>
  );
}

function getDisplayMessage(result: ReaderQaHistorySaveResult): string {
  if (result.status === "saved") {
    return "问答历史已保存。刷新页面后可在本章问答历史中看到最新记录。";
  }

  if (result.status === "save_failed") {
    return "问答历史保存失败。";
  }

  return result.message;
}

function formatHistorySaveStatus(
  status: ReaderQaHistorySaveResult["status"],
): string {
  const labels: Record<ReaderQaHistorySaveResult["status"], string> = {
    database_unavailable: "数据库不可用",
    demo_user_missing: "缺少演示用户",
    invalid_reader_context: "阅读器上下文无效",
    save_failed: "保存失败",
    saved: "已保存",
    skipped_mock_reader: "模拟阅读器已跳过",
    skipped_no_answer: "无回答已跳过",
  };

  return labels[status];
}
