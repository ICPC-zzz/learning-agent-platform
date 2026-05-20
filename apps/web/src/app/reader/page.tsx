import { AskAiPanel } from "../../components/reader/AskAiPanel";
import { ChunkList } from "../../components/reader/ChunkList";
import { ReaderDataSourceNotice } from "../../components/reader/ReaderDataSourceNotice";
import { ReaderContent } from "../../components/reader/ReaderContent";
import {
  getMockReadingProgress,
  mockAbilityProfile
} from "../../lib/mock-learning-context";
import { getReaderPageData } from "../../lib/reader-data";
import { ReaderChapterNavigation } from "./components/ReaderChapterNavigation";
import { ReaderChapterSelectionNotice } from "./components/ReaderChapterSelectionNotice";
import { ReaderQaHistoryPanel } from "./components/ReaderQaHistoryPanel";
import { ReadingProgressSaveForm } from "./components/ReadingProgressSaveForm";
import { getReaderAiRuntimeConfig } from "./reader-ai-runtime-config";
import { loadReaderQaHistoryForCurrentChapter } from "./reader-qa-history-loader";
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
  const readerData = await getReaderPageData({
    bookId: readerQuery.bookId
  });
  const chapterSelection = resolveReaderChapterSelection({
    chapters: readerData.chapters,
    fallbackChapterId: readerData.currentChapter.id,
    requestedChapterId: readerQuery.chapterId,
  });

  if (chapterSelection === null) {
    return (
      <main className="readerPage">
        <header className="readerHeader">
          <div>
            <p className="eyebrow">阅读器数据库只读边界 MVP</p>
            <h1>{readerData.book.title}</h1>
            <p className="status">未找到可读章节。</p>
          </div>
        </header>
        <ReaderDataSourceNotice
          fallbackReason={readerData.fallbackReason}
          source={readerData.source}
        />
        <section
          aria-label="阅读器章节选择"
          className="readerDataSourceNotice readerDataSourceNoticeFallback"
        >
          <span className="readerDataSourceBadge">无章节</span>
          <p>阅读器数据已加载，但其中没有可读章节。</p>
        </section>
      </main>
    );
  }

  const currentChapter = chapterSelection.currentChapter;
  const currentChapterChunks = readerData.chunks.filter(
    (chunk) => chunk.chapterId === currentChapter.id,
  );
  const aiRuntimeConfig = getReaderAiRuntimeConfig();
  const qaHistoryResult = await loadReaderQaHistoryForCurrentChapter({
    bookId: readerData.book.id,
    chapterId: currentChapter.id,
    readerDataSource: readerData.source,
  });
  const currentChapterIndex = chapterSelection.currentChapterIndex;
  const readingProgress = getMockReadingProgress({
    currentChapterIndex,
    currentChapterChunkCount: currentChapterChunks.length,
    totalChunkCount: readerData.chunks.length
  });
  const bookSourceLabel = readerData.book.sourceType ?? "未知";
  const lastCurrentChunk =
    currentChapterChunks[currentChapterChunks.length - 1];

  return (
    <main className="readerPage">
      <header className="readerHeader">
        <div>
          <p className="eyebrow">阅读器数据库只读边界 MVP</p>
          <h1>{readerData.book.title}</h1>
          <p className="status">
            {readerData.book.author ?? bookSourceLabel} · 来源：{bookSourceLabel}
          </p>
        </div>
        <p className="readerHeaderNote">
          此页面在可用时读取本地数据库阅读器数据，并在不可用时回退到静态示例书。
          数据库模式可以为演示用户保存最小 ReadingProgress 记录；模拟回退保持只读。
        </p>
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
            source={readerData.source}
            totalChapters={readerData.chapters.length}
          />
          <AskAiPanel
            abilityProfile={mockAbilityProfile}
            initialProviderStatus={aiRuntimeConfig}
            bookId={readerData.book.id}
            bookTitle={readerData.book.title}
            chapterId={currentChapter.id}
            chapterText={currentChapter.plainText}
            chapterTitle={currentChapter.title}
            chunks={currentChapterChunks}
            readingProgress={readingProgress}
            readerDataSource={readerData.source}
          />
          <ReaderQaHistoryPanel result={qaHistoryResult} />
        </aside>
      </div>

      <ChunkList chunks={currentChapterChunks} />
    </main>
  );
}
