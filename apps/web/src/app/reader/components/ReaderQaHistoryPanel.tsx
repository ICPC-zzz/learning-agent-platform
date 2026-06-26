import type {
  ReaderQaHistoryReadResult,
  ReaderQaHistoryView,
} from "../reader-qa-history-types";
import { ReaderQaFeedbackControls } from "./ReaderQaFeedbackControls";

interface ReaderQaHistoryPanelProps {
  result: ReaderQaHistoryReadResult;
}

export function ReaderQaHistoryPanel({ result }: ReaderQaHistoryPanelProps) {
  return (
    <section className="progressPanel" aria-labelledby="qa-history-title">
      <p className="eyebrow">章节问答历史</p>
      <h2 id="qa-history-title">问答历史预览</h2>
      <p>
        当前仅用于展示演示用户的问答历史占位状态，不代表真实模型问答或正式账户历史已上线。
      </p>

      <ReaderQaHistoryStatus result={result} />

      {result.status === "loaded" ? (
        <div className="mockQaHistory">
          {result.records.map((record) => (
            <ReaderQaHistoryItem key={record.id} record={record} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ReaderQaHistoryStatus({
  result,
}: ReaderQaHistoryPanelProps) {
  return (
    <dl className="aiProviderNotice" aria-label="问答历史读取状态">
      <div>
        <dt>历史读取状态</dt>
        <dd>{formatHistoryReadStatus(result.status)}</dd>
      </div>
      <div>
        <dt>历史读取消息</dt>
        <dd>{result.message}</dd>
      </div>
      <div>
        <dt>历史读取数量</dt>
        <dd>{result.records.length}</dd>
      </div>
    </dl>
  );
}

function ReaderQaHistoryItem({ record }: { record: ReaderQaHistoryView }) {
  return (
    <article className="mockQaCard">
      <div className="mockQaMessage mockQaQuestion">
        <span>问题</span>
        <p>{record.questionPreview}</p>
      </div>
      <div className="mockQaMessage mockQaAnswer">
        <span>回答预览</span>
        <p>{record.answerPreview}</p>
      </div>
      <dl className="aiProviderNotice" aria-label="问答历史元数据">
        <div>
          <dt>回答来源</dt>
          <dd>{record.answerSource}</dd>
        </div>
        <div>
          <dt>提供方标签</dt>
          <dd>{record.providerLabel}</dd>
        </div>
        <div>
          <dt>是否使用回退</dt>
          <dd>{record.fallbackUsed ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>回退原因</dt>
          <dd>{record.fallbackReason ?? "无"}</dd>
        </div>
        <div>
          <dt>错误分类</dt>
          <dd>{record.errorCategory ?? "无"}</dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{record.createdAtLabel}</dd>
        </div>
      </dl>
      <div>
        <p className="eyebrow">反馈</p>
        <ReaderQaFeedbackControls historyRecordId={record.id} />
      </div>
    </article>
  );
}

function formatHistoryReadStatus(
  status: ReaderQaHistoryReadResult["status"],
): string {
  const labels: Record<ReaderQaHistoryReadResult["status"], string> = {
    database_unavailable: "数据库不可用",
    demo_user_missing: "缺少演示用户",
    empty: "暂无记录",
    invalid_reader_context: "阅读器上下文无效",
        loaded: "已加载演示记录",
    read_failed: "读取失败",
    unavailable_for_mock_reader: "模拟阅读器不可用",
  };

  return labels[status];
}
