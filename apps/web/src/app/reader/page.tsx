import { cookies } from "next/headers";
import Link from "next/link";

import { DemoModeNotice } from "./DemoModeNotice";
import { ReaderDataSourceNotice } from "../../components/reader/ReaderDataSourceNotice";
import { getReaderPageData } from "../../lib/reader-data";
import {
  loadLatestReaderProgressChapterId,
  loadReaderProgressView,
} from "../../lib/reader-progress";
import { deserializeDevSession } from "../../lib/web-auth-dev-session";
import { ReaderReadingStateSourceNotice } from "./ReaderReadingStateSourceNotice";
import { ReaderEmptyState } from "./ReaderEmptyState";
import { ReaderPageContent } from "./ReaderPageContent";
import { getReaderProgressDbStatusForUi } from "./reader-progress-db-guard";
import { getFavoritesDbStatusForUi } from "../user/favorites-db-guard";
import { getReaderBookmarksDbStatusForUi } from "../user/reader-bookmarks-db-guard";
import { getReaderNotesDbStatusForUi } from "../user/reader-notes-db-guard";
import { getReadingSessionDbStatusForUi } from "../user/reading-session-db-guard";
import { resolveReaderSyncDevTriggerConfig } from "./reader-sync-dev-trigger-config";
import type { ReaderSyncDevTriggerProgressPayload } from "./ReaderSyncDevTriggerPreview";
import {
  readReaderSearchQuery,
  resolveReaderChapterSelection,
  type ReaderRawSearchParams,
} from "./reader-query";

function clampProgressRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

interface ReaderPageProps {
  searchParams?: Promise<ReaderRawSearchParams>;
}

export default async function ReaderPage({ searchParams }: ReaderPageProps) {
  const readerQuery = await readReaderSearchQuery(searchParams);
  const readerDataResult = await getReaderPageData({
    bookId: readerQuery.bookId,
    chapterId: readerQuery.chapterId,
  });

  if (readerDataResult.status !== "loaded") {
    return <ReaderEmptyState message={readerDataResult.message} />;
  }

  const readerData = readerDataResult.data;
  const latestSavedChapterId =
    readerQuery.chapterId === undefined
      ? await loadLatestReaderProgressChapterId({
          source: readerData.source,
          bookId: readerData.book.id,
          chapterIds: readerData.chapters.map((c) => c.id),
        })
      : null;
  const chapterSelection = resolveReaderChapterSelection({
    chapters: readerData.chapters,
    fallbackChapterId: latestSavedChapterId ?? readerData.currentChapter.id,
    requestedChapterId: readerQuery.chapterId,
  });

  if (chapterSelection === null || chapterSelection.status === "invalid_chapter_fallback") {
    return (
      <main className="readerPage">
        <DemoModeNotice />
        <header className="readerHeader">
          <div>
            <p className="eyebrow">阅读器预览</p>
            <h1>{readerData.book.title}</h1>
            <p className="status">未找到请求的可读章节。</p>
          </div>
          <Link className="secondaryLink" href="/books">返回书库</Link>
        </header>
        <ReaderDataSourceNotice fallbackReason={readerData.fallbackReason} source={readerData.source} />
        <ReaderReadingStateSourceNotice source={readerData.source} />
        <section aria-label="阅读器章节选择" className="readerDataSourceNotice readerDataSourceNoticeFallback">
          <span className="readerDataSourceBadge">章节不可用</span>
          <p>请求的 chapterId <code>{readerQuery.chapterId ?? "未提供"}</code> 未匹配到当前书籍章节。</p>
        </section>
      </main>
    );
  }

  const currentChapter = chapterSelection.currentChapter;
  const savedProgress = await loadReaderProgressView({
    source: readerData.source,
    bookId: readerData.book.id,
    chapterId: currentChapter.id,
  });
  const bookSourceLabel = readerData.book.sourceType ?? "未知";
  const readerDevSyncPreviewConfig = resolveReaderSyncDevTriggerConfig();
  const progressRatio = clampProgressRatio(savedProgress.progressPercent / 100);

  // --- A379: Reader Progress DB save control ---
  let dbStatus;
  try {
    const ck = await cookies();
    dbStatus = getReaderProgressDbStatusForUi(ck.get("lap-web-dev-session")?.value);
  } catch {
    dbStatus = getReaderProgressDbStatusForUi(undefined);
  }

  // --- A385: Favorites DB status ---
  let favDbStatus;
  let devSessionOwnerId: string | null = null;
  try {
    const ck = await cookies();
    const raw = ck.get("lap-web-dev-session")?.value;
    favDbStatus = getFavoritesDbStatusForUi(raw);
    const s = deserializeDevSession(raw);
    devSessionOwnerId = s?.userIdPreview ?? null;
  } catch {
    favDbStatus = getFavoritesDbStatusForUi(undefined);
    devSessionOwnerId = null;
  }

  // --- A391: Reader Bookmarks DB status ---
  let bookmarkDbStatus;
  try {
    const ck = await cookies();
    bookmarkDbStatus = getReaderBookmarksDbStatusForUi(ck.get("lap-web-dev-session")?.value);
  } catch {
    bookmarkDbStatus = getReaderBookmarksDbStatusForUi(undefined);
  }

  // --- A391: Reader Notes DB status ---
  let noteDbStatus;
  try {
    const ck = await cookies();
    noteDbStatus = getReaderNotesDbStatusForUi(ck.get("lap-web-dev-session")?.value);
  } catch {
    noteDbStatus = getReaderNotesDbStatusForUi(undefined);
  }

  // --- A392: Reading Session DB status ---
  let readingSessionDbStatus;
  try {
    const ck = await cookies();
    readingSessionDbStatus = getReadingSessionDbStatusForUi(ck.get("lap-web-dev-session")?.value);
  } catch {
    readingSessionDbStatus = getReadingSessionDbStatusForUi(undefined);
  }

  return (
    <ReaderPageContent
      bookId={readerData.book.id}
      currentChapter={currentChapter}
      currentChapterIndex={chapterSelection.currentChapterIndex}
      chapters={readerData.chapters}
      bookTitle={readerData.book.title}
      bookAuthor={readerData.book.author ?? bookSourceLabel}
      bookSourceLabel={bookSourceLabel}
      chunks={readerData.chunks}
      savedProgress={savedProgress}
      readerDevSyncProgressPreview={{
        bookId: readerData.book.id,
        chapterId: currentChapter.id,
        progressRatio,
        source: savedProgress.loadStatus === "loaded" ? "server-preview" : "server-preview-fallback",
      } satisfies ReaderSyncDevTriggerProgressPayload}
      readerDevSyncPreviewConfig={readerDevSyncPreviewConfig}
      dbStatus={dbStatus}
      favDbStatus={favDbStatus}
      bookmarkDbStatus={bookmarkDbStatus}
      noteDbStatus={noteDbStatus}
      readingSessionDbStatus={readingSessionDbStatus}
      devSessionOwnerId={devSessionOwnerId}
      totalChapters={readerData.chapters.length}
      fallbackReason={readerData.fallbackReason}
      source={readerData.source}
      chapterSelectionStatus={chapterSelection.status}
      requestedChapterId={chapterSelection.requestedChapterId}
      progressRatio={progressRatio}
    />
  );
}
