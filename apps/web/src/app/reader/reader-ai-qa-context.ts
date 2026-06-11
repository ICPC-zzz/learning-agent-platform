/**
 * Reader AI QA Context Builder - builds safe context from book/chapter data.
 * @module reader-ai-qa-context @previewOnly
 */

export interface ReaderAiQaContextInput {
  bookTitle: string;
  chapterTitle: string;
  chapterContent: string;
  codeBlockSummaries?: readonly string[];
  userQuestion: string;
}

export interface ReaderAiQaSafeContext {
  safePromptPreview: string;
  bookTitle: string;
  chapterTitle: string;
  chapterExcerpt: string;
  userQuestion: string;
  chapterTruncated: boolean;
  questionTruncated: boolean;
  sensitiveFieldsDetected: boolean;
  detectedPatterns: readonly string[];
  contextSources: readonly string[];
  codeBlockCount: number;
  charCounts: {
    chapterOriginal: number;
    chapterTruncated: number;
    questionOriginal: number;
    questionTruncated: number;
    totalInput: number;
  };
}

export var READER_AI_QA_LIMITS = {
  MAX_CHAPTER_CHARS: 8000,
  MAX_QUESTION_CHARS: 1000,
  MAX_CODE_SUMMARY_CHARS: 500,
  MAX_CODE_BLOCK_SUMMARIES: 5,
  MAX_TOTAL_INPUT_CHARS: 12000,
} as const;

export interface BuildReaderAiQaContextResult {
  context: ReaderAiQaSafeContext | null;
  blockedReason: string | null;
}

var SENSITIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bapi[_\s-]*key\s*[:=]\s*\S+/gi, label: "api_key" },
  { pattern: /\bapi[_\s-]*secret\s*[:=]\s*\S+/gi, label: "api_secret" },
  { pattern: /\baccess[_\s-]*token\s*[:=]\s*\S+/gi, label: "access_token" },
  { pattern: /\brefresh[_\s-]*token\s*[:=]\s*\S+/gi, label: "refresh_token" },
  { pattern: /\bprivate[_\s-]*key\s*[:=]\s*\S+/gi, label: "private_key" },
  { pattern: /\bclient[_\s-]*secret\s*[:=]\s*\S+/gi, label: "client_secret" },
  { pattern: /\bbearer\s+\S+/gi, label: "bearer_token" },
  { pattern: /\bauthorization\s*[:=]\s*\S+/gi, label: "authorization" },
  { pattern: /\bpassword\s*[:=]\s*\S+/gi, label: "password" },
  { pattern: /\bDATABASE_URL\s*[:=]\s*\S+/gi, label: "DATABASE_URL" },
  { pattern: /\bXFYUN_SPARK_API_(KEY|SECRET|TOKEN)\s*[:=]\s*\S+/gi, label: "spark_credential" },
  { pattern: /\bsecret\s*[:=]\s*\S+/gi, label: "secret" },
  { pattern: /\bcookie\b/gi, label: "cookie" },
  { pattern: /\btoken\b/gi, label: "token" },
  { pattern: /\braw[_\s-]*prompt\b/gi, label: "raw_prompt" },
  { pattern: /\braw[_\s-]*response\b/gi, label: "raw_response" },
  { pattern: /\bfull[_\s-]*chapter[_\s-]*content\b/gi, label: "full_chapter_content" },
  { pattern: /\braw[_\s-]*text\b/gi, label: "raw_text" },
];

