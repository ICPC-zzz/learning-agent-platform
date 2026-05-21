export type BookDetailStatus =
  | "loaded"
  | "database_unavailable"
  | "book_not_found"
  | "read_failed"
  | "unavailable"
  | "mock_fallback";

export type BookDetailReadingProgressStatus =
  | "progress_saved"
  | "progress_empty"
  | "demo_user_missing"
  | "database_unavailable"
  | "read_failed";

export interface BookDetailChapterView {
  id: string;
  title: string;
  orderIndex: number;
  level: number;
  chunkCount: number;
  characterCount: number;
  readerHref: string;
}

export interface BookDetailView {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  description?: string;
  language?: string;
  sourceType?: string;
  sourceUrl?: string;
  tags: string[];
  createdAtLabel?: string;
  updatedAtLabel?: string;
  chapterCount: number;
  chunkCount: number;
  characterCount: number;
  readerHref: string;
  readingProgress: BookDetailReadingProgressView;
  chapters: BookDetailChapterView[];
}

export interface BookDetailReadingProgressView {
  status: BookDetailReadingProgressStatus;
  message: string;
  hasSavedProgress: boolean;
  currentChapterTitle?: string;
  currentChapterLabel?: string;
  currentChapterProgressLabel?: string;
  completedChapterCount: number;
  totalChapterCount: number;
  updatedAtLabel?: string;
  continueReaderHref: string;
}

export type BookDetailLoadResult =
  | {
      status: "loaded" | "mock_fallback";
      book: BookDetailView;
      message: string;
    }
  | {
      status: Exclude<BookDetailStatus, "loaded" | "mock_fallback">;
      book: null;
      message: string;
    };
