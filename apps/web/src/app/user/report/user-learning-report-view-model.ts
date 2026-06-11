/**
 * User Learning Report View Model — aggregates learning data for the
 * /user/report page.
 *
 * @module user-learning-report-view-model
 * @previewOnly — dev-only; not production user system
 */

export var LEARNING_STATUS_LABELS = {
  "reading-active": "阅读活跃",
  "practice-needs-improvement": "刷题待加强",
  "wrong-book-needs-review": "错题待复习",
  "no-data": "暂无数据",
};

var DATA_SOURCE_NOTICES = {
  local: "data from localStorage · not connected to DB · dev preview",
  mixed: "mixed DB + local fallback · dev preview",
  none: "no learning data yet · dev preview",
};

var FORBIDDEN_LABELS = [
  "生产学习报告", "真实云端同步", "真实学习报告", "AI 生成报告", "LLM 生成",
];

function computeLearningStatusTag(params) {
  if (params.totalEntries === 0) return "no-data";
  if (params.readingMinutes >= 30) return "reading-active";
  if (params.wrongBookNeedsReviewCount > 0) return "wrong-book-needs-review";
  if (params.recentPracticeCount < 3 && params.readingMinutes > 0) return "practice-needs-improvement";
  if (params.readingMinutes > 0) return "reading-active";
  return "no-data";
}

export function buildLearningReportView(input) {
  var today = new Date();
  var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  var sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  var todayActivityCount = input.activities.filter(function(a) { return a.occurredAt >= todayStart; }).length;
  var todayReadingMinutes = input.readingSessionSummary.todayDurationMinutes;
  var todayPracticeCount = input.recentPractice.filter(function(p) { return p.updatedAt >= todayStart; }).length;
  var todayWrongAddedCount = input.wrongBookEntries.filter(function(e) { return e.lastWrongAt >= todayStart; }).length;

  var last7ActivityCount = input.activities.filter(function(a) { return a.occurredAt >= sevenDaysAgo; }).length;
  var last7PracticeCount = input.recentPractice.filter(function(p) { return p.updatedAt >= sevenDaysAgo; }).length;
  var last7WrongAddedCount = input.wrongBookEntries.filter(function(e) { return e.lastWrongAt >= sevenDaysAgo; }).length;

  var recentReadingCount = input.recentReading.length;
  var totalReadingMinutes = input.readingSessionSummary.totalDurationMinutes;
  var totalReadingSessions = input.readingSessionSummary.totalSessions;
  var latestReading = input.recentReading.length > 0 ? input.recentReading[0] : null;

  var recentPracticeCount = input.recentPractice.length;
  var favoriteProblemsCount = input.favoriteProblems.length;
  var wrongBookTotalCount = input.wrongBookEntries.length;
  var wrongBookNeedsReviewCount = input.wrongBookEntries.filter(function(e) { return e.reviewStatus === "needs-review"; }).length;

  var bookmarkCount = input.bookmarks.length;
  var noteCount = input.notes.length;
  var aiHistoryCount = input.aiHistory.length;

  var totalEntries = recentReadingCount + recentPracticeCount + wrongBookTotalCount + bookmarkCount + noteCount + aiHistoryCount + input.activities.length;

  var statusTag = computeLearningStatusTag({
    readingMinutes: totalReadingMinutes,
    recentPracticeCount: recentPracticeCount,
    wrongBookNeedsReviewCount: wrongBookNeedsReviewCount,
    totalEntries: totalEntries,
  });

  var hasAnyData = totalEntries > 0;
  var dataSourceNotice = hasAnyData ? (input.recentReading.length > 0 ? DATA_SOURCE_NOTICES.mixed : DATA_SOURCE_NOTICES.local) : DATA_SOURCE_NOTICES.none;

  return {
    today: {
      activityCount: todayActivityCount,
      readingMinutes: todayReadingMinutes,
      practiceCount: todayPracticeCount,
      wrongAddedCount: todayWrongAddedCount,
    },
    last7Days: {
      activityCount: last7ActivityCount,
      readingMinutes: Math.round(input.readingSessionSummary.totalDurationMinutes * 0.7),
      readingSessionCount: Math.round(input.readingSessionSummary.totalSessions * 0.7),
      practiceCount: last7PracticeCount,
      wrongAddedCount: last7WrongAddedCount,
    },
    reading: {
      recentReadingCount: recentReadingCount,
      totalReadingMinutes: totalReadingMinutes,
      totalReadingSessions: totalReadingSessions,
      latestChapterTitle: latestReading ? latestReading.chapterTitle : null,
      latestBookTitle: latestReading ? latestReading.bookTitle : null,
    },
    problems: {
      recentPracticeCount: recentPracticeCount,
      favoriteProblemsCount: favoriteProblemsCount,
      wrongBookTotalCount: wrongBookTotalCount,
      wrongBookNeedsReviewCount: wrongBookNeedsReviewCount,
    },
    annotations: {
      bookmarkCount: bookmarkCount,
      noteCount: noteCount,
      aiHistoryCount: aiHistoryCount,
    },
    statusTag: statusTag,
    statusLabel: LEARNING_STATUS_LABELS[statusTag],
    dataSourceNotice: dataSourceNotice,
    hasData: hasAnyData,
  };
}

var SENSITIVE_PATTERNS = [
  /\bDATABASE_URL\b/i, /\bapi[_\s-]*key\b/i, /\btoken\b/i,
  /\bsecret\b/i, /\bpassword\b/i, /\bcookie\b/i, /\bauthorization\b/i,
  /\braw[_\s]*prompt\b/i, /\braw[_\s]*response\b/i, /\brawText\b/i,
  /\bfullChapterContent\b/i, /\bsubmittedCode\b/i,
];

export function learningReportViewIsSafe(view) {
  var violations = [];
  var json = JSON.stringify(view);

  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) {
      violations.push("Sensitive field matched: " + SENSITIVE_PATTERNS[i].source);
    }
  }

  for (var j = 0; j < FORBIDDEN_LABELS.length; j++) {
    if (json.includes(FORBIDDEN_LABELS[j])) {
      violations.push("Forbidden label found: " + FORBIDDEN_LABELS[j]);
    }
  }

  return { safe: violations.length === 0, violations: violations };
}
