// Self-contained today plan VM (no cross-directory TS imports for testability)

var DATA_SOURCE_NOTICE = "rules today plan . no LLM . dev preview . local fallback . no production account";

var FORBIDDEN_LABELS = [
  "AI plan", "LLM generated", "production plan", "real learning plan", "AI auto planned",
];

var SENSITIVE_PATTERNS = [
  /\bDATABASE_URL\b/i, /\bapi_.*key\b/i, /\btoken\b/i,
  /\bsecret\b/i, /\bpassword\b/i, /\bcookie\b/i, /\bauthorization\b/i,
  /\braw.*prompt\b/i, /\braw.*response\b/i, /\brawText\b/i,
  /\bfullChapterContent\b/i, /\bsubmittedCode\b/i,
];

var MAX_NOTE_TEXT = 1000;
var MAX_TASKS = 5;

interface TodayPlanProblemEntry {
  problemId: string;
  title: string;
  difficulty: string;
  reviewStatus?: string;
}

interface TodayPlanReadingEntry {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  progressRatio: number;
}

interface TodayPlanNoteEntry {
  noteId: string;
  bookTitle: string;
}

interface TodayPlanAiHistoryEntry {
  bookTitle: string;
  chapterTitle: string;
  questionPreview: string;
  chapterId: string;
}

interface TodayPlanInput {
  hasSession: boolean;
  wrongBookEntries?: TodayPlanProblemEntry[];
  recentReading?: TodayPlanReadingEntry[];
  readingSessionSummary?: {
    totalSessions: number;
    totalDurationMinutes: number;
    todayDurationMinutes: number;
  };
  recentPractice?: unknown[];
  notes?: TodayPlanNoteEntry[];
  aiHistory?: TodayPlanAiHistoryEntry[];
  favoriteProblems?: TodayPlanProblemEntry[];
  hasDailyChallenge?: boolean;
  dailyChallengeTitle?: string | null;
}

interface TodayPlanTask {
  taskId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  targetType: "problem" | "chapter" | "book" | "note";
  targetId: string;
  targetLink: string;
  status: "todo" | "suggested";
  reason: string;
  devOnlyLabel: string;
}

interface TodayPlanView {
  tasks: TodayPlanTask[];
  totalTasks: number;
  totalEstimatedMinutes: number;
  dataSourceNotice: string;
  hasSession: boolean;
  message: string;
}

function sanitizeTitle(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "unknown";
  return raw.trim().slice(0, maxLen);
}

var _taskIdCounter = 0;
function nextTaskId() {
  _taskIdCounter++;
  return "task-" + Date.now().toString(36) + "-" + _taskIdCounter;
}

