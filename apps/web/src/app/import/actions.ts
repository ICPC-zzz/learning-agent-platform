"use server";

import {
  importPlainTextBook,
  normalizePlainText,
  type JsonObject,
  type TextImportInput,
} from "@learning-agent-platform/book-engine";
import {
  createBookRepositoryInputFromImportedBook,
  getDatabaseEnvStatus,
  getPrismaClient,
  PrismaBookRepository,
  type ImportedBookRepositoryInput,
} from "@learning-agent-platform/db";

import type { ImportLanguage } from "./book-import-preview-types";
import { createBookImportSaveResultLinks } from "./book-import-save-links";
import {
  BOOK_IMPORT_DEFAULT_MAX_CHUNK_CHARS,
  BOOK_IMPORT_DEFAULT_OVERLAP_CHARS,
  BOOK_IMPORT_MAX_CONTENT_CHARS,
  BOOK_IMPORT_MIN_CONTENT_CHARS,
  type BookImportSaveActionState,
} from "./book-import-save-types";

interface ValidatedSaveRequest {
  input: TextImportInput;
  language: ImportLanguage;
  totalChars: number;
  maxChunkChars: number;
  overlapChars: number;
}

interface OptionalIntegerResult {
  value?: number;
  error?: string;
}

export async function saveImportedPlainTextBookAction(
  previousState: BookImportSaveActionState,
  formData: FormData,
): Promise<BookImportSaveActionState> {
  void previousState;

  const validationResult = validateSaveFormData(formData);

  if ("errors" in validationResult) {
    return {
      ok: false,
      status: "validation_error",
      message: "导入保存校验失败，未尝试写入数据库。",
      fieldErrors: validationResult.errors,
    };
  }

  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return {
      ok: false,
      status: "database_unavailable",
      message: "数据库保存不可用：DATABASE_URL 未配置。",
    };
  }

  let bookRepository: PrismaBookRepository;

  try {
    bookRepository = new PrismaBookRepository(getPrismaClient());
  } catch {
    return {
      ok: false,
      status: "database_unavailable",
      message: "数据库保存不可用：Prisma client 无法初始化。",
    };
  }

  try {
    const importedBook = importPlainTextBook(validationResult.input);
    const repositoryInput: ImportedBookRepositoryInput = {
      document: {
        title: importedBook.document.title,
        author: importedBook.document.author ?? null,
        sourceType: importedBook.document.sourceType,
        sourceMetadata: importedBook.document.sourceMetadata,
      },
      chapters: importedBook.chapters,
      chunks: importedBook.chunks,
    };
    const savedBook = await bookRepository.createBookWithContent(
      createBookRepositoryInputFromImportedBook(repositoryInput),
    );
    const resultLinks = createBookImportSaveResultLinks(savedBook.bookId);

    return {
      ok: true,
      status: "database_saved",
      bookId: savedBook.bookId,
      bookTitle: importedBook.document.title,
      chapterCount: savedBook.chapterCount,
      chunkCount: savedBook.chunkCount,
      savedAt: new Date().toISOString(),
      detailHref: resultLinks.detailHref,
      readerHref: resultLinks.readerHref,
      libraryHref: resultLinks.libraryHref,
      message: `已将《${importedBook.document.title}》保存到当前开发环境数据源。`,
    };
  } catch {
    return {
      ok: false,
      status: "save_failed",
      message:
        "创建 Book、Chapter 和 Chunk 记录时数据库保存失败。",
    };
  }
}

