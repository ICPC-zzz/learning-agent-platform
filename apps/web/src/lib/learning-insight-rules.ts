/**
 * Learning Insight Rules — deterministic recommendation and plan rules.
 *
 * All rules are deterministic, no LLM calls, no AI, no agent loop.
 * Each rule operates on safe preview data only.
 *
 * @module learning-insight-rules
 * @previewOnly — dev-only / 规则型推荐 / 未调用 LLM
 */

import type {
  SafeReadingSummary,
  SafeReadingSessionSummary,
  SafeProblemPracticeSummary,
  SafeProblemFavoriteSummary,
  SafeWrongBookSummary,
  SafeBookmarkSummary,
  SafeNoteSummary,
  SafeAiHistorySummary,
  SafeActivitySummary,
  LearningStatusTag,
  ReviewRecommendation,
  TodayPlanTask,
  TaskStatus,
} from "./learning-insight-types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAFETY_LABEL = "规则型推荐 · 未调用 LLM · 开发预览 · local fallback · 未接生产账号";
const DEV_ONLY_LABEL = "开发预览 · 规则型 · 未调用 LLM";
const FORBIDDEN_LABELS = [
  "AI 已自动规划",
  "生产学习报告",
  "真实云端同步",
  "真实判题已接入",
  "Agent 已运行",
  "LLM 推荐",
] as const;

// ---------------------------------------------------------------------------
// Learning status tag
// ---------------------------------------------------------------------------

/**
 * Compute the learning status tag from aggregated data.
 * Deterministic — based on simple thresholds.
 */
export function computeLearningStatusTag(params: {
  readingMinutes: number;
  recentPracticeCount: number;
  wrongBookNeedsReviewCount: number;
  totalEntries: number;
}): LearningStatusTag {
  const { readingMinutes, recentPracticeCount, wrongBookNeedsReviewCount, totalEntries } = params;

  if (totalEntries === 0) return "no-data";

  // Strong reading signal → reading-active
  if (readingMinutes >= 30) return "reading-active";

  // Wrong book needs review → wrong-book-needs-review
  if (wrongBookNeedsReviewCount > 0) return "wrong-book-needs-review";

  // Practice count low → practice-needs-improvement
  if (recentPracticeCount < 3 && readingMinutes > 0) return "practice-needs-improvement";

  // Default if has reading data
  if (readingMinutes > 0) return "reading-active";

  return "no-data";
}

// ---------------------------------------------------------------------------
// Review recommendations
// ---------------------------------------------------------------------------

let _recIdCounter = 0;
function nextRecId(): string {
  _recIdCounter++;
  return `rec-${Date.now().toString(36)}-${_recIdCounter}`;
}

/**
 * Generate review recommendations from available data.
 * Returns up to 10 sorted by priority (1 = highest).
 */
