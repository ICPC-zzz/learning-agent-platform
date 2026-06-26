import Link from "next/link";
import { cookies } from "next/headers";

import { loadBookLibrary } from "./book-library-loader";
import { BookLibraryEmptyState } from "./components/BookLibraryEmptyState";
import { BookLibraryList } from "./components/BookLibraryList";
import { BookLibraryStatus } from "./components/BookLibraryStatus";
import { getFavoritesDbStatusForUi } from "../user/favorites-db-guard";
import { deserializeDevSession } from "../../lib/web-auth-dev-session";

export default async function BooksPage() {
  const result = await loadBookLibrary({ limit: 20 });

  // A385: Favorites DB status
  let favDbStatus;
  let devSessionOwnerId: string | null = null;
  try {
    const cookieStore = await cookies();
    const devSessionCookie = cookieStore.get("lap-web-dev-session")?.value;
    favDbStatus = getFavoritesDbStatusForUi(devSessionCookie);
    const session = deserializeDevSession(devSessionCookie);
    devSessionOwnerId = session?.userIdPreview ?? null;
  } catch {
    favDbStatus = getFavoritesDbStatusForUi(undefined);
    devSessionOwnerId = null;
  }

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
        <BookLibraryList books={result.books} dbFavoritesEnabled={favDbStatus.enabled} devSessionOwnerId={devSessionOwnerId} />
      ) : (
        <BookLibraryEmptyState message={result.message} />
      )}
    </main>
  );
}
