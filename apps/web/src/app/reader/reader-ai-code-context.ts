/**
 * Reader AI Code Context Builder — extracts safe code block summaries from
 * chapter content for LLM context injection.
 *
 * Input: chapter content
 * Output: sanitized, truncated, count-limited code block summaries
 *
 * Designation: **开发预览 · dev-only · mock 默认 · 不保存 raw code**
 *
 * @module reader-ai-code-context
 * @previewOnly
 */

export interface ReaderAiCodeBlockSummary {
  index: number;
  language: string;
  lineCount: number;
  preview: string;
  containsSensitivePattern: boolean;
  blocked: boolean;
  blockedReason: string | null;
}

export interface ReaderAiCodeContextOutput {
  codeBlockCount: number;
  languageSummary: string;
  codeBlockSummaries: readonly ReaderAiCodeBlockSummary[];
  safeToExposeToLlm: boolean;
  blockedReasons: readonly string[];
}

export interface ReaderAiCodeContextInput {
  chapterContent: string;
  bookId?: string;
  chapterId?: string;
}

export var CODE_CONTEXT_LIMITS = {
  MAX_CODE_BLOCKS: 8,
  MAX_PREVIEW_CHARS: 300,
  MAX_TOTAL_PREVIEW_CHARS: 2000,
} as const;

var SENSITIVE_PATTERNS = [
  { pattern: /\bDATABASE_URL\s*[:=]\s*\S+/gi, label: "DATABASE_URL" },
  { pattern: /\bapi[_\s-]*key\s*[:=]\s*\S+/gi, label: "api_key" },
  { pattern: /\baccess[_\s-]*token\s*[:=]\s*\S+/gi, label: "token" },
  { pattern: /\brefresh[_\s-]*token\s*[:=]\s*\S+/gi, label: "token" },
  { pattern: /\bbearer\s+\S+/gi, label: "authorization" },
  { pattern: /\bauthorization\s*[:=]\s*\S+/gi, label: "authorization" },
  { pattern: /\bpassword\s*[:=]\s*\S+/gi, label: "password" },
  { pattern: /\bsecret\s*[:=]\s*\S+/gi, label: "secret" },
  { pattern: /\bprivate[_\s-]*key\s*[:=]\s*\S+/gi, label: "private_key" },
  { pattern: /\bclient[_\s-]*secret\s*[:=]\s*\S+/gi, label: "client_secret" },
  { pattern: /\bcookie\b/gi, label: "cookie" },
  { pattern: /\btoken\b/gi, label: "token" },
  { pattern: /\bsk-[A-Za-z0-9]{8,}\b/gi, label: "api_key" },
];

