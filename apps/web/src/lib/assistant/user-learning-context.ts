import type {
  AssistantLearningContextSummary,
} from "./assistant-types.ts";

export async function buildAssistantLearningContext(input: {
  userId: string | null;
  displayName?: string | null;
}): Promise<AssistantLearningContextSummary> {
  const base = createEmptyAssistantLearningContext(input.displayName ?? null, !!input.userId);

  if (!input.userId) {
    return base;
  }

  try {
    const db = await import("@learning-agent-platform/db");
    const { hasDatabaseUrl, getPrismaClient } = db;
    if (!hasDatabaseUrl()) {
      return base;
    }

    const prisma = getPrismaClient();
    const learningRepo = new db.PrismaLearningRepository(prisma);
    const attemptRepo = new db.PrismaProblemAttemptRepository(prisma);
    const wrongBookRepo = new db.PrismaProblemWrongBookRepository(prisma);
    const articleRepo = new db.PrismaArticleRepository(prisma);
    const readingSessionRepo = new db.PrismaReadingSessionRepository(prisma);

    const [
      profileResult,
      attemptsResult,
      wrongBooksResult,
      articleReadingsResult,
      readingSessionsResult,
      readingSummaryResult,
    ] = await Promise.allSettled([
      learningRepo.getAbilityProfile(input.userId),
      attemptRepo.listRecentProblemAttemptsByUser(input.userId, 8),
      wrongBookRepo.listProblemWrongBookByOwner({ ownerId: input.userId, limit: 8 }),
      articleRepo.listArticleReadingsByOwner({ userId: input.userId, limit: 5 }),
      readingSessionRepo.listReadingSessionsByOwner({ userId: input.userId, limit: 4 }),
      readingSessionRepo.summarizeReadingSessionsByOwner(input.userId),
    ]);

    const profile = getSettledValue(profileResult, null);
    const attempts = getSettledValue(attemptsResult, []);
    const wrongBooks = getSettledValue(wrongBooksResult, []);
    const articleReadings = getSettledValue(articleReadingsResult, []);
    const readingSessions = getSettledValue(readingSessionsResult, []);
    const readingSummary = getSettledValue(readingSummaryResult, {
      totalSessions: 0,
      totalDurationSeconds: 0,
      totalDurationMinutes: 0,
    });

    const recentProblems = collectRecentProblemIds(attempts);
    const recentAttemptSummary = summarizeAttempts(attempts);
    const recentWrongBookSummary = summarizeWrongBooks(wrongBooks);
    const recentReadingSummary = summarizeRecentReadings(articleReadings, readingSessions, readingSummary);

    return {
      userLabel: input.displayName ?? input.userId,
      hasSession: true,
      abilityBand: profile ? formatAbilityBand(profile.overallScore) : undefined,
      currentLevel: profile ? formatAbilityBand(profile.overallScore) : undefined,
      recentPracticeCount: attempts.length,
      recentProblemIds: recentProblems,
      recentAttemptSummary,
      recentWrongBookSummary,
      recentReadingSummary,
      learningGoalSummary: buildGoalSummary(profile?.overallScore ?? null, attempts.length),
      recentRouteHint: recentProblems[0] ? `/problems/${recentProblems[0]}` : undefined,
    };
  } catch {
    return base;
  }
}

function getSettledValue<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export function createEmptyAssistantLearningContext(
  userLabel: string | null,
  hasSession: boolean,
): AssistantLearningContextSummary {
  return {
    userLabel: userLabel ?? undefined,
    hasSession,
    abilityBand: undefined,
    currentLevel: undefined,
    recentPracticeCount: 0,
    recentProblemIds: [],
    recentAttemptSummary: "",
    recentWrongBookSummary: "",
    recentReadingSummary: "",
    learningGoalSummary: "",
    recentRouteHint: undefined,
  };
}

export function mergeAssistantLearningContext(
  base: AssistantLearningContextSummary,
  override: AssistantLearningContextSummary | null | undefined,
): AssistantLearningContextSummary {
  if (!override) {
    return base;
  }

  const recentProblemIds = Array.from(
    new Set([
      ...(base.recentProblemIds ?? []),
      ...(override.recentProblemIds ?? []),
    ]),
  ).slice(0, 8);

  return {
    userLabel: base.userLabel ?? override.userLabel,
    hasSession: base.hasSession || override.hasSession,
    abilityBand: base.abilityBand ?? override.abilityBand,
    currentLevel: base.currentLevel ?? override.currentLevel,
    recentPracticeCount: base.recentPracticeCount > 0
      ? base.recentPracticeCount
      : override.recentPracticeCount,
    recentProblemIds,
    recentAttemptSummary: chooseSummaryText(base.recentAttemptSummary, override.recentAttemptSummary),
    recentWrongBookSummary: chooseSummaryText(base.recentWrongBookSummary, override.recentWrongBookSummary),
    recentReadingSummary: chooseSummaryText(base.recentReadingSummary, override.recentReadingSummary),
    learningGoalSummary: chooseSummaryText(base.learningGoalSummary, override.learningGoalSummary),
    recentRouteHint: base.recentRouteHint ?? override.recentRouteHint,
  };
}