export function generateReviewRecommendations(params: {
  wrongBookEntries: SafeWrongBookSummary[];
  recentPractice: SafeProblemPracticeSummary[];
  recentReading: SafeReadingSummary[];
  bookmarks: SafeBookmarkSummary[];
  notes: SafeNoteSummary[];
  aiHistory: SafeAiHistorySummary[];
  favoriteProblems: SafeProblemFavoriteSummary[];
}): ReviewRecommendation[] {
  const {
    wrongBookEntries,
    recentPractice,
    recentReading,
    bookmarks,
    notes,
    aiHistory,
    favoriteProblems,
  } = params;

  const recommendations: ReviewRecommendation[] = [];

  // Priority 1: needs-review wrong book entries (up to 3)
  const needsReviewEntries = wrongBookEntries
    .filter((e) => e.reviewStatus === "needs-review")
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 3);
  for (const entry of needsReviewEntries) {
    recommendations.push({
      recommendationId: nextRecId(),
      title: `复习错题：${sanitizeTitle(entry.title, 60)}`,
      reason: `错题本中有 ${entry.wrongCount} 次错误记录，需要复习`,
      targetType: "problem",
      targetId: entry.problemId,
      targetLink: `/problems/${entry.problemId}`,
      priority: 1,
      sourceType: "wrong-book",
      safetyLabel: SAFETY_LABEL,
    });
  }

  // Priority 2: high wrong count wrong book entries (up to 2)
  const highWrongEntries = wrongBookEntries
    .filter((e) => e.reviewStatus !== "needs-review" && e.wrongCount >= 2)
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 2);
  for (const entry of highWrongEntries) {
    recommendations.push({
      recommendationId: nextRecId(),
      title: `回顾高频错题：${sanitizeTitle(entry.title, 60)}`,
      reason: `该题错误 ${entry.wrongCount} 次，建议巩固`,
      targetType: "problem",
      targetId: entry.problemId,
      targetLink: `/problems/${entry.problemId}`,
      priority: 2,
      sourceType: "wrong-book",
      safetyLabel: SAFETY_LABEL,
    });
  }

  // Priority 3: recent practice with needs-review status (up to 2)
  const needsReviewPractice = recentPractice
    .filter((p) => p.status === "needs-review")
    .slice(0, 2);
  for (const entry of needsReviewPractice) {
    recommendations.push({
      recommendationId: nextRecId(),
      title: `重做练习题：${sanitizeTitle(entry.title, 60)}`,
      reason: "最近练习状态为需要复习",
      targetType: "problem",
      targetId: entry.problemId,
      targetLink: `/problems/${entry.problemId}`,
      priority: 3,
      sourceType: "recent-practice",
      safetyLabel: SAFETY_LABEL,
    });
  }

  // Priority 4: recent reading but incomplete chapters (up to 2)
  const incompleteReadings = recentReading
    .filter((r) => r.progressRatio < 1.0)
    .sort((a, b) => new Date(b.lastReadAt).getTime() - new Date(a.lastReadAt).getTime())
    .slice(0, 2);
  for (const entry of incompleteReadings) {
    recommendations.push({
      recommendationId: nextRecId(),
      title: `继续阅读：${sanitizeTitle(entry.chapterTitle, 60)}`,
      reason: `最近阅读但未完成（进度 ${Math.round(entry.progressRatio * 100)}%）`,
      targetType: "chapter",
      targetId: entry.chapterId,
      targetLink: `/reader?bookId=${encodeURIComponent(entry.bookId)}&chapterId=${encodeURIComponent(entry.chapterId)}`,
      priority: 4,
      sourceType: "recent-reading",
      safetyLabel: SAFETY_LABEL,
    });
  }

  // Priority 5: chapters with notes/bookmarks but not recently read (up to 2)
  const annotatedChapterIds = new Set<string>();
  const annotatedChapters: { bookId: string; chapterId: string; bookTitle: string; chapterTitle: string; reason: string }[] = [];
  for (const n of notes) {
    const key = `${n.bookId}:${n.chapterId}`;
    if (!annotatedChapterIds.has(key)) {
      annotatedChapterIds.add(key);
      annotatedChapters.push({
        bookId: n.bookId,
        chapterId: n.chapterId,
        bookTitle: n.bookTitle,
        chapterTitle: n.chapterTitle,
        reason: "有阅读笔记",
      });
    }
  }
  for (const b of bookmarks) {
    const key = `${b.bookId}:${b.chapterId}`;
    if (!annotatedChapterIds.has(key)) {
      annotatedChapterIds.add(key);
      annotatedChapters.push({
        bookId: b.bookId,
        chapterId: b.chapterId,
        bookTitle: b.bookTitle,
        chapterTitle: b.chapterTitle,
        reason: "有书签",
      });
    }
  }
  // Filter to chapters not in recent reading (within last 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const recentChapterIds = new Set(
    recentReading
      .filter((r) => r.lastReadAt >= threeDaysAgo)
      .map((r) => `${r.bookId}:${r.chapterId}`),
  );
  const unvisitedAnnotated = annotatedChapters
    .filter((c) => !recentChapterIds.has(`${c.bookId}:${c.chapterId}`))
    .slice(0, 2);
  for (const entry of unvisitedAnnotated) {
    recommendations.push({
      recommendationId: nextRecId(),
      title: `回顾章节：${sanitizeTitle(entry.chapterTitle, 60)}`,
      reason: `${entry.reason}但近期未阅读`,
      targetType: "chapter",
      targetId: entry.chapterId,
      targetLink: `/reader?bookId=${encodeURIComponent(entry.bookId)}&chapterId=${encodeURIComponent(entry.chapterId)}`,
      priority: 5,
      sourceType: "annotation",
      safetyLabel: SAFETY_LABEL,
    });
  }

  // Priority 6: AI history chapters (up to 1)
  if (aiHistory.length > 0) {
    const latestAi = aiHistory[0];
    recommendations.push({
      recommendationId: nextRecId(),
      title: `回顾 AI 问答章节：${sanitizeTitle(latestAi.chapterTitle, 60)}`,
      reason: "AI 问答历史中出现过问题的章节",
      targetType: "chapter",
      targetId: latestAi.chapterId,
      targetLink: `/reader?bookId=${encodeURIComponent(latestAi.bookId)}&chapterId=${encodeURIComponent(latestAi.chapterId)}`,
      priority: 6,
      sourceType: "ai-history",
      safetyLabel: SAFETY_LABEL,
    });
  }

  // Priority 7: favorite but not practiced problems (up to 2)
  const practicedProblemIds = new Set(recentPractice.map((p) => p.problemId));
  const favNotPracticed = favoriteProblems
    .filter((f) => !practicedProblemIds.has(f.problemId))
    .slice(0, 2);
  for (const entry of favNotPracticed) {
    recommendations.push({
      recommendationId: nextRecId(),
      title: `练习收藏题：${sanitizeTitle(entry.title, 60)}`,
      reason: "已收藏但未练习",
      targetType: "problem",
      targetId: entry.problemId,
      targetLink: `/problems/${entry.problemId}`,
      priority: 7,
      sourceType: "favorite-problems",
      safetyLabel: SAFETY_LABEL,
    });
  }

  // Sort by priority (ascending = higher priority first), deduplicate by problemId+chapterId
  const seen = new Set<string>();
  return recommendations
    .filter((r) => {
      const key = `${r.targetType}:${r.targetId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Today plan
// ---------------------------------------------------------------------------

let _taskIdCounter = 0;
function nextTaskId(): string {
  _taskIdCounter++;
  return `task-${Date.now().toString(36)}-${_taskIdCounter}`;
}

/**
 * Generate 3–5 today plan tasks based on available data.
 */
export function generateTodayPlan(params: {
  wrongBookEntries: SafeWrongBookSummary[];
  recentReading: SafeReadingSummary[];
  readingSessionSummary: SafeReadingSessionSummary;
  recentPractice: SafeProblemPracticeSummary[];
  notes: SafeNoteSummary[];
  aiHistory: SafeAiHistorySummary[];
  favoriteProblems: SafeProblemFavoriteSummary[];
}): TodayPlanTask[] {
  const {
    wrongBookEntries,
    recentReading,
    readingSessionSummary,
    notes,
    aiHistory,
    favoriteProblems,
  } = params;

  const tasks: TodayPlanTask[] = [];

  // Task 1: Review wrong book entries (if needs-review exists)
  const needsReview = wrongBookEntries.filter((e) => e.reviewStatus === "needs-review").slice(0, 2);
  if (needsReview.length > 0) {
    const titles = needsReview.map((e) => sanitizeTitle(e.title, 30)).join("、");
    tasks.push({
      taskId: nextTaskId(),
      title: `复习 ${needsReview.length} 道待复习错题`,
      description: `错题待复习：${titles}。前往错题本查看详情并重新练习。`,
      estimatedMinutes: needsReview.length * 5,
      targetType: "problem",
      targetId: needsReview[0].problemId,
      targetLink: "/user/wrong-book",
      status: "todo",
      reason: `有 ${needsReview.length} 道错题标记为待复习`,
      devOnlyLabel: DEV_ONLY_LABEL,
    });
  }

  // Task 2: Continue reading (if recent reading exists)
  const latestReading = recentReading.length > 0 ? recentReading[0] : null;
  if (latestReading && latestReading.progressRatio < 1.0) {
    tasks.push({
      taskId: nextTaskId(),
      title: `继续阅读：${sanitizeTitle(latestReading.chapterTitle, 30)}`,
      description: `继续阅读「${sanitizeTitle(latestReading.bookTitle, 30)}」的「${sanitizeTitle(latestReading.chapterTitle, 30)}」，当前进度 ${Math.round(latestReading.progressRatio * 100)}%。`,
      estimatedMinutes: 15,
      targetType: "chapter",
      targetId: latestReading.chapterId,
      targetLink: `/reader?bookId=${encodeURIComponent(latestReading.bookId)}&chapterId=${encodeURIComponent(latestReading.chapterId)}`,
      status: "suggested",
      reason: "最近阅读未完成",
      devOnlyLabel: DEV_ONLY_LABEL,
    });
  } else if (latestReading) {
    // Finished current — suggest continuing to next based on book
    tasks.push({
      taskId: nextTaskId(),
      title: `继续阅读 ${sanitizeTitle(latestReading.bookTitle, 30)}`,
      description: "已完成当前章节，继续保持阅读习惯（建议 15 分钟）。",
      estimatedMinutes: 15,
      targetType: "book",
      targetId: latestReading.bookId,
      targetLink: `/reader?bookId=${encodeURIComponent(latestReading.bookId)}`,
      status: "suggested",
      reason: "保持每日阅读习惯",
      devOnlyLabel: DEV_ONLY_LABEL,
    });
  } else {
    // No reading data — suggest starting
    tasks.push({
      taskId: nextTaskId(),
      title: "开始阅读 15 分钟",
      description: "前往书库选择一本书开始阅读。建议每天保持 15 分钟以上阅读时间。",
      estimatedMinutes: 15,
      targetType: "book",
      targetId: "",
      targetLink: "/books",
      status: "suggested",
      reason: "暂无阅读记录，建议开始",
      devOnlyLabel: DEV_ONLY_LABEL,
    });
  }

  // Task 3: Review a note (if notes exist)
  if (notes.length > 0) {
    const latestNote = notes[0];
    tasks.push({
      taskId: nextTaskId(),
      title: `回看 1 条阅读笔记`,
      description: `回顾「${sanitizeTitle(latestNote.bookTitle, 30)}」的阅读笔记，巩固记忆。`,
      estimatedMinutes: 5,
      targetType: "note",
      targetId: latestNote.noteId,
      targetLink: `/user/notes`,
      status: "suggested",
      reason: "有阅读笔记可供复习",
      devOnlyLabel: DEV_ONLY_LABEL,
    });
  }

  // Task 4: Do a favorite problem (if exists and not in tasks yet)
  if (favoriteProblems.length > 0 && tasks.length < 4) {
    const fav = favoriteProblems[0];
    tasks.push({
      taskId: nextTaskId(),
      title: `做 1 道收藏题`,
      description: `练习收藏题目「${sanitizeTitle(fav.title, 30)}」（${fav.difficulty}）。`,
      estimatedMinutes: 8,
      targetType: "problem",
      targetId: fav.problemId,
      targetLink: `/problems/${fav.problemId}`,
      status: "suggested",
      reason: "有收藏题目待练习",
      devOnlyLabel: DEV_ONLY_LABEL,
    });
  }

  // Task 5: Review AI history (if exists and not at task limit)
  if (aiHistory.length > 0 && tasks.length < 5) {
    const latestAi = aiHistory[0];
    tasks.push({
      taskId: nextTaskId(),
      title: "查看 1 条 AI 问答历史并总结",
      description: `回顾「${sanitizeTitle(latestAi.bookTitle, 30)} · ${sanitizeTitle(latestAi.chapterTitle, 30)}」的 AI 问答：${sanitizeTitle(latestAi.questionPreview, 50)}`,
      estimatedMinutes: 5,
      targetType: "chapter",
      targetId: latestAi.chapterId,
      targetLink: "/user/ai-history",
      status: "suggested",
      reason: "AI 问答历史可供复习",
      devOnlyLabel: DEV_ONLY_LABEL,
    });
  }

  return tasks;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeTitle(raw: string, maxLen: number): string {
  if (typeof raw !== "string") return "未知";
  return raw.trim().slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\braw[_\s]*prompt\b/i,
  /\braw[_\s]*response\b/i,
  /\brawText\b/i,
  /\bfullChapterContent\b/i,
  /\bsubmittedCode\b/i,
];

/**
 * Check that a recommendations list contains no sensitive data or forbidden labels.
 */
export function recommendationsAreSafe(
  recommendations: ReviewRecommendation[],
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(recommendations);

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(json)) {
      violations.push(`Sensitive field matched: ${pattern.source}`);
    }
  }

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label found: ${label}`);
    }
  }

  // Check that safety label is present on each recommendation
  for (const rec of recommendations) {
    if (!rec.safetyLabel || rec.safetyLabel.length === 0) {
      violations.push(`Recommendation ${rec.recommendationId} missing safety label`);
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Check that today plan tasks are safe.
 */
export function todayPlanTasksAreSafe(
  tasks: TodayPlanTask[],
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(tasks);

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(json)) {
      violations.push(`Sensitive field matched: ${pattern.source}`);
    }
  }

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label found: ${label}`);
    }
  }

  // Check dev-only label on each task
  for (const task of tasks) {
    if (!task.devOnlyLabel || task.devOnlyLabel.length === 0) {
      violations.push(`Task ${task.taskId} missing dev-only label`);
    }
    if (task.estimatedMinutes <= 0 || task.estimatedMinutes > 120) {
      violations.push(`Task ${task.taskId} has unreasonable estimatedMinutes: ${task.estimatedMinutes}`);
    }
  }

  return { safe: violations.length === 0, violations };
}