function generateTodayPlan(params: Required<TodayPlanInput>): TodayPlanTask[] {
  var tasks: TodayPlanTask[] = [];

  // Task 1: Review wrong book entries
  var needsReview = params.wrongBookEntries.filter(function(e) { return e.reviewStatus === "needs-review"; }).slice(0, 2);
  if (needsReview.length > 0) {
    var titles = needsReview.map(function(e) { return sanitizeTitle(e.title, 30); }).join(", ");
    tasks.push({
      taskId: nextTaskId(),
      title: "Review " + needsReview.length + " wrong book entries",
      description: "Wrong book needs review: " + titles + ". Go to wrong book to review.",
      estimatedMinutes: needsReview.length * 5,
      targetType: "problem",
      targetId: needsReview[0].problemId,
      targetLink: "/user/wrong-book",
      status: "todo",
      reason: needsReview.length + " wrong book entries marked needs-review",
      devOnlyLabel: "dev preview . rules . no LLM",
    });
  }

  // Task 2: Daily Challenge (A399)
  if (params.hasDailyChallenge) {
    var dcTitle = params.dailyChallengeTitle || "Daily Challenge Problem";
    tasks.push({
      taskId: nextTaskId(),
      title: "Complete daily challenge: " + sanitizeTitle(dcTitle, 30),
      description: "Go to daily challenge page for today's recommended problem. Deterministic rules, no LLM.",
      estimatedMinutes: 10,
      targetType: "problem",
      targetId: "",
      targetLink: "/daily-challenge",
      status: "todo",
      reason: "Daily challenge (A399 rules engine)",
      devOnlyLabel: "dev preview . rules engine . no LLM . no judge",
    });
  }

  // Task 3: Continue reading
  var latestReading = params.recentReading.length > 0 ? params.recentReading[0] : null;
  if (latestReading && latestReading.progressRatio < 1.0) {
    tasks.push({
      taskId: nextTaskId(),
      title: "Continue reading: " + sanitizeTitle(latestReading.chapterTitle, 30),
      description: "Continue reading " + sanitizeTitle(latestReading.bookTitle, 30) + " chapter " + sanitizeTitle(latestReading.chapterTitle, 30) + ", progress " + Math.round(latestReading.progressRatio * 100) + "%.",
      estimatedMinutes: 15,
      targetType: "chapter",
      targetId: latestReading.chapterId,
      targetLink: "/reader?bookId=" + encodeURIComponent(latestReading.bookId) + "&chapterId=" + encodeURIComponent(latestReading.chapterId),
      status: "suggested",
      reason: "Recent reading not completed",
      devOnlyLabel: "dev preview . rules . no LLM",
    });
  } else if (latestReading) {
    tasks.push({
      taskId: nextTaskId(),
      title: "Continue reading " + sanitizeTitle(latestReading.bookTitle, 30),
      description: "Completed current chapter, keep reading habit (suggest 15 min).",
      estimatedMinutes: 15,
      targetType: "book",
      targetId: latestReading.bookId,
      targetLink: "/reader?bookId=" + encodeURIComponent(latestReading.bookId),
      status: "suggested",
      reason: "Keep daily reading habit",
      devOnlyLabel: "dev preview . rules . no LLM",
    });
  } else {
    tasks.push({
      taskId: nextTaskId(),
      title: "Start reading 15 minutes",
      description: "Go to books library and pick a book to start reading. Suggest 15+ min daily reading.",
      estimatedMinutes: 15,
      targetType: "book",
      targetId: "",
      targetLink: "/books",
      status: "suggested",
      reason: "No reading records, suggest starting",
      devOnlyLabel: "dev preview . rules . no LLM",
    });
  }

  // Task 4: Review a note
  if (params.notes.length > 0) {
    var latestNote = params.notes[0];
    tasks.push({
      taskId: nextTaskId(),
      title: "Review 1 reading note",
      description: "Review note from " + sanitizeTitle(latestNote.bookTitle, 30) + " to reinforce memory.",
      estimatedMinutes: 5,
      targetType: "note",
      targetId: latestNote.noteId,
      targetLink: "/user/notes",
      status: "suggested",
      reason: "Has reading notes available for review",
      devOnlyLabel: "dev preview . rules . no LLM",
    });
  }

  // Task 5: Do a favorite problem
  if (params.favoriteProblems.length > 0 && tasks.length < 4) {
    var fav = params.favoriteProblems[0];
    tasks.push({
      taskId: nextTaskId(),
      title: "Do 1 favorite problem",
      description: "Practice favorite problem: " + sanitizeTitle(fav.title, 30) + " (" + fav.difficulty + ").",
      estimatedMinutes: 8,
      targetType: "problem",
      targetId: fav.problemId,
      targetLink: "/problems/" + fav.problemId,
      status: "suggested",
      reason: "Has favorite problems to practice",
      devOnlyLabel: "dev preview . rules . no LLM",
    });
  }

  // Task 6: Review AI history
  if (params.aiHistory.length > 0 && tasks.length < 5) {
    var latestAi = params.aiHistory[0];
    tasks.push({
      taskId: nextTaskId(),
      title: "Review 1 AI Q&A history",
      description: "Review AI Q&A: " + sanitizeTitle(latestAi.bookTitle, 30) + " . " + sanitizeTitle(latestAi.chapterTitle, 30) + " - " + sanitizeTitle(latestAi.questionPreview, 50),
      estimatedMinutes: 5,
      targetType: "chapter",
      targetId: latestAi.chapterId,
      targetLink: "/user/ai-history",
      status: "suggested",
      reason: "AI Q&A history available for review",
      devOnlyLabel: "dev preview . rules . no LLM",
    });
  }

  return tasks;
}