var FENCED_CODE_OPEN_REGEX = /^\s*```(?:\s*([^\s`]+))?(?:\s+.*)?$/;
var FENCED_CODE_CLOSE_REGEX = /^\s*```\s*$/;

export function buildReaderAiCodeContext(
  input: ReaderAiCodeContextInput,
): ReaderAiCodeContextOutput {
  var chapterContent = input.chapterContent;
  var blockedReasons: string[] = [];

  if (!chapterContent || chapterContent.trim().length === 0) {
    return {
      codeBlockCount: 0,
      languageSummary: "无代码块",
      codeBlockSummaries: [],
      safeToExposeToLlm: true,
      blockedReasons: [],
    };
  }

  var lines = chapterContent.split(/\r?\n/);
  var rawBlocks: Array<{ language: string; startLine: number; endLine: number; rawContent: string }> = [];
  var inBlock: { language: string; startLine: number; rawContent: string } | null = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var lineNum = i + 1;

    if (inBlock === null) {
      var openMatch = line.match(FENCED_CODE_OPEN_REGEX);
      if (openMatch) {
        inBlock = {
          language: normalizeLanguage(openMatch[1]),
          startLine: lineNum,
          rawContent: "",
        };
      }
    } else {
      var closeMatch = line.match(FENCED_CODE_CLOSE_REGEX);
      if (closeMatch) {
        rawBlocks.push({
          language: inBlock.language,
          startLine: inBlock.startLine,
          endLine: lineNum,
          rawContent: inBlock.rawContent,
        });
        inBlock = null;
      } else {
        inBlock.rawContent = inBlock.rawContent.length > 0
          ? inBlock.rawContent + "\n" + line
          : line;
      }
    }
  }

  if (inBlock !== null) {
    rawBlocks.push({
      language: inBlock.language,
      startLine: inBlock.startLine,
      endLine: lines.length,
      rawContent: inBlock.rawContent,
    });
  }

  var totalBlockCount = rawBlocks.length;

  if (totalBlockCount === 0) {
    return {
      codeBlockCount: 0,
      languageSummary: "无代码块",
      codeBlockSummaries: [],
      safeToExposeToLlm: true,
      blockedReasons: [],
    };
  }

  var limitedBlocks = rawBlocks.slice(0, CODE_CONTEXT_LIMITS.MAX_CODE_BLOCKS);
  var summaries: ReaderAiCodeBlockSummary[] = [];
  var totalPreviewChars = 0;

  for (var bi = 0; bi < limitedBlocks.length; bi++) {
    var block = limitedBlocks[bi];
    var lineCount = Math.max(block.endLine - block.startLine + 1, 1);
    var preview = block.rawContent
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map(function (l) { return l.trim(); })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (preview.length === 0) {
      preview = "[空代码块]";
    }

    var containsSensitive = checkSensitivePatterns(preview);
    if (containsSensitive) {
      preview = redactSensitiveText(preview);
      blockedReasons.push("code block #" + (bi + 1) + " (" + block.language + ") contains sensitive fields");
    }

    if (preview.length > CODE_CONTEXT_LIMITS.MAX_PREVIEW_CHARS) {
      preview = preview.slice(0, CODE_CONTEXT_LIMITS.MAX_PREVIEW_CHARS - 3) + "...";
    }

    if (totalPreviewChars + preview.length > CODE_CONTEXT_LIMITS.MAX_TOTAL_PREVIEW_CHARS) {
      var remaining = CODE_CONTEXT_LIMITS.MAX_TOTAL_PREVIEW_CHARS - totalPreviewChars;
      if (remaining <= 0) break;
      preview = preview.slice(0, Math.max(0, remaining - 3)) + "...";
    }

    totalPreviewChars += preview.length;

    summaries.push({
      index: bi + 1,
      language: block.language,
      lineCount: lineCount,
      preview: preview,
      containsSensitivePattern: containsSensitive,
      blocked: containsSensitive,
      blockedReason: containsSensitive ? "contains sensitive fields" : null,
    });
  }

  var languageCounts = new Map();
  for (var si = 0; si < summaries.length; si++) {
    var lang = summaries[si].language;
    languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
  }
  var languageEntries = Array.from(languageCounts.entries())
    .sort(function (a, b) { return b[1] - a[1]; })
    .map(function (entry) { var lang = entry[0]; var count = entry[1]; return count > 1 ? lang + " (" + count + ")" : lang; });
  var languageSummary =
    languageEntries.length > 0 ? languageEntries.join(", ") : "无代码块";

  return {
    codeBlockCount: totalBlockCount,
    languageSummary: languageSummary,
    codeBlockSummaries: summaries,
    safeToExposeToLlm: true,
    blockedReasons: blockedReasons,
  };
}

function normalizeLanguage(raw: string | undefined | null): string {
  if (typeof raw !== "string") return "unknown";
  var trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : "unknown";
}

function checkSensitivePatterns(text: string): boolean {
  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    var entry = SENSITIVE_PATTERNS[i];
    entry.pattern.lastIndex = 0;
    if (entry.pattern.test(text)) {
      return true;
    }
  }
  return false;
}

function redactSensitiveText(text: string): string {
  var result = text;
  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    var entry = SENSITIVE_PATTERNS[i];
    entry.pattern.lastIndex = 0;
    result = result.replace(entry.pattern, "[redacted]");
  }
  return result;
}

export function buildSafeCodeBlockSummaryStrings(
  codeContext: ReaderAiCodeContextOutput,
): readonly string[] {
  return codeContext.codeBlockSummaries.map(function (s) {
    var sensitiveNote = s.containsSensitivePattern ? " [部分已脱敏]" : "";
    return "[" + s.language + ", " + s.lineCount + "行] " + s.preview + sensitiveNote;
  });
}
