import Link from "next/link";

import { AskAiPlaceholder } from "../../components/reader/AskAiPlaceholder";
import { ChunkList } from "../../components/reader/ChunkList";
import { ReaderDataSourceNotice } from "../../components/reader/ReaderDataSourceNotice";
import { ReaderContent } from "../../components/reader/ReaderContent";
import { getReaderPageData } from "../../lib/reader-data";
import {
  loadLatestReaderProgressChapterId,
  loadReaderProgressView,
} from "../../lib/reader-progress";
import { ReaderChapterNavigation } from "./components/ReaderChapterNavigation";
import { ReaderChapterSelectionNotice } from "./components/ReaderChapterSelectionNotice";
import { ReadingProgressSaveForm } from "./components/ReadingProgressSaveForm";
import { ReaderScrollPositionTracker } from "./ReaderScrollPositionTracker";
import { ReaderReadingTimer } from "./ReaderReadingTimer";
import { ReaderChapterCompletionToggle } from "./ReaderChapterCompletionToggle";
import { ReaderFontSizeControl } from "./ReaderFontSizeControl";
import { ReaderRecentChaptersPanel } from "./ReaderRecentChaptersPanel";
import { ReaderReadingStatsPanel } from "./ReaderReadingStatsPanel";
import { ReaderBookmarksPanel } from "./ReaderBookmarksPanel";
import { ReaderNoteDraftPanel } from "./ReaderNoteDraftPanel";
import { ReaderReadingStateSourceNotice } from "./ReaderReadingStateSourceNotice";
import { ReaderScrollProgressIndicator } from "./ReaderScrollProgressIndicator";
import { ReaderVisibleBlockIndicator } from "./ReaderVisibleBlockIndicator";
import { ReaderSyncPreviewPanel } from "./ReaderSyncPreviewPanel";
import {
  readReaderSearchQuery,
  resolveReaderChapterSelection,
  type ReaderRawSearchParams,
} from "./reader-query";

