import type { ImportLanguage } from "./book-import-preview-types";

export const BOOK_IMPORT_MIN_CONTENT_CHARS = 20;
export const BOOK_IMPORT_MAX_CONTENT_CHARS = 200_000;
export const BOOK_IMPORT_DEFAULT_MAX_CHUNK_CHARS = 2000;
export const BOOK_IMPORT_DEFAULT_OVERLAP_CHARS = 200;

export interface BookImportSaveFormInput {
  title: string;
  author: string;
  language: ImportLanguage;
  content: string;
  maxChunkChars: string;
  overlapChars: string;
}

export type BookImportSaveFailureStatus =
  | "database_unavailable"
  | "validation_error"
  | "save_failed";

export interface BookImportSaveLocalPreviewState {
  ok: null;
  status: "local_preview";
  message: string;
}

export interface BookImportSaveSuccessState {
  ok: true;
  status: "database_saved";
  bookId: string;
  bookTitle: string;
  chapterCount: number;
  chunkCount: number;
  savedAt: string;
  detailHref: string;
  readerHref: string;
  libraryHref: string;
  message: string;
}

export interface BookImportSaveFailureState {
  ok: false;
  status: BookImportSaveFailureStatus;
  message: string;
  fieldErrors?: string[];
}

export type BookImportSaveActionResult =
  | BookImportSaveSuccessState
  | BookImportSaveFailureState;

export type BookImportSaveActionState =
  | BookImportSaveLocalPreviewState
  | BookImportSaveActionResult;
