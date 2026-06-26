import type { BookLibraryLoadResult } from "../book-library-types";

interface BookLibraryStatusProps {
  result: BookLibraryLoadResult;
}

const statusLabels: Record<BookLibraryLoadResult["status"], string> = {
  loaded: "开发数据源",
  empty: "暂无数据",
  database_unavailable: "开发数据源不可用",
  read_failed: "读取失败",
  mock_fallback: "演示 fallback",
};

export function BookLibraryStatus({ result }: BookLibraryStatusProps) {
  const isDatabaseStatus = result.status === "loaded" || result.status === "empty";

  return (
    <section
      aria-label="书库数据来源"
      className={
        isDatabaseStatus
          ? "readerDataSourceNotice readerDataSourceNoticeDatabase"
          : "readerDataSourceNotice readerDataSourceNoticeFallback"
      }
    >
      <span className="readerDataSourceBadge">{statusLabels[result.status]}</span>
      <p>{result.message}</p>
    </section>
  );
}