function DemoModeNotice() {
  return (
    <section
      aria-label="演示模式提醒"
      className="demoModeNotice"
    >
      <span className="demoModeBadge">演示模式</span>
      <p>
        当前阅读器使用演示/预览数据。阅读进度仍以章节级预览为主；
        本章已读、滚动位置、阅读计时和当前可见内容块提示均为当前浏览器本地预览能力，
        数据库同步能力仅限开发预览，不代表真实学习闭环。AI 问答、RAG 与真实模型 provider 均未启用。
      </p>
    </section>
  );
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
          chapterIds: readerData.chapters.map((chapter) => chapter.id),
        })
      : null;
  const chapterSelection = resolveReaderChapterSelection({
    chapters: readerData.chapters,
    fallbackChapterId: latestSavedChapterId ?? readerData.currentChapter.id,
    requestedChapterId: readerQuery.chapterId,
  });

  if (
    chapterSelection === null ||
    chapterSelection.status === "invalid_chapter_fallback"
  ) {
    return (
      <main className="readerPage">
        <DemoModeNotice />
        <header className="readerHeader">
          <div>
            <p className="eyebrow">阅读器预览</p>
            <h1>{readerData.book.title}</h1>
            <p className="status">未找到请求的可读章节。</p>
          </div>
          <Link className="secondaryLink" href="/books">
            返回书库
          </Link>
        </header>
        <ReaderDataSourceNotice
          fallbackReason={readerData.fallbackReason}
          source={readerData.source}
        />
        <ReaderReadingStateSourceNotice source={readerData.source} />
        <section
          aria-label="阅读器章节选择"
          className="readerDataSourceNotice readerDataSourceNoticeFallback"
        >
          <span className="readerDataSourceBadge">章节不可用</span>
          <p>
            请求的 chapterId{" "}
            <code>{readerQuery.chapterId ?? "未提供"}</code>{" "}
            未匹配到当前书籍章节。当前页面不会自动生成章节或调用 AI，请返回书籍详情页重新选择章节。
          </p>
        </section>
      </main>
    );
  }

  const currentChapter = chapterSelection.currentChapter;
  const currentChapterChunks = readerData.chunks.filter(
    (chunk) => chunk.chapterId === currentChapter.id,
  );
  const currentChapterIndex = chapterSelection.currentChapterIndex;
  const savedProgress = await loadReaderProgressView({
    source: readerData.source,
    bookId: readerData.book.id,
    chapterId: currentChapter.id,
  });
  const bookSourceLabel = readerData.book.sourceType ?? "未知";
  const lastCurrentChunk =
    currentChapterChunks[currentChapterChunks.length - 1];

  return (
    <main className="readerPage">
      <DemoModeNotice />
      <ReaderScrollPositionTracker
        bookId={readerData.book.id}
        chapterId={currentChapter.id}
        dbSyncEnabled={false}
      />
      <ReaderReadingTimer
        bookId={readerData.book.id}
        chapterId={currentChapter.id}
      />
      <ReaderChapterCompletionToggle
        bookId={readerData.book.id}
        chapterId={currentChapter.id}
      />
      <ReaderFontSizeControl />
      <ReaderScrollProgressIndicator />
      <ReaderVisibleBlockIndicator />
      <header className="readerHeader">
        <div>
          <p className="eyebrow">阅读器预览</p>
          <h1>{readerData.book.title}</h1>
          <p className="status">
            {readerData.book.author ?? bookSourceLabel} · 来源：{bookSourceLabel}
          </p>
        </div>
        <Link
          className="secondaryLink"
          href={`/books/${encodeURIComponent(readerData.book.id)}`}
        >
          返回章节列表
        </Link>
      </header>

      <ReaderDataSourceNotice
        fallbackReason={readerData.fallbackReason}
        source={readerData.source}
      />
      <ReaderReadingStateSourceNotice source={readerData.source} />
      <ReaderChapterSelectionNotice
        chapterTitle={currentChapter.title}
        currentChapterIndex={currentChapterIndex}
        requestedChapterId={chapterSelection.requestedChapterId}
        status={chapterSelection.status}
        totalChapters={readerData.chapters.length}
      />

      <div className="readerLayout">
        <ReaderChapterNavigation
          bookId={readerData.book.id}
          chapters={readerData.chapters}
          currentChapterId={currentChapter.id}
        />
        <ReaderContent chapter={currentChapter} />
        <aside className="readerRightRail" aria-label="阅读器上下文">
          <ReaderSyncPreviewPanel
            bookId={readerData.book.id}
            chapterId={currentChapter.id}
          />
          <ReadingProgressSaveForm
            bookId={readerData.book.id}
            chapterId={currentChapter.id}
            currentChapterIndex={currentChapterIndex}
            fallbackReason={readerData.fallbackReason}
            lastChunkId={lastCurrentChunk?.id ?? null}
            progressRatio={1}
            savedProgress={savedProgress}
            source={readerData.source}
            totalChapters={readerData.chapters.length}
          />
          <AskAiPlaceholder
            bookTitle={readerData.book.title}
            chapterTitle={currentChapter.title}
            chunkCount={currentChapterChunks.length}
          />
          <ReaderRecentChaptersPanel
            bookId={readerData.book.id}
            chapterId={currentChapter.id}
            bookTitle={readerData.book.title}
            chapterTitle={currentChapter.title}
          />
          <ReaderReadingStatsPanel
            bookId={readerData.book.id}
            chapterId={currentChapter.id}
            bookTitle={readerData.book.title}
            chapterTitle={currentChapter.title}
          />
          <ReaderBookmarksPanel
            bookId={readerData.book.id}
            chapterId={currentChapter.id}
            bookTitle={readerData.book.title}
            chapterTitle={currentChapter.title}
          />
          <ReaderNoteDraftPanel
            bookId={readerData.book.id}
            chapterId={currentChapter.id}
          />
        </aside>
      </div>

      <ChunkList chunks={currentChapterChunks} />
    </main>
  );
}

function ReaderEmptyState({ message }: { message: string }) {
  return (
    <main className="readerPage">
      <DemoModeNotice />
      <header className="readerHeader">
        <div>
          <p className="eyebrow">阅读器预览</p>
          <h1>阅读器需要书籍参数</h1>
          <p className="status">请从书库选择一本书，再从章节列表进入阅读器。</p>
        </div>
        <Link className="secondaryLink" href="/books">
          返回书库
        </Link>
      </header>
      <ReaderReadingStateSourceNotice source="local_fallback" />
      <section
        aria-label="阅读器错误提示"
        className="readerDataSourceNotice readerDataSourceNoticeFallback"
      >
        <span className="readerDataSourceBadge">不可阅读</span>
        <p>{message}</p>
      </section>
    </main>
  );
}
