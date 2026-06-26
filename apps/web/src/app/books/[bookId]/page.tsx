import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";

import { loadBookDetail } from "../book-detail-loader";
import type {
  BookDetailLoadResult,
  BookDetailReadingProgressView,
  BookDetailView,
} from "../book-detail-types";
import { deserializeDevSession } from "../../../lib/web-auth-dev-session";
import { FavoriteBookButton } from "../../../components/books/FavoriteBookButton";
import { getFavoritesDbStatusForUi } from "../../user/favorites-db-guard";

interface BookDetailPageProps {
  params?: Promise<{
    bookId?: string | string[];
  }>;
}

const statusLabels: Record<BookDetailLoadResult["status"], string> = {
  loaded: "开发数据源",
  database_unavailable: "开发数据源不可用",
  book_not_found: "未找到书籍",
  read_failed: "读取失败",
  unavailable: "不可用",
  mock_fallback: "演示 fallback",
};

const progressStatusLabels: Record<
  BookDetailReadingProgressView["status"],
  string
> = {
  progress_saved: "演示进度",
  progress_empty: "暂无演示进度",
  demo_user_missing: "缺少演示用户",
  database_unavailable: "开发数据源不可用",
  read_failed: "读取失败",
};

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  // Read dev session cookie for ownerId — A379: enable DB progress queries
  let ownerId: string | undefined;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const session = deserializeDevSession(raw);
    if (session !== null && session.userIdPreview.length > 0) {
      ownerId = session.userIdPreview;
    }
  } catch {
    ownerId = undefined;
  }

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

  const result = await loadBookDetail({
    bookId: await readBookIdRouteParam(params),
    ownerId,
  });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A131 章节列表</p>
          <h1>{result.book?.title ?? "书籍详情"}</h1>
          <p className="status">
            {result.book === null
              ? "只读展示开发数据源或演示 fallback 中的书籍详情。"
              : `${result.book.author ?? "未知作者"} · 来源：${
                  result.book.sourceType ?? "saved_book"
                }`}
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/books">
            返回书库
          </Link>
          {result.book === null ? null : result.book.readingProgress.hasSavedProgress ? (
            <Link className="primaryLink" href={result.book.readingProgress.continueReaderHref}>
              继续阅读（dev session 进度）
            </Link>
          ) : (
            <Link className="primaryLink" href={result.book.readerHref}>
              从第一章开始阅读
            </Link>
          )}
        </div>
      </header>

      <BookDetailStatus result={result} />

      {result.book === null ? (
        <BookDetailEmptyState message={result.message} />
      ) : (
        <BookDetailContent book={result.book} dbFavoritesEnabled={favDbStatus.enabled} devSessionOwnerId={devSessionOwnerId} />
      )}
    </main>
  );
}

async function readBookIdRouteParam(
  params: BookDetailPageProps["params"],
): Promise<string | undefined> {
  if (params === undefined) {
    return undefined;
  }

  const resolvedParams = await params;
  const rawBookId = resolvedParams.bookId;
  const bookId = Array.isArray(rawBookId) ? rawBookId[0] : rawBookId;

  if (bookId === undefined) {
    return undefined;
  }

  const normalizedBookId = bookId.trim();

  return normalizedBookId.length === 0 ? undefined : normalizedBookId;
}

function BookDetailStatus({ result }: { result: BookDetailLoadResult }) {
  const isDatabaseStatus = result.status === "loaded";

  return (
    <section
      aria-label="书籍详情数据来源"
      className={
        isDatabaseStatus
          ? "readerDataSourceNotice readerDataSourceNoticeDatabase"
          : "readerDataSourceNotice readerDataSourceNoticeFallback"
      }
    >
      <span className="readerDataSourceBadge">{statusLabels[result.status]}</span>
      <p>{result.message}</p>
    </section>
  );
}

function BookDetailEmptyState({ message }: { message: string }) {
  return (
    <section className="learningEmptyState" aria-label="书籍详情不可用">
      <strong>书籍详情不可用。</strong>
      <p>{message}</p>
      <Link className="secondaryLink" href="/books">
        返回书库
      </Link>
    </section>
  );
}