function chooseSummaryText(baseText: string, overrideText: string): string {
  const baseNormalized = normalizeSummaryText(baseText);
  if (baseNormalized.length > 0 && !looksLikePlaceholderSummary(baseNormalized)) {
    return baseText;
  }

  const overrideNormalized = normalizeSummaryText(overrideText);
  if (overrideNormalized.length === 0 || looksLikePlaceholderSummary(overrideNormalized)) {
    return baseText;
  }

  return overrideText;
}

function collectRecentProblemIds(
  attempts: Array<{ problemId: string | null; externalProblemId: string | null }>,
): string[] {
  const ids = new Set<string>();
  for (const attempt of attempts) {
    const problemId = attempt.problemId ?? attempt.externalProblemId;
    if (problemId && problemId.trim().length > 0) {
      ids.add(problemId.trim());
    }
  }
  return Array.from(ids).slice(0, 5);
}

function normalizeSummaryText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function looksLikePlaceholderSummary(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes("暂无")
    || normalized.includes("未同步")
    || normalized.includes("未读取")
    || normalized.includes("没有")
    || normalized.includes("未发现");
}

function summarizeAttempts(
  attempts: Array<{
    problemId: string | null;
    problem?: { id: string; title: string } | null;
    correctness: string;
    topicTags: string[];
  }>,
): string {
  if (attempts.length === 0) {
    return "暂无最近练习记录";
  }

  const solved = attempts.filter((attempt) => attempt.correctness === "CORRECT").length;
  const failed = attempts.filter((attempt) => attempt.correctness === "INCORRECT" || attempt.correctness === "PARTIAL").length;
  const recentTitle = attempts[0]?.problem?.title ?? attempts[0]?.problemId ?? "未知题目";
  return `最近 ${attempts.length} 次练习，已解决 ${solved}，待加强 ${failed}，最近题目：${recentTitle}`;
}

function summarizeWrongBooks(
  wrongBooks: Array<{ problemTitle: string; wrongCount: number; tagsJson: string }>,
): string {
  if (wrongBooks.length === 0) {
    return "暂无错题记录";
  }

  const top = wrongBooks[0];
  return `错题本 ${wrongBooks.length} 条，最近问题：${top.problemTitle}（${top.wrongCount} 次）`;
}

export function summarizeRecentReadings(
  articleReadings: Array<{
    articleTitle: string;
    sourcePlatform: string;
    sourceName: string;
    originalUrl: string;
    lastReadAt: Date | string;
  }>,
  sessions: Array<{
    bookTitle: string;
    chapterTitle: string;
    durationSeconds: number;
    progressRatio: number;
  }>,
  summary: { totalSessions: number; totalDurationSeconds: number; totalDurationMinutes: number },
): string {
  const parts: string[] = [];

  if (articleReadings.length > 0) {
    const latestArticle = articleReadings[0];
    parts.push(`最近阅读 ${articleReadings.length} 篇文章，最近一篇是《${latestArticle.articleTitle}》`);
  }

  if (sessions.length > 0) {
    const latest = sessions[0];
    parts.push(`最近阅读 ${sessions.length} 个章节，最近一项是《${latest.bookTitle} / ${latest.chapterTitle}》`);
  } else if (summary.totalSessions > 0) {
    parts.push(`累计阅读 ${summary.totalSessions} 次，约 ${summary.totalDurationMinutes} 分钟`);
  }

  return parts.join("；");
}

function summarizeReadingSessions(
  sessions: Array<{
    bookTitle: string;
    chapterTitle: string;
    durationSeconds: number;
    progressRatio: number;
  }>,
  summary: { totalSessions: number; totalDurationSeconds: number; totalDurationMinutes: number },
): string {
  if (sessions.length === 0) {
    return summary.totalSessions > 0
      ? `累计阅读 ${summary.totalSessions} 次，约 ${summary.totalDurationMinutes} 分钟`
      : "暂无最近阅读记录";
  }

  const latest = sessions[0];
  return `最近阅读《${latest.bookTitle}》${latest.chapterTitle}，累计 ${summary.totalDurationMinutes} 分钟`;
}

function formatAbilityBand(score: number): string {
  if (score >= 80) return "advanced";
  if (score >= 55) return "intermediate";
  if (score >= 25) return "developing";
  return "starting";
}

function buildGoalSummary(score: number | null, recentPracticeCount: number): string {
  if (score === null) {
    return recentPracticeCount > 0
      ? `最近有 ${recentPracticeCount} 次练习，建议保持稳定练习频率`
      : "当前还没有设置可读的能力画像";
  }

  return `当前能力分 ${Math.round(score)}，最近 ${recentPracticeCount} 次练习`;
}
