import Link from "next/link";
import type { ReactNode } from "react";

import type { BookLibraryItemView } from "../book-library-types";

interface BookLibraryItemProps {
  book: BookLibraryItemView;
}

export function BookLibraryItem({ book }: BookLibraryItemProps) {
  return (
    <article className="chunkItem">
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">{book.sourceType ?? "saved_book"}</p>
          <h2>{book.title}</h2>
          <p className="panelNote">
            {book.author ?? "未知作者"}
            {book.language === undefined ? "" : ` · ${book.language}`}
          </p>
        </div>
        <div className="homeActions">
          <Link className="primaryLink" href={book.detailHref}>
            查看章节
          </Link>
        </div>
      </div>

      <p className="panelNote" style={{ marginTop: "12px" }}>
        {book.summary ?? "进入书籍详情页查看章节列表，并从章节进入阅读器。"}
      </p>

      <dl className="scoreMeta" style={{ marginTop: "14px" }}>
        <SummaryRow label="书籍 ID" value={<code>{book.id}</code>} />
        {book.chapterCount !== undefined ? (
          <SummaryRow label="章节数" value={book.chapterCount} />
        ) : null}
        {book.chunkCount !== undefined ? (
          <SummaryRow label="chunk 数" value={book.chunkCount} />
        ) : null}
        {book.createdAtLabel !== undefined ? (
          <SummaryRow label="创建时间" value={book.createdAtLabel} />
        ) : null}
        {book.updatedAtLabel !== undefined ? (
          <SummaryRow label="更新时间" value={book.updatedAtLabel} />
        ) : null}
      </dl>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
