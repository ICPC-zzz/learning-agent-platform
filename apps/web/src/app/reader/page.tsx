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
import {
  readReaderSearchQuery,
  resolveReaderChapterSelection,
  type ReaderRawSearchParams,
} from "./reader-query";

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
        </aside>
      </div>

      <ChunkList chunks={currentChapterChunks} />
    </main>
  );
}

function ReaderEmptyState({ message }: { message: string }) {
  return (
    <main className="readerPage">
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
      <section
        aria-label="阅读器参数不可用"
        className="readerDataSourceNotice readerDataSourceNoticeFallback"
      >
        <span className="readerDataSourceBadge">不可阅读</span>
        <p>{message}</p>
      </section>
    </main>
  );
}
