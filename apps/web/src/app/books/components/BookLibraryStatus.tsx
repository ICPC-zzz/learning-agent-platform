import type { BookLibraryLoadResult } from "../book-library-types";

interface BookLibraryStatusProps {
  result: BookLibraryLoadResult;
}

const statusLabels: Record<BookLibraryLoadResult["status"], string> = {
  loaded: "数据库",
  empty: "暂无数据",
  database_unavailable: "数据库不可用",
  read_failed: "读取失败",
  mock_fallback: "模拟回退",
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