function BookDetailContent({ book, dbFavoritesEnabled = false, devSessionOwnerId = null }: { book: BookDetailView; dbFavoritesEnabled?: boolean; devSessionOwnerId?: string | null }) {
  return (
    <>
      <section className="learningPanel" aria-labelledby="book-metadata-title">
        <div className="panelHeaderRow">
          <div>
            <p className="eyebrow">只读书籍元数据</p>
            <h2 id="book-metadata-title">{book.title}</h2>
            {book.subtitle === undefined ? null : (
              <p className="panelNote">{book.subtitle}</p>
            )}
          </div>
          {book.readingProgress.hasSavedProgress ? (
            <Link className="primaryLink" href={book.readingProgress.continueReaderHref}>
              继续阅读（dev session 进度）
            </Link>
          ) : (
            <Link className="primaryLink" href={book.readerHref}>
              从第一章开始阅读
            </Link>
          )}
          <FavoriteBookButton
            bookId={book.id}
            title={book.title}
            sourceType={book.sourceType ?? undefined}
            firstChapterId={book.chapters[0]?.id}
            dbFavoritesEnabled={dbFavoritesEnabled}
            devSessionOwnerId={devSessionOwnerId}
          />
        </div>

        <dl className="scoreMeta" style={{ marginTop: "14px" }}>
          <SummaryRow label="书籍 ID" value={<code>{book.id}</code>} />
          <SummaryRow label="作者" value={book.author ?? "未知作者"} />
          <SummaryRow label="来源" value={book.sourceType ?? "saved_book"} />
          {book.language === undefined ? null : (
            <SummaryRow label="语言" value={book.language} />
          )}
          {book.tags.length === 0 ? null : (
            <SummaryRow label="标签" value={book.tags.join(", ")} />
          )}
          {book.sourceUrl === undefined ? null : (
            <SummaryRow label="来源 URL（只读）" value={book.sourceUrl} />
          )}
          {book.createdAtLabel === undefined ? null : (
            <SummaryRow label="创建时间" value={book.createdAtLabel} />
          )}
          {book.updatedAtLabel === undefined ? null : (
            <SummaryRow label="更新时间" value={book.updatedAtLabel} />
          )}
        </dl>

        {book.description === undefined ? null : (
          <p className="panelNote" style={{ marginTop: "14px" }}>
            {book.description}
          </p>
        )}
      </section>

      <section className="learningPanel" aria-labelledby="book-stats-title">
        <div className="panelHeader">
          <p className="eyebrow">书籍统计</p>
          <h2 id="book-stats-title">只读内容摘要</h2>
        </div>
        <dl className="scoreMeta" style={{ marginTop: "14px" }}>
          <SummaryRow label="章节数" value={book.chapterCount} />
          <SummaryRow label="chunk 数" value={book.chunkCount} />
          <SummaryRow label="字符数" value={book.characterCount} />
        </dl>
      </section>

      <BookReadingProgressSummary progress={book.readingProgress} />

      <section className="learningPanel" aria-labelledby="book-chapters-title">
        <div className="panelHeader">
          <p className="eyebrow">章节</p>
          <h2 id="book-chapters-title">章节列表</h2>
          <p className="panelNote">
            选择任一章节进入阅读器预览；链接只携带 bookId 和 chapterId，不触发 AI 解析或 RAG。
          </p>
        </div>
        <div className="chunkList" style={{ marginTop: "18px" }}>
          {book.chapters.length === 0 ? (
            <div className="learningEmptyState" aria-live="polite">
              <strong>这本书籍预览没有找到章节。</strong>
              <p>书籍元数据可用，但当前开发数据源中的章节记录为空。</p>
            </div>
          ) : (
            book.chapters.map((chapter) => (
              <article className="chunkItem" key={chapter.id}>
                <div className="panelHeaderRow">
                  <div>
                    <p className="eyebrow">第 {chapter.orderIndex + 1} 章</p>
                    <h3>{chapter.title}</h3>
                  </div>
                  <Link className="secondaryLink" href={chapter.readerHref}>
                    打开章节
                  </Link>
                </div>
                <dl className="scoreMeta" style={{ marginTop: "14px" }}>
                  <SummaryRow label="章节 ID" value={<code>{chapter.id}</code>} />
                  <SummaryRow label="层级" value={chapter.level} />
                  <SummaryRow label="chunk 数" value={chapter.chunkCount} />
                  <SummaryRow
                    label="字符数"
                    value={chapter.characterCount}
                  />
                </dl>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

function BookReadingProgressSummary({
  progress,
}: {
  progress: BookDetailReadingProgressView;
}) {
  return (
    <section className="learningPanel" aria-labelledby="book-progress-title">
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">阅读进度预览</p>
          <h2 id="book-progress-title">
            {progress.hasSavedProgress ? "阅读进度（dev-only）" : "演示用户进度"}
          </h2>
          <p className="panelNote">{progress.message}</p>
        </div>
        <Link className="primaryLink" href={progress.continueReaderHref}>
          继续阅读
        </Link>
      </div>

      <dl className="scoreMeta" style={{ marginTop: "14px" }}>
        <SummaryRow
          label="数据状态"
          value={progressStatusLabels[progress.status]}
        />
        <SummaryRow
          label="存在演示进度"
          value={progress.hasSavedProgress ? "是" : "否"}
        />
        <SummaryRow
          label="已完成章节"
          value={`${progress.completedChapterCount} / ${progress.totalChapterCount}`}
        />
        {progress.currentChapterTitle === undefined ? null : (
          <SummaryRow
            label="当前章节"
            value={
              <>
                {progress.currentChapterLabel === undefined
                  ? null
                  : `${progress.currentChapterLabel}: `}
                {progress.currentChapterTitle}
              </>
            }
          />
        )}
        {progress.currentChapterProgressLabel === undefined ? null : (
          <SummaryRow
            label="章节进度"
            value={progress.currentChapterProgressLabel}
          />
        )}
        {progress.updatedAtLabel === undefined ? null : (
          <SummaryRow label="进度更新时间" value={progress.updatedAtLabel} />
        )}
      </dl>
    </section>
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
