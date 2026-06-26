import { createHash } from "node:crypto";

export type ReaderCodeElementKind = "code-block";

export interface ReaderCodeElementPreview {
  elementId: string;
  kind: ReaderCodeElementKind;
  language: string;
  startLine: number;
  endLine: number;
  lineCount: number;
  previewText: string;
  previewOnly: true;
  implemented: true;
  safeToExposeToClient: true;
}

export interface ReaderCodeElementPreviewCollection {
  previewOnly: true;
  implemented: true;
  safeToExposeToClient: true;
  elements: ReaderCodeElementPreview[];
}

export interface ReaderCodeElementPreviewInput {
  chapterText?: string | null;
  scopeId?: string | null;
}

interface ParsedReaderCodeElement {
  kind: ReaderCodeElementKind;
  sourceType: "fenced" | "html";
  language: string;
  startLine: number;
  endLine: number;
  rawContent: string;
}

interface ReaderCodeElementPreviewBuilder {
  kind: ReaderCodeElementKind;
  sourceType: "fenced" | "html";
  language: string;
  startLine: number;
  endLine: number;
  rawContent: string;
  scopeId: string;
}

const MAX_PREVIEW_TEXT_LENGTH = 120;

const FENCED_CODE_OPEN_REGEX = /^\s*```(?:\s*([^\s`]+))?(?:\s+.*)?$/;
const FENCED_CODE_CLOSE_REGEX = /^\s*```\s*$/;
const HTML_CODE_OPEN_REGEX = /^(\s*)<pre\b[^>]*>\s*<code\b([^>]*)>(.*)$/i;
const HTML_CODE_CLOSE_REGEX = /<\/code>\s*<\/pre>/i;

const SENSITIVE_PREVIEW_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/gi,
  /\b[A-Za-z0-9_]*(?:token|secret|cookie|password|passwd)[A-Za-z0-9_]*\b/gi,
  /\b(?:api[\s_-]*key|access[\s_-]*key|private[\s_-]*key|auth[\s_-]*token|refresh[\s_-]*token|session[\s_-]*token)\b/gi,
  /\b(?:apiKey|accessKey|privateKey|authToken|refreshToken|sessionToken|secretToken|cookieToken|passwordToken)\b/gi,
  /\b(?:token|cookie|secret|password|passwd)\b/gi,
  /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{8,}\b/gi,
  /\bsk-[A-Za-z0-9]{8,}\b/gi,
];

export function createEmptyReaderCodeElementPreview(): ReaderCodeElementPreviewCollection {
  return {
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
    elements: [],
  };
}

export function extractReaderCodeElementsPreview(
  input: ReaderCodeElementPreviewInput,
): ReaderCodeElementPreviewCollection {
  const chapterText = typeof input.chapterText === "string" ? input.chapterText : "";
  if (chapterText.trim().length === 0) {
    return createEmptyReaderCodeElementPreview();
  }

  const scopeId = normalizeOptionalText(input.scopeId) ?? "";
  const lines = chapterText.split(/\r?\n/);
  const parsedElements: ReaderCodeElementPreview[] = [];
  let activeBlock: ParsedReaderCodeElement | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (activeBlock === null) {
      const fencedOpenMatch = line.match(FENCED_CODE_OPEN_REGEX);
      if (fencedOpenMatch !== null) {
        activeBlock = {
          kind: "code-block",
          sourceType: "fenced",
          language: normalizeCodeLanguage(fencedOpenMatch[1]),
          startLine: lineNumber,
          endLine: lineNumber,
          rawContent: "",
        };
        continue;
      }

      const htmlOpenMatch = line.match(HTML_CODE_OPEN_REGEX);
      if (htmlOpenMatch !== null) {
        const htmlLanguage = extractHtmlCodeLanguage(htmlOpenMatch[2]);
        const afterOpenTag = htmlOpenMatch[3] ?? "";
        const closeIndex = afterOpenTag.search(HTML_CODE_CLOSE_REGEX);

        if (closeIndex >= 0) {
          parsedElements.push(
            createReaderCodeElementPreview({
              kind: "code-block",
              sourceType: "html",
              language: htmlLanguage,
              startLine: lineNumber,
              endLine: lineNumber,
              rawContent: afterOpenTag.slice(0, closeIndex),
              scopeId,
            }),
          );
          continue;
        }

        activeBlock = {
          kind: "code-block",
          sourceType: "html",
          language: htmlLanguage,
          startLine: lineNumber,
          endLine: lineNumber,
          rawContent: afterOpenTag,
        };
        continue;
      }

      continue;
    }

    const fencedCloseMatch = line.match(FENCED_CODE_CLOSE_REGEX);
    if (fencedCloseMatch !== null && activeBlock.sourceType === "fenced") {
      activeBlock.endLine = lineNumber;
      parsedElements.push(
        createReaderCodeElementPreview({
          ...activeBlock,
          scopeId,
        }),
      );
      activeBlock = null;
      continue;
    }

    const htmlCloseIndex = line.search(HTML_CODE_CLOSE_REGEX);
    if (htmlCloseIndex >= 0 && activeBlock.sourceType === "html") {
      const beforeCloseTag = line.slice(0, htmlCloseIndex);
      const nextRawContent =
        activeBlock.rawContent.length > 0
          ? `${activeBlock.rawContent}\n${beforeCloseTag}`
          : beforeCloseTag;
      activeBlock.endLine = lineNumber;
      parsedElements.push(
        createReaderCodeElementPreview({
          ...activeBlock,
          rawContent: nextRawContent,
          scopeId,
        }),
      );
      activeBlock = null;
      continue;
    }

    activeBlock.rawContent =
      activeBlock.rawContent.length > 0
        ? `${activeBlock.rawContent}\n${line}`
        : line;
    activeBlock.endLine = lineNumber;
  }

  if (activeBlock !== null) {
    parsedElements.push(
      createReaderCodeElementPreview({
        ...activeBlock,
        scopeId,
      }),
    );
  }

  return {
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
    elements: parsedElements,
  };
}

export function validateReaderCodeElementPreview(
  value: unknown,
): value is ReaderCodeElementPreviewCollection {
  if (!isRecord(value)) {
    return false;
  }

  const preview = value as Record<string, unknown>;
  const elements = preview.elements;

  if (
    preview.previewOnly !== true ||
    preview.implemented !== true ||
    preview.safeToExposeToClient !== true ||
    !Array.isArray(elements)
  ) {
    return false;
  }

  return elements.every(isValidReaderCodeElementPreview);
}

function createReaderCodeElementPreview(
  input: ReaderCodeElementPreviewBuilder,
): ReaderCodeElementPreview {
  const previewText = normalizeReaderCodeElementPreviewText(input.rawContent);

  return {
    elementId: buildReaderCodeElementId(input),
    kind: input.kind,
    language: input.language,
    startLine: input.startLine,
    endLine: input.endLine,
    lineCount: Math.max(input.endLine - input.startLine + 1, 1),
    previewText,
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
  };
}

function buildReaderCodeElementId(input: ReaderCodeElementPreviewBuilder): string {
  const hash = createHash("sha256");
  hash.update(input.scopeId);
  hash.update("\u0000");
  hash.update(input.kind);
  hash.update("\u0000");
  hash.update(input.sourceType);
  hash.update("\u0000");
  hash.update(input.language);
  hash.update("\u0000");
  hash.update(String(input.startLine));
  hash.update("\u0000");
  hash.update(String(input.endLine));
  hash.update("\u0000");
  hash.update(input.rawContent.replace(/\r\n?/g, "\n"));

  return `reader-code-block-${hash.digest("hex").slice(0, 16)}`;
}

function normalizeReaderCodeElementPreviewText(rawContent: string): string {
  const normalizedContent = rawContent
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalizedContent.length === 0) {
    return "";
  }

  const redactedContent = redactSensitivePreviewText(normalizedContent).trim();
  const truncatedContent = redactedContent.slice(0, MAX_PREVIEW_TEXT_LENGTH).trim();

  if (truncatedContent.length > 0) {
    return truncatedContent;
  }

  return "[redacted]";
}

function redactSensitivePreviewText(text: string): string {
  let redactedText = text;
  for (const pattern of SENSITIVE_PREVIEW_PATTERNS) {
    redactedText = redactedText.replace(pattern, "[redacted]");
  }

  return redactedText;
}

function normalizeCodeLanguage(rawLanguage: string | undefined | null): string {
  const normalizedLanguage = normalizeOptionalText(rawLanguage);
  return normalizedLanguage ?? "unknown";
}

function extractHtmlCodeLanguage(rawAttributes: string): string {
  const languageMatch = rawAttributes.match(
    /\b(?:class|data-language)\s*=\s*["'][^"']*\b(?:language|lang)-([A-Za-z0-9_+-]+)\b[^"']*["']/i,
  );
  if (languageMatch !== null) {
    return normalizeCodeLanguage(languageMatch[1]);
  }

  return "unknown";
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function isValidReaderCodeElementPreview(value: unknown): value is ReaderCodeElementPreview {
  if (!isRecord(value)) {
    return false;
  }

  const preview = value as Record<string, unknown>;
  const startLine = preview.startLine;
  const endLine = preview.endLine;
  const lineCount = preview.lineCount;

  return (
    typeof preview.elementId === "string" &&
    preview.elementId.startsWith("reader-code-block-") &&
    preview.kind === "code-block" &&
    typeof preview.language === "string" &&
    preview.language.length > 0 &&
    typeof startLine === "number" &&
    Number.isInteger(startLine) &&
    startLine > 0 &&
    typeof endLine === "number" &&
    Number.isInteger(endLine) &&
    endLine >= startLine &&
    typeof lineCount === "number" &&
    Number.isInteger(lineCount) &&
    lineCount === endLine - startLine + 1 &&
    typeof preview.previewText === "string" &&
    preview.previewText.length <= MAX_PREVIEW_TEXT_LENGTH &&
    !containsSensitivePreviewText(preview.previewText) &&
    preview.previewOnly === true &&
    preview.implemented === true &&
    preview.safeToExposeToClient === true
  );
}

function containsSensitivePreviewText(text: string): boolean {
  return SENSITIVE_PREVIEW_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
