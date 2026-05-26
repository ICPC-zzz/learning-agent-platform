import type { ReaderDataSource } from "../../lib/reader-types";

interface ReaderReadingStateSourceNoticeProps {
  source: ReaderDataSource | "local_fallback";
}

export function ReaderReadingStateSourceNotice({
  source,
}: ReaderReadingStateSourceNoticeProps) {
  const usesDatabaseSync = source === "database";

  return (
    <section
      aria-label="阅读状态数据源"
      className={
        usesDatabaseSync
          ? "readerDataSourceNotice readerDataSourceNoticeDatabase"
          : "readerDataSourceNotice readerDataSourceNoticeFallback"
      }
    >
      <span className="readerDataSourceBadge">阅读状态数据源</span>
      <p>
        {usesDatabaseSync
          ? "开发预览 - 本地数据库同步阅读状态（仅阅读状态字段）。"
          : "开发预览 - 本地浏览器记录（未写入数据库或数据库暂不可用）。"}
      </p>
    </section>
  );
}
