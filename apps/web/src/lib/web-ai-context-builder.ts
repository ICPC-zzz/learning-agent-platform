/**
 * Web AI Context Builder — builds safe, sanitized context for the floating LLM
 * assistant. Supports multiple page types and aggregates safe user data summaries.
 *
 * Design goals:
 * - Safe: no secrets, tokens, cookies, DATABASE_URL, raw payloads
 * - Sanitized: sensitive patterns detected and redacted
 * - Limited: max char limits per field
 * - Page-aware: different context for different page types
 *
 * @module web-ai-context-builder
 * @previewOnly
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Page type classification for context building. */
export type WebAiPageType =
  | "home"
  | "articles"
  | "books"
  | "bookDetail"
  | "reader"
  | "problems"
  | "problemDetail"
  | "user"
  | "import"
  | "learning"
  | "ask"
  | "unknown";

/** Restricted intent labels for the web-side limited assistant. */
export type WebAiRestrictedIntent =
  | "explainCurrentPage"
  | "summarizeCurrentBook"
  | "explainCurrentProblem"
  | "suggestNextLearningStep"
  | "findImportedContent"
  | "generalQuestion";

/** Input for building page-level context. */
export interface WebAiPageContextInput {
  currentPath: string;
  pageTitle: string;
  pageType: WebAiPageType;
  routeParams?: Record<string, string>;
  visibleSummary?: string;
  // Reader-specific
  bookTitle?: string;
  chapterTitle?: string;
  chapterExcerpt?: string;
  codeBlockCount?: number;
  // Problem-specific
  problemTitle?: string;
  problemDifficulty?: string;
  problemTags?: readonly string[];
  problemStatementPreview?: string;
  // Books / book-detail specific
  bookCount?: number;
  bookDescription?: string;
  // User-specific
  userStatsSummary?: string;
  recentReadingSummary?: string;
  importedBookCount?: number;
  importedProblemCount?: number;
  learningStatsSummary?: string;
}

/** Safe context built from page input. */
export interface WebAiSafeContext {
  /** Full prompt preview that can be shown to LLM. */
  safePromptPreview: string;
  /** Page path, sanitized. */
  currentPath: string;
  /** Page type classification. */
  pageType: WebAiPageType;
  /** Page title, sanitized. */
  pageTitle: string;
  /** Detected or inferred intent. */
  detectedIntent: WebAiRestrictedIntent;
  /** Whether content was truncated. */
  truncated: boolean;
  /** Whether sensitive patterns were detected and redacted. */
  sensitiveFieldsDetected: boolean;
  /** Detected pattern labels. */
  detectedPatterns: readonly string[];
  /** Character counts for transparency. */
  charCounts: {
    totalInput: number;
    pageContextChars: number;
    userDataChars: number;
    maxLimit: number;
  };
}

/** User data summary for safe LLM context. */
export interface WebAiUserDataSummary {
  recentReadingSummary: string;
  importedBookCount: number;
  importedProblemCount: number;
  learningStatsSummary: string;
  favoritesSummary: string;
  dbAvailable: boolean;
}

/** Result of building context. */
export interface BuildWebAiContextResult {
  context: WebAiSafeContext | null;
  blockedReason: string | null;
}

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export const WEB_AI_CONTEXT_LIMITS = {
  MAX_TOTAL_INPUT_CHARS: 8000,
  MAX_PAGE_TITLE_CHARS: 200,
  MAX_PATH_CHARS: 500,
  MAX_VISIBLE_SUMMARY_CHARS: 2000,
  MAX_CHAPTER_EXCERPT_CHARS: 3000,
  MAX_PROBLEM_STATEMENT_CHARS: 2000,
  MAX_BOOK_DESCRIPTION_CHARS: 1500,
  MAX_USER_STATS_CHARS: 1500,
  MAX_RECENT_READING_CHARS: 1000,
  MAX_LEARNING_STATS_CHARS: 1500,
  MAX_QUESTION_CHARS: 1000,
  MAX_QUESTION_PREVIEW_FOR_CONTEXT: 200,
} as const;

