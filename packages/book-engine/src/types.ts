export type BookSourceType = "builtin" | "imported_text" | "imported_url";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface ImportWarning {
  code: string;
  message: string;
}

export interface ChapteringOptions {
  detectHeadings?: boolean;
  fallbackChapterTitle?: string;
}

export interface ChunkingOptions {
  maxChunkChars?: number;
  overlapChars?: number;
  minChunkChars?: number;
}

export interface TextImportInput {
  title: string;
  sourceText: string;
  author?: string;
  sourceType?: BookSourceType;
  sourceMetadata?: JsonObject;
  chapteringOptions?: ChapteringOptions;
  chunkingOptions?: ChunkingOptions;
}

export interface ImportedBookDocument {
  id: string;
  title: string;
  author?: string;
  sourceType: BookSourceType;
  sourceMetadata?: JsonObject;
  createdAt: string;
}

export interface ImportedBookChapter {
  id: string;
  bookId: string;
  parentId?: string;
  title: string;
  orderIndex: number;
  level: number;
  plainText: string;
}

export interface ImportedContentChunk {
  id: string;
  bookId: string;
  chapterId: string;
  orderIndex: number;
  plainText: string;
  charCount: number;
  startOffset?: number;
  endOffset?: number;
}

export interface TextImportResult {
  document: ImportedBookDocument;
  chapters: ImportedBookChapter[];
  chunks: ImportedContentChunk[];
  warnings: ImportWarning[];
}
