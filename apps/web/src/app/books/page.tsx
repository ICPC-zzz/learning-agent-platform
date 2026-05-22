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
          <p className="eyebrow">A152 书库预览边界</p>
          <h1>书库 / 只读预览入口</h1>
          <p className="status">
            仅展示开发数据源或演示 fallback 中可进入章节列表的书籍入口；不会导入新格式或触发 AI 解析。
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            返回首页
          </Link>
          <Link className="primaryLink" href="/import">
            打开文本导入预览
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
