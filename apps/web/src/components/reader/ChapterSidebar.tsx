import type { ReaderChapter } from "../../lib/reader-types";

interface ChapterSidebarProps {
  chapters: ReaderChapter[];
  currentChapterId: string;
}

export function ChapterSidebar({ chapters, currentChapterId }: ChapterSidebarProps) {
  return (
    <aside className="readerSidebar" aria-label="章节列表">
      <h2>章节</h2>
      <ol className="chapterList">
        {chapters.map((chapter) => {
          const isCurrent = chapter.id === currentChapterId;

          return (
            <li
              aria-current={isCurrent ? "page" : undefined}
              className={isCurrent ? "chapterListItem chapterListItemActive" : "chapterListItem"}
              key={chapter.id}
            >
              <span className="chapterOrder">{chapter.orderIndex + 1}</span>
              <span>{chapter.title}</span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
