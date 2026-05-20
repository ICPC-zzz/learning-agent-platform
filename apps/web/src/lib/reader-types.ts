export type ReaderDataSource = "database" | "mock_fallback";

export type ReaderFallbackReason =
  | "missing_database_url"
  | "no_database_book_found"
  | "database_read_failed";

export interface ReaderBookView {
  id: string;
  title: string;
  author?: string | null;
  sourceType?: string;
  sourceMetadata?: Record<string, unknown>;
  createdAt?: string | Date;
}

export interface ReaderChapterView {
  id: string;
  title: string;
  orderIndex: number;
  plainText: string;
  bookId?: string;
  parentId?: string | null;
  level?: number;
}

export interface ReaderChunkView {
  id: string;
  chapterId: string;
  orderIndex: number;
  plainText: string;
  charCount: number;
  bookId?: string;
  startOffset?: number | null;
  endOffset?: number | null;
}

export type ReaderBookDocument = ReaderBookView;

export type ReaderChapter = ReaderChapterView;

export type ReaderContentChunk = ReaderChunkView;

export interface ReaderPageData {
  source: ReaderDataSource;
  fallbackReason?: ReaderFallbackReason;
  book: ReaderBookView;
  chapters: ReaderChapterView[];
  chunks: ReaderChunkView[];
  currentChapter: ReaderChapterView;
  currentChapterChunks: ReaderChunkView[];
}

export interface MockQaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface ReaderBook {
  document: ReaderBookDocument;
  chapters: ReaderChapter[];
  chunks: ReaderContentChunk[];
}

export interface ReaderChapterContext {
  book: ReaderBookDocument;
  chapter: ReaderChapter;
  chunks: ReaderContentChunk[];
}
