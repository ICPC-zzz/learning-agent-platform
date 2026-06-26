export type ImportLanguage = "auto" | "zh" | "en";

export type ImportPreviewSource = "local_preview";

export type ImportPersistenceStatus = "not_saved";

export interface ImportPreviewChunkViewModel {
  id: string;
  orderIndex: number;
  charCount: number;
  previewText: string;
}

export interface ImportPreviewChapterViewModel {
  id: string;
  orderIndex: number;
  title: string;
  level: number;
  charCount: number;
  chunkCount: number;
  previewText: string;
  previewChunks: ImportPreviewChunkViewModel[];
}

export interface ImportPreviewChunkSettings {
  maxChunkChars: number;
  overlapChars: number;
}

export interface ImportPreviewViewModel {
  title: string;
  author?: string;
  language: ImportLanguage;
  source: ImportPreviewSource;
  persistenceStatus: ImportPersistenceStatus;
  totalChapters: number;
  totalChunks: number;
  totalChars: number;
  chapterPreviewLimit: number;
  chunkPreviewLimitPerChapter: number;
  omittedChapterCount: number;
  chunkSettings: ImportPreviewChunkSettings;
  warnings: string[];
  chapters: ImportPreviewChapterViewModel[];
}