function validateSaveFormData(
  formData: FormData,
): ValidatedSaveRequest | { errors: string[] } {
  const errors: string[] = [];
  const title = readRequiredTrimmedText(formData, "title");
  const content = readRequiredText(formData, "content");
  const author = readOptionalTrimmedText(formData, "author");
  const languageText = readRequiredTrimmedText(formData, "language");
  const parsedLanguage = parseImportLanguage(languageText);
  const maxChunkCharsText = readOptionalTrimmedText(formData, "maxChunkChars");
  const overlapCharsText = readOptionalTrimmedText(formData, "overlapChars");

  if (title === null) {
    errors.push("必须填写书名。");
  }

  if (content === null) {
    errors.push("必须填写纯文本内容。");
  }

  if (languageText === null || parsedLanguage === null) {
    errors.push("语言必须是 auto、zh 或 en。");
  }

  const normalizedText = content === null ? "" : normalizePlainText(content);

  if (content !== null) {
    if (normalizedText.length === 0) {
      errors.push("必须填写纯文本内容。");
    } else if (normalizedText.length < BOOK_IMPORT_MIN_CONTENT_CHARS) {
      errors.push(
        `纯文本内容至少需要 ${BOOK_IMPORT_MIN_CONTENT_CHARS} 个字符。`,
      );
    } else if (normalizedText.length > BOOK_IMPORT_MAX_CONTENT_CHARS) {
      errors.push(
        `纯文本内容不能超过 ${BOOK_IMPORT_MAX_CONTENT_CHARS} 个字符。`,
      );
    }
  }

  const parsedMaxChunkChars = parseOptionalInteger(
    maxChunkCharsText,
    "maxChunkChars",
    { min: 1 },
  );
  const parsedOverlapChars = parseOptionalInteger(
    overlapCharsText,
    "overlapChars",
    { min: 0 },
  );

  if (parsedMaxChunkChars.error !== undefined) {
    errors.push(parsedMaxChunkChars.error);
  }

  if (parsedOverlapChars.error !== undefined) {
    errors.push(parsedOverlapChars.error);
  }

  const effectiveMaxChunkChars =
    parsedMaxChunkChars.value ?? BOOK_IMPORT_DEFAULT_MAX_CHUNK_CHARS;
  const defaultOverlapChars = Math.min(
    BOOK_IMPORT_DEFAULT_OVERLAP_CHARS,
    Math.max(0, effectiveMaxChunkChars - 1),
  );
  const effectiveOverlapChars =
    parsedOverlapChars.value ?? defaultOverlapChars;

  if (effectiveOverlapChars >= effectiveMaxChunkChars) {
    errors.push("overlapChars 必须小于 maxChunkChars。");
  }

  if (
    errors.length > 0 ||
    title === null ||
    content === null ||
    parsedLanguage === null
  ) {
    return { errors };
  }

  const sourceMetadata: JsonObject = {
    language: parsedLanguage,
    saveBoundary: "A133",
    source: "plain_text_form",
    previewSource: "server_reimport",
    totalChars: normalizedText.length,
    chaptering: {
      fallbackChapterTitle: "正文",
      strategy: "rule_based_preview_or_single_chapter_fallback",
    },
    chunking: {
      maxChunkChars: effectiveMaxChunkChars,
      overlapChars: effectiveOverlapChars,
    },
  };
  const chunkingOptions: NonNullable<TextImportInput["chunkingOptions"]> = {
    maxChunkChars: effectiveMaxChunkChars,
    overlapChars: effectiveOverlapChars,
  };

  return {
    input: {
      title,
      sourceText: content,
      author: author ?? undefined,
      sourceType: "imported_text",
      sourceMetadata,
      chapteringOptions: {
        fallbackChapterTitle: "正文",
      },
      chunkingOptions,
    },
    language: parsedLanguage,
    totalChars: normalizedText.length,
    maxChunkChars: effectiveMaxChunkChars,
    overlapChars: effectiveOverlapChars,
  };
}

function readRequiredText(formData: FormData, key: string): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  return value.length === 0 ? null : value;
}

function readRequiredTrimmedText(
  formData: FormData,
  key: string,
): string | null {
  const value = readRequiredText(formData, key);

  if (value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function readOptionalTrimmedText(
  formData: FormData,
  key: string,
): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function parseImportLanguage(value: string | null): ImportLanguage | null {
  if (value === "auto" || value === "zh" || value === "en") {
    return value;
  }

  return null;
}

function parseOptionalInteger(
  rawValue: string | null,
  label: string,
  bounds: { min: number },
): OptionalIntegerResult {
  if (rawValue === null) {
    return {};
  }

  if (!/^\d+$/.test(rawValue)) {
    return {
      error: `${label} 必须是整数。`,
    };
  }

  const parsedValue = Number(rawValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < bounds.min) {
    return {
      error: `${label} 至少为 ${bounds.min}。`,
    };
  }

  return {
    value: parsedValue,
  };
}
