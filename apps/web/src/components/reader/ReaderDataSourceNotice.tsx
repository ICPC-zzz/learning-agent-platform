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
  mock_fallback: "模拟回退"
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
          回退原因：<code>{fallbackReason ?? "database_read_failed"}</code>。
          阅读器页面仍在模拟模式运行。
        </p>
      )}
    </section>
  );
}
