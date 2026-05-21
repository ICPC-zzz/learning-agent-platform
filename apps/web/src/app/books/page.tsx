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
          <p className="eyebrow">A131 书籍阅读最短路径</p>
          <h1>书库 / 可阅读入口</h1>
          <p className="status">
            展示可进入章节列表的书籍入口；演示 fallback 数据会明确标注。
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            返回首页
          </Link>
        </div>
      </header>

      <BookLibraryStatus result={result} />

      {result.books.length > 0 ? (
        <BookLibraryList books={result.books} />
      ) : (
        <BookLibraryEmptyState message={result.message} />
      )}
    </main>
  );
}
