import Link from "next/link";

import type { ReaderChapterView } from "../../../lib/reader-types";

interface ReaderChapterNavigationProps {
  bookId: string;
  chapters: readonly ReaderChapterView[];
  currentChapterId: string;
}

export function ReaderChapterNavigation({
  bookId,
  chapters,
  currentChapterId,
}: ReaderChapterNavigationProps) {
  const currentChapterIndex = chapters.findIndex(
    (chapter) => chapter.id === currentChapterId,
  );

  return (
    <aside className="readerSidebar" aria-label="章节列表">
      <h2>章节</h2>
      <p className="panelNote">
        第 {currentChapterIndex >= 0 ? currentChapterIndex + 1 : 1} 章 / 共{" "}
        {chapters.length} 章
      </p>
      <ol className="chapterList">
        {chapters.map((chapter, chapterIndex) => {
          const isCurrent = chapter.id === currentChapterId;

          return (
            <li
              aria-current={isCurrent ? "page" : undefined}
              className={
                isCurrent
                  ? "chapterListItem chapterListItemActive"
                  : "chapterListItem"
              }
              key={chapter.id}
            >
              <span className="chapterOrder">{chapterIndex + 1}</span>
              <Link href={createReaderChapterHref(bookId, chapter.id)}>
                {chapter.title}
              </Link>
              {isCurrent ? <span className="eyebrow">当前</span> : null}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

function createReaderChapterHref(bookId: string, chapterId: string): string {
  return `/reader?bookId=${encodeURIComponent(bookId)}&chapterId=${encodeURIComponent(
    chapterId,
  )}`;
}