function capTasks(tasks: TodayPlanTask[], maxTasks: number): TodayPlanTask[] {
  if (tasks.length <= maxTasks) return tasks;
  var dcTask = null;
  var nonDcTasks = [];
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].targetLink === "/daily-challenge") {
      dcTask = tasks[i];
    } else {
      nonDcTasks.push(tasks[i]);
    }
  }
  var result = [];
  if (dcTask !== null) {
    result.push(dcTask);
    var limit = maxTasks - 1;
  } else {
    var limit = maxTasks;
  }
  for (var j = 0; j < nonDcTasks.length && result.length < maxTasks; j++) {
    result.push(nonDcTasks[j]);
  }
  return result;
}

function todayPlanTasksAreSafe(tasks: TodayPlanTask[]): { safe: boolean; violations: string[] } {
  var violations: string[] = [];
  var json = JSON.stringify(tasks);

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

  for (var k = 0; k < tasks.length; k++) {
    var t = tasks[k];
    if (!t.devOnlyLabel || t.devOnlyLabel.length === 0) {
      violations.push("Task " + t.taskId + " missing dev-only label");
    }
    if (t.estimatedMinutes <= 0 || t.estimatedMinutes > 120) {
      violations.push("Task " + t.taskId + " unreasonable estimate: " + t.estimatedMinutes);
    }
  }

  return { safe: violations.length === 0, violations: violations };
}

export function buildTodayPlanView(input: TodayPlanInput): TodayPlanView {
  var hasSession = input.hasSession;
  var tasks = hasSession ? generateTodayPlan({
    hasSession: input.hasSession,
    wrongBookEntries: input.wrongBookEntries || [],
    recentReading: input.recentReading || [],
    readingSessionSummary: input.readingSessionSummary || { totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 },
    recentPractice: input.recentPractice || [],
    notes: input.notes || [],
    aiHistory: input.aiHistory || [],
    favoriteProblems: input.favoriteProblems || [],
    hasDailyChallenge: input.hasDailyChallenge || false,
    dailyChallengeTitle: input.dailyChallengeTitle || null,
  }) : [];

  var cappedTasks = capTasks(tasks, MAX_TASKS);

  var safetyCheck = todayPlanTasksAreSafe(cappedTasks);
  var safeTasks = safetyCheck.safe ? cappedTasks : cappedTasks.filter(function(t: TodayPlanTask) { return t.devOnlyLabel && t.devOnlyLabel.length > 0; });

  var totalEstimatedMinutes = safeTasks.reduce(function(sum: number, t: TodayPlanTask) { return sum + t.estimatedMinutes; }, 0);

  var message = safeTasks.length > 0
    ? "Today: " + safeTasks.length + " suggested tasks, estimated " + totalEstimatedMinutes + " min (rules engine)"
    : hasSession
      ? "Not enough data to generate today plan."
      : "Please login with dev session first.";

  return {
    tasks: safeTasks,
    totalTasks: safeTasks.length,
    totalEstimatedMinutes: totalEstimatedMinutes,
    dataSourceNotice: DATA_SOURCE_NOTICE,
    hasSession: hasSession,
    message: message,
  };
}

export function todayPlanViewIsSafe(view: TodayPlanView): { safe: boolean; violations: string[] } {
  var violations: string[] = [];
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

  var taskSafety = todayPlanTasksAreSafe(view.tasks);
  violations.push.apply(violations, taskSafety.violations);

  return { safe: violations.length === 0, violations: violations };
}