export function buildReaderAiQaContext(input: ReaderAiQaContextInput): BuildReaderAiQaContextResult {
  var questionTrimmed = input.userQuestion.trim();
  if (questionTrimmed.length === 0) {
    return { context: null, blockedReason: "问题不能为空。" };
  }

  var questionTruncated = false;
  var finalQuestion = questionTrimmed;
  if (finalQuestion.length > READER_AI_QA_LIMITS.MAX_QUESTION_CHARS) {
    finalQuestion = finalQuestion.slice(0, READER_AI_QA_LIMITS.MAX_QUESTION_CHARS);
    questionTruncated = true;
  }

  var sanitizeResult = sanitizeField(finalQuestion);
  finalQuestion = sanitizeResult.sanitized;
  var bookSanitize = sanitizeField(input.bookTitle);
  var chapterSanitize = sanitizeField(input.chapterTitle);
  var contentSanitize = sanitizeField(input.chapterContent);

  var allDetectedPatterns = new Set<string>();
  var allResults = [sanitizeResult, bookSanitize, chapterSanitize, contentSanitize];
  for (var i = 0; i < allResults.length; i++) {
    var r = allResults[i];
    for (var j = 0; j < r.detectedPatterns.length; j++) {
      allDetectedPatterns.add(r.detectedPatterns[j]);
    }
  }

  var chapterOriginalLength = contentSanitize.sanitized.length;
  var chapterTruncated = false;
  var chapterExcerpt = contentSanitize.sanitized;
  if (chapterExcerpt.length > READER_AI_QA_LIMITS.MAX_CHAPTER_CHARS) {
    chapterExcerpt = chapterExcerpt.slice(0, READER_AI_QA_LIMITS.MAX_CHAPTER_CHARS - 3) + "...";
    chapterTruncated = true;
  }

  var rawSummaries = (input.codeBlockSummaries ?? []).slice(0, READER_AI_QA_LIMITS.MAX_CODE_BLOCK_SUMMARIES);
  var codeSummaries: string[] = [];
  for (var k = 0; k < rawSummaries.length; k++) {
    var sanitized = sanitizeField(rawSummaries[k]);
    var summary = sanitized.sanitized;
    if (summary.length > READER_AI_QA_LIMITS.MAX_CODE_SUMMARY_CHARS) {
      summary = summary.slice(0, READER_AI_QA_LIMITS.MAX_CODE_SUMMARY_CHARS - 3) + "...";
    }
    codeSummaries.push(summary);
  }

  var safePromptPreview = "Book: " + bookSanitize.sanitized + "\n" +
    "Chapter: " + chapterSanitize.sanitized + "\n" +
    "Chapter excerpt (" + chapterExcerpt.length + " chars" + (chapterTruncated ? ", truncated" : "") + "):\n" +
    chapterExcerpt;

  if (codeSummaries.length > 0) {
    var codeBlock = "\nCode summaries (" + codeSummaries.length + "):";
    for (var c = 0; c < codeSummaries.length; c++) {
      codeBlock += "\n[" + (c + 1) + "] " + codeSummaries[c];
    }
    safePromptPreview += codeBlock;
  }

  safePromptPreview += "\nUser question: " + finalQuestion;

  var totalInput = safePromptPreview.length;
  if (totalInput > READER_AI_QA_LIMITS.MAX_TOTAL_INPUT_CHARS) {
    return {
      context: null,
      blockedReason: "Context total chars (" + totalInput + ") exceeds limit (" + READER_AI_QA_LIMITS.MAX_TOTAL_INPUT_CHARS + ").",
    };
  }

  return {
    context: {
      safePromptPreview: safePromptPreview,
      bookTitle: bookSanitize.sanitized,
      chapterTitle: chapterSanitize.sanitized,
      chapterExcerpt: chapterExcerpt,
      userQuestion: finalQuestion,
      chapterTruncated: chapterTruncated,
      questionTruncated: questionTruncated,
      sensitiveFieldsDetected: allDetectedPatterns.size > 0,
      detectedPatterns: Array.from(allDetectedPatterns),
      contextSources: codeSummaries.length > 0
        ? ["chapter-summary", "code-block-summary", "user-question"]
        : ["chapter-summary", "user-question"],
      codeBlockCount: codeSummaries.length,
      charCounts: {
        chapterOriginal: chapterOriginalLength,
        chapterTruncated: chapterExcerpt.length,
        questionOriginal: questionTrimmed.length,
        questionTruncated: finalQuestion.length,
        totalInput: totalInput,
      },
    },
    blockedReason: null,
  };
}

interface SanitizeResult { sanitized: string; detectedPatterns: readonly string[]; }

function sanitizeField(text: string): SanitizeResult {
  var result = text;
  var detected: string[] = [];
  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    var entry = SENSITIVE_PATTERNS[i];
    if (entry.pattern.test(result)) {
      detected.push(entry.label);
      entry.pattern.lastIndex = 0;
      result = result.replace(entry.pattern, "[" + entry.label + "_redacted]");
    }
  }
  return { sanitized: result, detectedPatterns: detected };
}
