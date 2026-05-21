import type {
  ReaderDataSource,
  ReaderFallbackReason
} from "../../lib/reader-types";

interface ReaderDataSourceNoticeProps {
  source: ReaderDataSource;
  fallbackReason?: ReaderFallbackReason;
}

const sourceLabels: Record<ReaderDataSource, string> = {
  database: "数据库",
  mock_fallback: "演示 fallback"
};

const fallbackReasonLabels: Record<ReaderFallbackReason, string> = {
  database_read_failed: "数据库读取失败",
  demo_fallback_requested: "请求的是演示 fallback 书籍",
  missing_database_url: "DATABASE_URL 未配置",
  no_database_book_found: "没有找到可读的数据库书籍",
};

export function ReaderDataSourceNotice({
  source,
  fallbackReason
}: ReaderDataSourceNoticeProps) {
  const isDatabaseSource = source === "database";

  return (
    <section
      aria-label="阅读器数据源"
      className={
        isDatabaseSource
          ? "readerDataSourceNotice readerDataSourceNoticeDatabase"
          : "readerDataSourceNotice readerDataSourceNoticeFallback"
      }
    >
      <span className="readerDataSourceBadge">{sourceLabels[source]}</span>
      {isDatabaseSource ? (
        <p>已从本地数据库加载。</p>
      ) : (
        <p>
          回退原因：{fallbackReasonLabels[fallbackReason ?? "database_read_failed"]}。
          当前展示的是演示 fallback 内容，不是生产数据库内容。
        </p>
      )}
    </section>
  );
}
