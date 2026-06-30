import {
  getPrismaClient,
  PrismaArticleRepository,
  PrismaCodeforcesAccountRepository,
  type CodeforcesAccountRecord,
  type CodeforcesAccountStats,
  type CodeforcesRatingChangeRecord,
  type CodeforcesRecentSubmissionInput,
  type CodeforcesUserProblemStatRecord,
} from "@learning-agent-platform/db";

import { getCurrentAuthSession } from "../lib/session/web-auth-session";
import { loadArticleLibrary } from "./articles/article-library-loader";
import { collectLearningArtifactSummaries } from "../lib/assistant/learning-artifact-memory";
import {
  buildDbArticleFavoritesLoadResult,
  createEmptyDbArticleFavoritesLoadResult,
  type DbArticleFavoritesLoadResult,
} from "./user/article-favorites-db-view-model";
import {
  buildDbArticleRecentReadingLoadResult,
  createEmptyDbArticleRecentReadingLoadResult,
  type DbArticleRecentReadingLoadResult,
} from "./user/article-recent-reading-db-view-model";

export interface HomeDashboardData {
  userId: string;
  displayName: string;
  emailLabel: string | null;
  sessionMode: string;
  codeforces: {
    hasAccount: boolean;
    account: CodeforcesAccountRecord | null;
    stats: CodeforcesAccountStats | null;
    ratingHistory: CodeforcesRatingChangeRecord[];
    problemStats: CodeforcesUserProblemStatRecord[];
    recentSubmissions: CodeforcesRecentSubmissionInput[];
    heatmap: HeatmapDay[];
    ratingCurve: RatingPoint[];
    weakTags: WeakTagSummary[];
    lastSyncedLabel: string;
    sourceLabel: string;
  };
  todayTraining: TrainingTask[];
  reviewPlan: ReviewPlanSummary;
  reading: {
    latestArticles: HomeArticleTitle[];
    favorites: DbArticleFavoritesLoadResult;
    recentReadings: DbArticleRecentReadingLoadResult;
  };
  artifactSummaries: {
    learningReportSummary: string;
    reviewPlanSummary: string;
    recentCodeAnalysisSummary: string;
  };
}

