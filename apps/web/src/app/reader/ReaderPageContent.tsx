import { cookies } from "next/headers";
import Link from "next/link";

import { DemoModeNotice } from "./DemoModeNotice";
import { ReaderDataSourceNotice } from "../../components/reader/ReaderDataSourceNotice";
import { ReaderContent } from "../../components/reader/ReaderContent";
import { deserializeDevSession } from "../../lib/web-auth-dev-session";
import { ReaderChapterNavigation } from "./components/ReaderChapterNavigation";
import { ReaderChapterSelectionNotice } from "./components/ReaderChapterSelectionNotice";
import { ReadingProgressSaveForm } from "./components/ReadingProgressSaveForm";
import { ReaderScrollPositionTracker } from "./ReaderScrollPositionTracker";
import { ReaderReadingTimer } from "./ReaderReadingTimer";
import { ReaderChapterCompletionToggle } from "./ReaderChapterCompletionToggle";
import { ReaderFontSizeControl } from "./ReaderFontSizeControl";
import { ReaderScrollProgressIndicator } from "./ReaderScrollProgressIndicator";
import { ReaderVisibleBlockIndicator } from "./ReaderVisibleBlockIndicator";
import { ReaderReadingStateSourceNotice } from "./ReaderReadingStateSourceNotice";
import { ReaderLocalLearningStatusCard } from "./ReaderLocalLearningStatusCard";
import { ReaderUserActions } from "./ReaderUserActions";
import { getFavoritesDbStatusForUi } from "../user/favorites-db-guard";
import { ChunkList } from "../../components/reader/ChunkList";
import { ReaderAiQuestionPanel } from "./ReaderAiQuestionPanel";
import { buildReaderAiCodeContext, buildSafeCodeBlockSummaryStrings } from "./reader-ai-code-context";
import { ReaderRecentChaptersPanel } from "./ReaderRecentChaptersPanel";
import { ReaderReadingStatsPanel } from "./ReaderReadingStatsPanel";
import { ReaderBookmarkControl } from "./ReaderBookmarkControl";
import { ReaderNoteControl } from "./ReaderNoteControl";
import { ReaderStudyTimerControl } from "./ReaderStudyTimerControl";
import { ReaderSyncPreviewPanel } from "./ReaderSyncPreviewPanel";
import { ReaderProgressSaveControlWrapper } from "./ReaderProgressSaveControlWrapper";
import type { ReaderSyncDevTriggerProgressPayload } from "./ReaderSyncDevTriggerPreview";
import { getReaderProgressDbStatusForUi } from "./reader-progress-db-guard";
import { previewReaderSyncRealServerAction } from "./reader-sync-real-server-action.server";
import { resolveReaderSyncDevTriggerConfig } from "./reader-sync-dev-trigger-config";
import type { ReaderPageData, ReaderChapterData, ReadingProgressView } from "../../lib/reader-data";

interface ReaderPageContentProps {
  bookId: string;
  currentChapter: ReaderChapterData;
  currentChapterIndex: number;
  chapters: ReaderChapterData[];
  bookTitle: string;
  bookAuthor: string;
  bookSourceLabel: string;
  chunks: { chapterId: string; id: string }[];
  savedProgress: ReadingProgressView;
  readerDevSyncProgressPreview: ReaderSyncDevTriggerProgressPayload;
  readerDevSyncPreviewConfig: ReturnType<typeof resolveReaderSyncDevTriggerConfig>;
  dbStatus: ReturnType<typeof getReaderProgressDbStatusForUi>;
  favDbStatus: ReturnType<typeof getFavoritesDbStatusForUi>;
  /** A391: Reader bookmarks DB guard status. */
  bookmarkDbStatus: { enabled: boolean; notice: string };
  /** A391: Reader notes DB guard status. */
  noteDbStatus: { enabled: boolean; notice: string };
  /** A392: Reading session DB guard status. */
  readingSessionDbStatus: { enabled: boolean; notice: string };
  devSessionOwnerId: string | null;
  totalChapters: number;
  fallbackReason?: string;
  source: string;
  chapterSelectionStatus: string;
  requestedChapterId?: string;
  progressRatio: number;
}

