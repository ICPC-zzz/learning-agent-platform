import Link from "next/link";

import { loadBookLibrary } from "./book-library-loader";
import { BookLibraryEmptyState } from "./components/BookLibraryEmptyState";
import { BookLibraryList } from "./components/BookLibraryList";
import { BookLibraryStatus } from "./components/BookLibraryStatus";

export default async function BooksPage() {
  const result = await loadBookLibrary({ limit: 20 });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A40 书库数据库只读边界 MVP</p>
          <h1>书库 / 已保存书籍</h1>
          <p className="status">
            只读展示已保存书籍列表，并提供直接进入阅读器的链接。
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            返回首页
          </Link>
          <Link className="primaryLink" href="/import">
            导入新书
          </Link>
        </div>
      </header>

      <BookLibraryStatus result={result} />

      {result.status === "loaded" ? (
        <BookLibraryList books={result.books} />
      ) : (
        <BookLibraryEmptyState message={result.message} />
      )}
    </main>
  );
}