export interface HeatmapDay {
  date: string;
  count: number;
  solved: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface RatingPoint {
  label: string;
  contestName: string;
  rank: number | null;
  rating: number;
  delta: number;
}

export interface WeakTagSummary {
  tag: string;
  attempted: number;
  solved: number;
  completionRate: number;
}

export interface TrainingTask {
  label: string;
  detail: string;
  href: string;
  status: string;
}

export interface ReviewPlanSummary {
  items: Array<{
    label: string;
    detail: string;
    href: string;
  }>;
  source: "learning-report" | "codeforces-data" | "empty";
}

export interface HomeArticleTitle {
  id: string;
  title: string;
  sourceName: string;
  href: string;
}

export async function loadHomeDashboardData(): Promise<HomeDashboardData | null> {
  const session = await getCurrentAuthSession();
  if (!session.hasSession) return null;

  const [latestArticles, favorites, recentReadings, codeforces, artifactSummaries] = await Promise.all([
    loadLatestArticleTitles(),
    loadHomeArticleFavorites(session.userId, session.displayName).catch(() =>
      createEmptyDbArticleFavoritesLoadResult(true, "首页文章收藏数据库快照读取失败。"),
    ),
    loadHomeArticleRecentReadings(session.userId, session.displayName).catch(() =>
      createEmptyDbArticleRecentReadingLoadResult(true, "首页最近阅读数据库快照读取失败。"),
    ),
    loadCodeforcesHomeData(session.userId).catch(() => createEmptyCodeforcesHomeData()),
    collectLearningArtifactSummaries(session.userId).catch(() => ({
      learningReportSummary: "",
      reviewPlanSummary: "",
      recentCodeAnalysisSummary: "",
    })),
  ]);

  const reviewPlan = buildReviewPlan(codeforces.problemStats, artifactSummaries.reviewPlanSummary);

  return {
    userId: session.userId,
    displayName: session.displayName,
    emailLabel: session.email,
    sessionMode: "database",
    codeforces,
    todayTraining: buildTrainingTasks(codeforces, reviewPlan, artifactSummaries.learningReportSummary),
    reviewPlan,
    reading: {
      latestArticles,
      favorites,
      recentReadings,
    },
    artifactSummaries,
  };
}

async function loadLatestArticleTitles(): Promise<HomeArticleTitle[]> {
  try {
    const articleLibrary = loadArticleLibrary();
    return articleLibrary.articles.slice(0, 5).map((article) => ({
      id: article.id,
      title: article.title,
      sourceName: article.sourceName || article.sourcePlatform,
      href: article.originalUrl || "/articles",
    }));
  } catch {
    return [];
  }
}

async function loadHomeArticleFavorites(userId: string, ownerLabel: string): Promise<DbArticleFavoritesLoadResult> {
  const prisma = getPrismaClient();
  const repository = new PrismaArticleRepository(prisma);
  const records = await repository.listFavoriteArticlesByOwner({
    userId,
    limit: 8,
  });
  return buildDbArticleFavoritesLoadResult(records, ownerLabel);
}

async function loadHomeArticleRecentReadings(
  userId: string,
  ownerLabel: string,
): Promise<DbArticleRecentReadingLoadResult> {
  const prisma = getPrismaClient();
  const repository = new PrismaArticleRepository(prisma);
  const records = await repository.listArticleReadingsByOwner({
    userId,
    limit: 8,
  });
  return buildDbArticleRecentReadingLoadResult(records, ownerLabel);
}

async function loadCodeforcesHomeData(userId: string): Promise<HomeDashboardData["codeforces"]> {
  const prisma = getPrismaClient();
  const repository = new PrismaCodeforcesAccountRepository(prisma);
  const account = await repository.getAccountByUserId(userId);
  if (!account) return createEmptyCodeforcesHomeData();

  const [stats, problemStats, ratingHistory, recentSubmissions] = await Promise.all([
    repository.getAccountStats(account.id),
    repository.getProblemStatsByAccount(account.id),
    repository.getRatingHistory(account.id),
    repository.getRecentSubmissions(account.id, 500),
  ]);

  return {
    hasAccount: true,
    account,
    stats,
    ratingHistory,
    problemStats,
    recentSubmissions,
    heatmap: buildSubmissionHeatmap(recentSubmissions),
    ratingCurve: buildRatingCurve(ratingHistory),
    weakTags: buildWeakTags(problemStats),
    lastSyncedLabel: formatRelativeDate(account.lastSyncedAt),
    sourceLabel: "Codeforces API 同步快照",
  };
}

function createEmptyCodeforcesHomeData(): HomeDashboardData["codeforces"] {
  return {
    hasAccount: false,
    account: null,
    stats: null,
    ratingHistory: [],
    problemStats: [],
    recentSubmissions: [],
    heatmap: buildSubmissionHeatmap([]),
    ratingCurve: [],
    weakTags: [],
    lastSyncedLabel: "未同步",
    sourceLabel: "未绑定 Codeforces",
  };
}

function buildSubmissionHeatmap(submissions: CodeforcesRecentSubmissionInput[]): HeatmapDay[] {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 55);

  const dayMap = new Map<string, { count: number; solved: number }>();
  for (const submission of submissions) {
    const date = new Date(submission.creationTimeSeconds * 1000);
    const key = date.toISOString().slice(0, 10);
    const entry = dayMap.get(key) ?? { count: 0, solved: 0 };
    entry.count += 1;
    if (submission.verdict === "OK") entry.solved += 1;
    dayMap.set(key, entry);
  }