export function ReaderPageContent(props: ReaderPageContentProps) {
  const {
    bookId,
    currentChapter,
    currentChapterIndex,
    chapters,
    bookTitle,
    bookAuthor,
    bookSourceLabel,
    chunks,
    savedProgress,
    readerDevSyncProgressPreview,
    readerDevSyncPreviewConfig,
    dbStatus,
    favDbStatus,
    bookmarkDbStatus,
    noteDbStatus,
    readingSessionDbStatus,
    devSessionOwnerId,
    totalChapters,
    fallbackReason,
    source,
    chapterSelectionStatus,
    requestedChapterId,
    progressRatio,
  } = props;

  const currentChapterChunks = chunks.filter(
    (chunk) => chunk.chapterId === currentChapter.id,
  );
  const lastCurrentChunk = currentChapterChunks[currentChapterChunks.length - 1];

  return (
    <main className="readerPage">
      <DemoModeNotice />
      <ReaderScrollPositionTracker bookId={bookId} chapterId={currentChapter.id} dbSyncEnabled={false} />
      <ReaderReadingTimer bookId={bookId} chapterId={currentChapter.id} />
      <ReaderChapterCompletionToggle bookId={bookId} chapterId={currentChapter.id} />
      <ReaderFontSizeControl />
      <ReaderScrollProgressIndicator />
      <ReaderVisibleBlockIndicator />
      <header className="readerHeader">
        <div>
          <p className="eyebrow">阅读器预览</p>
          <h1>{bookTitle}</h1>
          <p className="status">{bookAuthor ?? bookSourceLabel} · 来源：{bookSourceLabel}</p>
        </div>
        <Link className="secondaryLink" href={`/books/${encodeURIComponent(bookId)}`}>返回章节列表</Link>
      </header>
      <ReaderDataSourceNotice fallbackReason={fallbackReason} source={source} />
      <ReaderReadingStateSourceNotice source={source} />
      <ReaderChapterSelectionNotice
        chapterTitle={currentChapter.title}
        currentChapterIndex={currentChapterIndex}
        requestedChapterId={requestedChapterId}
        status={chapterSelectionStatus}
        totalChapters={totalChapters}
      />
      <div className="readerLayout">
        <ReaderChapterNavigation bookId={bookId} chapters={chapters} currentChapterId={currentChapter.id} />
        <ReaderContent chapter={currentChapter} />
        <aside className="readerRightRail" aria-label="阅读器上下文">
          <ReaderLocalLearningStatusCard bookId={bookId} chapterId={currentChapter.id} bookTitle={bookTitle} chapterTitle={currentChapter.title} />
          <ReaderUserActions bookId={bookId} chapterId={currentChapter.id} bookTitle={bookTitle} chapterTitle={currentChapter.title} sourceType={bookSourceLabel} dbFavoritesEnabled={favDbStatus.enabled} devSessionOwnerId={devSessionOwnerId} />
          <ReaderSyncPreviewPanel
            bookId={bookId} chapterId={currentChapter.id}
            devSyncProgressPreview={readerDevSyncProgressPreview}
            showDevSyncTrigger={readerDevSyncPreviewConfig.showDevSyncTrigger}
            devSyncEnabled={readerDevSyncPreviewConfig.devSyncEnabled}
            allowDevOnlySyncPreview={readerDevSyncPreviewConfig.allowDevOnlySyncPreview}
            onTriggerDevSync={readerDevSyncPreviewConfig.showDevSyncTrigger && readerDevSyncPreviewConfig.devSyncEnabled && readerDevSyncPreviewConfig.allowDevOnlySyncPreview ? previewReaderSyncRealServerAction : undefined}
          />
          <ReadingProgressSaveForm bookId={bookId} chapterId={currentChapter.id} currentChapterIndex={currentChapterIndex} fallbackReason={fallbackReason} lastChunkId={lastCurrentChunk?.id ?? null} progressRatio={1} savedProgress={savedProgress} source={source} totalChapters={totalChapters} />
          <ReaderProgressSaveControlWrapper bookId={bookId} chapterId={currentChapter.id} progressRatio={progressRatio} dbStatus={dbStatus} />
          <ReaderAiQuestionPanel
            bookId={bookId}
            chapterId={currentChapter.id}
            bookTitle={bookTitle}
            chapterTitle={currentChapter.title}
            chapterContent={currentChapter.plainText}
            codeBlockSummaries={buildSafeCodeBlockSummaryStrings(
              buildReaderAiCodeContext({
                chapterContent: currentChapter.plainText,
                bookId,
                chapterId: currentChapter.id,
              }),
            )}
          />
          <ReaderRecentChaptersPanel bookId={bookId} chapterId={currentChapter.id} bookTitle={bookTitle} chapterTitle={currentChapter.title} />
          <ReaderReadingStatsPanel bookId={bookId} chapterId={currentChapter.id} bookTitle={bookTitle} chapterTitle={currentChapter.title} />
          <ReaderBookmarkControl bookId={bookId} chapterId={currentChapter.id} bookTitle={bookTitle} chapterTitle={currentChapter.title} sourceType={bookSourceLabel} progressRatio={progressRatio} dbBookmarkEnabled={bookmarkDbStatus.enabled} devSessionOwnerId={devSessionOwnerId} />
          <ReaderNoteControl bookId={bookId} chapterId={currentChapter.id} bookTitle={bookTitle} chapterTitle={currentChapter.title} sourceType={bookSourceLabel} progressRatio={progressRatio} dbNoteEnabled={noteDbStatus.enabled} devSessionOwnerId={devSessionOwnerId} />
          <ReaderStudyTimerControl bookId={bookId} chapterId={currentChapter.id} bookTitle={bookTitle} chapterTitle={currentChapter.title} sourceType={bookSourceLabel} progressRatio={progressRatio} dbEnabled={readingSessionDbStatus.enabled} devSessionOwnerId={devSessionOwnerId} />
        </aside>
      </div>
      <ChunkList chunks={currentChapterChunks} />
    </main>
  );
}
