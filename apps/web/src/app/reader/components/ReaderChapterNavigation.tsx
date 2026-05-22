import Link from "next/link";

export interface ReaderChapterNavigationLink {
  href: string;
  title: string;
  disabled?: boolean;
}

export interface ReaderChapterNavigationProps {
  bookId: string;
  chapters: readonly { id: string; title: string }[];
  currentChapterId: string;
}

/**
 * Renders "上一章 / 下一章" navigation for the reader page.
 *
 * Computes adjacent chapters from the provided `chapters` array.
 * When the array has at least 2 chapters and the current chapter is not at an edge,
 * the links point to `/reader?bookId=...&chapterId=...`.
 *
 * Disabled states are shown with a clear message when:
 * - The current chapter is the first chapter (no previous)
 * - The current chapter is the last chapter (no next)
 * - The chapters array does not provide enough data to resolve adjacent chapters
 */
export function ReaderChapterNavigation({
  bookId,
  chapters,
  currentChapterId,
}: ReaderChapterNavigationProps) {
  const currentIndex = chapters.findIndex(
    (chapter) => chapter.id === currentChapterId,
  );

  const previous =
    currentIndex > 0 ? chapters[currentIndex - 1] : undefined;
  const next =
    currentIndex >= 0 && currentIndex < chapters.length - 1
      ? chapters[currentIndex + 1]
      : undefined;

  const buildHref = (chapterId: string) =>
    `/reader?bookId=${encodeURIComponent(bookId)}&chapterId=${encodeURIComponent(chapterId)}`;

  return (
    <nav aria-label="章节导航" className="readerChapterNavigation">
      <div className="readerChapterNavItem">
        {previous !== undefined ? (
          <Link
            className="readerChapterNavLink"
            href={buildHref(previous.id)}
          >
            <span className="readerChapterNavDirection">上一章</span>
            <span className="readerChapterNavTitle">{previous.title}</span>
          </Link>
        ) : (
          <span
            className="readerChapterNavLink readerChapterNavDisabled"
            aria-disabled="true"
          >
            <span className="readerChapterNavDirection">上一章</span>
            <span className="readerChapterNavTitle">
              {currentIndex < 0
                ? "当前预览数据未提供上一章"
                : "已是第一章"}
            </span>
          </span>
        )}
      </div>

      <div className="readerChapterNavItem readerChapterNavNext">
        {next !== undefined ? (
          <Link
            className="readerChapterNavLink"
            href={buildHref(next.id)}
          >
            <span className="readerChapterNavDirection">下一章</span>
            <span className="readerChapterNavTitle">{next.title}</span>
          </Link>
        ) : (
          <span
            className="readerChapterNavLink readerChapterNavDisabled"
            aria-disabled="true"
          >
            <span className="readerChapterNavDirection">下一章</span>
            <span className="readerChapterNavTitle">
              {currentIndex < 0
                ? "当前预览数据未提供下一章"
                : "已是最后一章"}
            </span>
          </span>
        )}
      </div>
    </nav>
  );
}