// ---------------------------------------------------------------------------
// Restricted intent descriptions (for UI display)
// ---------------------------------------------------------------------------

export const RESTRICTED_INTENT_LABELS: Record<WebAiRestrictedIntent, string> = {
  explainCurrentPage: "解释当前页面",
  summarizeCurrentBook: "总结当前书籍",
  explainCurrentProblem: "解释当前题目",
  suggestNextLearningStep: "建议下一步学习",
  findImportedContent: "查找已导入内容",
  generalQuestion: "通用问答",
};

// ---------------------------------------------------------------------------
// Sensitive patterns (same as reader-ai-qa-context)
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
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

// ---------------------------------------------------------------------------
// Intent detector
// ---------------------------------------------------------------------------

export function detectIntent(
  question: string,
  pageType: WebAiPageType,
): WebAiRestrictedIntent {
  const q = question.toLowerCase();

  // Page-type-aware intent detection
  if (pageType === "reader" || pageType === "bookDetail") {
    if (q.includes("总结") || q.includes("概括") || q.includes("这本书") || q.includes("本章")) {
      return "summarizeCurrentBook";
    }
  }

  if (pageType === "problemDetail" || pageType === "problems") {
    if (q.includes("题目") || q.includes("这道题") || q.includes("解题") || q.includes("解释")) {
      return "explainCurrentProblem";
    }
  }

  if (pageType === "user" || pageType === "learning") {
    if (q.includes("下一步") || q.includes("学习计划") || q.includes("推荐") || q.includes("建议")) {
      return "suggestNextLearningStep";
    }
  }

  if (pageType === "import" || q.includes("导入") || q.includes("已导入")) {
    return "findImportedContent";
  }

  if (q.includes("解释") || q.includes("这是什么") || q.includes("当前页面")) {
    return "explainCurrentPage";
  }

  return "generalQuestion";
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

export function buildWebAiPageContext(
  input: WebAiPageContextInput,
  question: string,
  userData?: WebAiUserDataSummary,
): BuildWebAiContextResult {
  const questionTrimmed = question.trim();
  if (questionTrimmed.length === 0) {
    return { context: null, blockedReason: "问题不能为空。" };
  }

  if (questionTrimmed.length > WEB_AI_CONTEXT_LIMITS.MAX_QUESTION_CHARS) {
    return {
      context: null,
      blockedReason: "问题太长: " + questionTrimmed.length + " 字符，限制: " + WEB_AI_CONTEXT_LIMITS.MAX_QUESTION_CHARS,
    };
  }

  // Sanitize all fields
  const pathSanitized = sanitizeField(input.currentPath.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_PATH_CHARS));
  const titleSanitized = sanitizeField(input.pageTitle.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_PAGE_TITLE_CHARS));
  const summarySanitized = input.visibleSummary
    ? sanitizeField(input.visibleSummary.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_VISIBLE_SUMMARY_CHARS))
    : null;

  const detectedIntent = detectIntent(questionTrimmed, input.pageType);

  // Build page context section
  let pageContext = "当前页面:\n";
  pageContext += "路径: " + pathSanitized.sanitized + "\n";
  pageContext += "标题: " + titleSanitized.sanitized + "\n";
  pageContext += "页面类型: " + input.pageType + "\n";

  if (input.routeParams && Object.keys(input.routeParams).length > 0) {
    const safeParams = sanitizeField(JSON.stringify(input.routeParams));
    pageContext += "路由参数: " + safeParams.sanitized + "\n";
  }

  if (summarySanitized && summarySanitized.sanitized.length > 0) {
    pageContext += "页面摘要: " + summarySanitized.sanitized + "\n";
  }

  // Add page-type-specific context
  if (input.pageType === "reader") {
    const bookSanitized = sanitizeField((input.bookTitle ?? "").slice(0, WEB_AI_CONTEXT_LIMITS.MAX_PAGE_TITLE_CHARS));
    const chapterSanitized = sanitizeField((input.chapterTitle ?? "").slice(0, WEB_AI_CONTEXT_LIMITS.MAX_PAGE_TITLE_CHARS));
    const excerptSanitized = input.chapterExcerpt
      ? sanitizeField(input.chapterExcerpt.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_CHAPTER_EXCERPT_CHARS))
      : null;

    pageContext += "书籍: " + bookSanitized.sanitized + "\n";
    pageContext += "章节: " + chapterSanitized.sanitized + "\n";
    if (input.codeBlockCount !== undefined) {
      pageContext += "代码块数量: " + input.codeBlockCount + "\n";
    }
    if (excerptSanitized && excerptSanitized.sanitized.length > 0) {
      pageContext += "章节摘要: " + excerptSanitized.sanitized + "\n";
    }
  }

  if (input.pageType === "problemDetail") {
    const probTitle = sanitizeField((input.problemTitle ?? "").slice(0, WEB_AI_CONTEXT_LIMITS.MAX_PAGE_TITLE_CHARS));
    const probStmt = input.problemStatementPreview
      ? sanitizeField(input.problemStatementPreview.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_PROBLEM_STATEMENT_CHARS))
      : null;

    pageContext += "题目标题: " + probTitle.sanitized + "\n";
    if (input.problemDifficulty) {
      pageContext += "难度: " + sanitizeField(input.problemDifficulty).sanitized + "\n";
    }
    if (input.problemTags && input.problemTags.length > 0) {
      const tagsSanitized = sanitizeField(input.problemTags.join(", "));
      pageContext += "标签: " + tagsSanitized.sanitized + "\n";
    }
    if (probStmt && probStmt.sanitized.length > 0) {
      pageContext += "题面: " + probStmt.sanitized + "\n";
    }
  }

  if (input.pageType === "books" || input.pageType === "bookDetail") {
    if (input.bookCount !== undefined) {
      pageContext += "可见书籍数: " + input.bookCount + "\n";
    }
    if (input.bookDescription) {
      const descSanitized = sanitizeField(input.bookDescription.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_BOOK_DESCRIPTION_CHARS));
      pageContext += "书籍描述: " + descSanitized.sanitized + "\n";
    }
  }

  if (input.pageType === "user") {
    const stats = input.userStatsSummary
      ? sanitizeField(input.userStatsSummary.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_USER_STATS_CHARS))
      : null;
    if (stats && stats.sanitized.length > 0) {
      pageContext += "用户统计: " + stats.sanitized + "\n";
    }
  }

  // Build user data context
  let userDataContext = "";
  let hasUserData = false;
  if (userData) {
    hasUserData = true;
    userDataContext += "\n学习数据摘要:\n";
    userDataContext += "DB 可用: " + (userData.dbAvailable ? "是" : "否") + "\n";

    if (userData.importedBookCount > 0 || userData.importedProblemCount > 0) {
      userDataContext += "已导入: " + userData.importedBookCount + " 本书, " + userData.importedProblemCount + " 道题\n";
    }

    if (userData.recentReadingSummary) {
      const reading = sanitizeField(userData.recentReadingSummary.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_RECENT_READING_CHARS));
      userDataContext += "最近阅读: " + reading.sanitized + "\n";
    }

    if (userData.learningStatsSummary) {
      const learn = sanitizeField(userData.learningStatsSummary.slice(0, WEB_AI_CONTEXT_LIMITS.MAX_LEARNING_STATS_CHARS));
      userDataContext += "学习统计: " + learn.sanitized + "\n";
    }

    if (userData.favoritesSummary) {
      const fav = sanitizeField(userData.favoritesSummary);
      userDataContext += "收藏: " + fav.sanitized + "\n";
    }
  }

  // Build full prompt context
  let fullContext = pageContext;
  if (hasUserData) {
    fullContext += userDataContext;
  }
  fullContext += "\n用户问题: " + questionTrimmed;

  // Check total limit
  const totalChars = fullContext.length;
  if (totalChars > WEB_AI_CONTEXT_LIMITS.MAX_TOTAL_INPUT_CHARS) {
    // Truncate proportionally
    const availableForPage = Math.floor(
      WEB_AI_CONTEXT_LIMITS.MAX_TOTAL_INPUT_CHARS * (pageContext.length / totalChars),
    );
    const pageTruncated = pageContext.slice(0, availableForPage - 3) + "...";
    const remaining = WEB_AI_CONTEXT_LIMITS.MAX_TOTAL_INPUT_CHARS - pageTruncated.length;
    const questionPart = "\n用户问题: " + questionTrimmed;
    const userDataPart = hasUserData ? userDataContext.slice(0, Math.max(0, remaining - questionPart.length - 3)) + "..." : "";
    fullContext = pageTruncated + userDataPart + questionPart;
  }

  // Collect all detected patterns
  const allDetected = collectDetectedPatterns(pathSanitized, titleSanitized, summarySanitized);

  return {
    context: {
      safePromptPreview: fullContext,
      currentPath: pathSanitized.sanitized,
      pageType: input.pageType,
      pageTitle: titleSanitized.sanitized,
      detectedIntent,
      truncated: totalChars > WEB_AI_CONTEXT_LIMITS.MAX_TOTAL_INPUT_CHARS,
      sensitiveFieldsDetected: allDetected.length > 0,
      detectedPatterns: allDetected,
      charCounts: {
        totalInput: fullContext.length,
        pageContextChars: pageContext.length,
        userDataChars: hasUserData ? userDataContext.length : 0,
        maxLimit: WEB_AI_CONTEXT_LIMITS.MAX_TOTAL_INPUT_CHARS,
      },
    },
    blockedReason: null,
  };
}

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------

