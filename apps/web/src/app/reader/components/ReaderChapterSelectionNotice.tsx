import type { ReaderChapterQueryStatus } from "../reader-query";

interface ReaderChapterSelectionNoticeProps {
  chapterTitle: string;
  currentChapterIndex: number;
  requestedChapterId?: string;
  status: ReaderChapterQueryStatus;
  totalChapters: number;
}

const statusLabels: Record<ReaderChapterQueryStatus, string> = {
  default_chapter: "默认章节",
  selected_chapter: "已选择章节",
  invalid_chapter_fallback: "无效章节回退",
};

export function ReaderChapterSelectionNotice({
  chapterTitle,
  currentChapterIndex,
  requestedChapterId,
  status,
  totalChapters,
}: ReaderChapterSelectionNoticeProps) {
  const isFallback = status === "invalid_chapter_fallback";

  return (
    <section
      aria-label="阅读器章节选择"
      className={
        isFallback
          ? "readerDataSourceNotice readerDataSourceNoticeFallback"
          : "readerDataSourceNotice readerDataSourceNoticeDatabase"
      }
    >
      <span className="readerDataSourceBadge">{statusLabels[status]}</span>
      <p>
        当前章节：第 {currentChapterIndex + 1} 章 / 共 {totalChapters} 章 ·{" "}
        {chapterTitle}.
      </p>
      {isFallback ? (
        <p>
          请求的 chapterId <code>{requestedChapterId}</code> 未找到，因此阅读器打开了默认章节。
        </p>
      ) : null}
    </section>
  );
}