  const days: HeatmapDay[] = [];
  for (let i = 0; i < 56; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    const entry = dayMap.get(key) ?? { count: 0, solved: 0 };
    days.push({
      date: key,
      count: entry.count,
      solved: entry.solved,
      level: heatLevel(entry.count),
    });
  }
  return days;
}

function heatLevel(count: number): HeatmapDay["level"] {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function buildRatingCurve(history: CodeforcesRatingChangeRecord[]): RatingPoint[] {
  return history.slice(-16).map((item) => ({
    label: `${item.ratingUpdateAt.getMonth() + 1}/${item.ratingUpdateAt.getDate()}`,
    contestName: item.contestName,
    rank: item.rank,
    rating: item.newRating,
    delta: item.newRating - item.oldRating,
  }));
}

function buildWeakTags(problemStats: CodeforcesUserProblemStatRecord[]): WeakTagSummary[] {
  const tagMap = new Map<string, { attempted: number; solved: number }>();
  for (const stat of problemStats) {
    for (const tag of stat.tags) {
      const entry = tagMap.get(tag) ?? { attempted: 0, solved: 0 };
      entry.attempted += 1;
      if (stat.accepted) entry.solved += 1;
      tagMap.set(tag, entry);
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, entry]) => ({
      tag,
      attempted: entry.attempted,
      solved: entry.solved,
      completionRate: entry.attempted > 0 ? entry.solved / entry.attempted : 0,
    }))
    .filter((item) => item.attempted >= 2)
    .sort((left, right) => left.completionRate - right.completionRate || right.attempted - left.attempted)
    .slice(0, 4);
}

function buildReviewPlan(
  problemStats: CodeforcesUserProblemStatRecord[],
  reviewPlanSummary: string,
): ReviewPlanSummary {
  const weakTags = buildWeakTags(problemStats);
  if (weakTags.length > 0) {
    return {
      source: reviewPlanSummary ? "learning-report" : "codeforces-data",
      items: weakTags.slice(0, 3).map((tag) => ({
        label: tag.tag,
        detail: `${tag.solved}/${tag.attempted} 已解决`,
        href: `/problems?tags=${encodeURIComponent(tag.tag)}`,
      })),
    };
  }

  return {
    source: reviewPlanSummary ? "learning-report" : "empty",
    items: [
      { label: "生成学习分析报告", detail: "补全今日训练", href: "/user" },
      { label: "同步 Codeforces 提交", detail: "刷新热力图", href: "/user" },
      { label: "收藏重点文章", detail: "形成复习材料", href: "/articles" },
    ],
  };
}

function buildTrainingTasks(
  codeforces: HomeDashboardData["codeforces"],
  reviewPlan: ReviewPlanSummary,
  learningReportSummary: string,
): TrainingTask[] {
  const firstWeakTag = reviewPlan.items[0];
  const solved = codeforces.stats?.solvedProblems ?? 0;
  const unfinished = codeforces.stats?.unfinishedProblems ?? 0;

  return [
    {
      label: firstWeakTag ? `复习 ${firstWeakTag.label}` : "生成学习分析",
      detail: firstWeakTag?.detail ?? (learningReportSummary ? "已有报告摘要" : "需要先生成报告"),
      href: firstWeakTag?.href ?? "/user",
      status: firstWeakTag ? "开始" : "生成",
    },
    {
      label: "进入题库训练",
      detail: solved > 0 ? `已解决 ${solved} 题` : "按 Rating 筛题",
      href: "/problems",
      status: "题库",
    },
    {
      label: "处理未完成题",
      detail: unfinished > 0 ? `${unfinished} 题待复盘` : "暂无未完成快照",
      href: "/user",
      status: "复盘",
    },
  ];
}

function formatRelativeDate(value: Date | null): string {
  if (!value) return "未同步";
  const diff = Date.now() - value.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`;
  if (diff < 86_400_000) return `${Math.max(1, Math.floor(diff / 3_600_000))} 小时前`;
  return value.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}
