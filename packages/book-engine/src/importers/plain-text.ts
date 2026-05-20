import type {
  BookSourceType,
  ImportWarning,
  ImportedBookDocument,
  TextImportInput,
  TextImportResult,
} from "../types.js";
import { buildChaptersFromPlainText } from "../chaptering/chapter-builder.js";
import { chunkChaptersByCharacters } from "../chunkers/character-chunker.js";
import { normalizePlainText } from "../parsers/text-normalizer.js";
import { createBookId, createImportWarning } from "../utils.js";

const DETERMINISTIC_CREATED_AT = "1970-01-01T00:00:00.000Z";

export function importPlainTextBook(input: TextImportInput): TextImportResult {
  const title = input.title.trim();

  if (title.length === 0) {
    throw new Error("Book title is required.");
  }

  if (typeof input.sourceText !== "string") {
    throw new Error("sourceText must be a string.");
  }

  const warnings: ImportWarning[] = [];
  const sourceType: BookSourceType = "imported_text";

  if (input.sourceType !== undefined && input.sourceType !== "imported_text") {
    warnings.push(
      createImportWarning(
        "unsupported_source_type",
        "Plain text import only supports imported_text in this MVP.",
      ),
    );
  }

  const normalizedText = normalizePlainText(input.sourceText);

  if (normalizedText.length === 0) {
    warnings.push(
      createImportWarning("empty_text", "The provided sourceText is empty after normalization."),
    );
  }

  const document: ImportedBookDocument = {
    id: createBookId(),
    title,
    author: normalizeOptionalText(input.author),
    sourceType,
    sourceMetadata: input.sourceMetadata,
    createdAt: DETERMINISTIC_CREATED_AT,
  };

  if (normalizedText.length === 0) {
    return {
      document,
      chapters: [],
      chunks: [],
      warnings,
    };
  }

  const chapters = buildChaptersFromPlainText({
    bookId: document.id,
    text: normalizedText,
    options: input.chapteringOptions,
  });
  const chunks = chunkChaptersByCharacters({
    chapters,
    options: input.chunkingOptions,
  });

  return {
    document,
    chapters,
    chunks,
    warnings,
  };
}

function normalizeOptionalText(text: string | undefined): string | undefined {
  const normalizedText = text?.trim();
  return normalizedText !== undefined && normalizedText.length > 0 ? normalizedText : undefined;
}
