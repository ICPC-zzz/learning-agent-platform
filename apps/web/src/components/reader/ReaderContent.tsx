import type { ReaderChapter } from "../../lib/reader-types";

interface ReaderContentProps {
  chapter: ReaderChapter;
}

export function ReaderContent({ chapter }: ReaderContentProps) {
  const paragraphs = chapter.plainText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return (
    <article className="readerContent">
      <p className="eyebrow">当前章节</p>
      <h2>{chapter.title}</h2>
      <div className="chapterBody">
        {paragraphs.map((paragraph, index) => (
          <p key={paragraph} data-reader-block data-reader-block-index={index + 1}>
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
