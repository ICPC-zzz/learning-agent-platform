/**
 * Reader book source notice.
 *
 * Displays the origin and safety status of the current book content.
 * Shows different messages depending on whether the book is:
 * - A built-in sample book
 * - A dev-imported book (in-memory store)
 * - Loaded from the development database
 *
 * @module ReaderBookSourceNotice
 * @previewOnly — display-only, no database writes
 */

interface ReaderBookSourceNoticeProps {
  sourceType?: string;
  bookTitle: string;
  bookId: string;
}

export function ReaderBookSourceNotice({
  sourceType,
  bookTitle,
  bookId,
}: ReaderBookSourceNoticeProps) {
  const isSample = sourceType === "内置示例书" || sourceType === "builtin";
  const isDevImport =
    sourceType !== undefined &&
    ((sourceType.includes("开发内存书库") ||
      sourceType.includes("重启丢失") ||
      sourceType === "dev-import" ||
      sourceType.startsWith("dev-")));

  if (!isSample && !isDevImport) {
    // Database-loaded books — show development notice
    return (
      <section
        aria-label="书籍内容来源"
        className="readerDataSourceNotice readerDataSourceNoticeDatabase"
      >
        <span className="readerDataSourceBadge">开发数据源</span>
        <p>
          当前内容从开发数据源加载。阅读进度与同步能力仅限开发预览，不代表真实用户书库闭环。
        </p>
        <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
          书籍 ID: {bookId}
        </p>
      </section>
    );
  }

  if (isSample) {
    return (
      <section
        aria-label="书籍内容来源"
        className="readerDataSourceNotice readerDataSourceNoticeFallback"
      >
        <span className="readerDataSourceBadge">内置示例书</span>
        <p>
          当前内容来自项目内置编程示例书「{bookTitle}」。
          用于演示阅读与代码块识别，未连接用户书库。
        </p>
        <ul style={{ color: "#64748b", fontSize: "11px", listStyle: "disc", margin: "4px 0 0 18px", padding: 0 }}>
          <li>未连接真实用户账号</li>
          <li>阅读进度仅在本地浏览器记录</li>
          <li>不会触发真实同步或数据库写入</li>
        </ul>
        <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
          书籍 ID: {bookId}
        </p>
      </section>
    );
  }

  // Dev import
  return (
    <section
      aria-label="书籍内容来源"
      className="readerDataSourceNotice"
      style={{
        background: "#fffbeb",
        border: "1px solid #fcd34d",
        borderRadius: "10px",
        marginTop: "18px",
        padding: "14px 18px",
      }}
    >
      <span
        className="readerDataSourceBadge"
        style={{
          background: "#f59e0b",
          borderRadius: "4px",
          color: "#fff",
          fontSize: "11px",
          fontWeight: 600,
          padding: "2px 8px",
        }}
      >
        开发导入书籍
      </span>
      <p style={{ color: "#92400e", marginTop: "8px" }}>
        当前内容来自开发导入书籍「{bookTitle}」。
        该书保存在进程内内存书库，重启后全部丢失。
      </p>
      <ul style={{ color: "#92400e", fontSize: "11px", listStyle: "disc", margin: "4px 0 0 18px", padding: 0 }}>
        <li>保存于进程内开发书库</li>
        <li>重启后可能丢失</li>
        <li>未连接真实用户账号</li>
        <li>未写入生产数据库</li>
        <li>阅读进度仅在本地浏览器记录</li>
        <li>不会触发真实同步</li>
      </ul>
      <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0" }}>
        书籍 ID: {bookId}
      </p>
    </section>
  );
}