interface SanitizeResult {
  sanitized: string;
  detectedPatterns: readonly string[];
}

function sanitizeField(text: string): SanitizeResult {
  let result = text;
  const detected: string[] = [];
  for (let i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    const entry = SENSITIVE_PATTERNS[i];
    if (entry.pattern.test(result)) {
      detected.push(entry.label);
      entry.pattern.lastIndex = 0;
      result = result.replace(entry.pattern, "[" + entry.label + "_redacted]");
    }
  }
  return { sanitized: result, detectedPatterns: detected };
}

function collectDetectedPatterns(
  ...results: (SanitizeResult | null)[]
): readonly string[] {
  const all = new Set<string>();
  for (const r of results) {
    if (!r) continue;
    for (const p of r.detectedPatterns) {
      all.add(p);
    }
  }
  return Array.from(all);
}

// ---------------------------------------------------------------------------
// User data summary builder
// ---------------------------------------------------------------------------

export function buildEmptyUserDataSummary(): WebAiUserDataSummary {
  return {
    recentReadingSummary: "",
    importedBookCount: 0,
    importedProblemCount: 0,
    learningStatsSummary: "",
    favoritesSummary: "",
    dbAvailable: false,
  };
}

export function buildUserDataSummary(input: {
  dbAvailable: boolean;
  importedBookCount?: number;
  importedProblemCount?: number;
  recentReadingSummary?: string;
  learningStatsSummary?: string;
  favoritesSummary?: string;
}): WebAiUserDataSummary {
  return {
    recentReadingSummary: input.recentReadingSummary ?? "",
    importedBookCount: input.importedBookCount ?? 0,
    importedProblemCount: input.importedProblemCount ?? 0,
    learningStatsSummary: input.learningStatsSummary ?? "",
    favoritesSummary: input.favoritesSummary ?? "",
    dbAvailable: input.dbAvailable,
  };
}
