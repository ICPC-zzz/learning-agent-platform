import type { PrismaClient } from "@prisma/client";
import type { CodeforcesAccountRepository } from "@learning-agent-platform/db";

import type { AssistantMemoryRecord } from "../assistant-types.ts";
import { listAssistantMemories } from "../memory-service.ts";
import {
  LEARNING_ARTIFACT_KIND_LEARNING_REPORT,
  artifactKindOfMemory,
  isReadonlyLearningArtifactMemory,
} from "../learning-artifact-classification.ts";
import {
  fetchCodeforcesContestList,
  type CfContestEntry,
} from "../../cf-contest-service.ts";
import {
  queryCodeforcesCandidatesForUser,
} from "../../codeforces-agent-candidates-user.ts";
import type {
  AgentCandidateProblemRecord,
  CodeforcesAgentCandidate,
} from "../../codeforces-agent-candidates.ts";
import {
  createAssistantProviderEnvSnapshot,
} from "../config/assistant-provider-config.ts";

export type CodeforcesAssistantIntent =
  | "contest_recommendation"
  | "problem_recommendation"
  | "training_plan"
  | "learning_report"
  | "review_plan"
  | "code_analysis"
  | "cf_profile_refresh"
  | "historical_user_contests";

export type TrainingProfileSource =
  | "learning_report"
  | "derived_estimate"
  | "official_rating"
  | "insufficient_data";

export interface LearnerTrainingProfile {
  officialRating: number | null;
  estimatedRealRating: number | null;
  effectiveTrainingRating: number | null;
  recommendedMinRating: number | null;
  recommendedMaxRating: number | null;
  weakTags: string[];
  confidence: number | null;
  source: TrainingProfileSource;
  generatedAt: string | null;
  handle: string | null;
  evidenceSummary: string;
  rejectedReportReason: string | null;
}

export interface LearningReportCandidate {
  content: string;
  generatedAt: string | null;
  updatedAt: string | null;
  handle: string | null;
  officialRating: number | null;
  estimatedRealRating: number | null;
  recommendedMinRating: number | null;
  recommendedMaxRating: number | null;
  weakTags: string[];
  confidence: number | null;
}

export interface PersonalizedCodeforcesCandidate {
  problemId: string;
  problemKey: string;
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  originalUrl: string;
  recommendationReason: string;
  candidateLevel: CandidateSelectionLevel;
  weakTagMatched: boolean;
  matchedWeakTags: string[];
  ratingDelta: number | null;
}

export type CandidateSelectionLevel =
  | "target_range_weak_tag"
  | "target_range_any_tag"
  | "expanded_range"
  | "nearest_rating";

interface StagedCandidate extends CodeforcesAgentCandidate {
  candidateLevel: CandidateSelectionLevel;
}

export interface PersonalizedCandidateResult {
  profile: LearnerTrainingProfile;
  candidates: PersonalizedCodeforcesCandidate[];
  totalAvailable: number;
  excludedCompletedCount: number;
  dataSource: "local_curated_codeforces_pool";
  warnings: string[];
}

export type UpcomingContestSource = "codeforces_api" | "fresh_cache" | "stale_cache";

export interface UpcomingCodeforcesContest {
  contestId: number;
  name: string;
  phase: string;
  startTime: string;
  startTimeSeconds: number;
  relativeStart: string;
  durationSeconds: number | null;
  officialUrl: string;
  fetchedAt: string;
  source: UpcomingContestSource;
}

export interface UpcomingContestResult {
  contests: UpcomingCodeforcesContest[];
  fetchedAt: string | null;
  source: UpcomingContestSource | "unavailable";
  warnings: string[];
  errorCode?: string;
  errorMessage?: string;
}

const DEFAULT_CANDIDATE_LIMIT = 5;
const MAX_CANDIDATE_LIMIT = 10;
const DEFAULT_CONTEST_LIMIT = 5;
const MAX_CONTEST_LIMIT = 10;
const MIN_RATING = 800;
const MAX_RATING = 3500;
const CONTEST_CACHE_TTL_MS = 10 * 60 * 1000;
const CONTEST_STALE_TTL_MS = 60 * 60 * 1000;
const REPORT_FUTURE_SKEW_MS = 5 * 60 * 1000;

let upcomingContestCache: {
  fetchedAt: string;
  contests: CfContestEntry[];
  expiresAtMs: number;
  staleUntilMs: number;
} | null = null;

export function classifyCodeforcesAssistantIntent(question: string): CodeforcesAssistantIntent | null {
  const normalized = normalizeText(question).toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  const mentionsCodeforces = /\bcodeforces\b|\bcf\b|codeforces|比赛|竞赛|刷题|题|题目|题单|训练|rating|真实水平/.test(normalized);
  if (!mentionsCodeforces) {
    return null;
  }

  const asksHistoricalContest = /(参加过|参赛记录|历史.*比赛|比赛历史|rating\s*history|contest\s*history|最近.*打过|最近.*参加过)/i
    .test(normalized);
  if (asksHistoricalContest) {
    return "historical_user_contests";
  }

  if (/(代码分析|分析.*代码|bug|复杂度|优化.*代码|code\s*analysis)/i.test(normalized)) {
    return "code_analysis";
  }

  if (/(复习计划|复习安排|错题复习|review\s*plan)/i.test(normalized)) {
    return "review_plan";
  }

  if (/(学习报告|学习分析|训练报告|learning\s*report)/i.test(normalized)) {
    return "learning_report";
  }

  if (/(刷新|同步|更新).*(codeforces|cf|数据|档案|profile)|cf_profile_refresh/i.test(normalized)) {
    return "cf_profile_refresh";
  }

  const contestIntent = /(比赛|竞赛|contest|round|div\.|div|cf赛|codeforces赛)/i.test(normalized);
  const upcomingIntent = /(最近|近期|下一场|下场|即将|未来|可以参加|能参加|有什么|安排|什么时候|开始)/i
    .test(normalized);
  const contestRecommendationIntent = contestIntent
    && /(推荐|适合我|最适合|我该|哪场|参加|报名)/i.test(normalized);
  if (contestRecommendationIntent || contestIntent && upcomingIntent) {
    return "contest_recommendation";
  }

  if (/(训练计划|学习计划|刷题计划|制定.*计划|build.*training.*plan)/i.test(normalized)) {
    return "training_plan";
  }

  const problemIntent = /(推荐.*题|题单|练什么题|几道题|候选题|problem\s*recommendation|personalized.*problem)/i
    .test(normalized);
  if (problemIntent) {
    return "problem_recommendation";
  }

  const trainingIntent = /(训练|练习|刷题|题目|题单|推荐|真实水平|适合我|薄弱|rating)/i.test(normalized)
    && /(推荐|练|刷|题|训练|真实水平|薄弱)/i.test(normalized);

  if (trainingIntent) {
    return "problem_recommendation";
  }

  return null;
}

export function extractRequestedProblemLimit(question: string): number {
  const match = normalizeText(question).match(/(\d{1,2})\s*(道|个)?\s*(题|problem)/i);
  if (!match) {
    return DEFAULT_CANDIDATE_LIMIT;
  }
  const parsed = Number.parseInt(match[1] ?? "", 10);
  return clampLimit(parsed, DEFAULT_CANDIDATE_LIMIT, MAX_CANDIDATE_LIMIT);
}

export function resolveLearnerTrainingProfileFromSources(input: {
  currentHandle?: string | null;
  officialRating?: number | null;
  reportCandidates?: readonly LearningReportCandidate[];
  derivedEstimate?: {
    estimatedRating: number | null;
    confidence: number | null;
    weakTags?: readonly string[];
    generatedAt?: string | null;
  } | null;
}): LearnerTrainingProfile {
  const officialRating = normalizeRating(input.officialRating);
  const latestReport = selectLatestValidReport(input.reportCandidates ?? [], input.currentHandle ?? null);
  if (latestReport.valid) {
    const report = latestReport.report;
    const reportOfficial = report.officialRating ?? officialRating;
    if (report.estimatedRealRating !== null) {
      const range = resolveTrainingRange(report.estimatedRealRating, report.recommendedMinRating, report.recommendedMaxRating);
      return {
        officialRating: reportOfficial,
        estimatedRealRating: report.estimatedRealRating,
        effectiveTrainingRating: report.estimatedRealRating,
        recommendedMinRating: range.min,
        recommendedMaxRating: range.max,
        weakTags: report.weakTags,
        confidence: report.confidence ?? 0.75,
        source: "learning_report",
        generatedAt: report.generatedAt ?? report.updatedAt,
        handle: report.handle ?? input.currentHandle ?? null,
        evidenceSummary: buildProfileEvidenceSummary(reportOfficial, report.estimatedRealRating, report.estimatedRealRating),
        rejectedReportReason: null,
      };
    }

    if (report.recommendedMinRating !== null && report.recommendedMaxRating !== null) {
      const effective = Math.round((report.recommendedMinRating + report.recommendedMaxRating) / 2);
      return {
        officialRating: reportOfficial,
        estimatedRealRating: null,
        effectiveTrainingRating: effective,
        recommendedMinRating: report.recommendedMinRating,
        recommendedMaxRating: report.recommendedMaxRating,
        weakTags: report.weakTags,
        confidence: report.confidence ?? 0.6,
        source: "learning_report",
        generatedAt: report.generatedAt ?? report.updatedAt,
        handle: report.handle ?? input.currentHandle ?? null,
        evidenceSummary: `最新学习报告提供训练区间 ${report.recommendedMinRating}-${report.recommendedMaxRating}，本次采用区间中点 ${effective}。`,
        rejectedReportReason: null,
      };
    }
  }

  const rejectedReportReason = latestReport.valid ? null : latestReport.reason;
  const derived = input.derivedEstimate ?? null;
  const derivedRating = normalizeRating(derived?.estimatedRating);
  if (derivedRating !== null) {
    const range = resolveTrainingRange(derivedRating, null, null);
    return {
      officialRating,
      estimatedRealRating: derivedRating,
      effectiveTrainingRating: derivedRating,
      recommendedMinRating: range.min,
      recommendedMaxRating: range.max,
      weakTags: normalizeTags(derived?.weakTags ?? []),
      confidence: normalizeConfidence(derived?.confidence),
      source: "derived_estimate",
      generatedAt: derived?.generatedAt ?? null,
      handle: input.currentHandle ?? null,
      evidenceSummary: buildProfileEvidenceSummary(officialRating, derivedRating, derivedRating),
      rejectedReportReason,
    };
  }

  if (officialRating !== null) {
    const range = resolveTrainingRange(officialRating, null, null);
    return {
      officialRating,
      estimatedRealRating: null,
      effectiveTrainingRating: officialRating,
      recommendedMinRating: range.min,
      recommendedMaxRating: range.max,
      weakTags: [],
      confidence: null,
      source: "official_rating",
      generatedAt: null,
      handle: input.currentHandle ?? null,
      evidenceSummary: `没有可用的学习报告预估，本次暂时回退到 Codeforces 官方 Rating ${officialRating}。`,
      rejectedReportReason,
    };
  }

  return {
    officialRating: null,
    estimatedRealRating: null,
    effectiveTrainingRating: null,
    recommendedMinRating: null,
    recommendedMaxRating: null,
    weakTags: [],
    confidence: null,
    source: "insufficient_data",
    generatedAt: null,
    handle: input.currentHandle ?? null,
    evidenceSummary: "当前没有可用的学习报告、真实水平估计或官方 Rating。",
    rejectedReportReason,
  };
}

export async function resolveLearnerTrainingProfile(input: {
  userId: string | null;
  signal?: AbortSignal;
}): Promise<LearnerTrainingProfile> {
  throwIfAborted(input.signal);
  if (!input.userId) {
    return resolveLearnerTrainingProfileFromSources({});
  }

  try {
    const db = await import("@learning-agent-platform/db");
    if (!db.hasDatabaseUrl()) {
      return resolveLearnerTrainingProfileFromSources({});
    }

    const prisma = db.getPrismaClient();
    const accountRepo = new db.PrismaCodeforcesAccountRepository(prisma);
    const account = await accountRepo.getAccountByUserId(input.userId);
    throwIfAborted(input.signal);
    const [memories, derived] = await Promise.all([
      listAssistantMemories(input.userId, { includeInternal: true }),
      loadDerivedEstimate(input.userId, accountRepo),
    ]);
    throwIfAborted(input.signal);

    return resolveLearnerTrainingProfileFromSources({
      currentHandle: account?.canonicalHandle ?? null,
      officialRating: account?.currentRating ?? null,
      reportCandidates: collectLearningReportCandidates(memories),
      derivedEstimate: derived,
    });
  } catch {
    return resolveLearnerTrainingProfileFromSources({});
  }
}

export async function getPersonalizedCodeforcesCandidates(input: {
  userId: string | null;
  profile?: LearnerTrainingProfile | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<PersonalizedCandidateResult> {
  throwIfAborted(input.signal);
  const profile = input.profile ?? await resolveLearnerTrainingProfile({ userId: input.userId, signal: input.signal });
  const warnings: string[] = [];
  if (!input.userId) {
    return {
      profile,
      candidates: [],
      totalAvailable: 0,
      excludedCompletedCount: 0,
      dataSource: "local_curated_codeforces_pool",
      warnings: ["需要可信服务端 userId，不能由客户端伪造用户身份。"],
    };
  }

  if (
    profile.effectiveTrainingRating === null
    || profile.recommendedMinRating === null
    || profile.recommendedMaxRating === null
  ) {
    return {
      profile,
      candidates: [],
      totalAvailable: 0,
      excludedCompletedCount: 0,
      dataSource: "local_curated_codeforces_pool",
      warnings: ["训练画像资料不足，无法安全生成个性化题单。"],
    };
  }

  try {
    const db = await import("@learning-agent-platform/db");
    if (!db.hasDatabaseUrl()) {
      return {
        profile,
        candidates: [],
        totalAvailable: 0,
        excludedCompletedCount: 0,
        dataSource: "local_curated_codeforces_pool",
        warnings: ["数据库不可用，无法读取本地精选 Codeforces 题池。"],
      };
    }

    const prisma = db.getPrismaClient() as PrismaClient;
    const accountRepo = new db.PrismaCodeforcesAccountRepository(prisma);
    const records = await loadLocalCodeforcesProblemRecords(prisma);
    if (records.length === 0) {
      return {
        profile,
        candidates: [],
        totalAvailable: 0,
        excludedCompletedCount: 0,
        dataSource: "local_curated_codeforces_pool",
        warnings: ["本地精选题库当前不可用。"],
      };
    }
    return selectPersonalizedCodeforcesCandidatesFromRecords({
      userId: input.userId,
      profile,
      records,
      accountRepo,
      limit: input.limit,
      signal: input.signal,
      warnings,
    });
  } catch {
    return {
      profile,
      candidates: [],
      totalAvailable: 0,
      excludedCompletedCount: 0,
      dataSource: "local_curated_codeforces_pool",
      warnings: ["题库数据加载失败，未返回虚构题目。"],
    };
  }
}

export async function selectPersonalizedCodeforcesCandidatesFromRecords(input: {
  userId: string;
  profile: LearnerTrainingProfile;
  records: readonly AgentCandidateProblemRecord[];
  accountRepo: CodeforcesAccountRepository;
  limit?: number;
  signal?: AbortSignal;
  warnings?: readonly string[];
}): Promise<PersonalizedCandidateResult> {
  const warnings = [...(input.warnings ?? [])];
  if (
    input.profile.effectiveTrainingRating === null
    || input.profile.recommendedMinRating === null
    || input.profile.recommendedMaxRating === null
  ) {
    return {
      profile: input.profile,
      candidates: [],
      totalAvailable: 0,
      excludedCompletedCount: 0,
      dataSource: "local_curated_codeforces_pool",
      warnings: ["训练画像资料不足，无法安全生成个性化题单。"],
    };
  }

  if (input.records.length === 0) {
    return {
      profile: input.profile,
      candidates: [],
      totalAvailable: 0,
      excludedCompletedCount: 0,
      dataSource: "local_curated_codeforces_pool",
      warnings: ["本地精选题库当前不可用。"],
    };
  }

  throwIfAborted(input.signal);
  const limit = clampLimit(input.limit ?? DEFAULT_CANDIDATE_LIMIT, DEFAULT_CANDIDATE_LIMIT, MAX_CANDIDATE_LIMIT);
  const queryLimit = Math.min(60, Math.max(limit * 6, 20));

  let candidates: StagedCandidate[] = [];
  let totalAvailable = 0;
  let excludedCompletedCount = 0;

  if (input.profile.weakTags.length > 0) {
    const primary = await queryCandidateStage({
      userId: input.userId,
      records: input.records,
      accountRepo: input.accountRepo,
      minRating: input.profile.recommendedMinRating,
      maxRating: input.profile.recommendedMaxRating,
      includeTags: input.profile.weakTags,
      preferredTags: input.profile.weakTags,
      targetRating: input.profile.effectiveTrainingRating,
      limit: queryLimit,
      level: "target_range_weak_tag",
    });
    throwIfAborted(input.signal);
    candidates = mergeStagedCandidateLists(candidates, primary.candidates);
    totalAvailable = Math.max(totalAvailable, primary.totalAvailable);
    excludedCompletedCount = Math.max(excludedCompletedCount, primary.excludedCompletedCount);
    if (primary.candidates.length === 0) {
      warnings.push("薄弱标签在目标 Rating 区间内没有足够题目，已继续使用同区间题目补足。");
    }
  }

  if (candidates.length < limit) {
    const sameRange = await queryCandidateStage({
      userId: input.userId,
      records: input.records,
      accountRepo: input.accountRepo,
      minRating: input.profile.recommendedMinRating,
      maxRating: input.profile.recommendedMaxRating,
      preferredTags: input.profile.weakTags,
      targetRating: input.profile.effectiveTrainingRating,
      limit: queryLimit,
      level: "target_range_any_tag",
    });
    throwIfAborted(input.signal);
    candidates = mergeStagedCandidateLists(candidates, sameRange.candidates);
    totalAvailable = Math.max(totalAvailable, sameRange.totalAvailable);
    excludedCompletedCount = Math.max(excludedCompletedCount, sameRange.excludedCompletedCount);
  }

  if (candidates.length < limit) {
    const expanded = await queryCandidateStage({
      userId: input.userId,
      records: input.records,
      accountRepo: input.accountRepo,
      minRating: clampRating(input.profile.recommendedMinRating - 100),
      maxRating: clampRating(input.profile.recommendedMaxRating + 100),
      preferredTags: input.profile.weakTags,
      targetRating: input.profile.effectiveTrainingRating,
      limit: queryLimit,
      level: "expanded_range",
    });
    throwIfAborted(input.signal);
    candidates = mergeStagedCandidateLists(candidates, expanded.candidates);
    totalAvailable = Math.max(totalAvailable, expanded.totalAvailable);
    excludedCompletedCount = Math.max(excludedCompletedCount, expanded.excludedCompletedCount);
    if (expanded.candidates.length > 0) {
      warnings.push("目标 Rating 区间候选不足，已向上下各放宽 100 Rating 补足。");
    }
  }

  if (candidates.length < limit) {
    const nearest = await queryCandidateStage({
      userId: input.userId,
      records: input.records,
      accountRepo: input.accountRepo,
      minRating: MIN_RATING,
      maxRating: MAX_RATING,
      preferredTags: input.profile.weakTags,
      targetRating: input.profile.effectiveTrainingRating,
      limit: queryLimit,
      level: "nearest_rating",
    });
    throwIfAborted(input.signal);
    candidates = mergeStagedCandidateLists(candidates, nearest.candidates);
    totalAvailable = Math.max(totalAvailable, nearest.totalAvailable);
    excludedCompletedCount = Math.max(excludedCompletedCount, nearest.excludedCompletedCount);
    if (nearest.candidates.length > 0) {
      warnings.push("放宽区间后仍不足，已从有效本地题池中选择最接近目标 Rating 的未完成题。");
    }
  }

  const selected = diversifyCandidates(candidates, input.profile.weakTags, limit)
    .map((candidate) => toPersonalizedCandidate(candidate, input.profile));

  return {
    profile: input.profile,
    candidates: selected,
    totalAvailable,
    excludedCompletedCount,
    dataSource: "local_curated_codeforces_pool",
    warnings,
  };
}

export async function getUpcomingCodeforcesContests(input: {
  limit?: number;
  nowMs?: number;
  env?: Record<string, string | undefined>;
  customFetch?: typeof fetch;
  signal?: AbortSignal;
} = {}): Promise<UpcomingContestResult> {
  throwIfAborted(input.signal);
  const nowMs = input.nowMs ?? Date.now();
  const limit = clampLimit(input.limit ?? DEFAULT_CONTEST_LIMIT, DEFAULT_CONTEST_LIMIT, MAX_CONTEST_LIMIT);

  if (!input.customFetch && upcomingContestCache && upcomingContestCache.expiresAtMs > nowMs) {
    return {
      contests: buildUpcomingContestItems(upcomingContestCache.contests, {
        nowMs,
        fetchedAt: upcomingContestCache.fetchedAt,
        source: "fresh_cache",
        limit,
      }),
      fetchedAt: upcomingContestCache.fetchedAt,
      source: "fresh_cache",
      warnings: [],
    };
  }

  const env = input.env ?? createAssistantProviderEnvSnapshot();
  const fetchedAt = new Date(nowMs).toISOString();
  const live = await fetchCodeforcesContestList(env, { customFetch: input.customFetch, signal: input.signal });
  throwIfAborted(input.signal);

  if (live.success && live.data) {
    if (!input.customFetch) {
      upcomingContestCache = {
        fetchedAt,
        contests: live.data,
        expiresAtMs: nowMs + CONTEST_CACHE_TTL_MS,
        staleUntilMs: nowMs + CONTEST_STALE_TTL_MS,
      };
    }

    return {
      contests: buildUpcomingContestItems(live.data, {
        nowMs,
        fetchedAt,
        source: "codeforces_api",
        limit,
      }),
      fetchedAt,
      source: "codeforces_api",
      warnings: [],
    };
  }

  if (!input.customFetch && upcomingContestCache && upcomingContestCache.staleUntilMs > nowMs) {
    return {
      contests: buildUpcomingContestItems(upcomingContestCache.contests, {
        nowMs,
        fetchedAt: upcomingContestCache.fetchedAt,
        source: "stale_cache",
        limit,
      }),
      fetchedAt: upcomingContestCache.fetchedAt,
      source: "stale_cache",
      warnings: ["Codeforces API 实时请求失败，已使用短期缓存并标记为 stale_cache。"],
      errorCode: live.error ?? "CF_API_FAILED",
      errorMessage: "Codeforces API 暂时不可用，使用缓存结果。",
    };
  }

  return {
    contests: [],
    fetchedAt: null,
    source: "unavailable",
    warnings: ["Codeforces API 请求失败，且没有可接受缓存；不会用历史参赛记录冒充未来比赛。"],
    errorCode: live.error ?? "CF_API_FAILED",
    errorMessage: "暂时无法获取 Codeforces 近期比赛。",
  };
}

export function buildUpcomingContestItems(
  contests: readonly CfContestEntry[],
  input: {
    nowMs: number;
    fetchedAt: string;
    source: UpcomingContestSource;
    limit?: number;
  },
): UpcomingCodeforcesContest[] {
  const limit = clampLimit(input.limit ?? DEFAULT_CONTEST_LIMIT, DEFAULT_CONTEST_LIMIT, MAX_CONTEST_LIMIT);
  return contests
    .filter((contest) => contest.phase === "BEFORE" && contest.startTimeSeconds * 1000 > input.nowMs)
    .sort((left, right) => left.startTimeSeconds - right.startTimeSeconds)
    .slice(0, limit)
    .map((contest) => ({
      contestId: contest.id,
      name: contest.name,
      phase: contest.phase,
      startTime: formatContestStartTime(contest.startTimeSeconds),
      startTimeSeconds: contest.startTimeSeconds,
      relativeStart: formatRelativeStart(contest.startTimeSeconds * 1000 - input.nowMs),
      durationSeconds: Number.isFinite(contest.durationSeconds) ? contest.durationSeconds : null,
      officialUrl: `https://codeforces.com/contest/${contest.id}`,
      fetchedAt: input.fetchedAt,
      source: input.source,
    }));
}

export function collectLearningReportCandidates(
  memories: readonly AssistantMemoryRecord[],
): LearningReportCandidate[] {
  return memories
    .filter((memory) =>
      artifactKindOfMemory(memory) === LEARNING_ARTIFACT_KIND_LEARNING_REPORT
      || (
        isReadonlyLearningArtifactMemory(memory)
        && memory.content.toLowerCase().startsWith("codeforces learning report")
      )
    )
    .map((memory) => parseLearningReportMemory(memory))
    .filter((report): report is LearningReportCandidate => report !== null);
}

export function resetUpcomingCodeforcesContestCacheForTests(): void {
  upcomingContestCache = null;
}

export function expireUpcomingCodeforcesContestCacheForTests(nowMs = Date.now()): void {
  if (!upcomingContestCache) {
    return;
  }
  upcomingContestCache = {
    ...upcomingContestCache,
    expiresAtMs: nowMs - 1,
  };
}

async function loadDerivedEstimate(
  userId: string,
  accountRepo: {
    getAccountByUserId(userId: string): Promise<{ id: string; currentRating: number | null; maxRating: number | null; lastOnlineAt: Date | null } | null>;
    getProblemStatsByAccount(accountId: string): Promise<Array<{
      problemKey: string;
      contestId: number;
      index: string;
      name: string;
      rating: number | null;
      tags: string[];
      attempts: number;
      accepted: boolean;
      firstAcceptedAt: Date | null;
      lastSubmittedAt: Date | null;
      lastVerdict: string | null;
    }>>;
    getRatingHistory(accountId: string): Promise<Array<{
      contestId: number;
      contestName: string;
      oldRating: number;
      newRating: number;
      ratingUpdateAt: Date;
    }>>;
  },
): Promise<{
  estimatedRating: number | null;
  confidence: number | null;
  weakTags: string[];
  generatedAt: string | null;
} | null> {
  const account = await accountRepo.getAccountByUserId(userId);
  if (!account) {
    return null;
  }
  const [stats, ratingHistory] = await Promise.all([
    accountRepo.getProblemStatsByAccount(account.id),
    accountRepo.getRatingHistory(account.id),
  ]);
  if (stats.length === 0) {
    return null;
  }

  const cfStats = stats.map((stat) => ({
    problemKey: stat.problemKey,
    contestId: stat.contestId,
    index: stat.index,
    name: stat.name,
    rating: stat.rating,
    tags: stat.tags,
    attempts: stat.attempts,
    accepted: stat.accepted,
    firstAcceptedAt: stat.firstAcceptedAt?.toISOString() ?? null,
    lastSubmittedAt: stat.lastSubmittedAt?.toISOString() ?? null,
    lastVerdict: stat.lastVerdict,
  }));
  const [{ estimateUserRating }, { computeWeakTags }] = await Promise.all([
    import("../../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-rating-estimator.ts"),
    import("../../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-wrongbook-review.ts"),
  ]);
  const estimate = estimateUserRating({
    currentRating: account.currentRating,
    maxRating: account.maxRating,
    ratingHistory: ratingHistory.map((entry) => ({
      contestId: entry.contestId,
      contestName: entry.contestName,
      oldRating: entry.oldRating,
      newRating: entry.newRating,
      ratingUpdateAt: entry.ratingUpdateAt.toISOString(),
    })),
    problemStats: cfStats,
    lastOnlineAt: account.lastOnlineAt?.toISOString() ?? null,
  });

  return {
    estimatedRating: estimate.estimatedRating,
    confidence: estimate.confidence,
    weakTags: computeWeakTags(cfStats).map((tag) => tag.tag),
    generatedAt: new Date().toISOString(),
  };
}

async function loadLocalCodeforcesProblemRecords(prisma: PrismaClient): Promise<AgentCandidateProblemRecord[]> {
  const problems = await prisma.problem.findMany({
    where: { source: "codeforces" },
    take: 2500,
    select: {
      id: true,
      title: true,
      source: true,
      sourceUrl: true,
      metadata: true,
      difficulty: true,
      tags: true,
    },
  });

  return problems.map((problem) => ({
    id: problem.id,
    title: problem.title,
    source: problem.source,
    sourceUrl: problem.sourceUrl,
    metadata: problem.metadata,
    difficulty: problem.difficulty,
    tags: Array.isArray(problem.tags) ? problem.tags.filter((tag): tag is string => typeof tag === "string") : [],
  }));
}

async function queryCandidateStage(input: {
  userId: string;
  records: readonly AgentCandidateProblemRecord[];
  accountRepo: CodeforcesAccountRepository;
  minRating: number;
  maxRating: number;
  includeTags?: readonly string[];
  preferredTags: readonly string[];
  targetRating: number;
  limit: number;
  level: CandidateSelectionLevel;
}): Promise<{
  candidates: StagedCandidate[];
  totalAvailable: number;
  excludedCompletedCount: number;
}> {
  const result = await queryCodeforcesCandidatesForUser(input.userId, input.records, {
    mode: "new_training",
    minRating: input.minRating,
    maxRating: input.maxRating,
    includeTags: input.includeTags ? [...input.includeTags] : undefined,
    preferredTags: [...input.preferredTags],
    targetRating: input.targetRating,
    limit: input.limit,
  }, input.accountRepo);

  return {
    candidates: result.candidates.map((candidate) => ({
      ...candidate,
      candidateLevel: input.level,
    })),
    totalAvailable: result.totalCandidates,
    excludedCompletedCount: result.querySummary.solvedKeysExcluded,
  };
}

function parseLearningReportMemory(memory: AssistantMemoryRecord): LearningReportCandidate | null {
  const content = memory.content.replace(/\s+/g, " ").trim();
  if (content.length === 0) {
    return null;
  }

  const metadata = normalizeRecord(memory.metadata);
  return {
    content,
    generatedAt: readString(metadata.generatedAt) ?? memory.updatedAt,
    updatedAt: memory.updatedAt,
    handle: readString(metadata.handle) ?? parseStringAfterLabel(content, "handle"),
    officialRating: parseNumberAfterLabel(content, "official"),
    estimatedRealRating: parseNumberAfterLabel(content, "estimated"),
    recommendedMinRating: parseTrainingRange(content)?.min ?? null,
    recommendedMaxRating: parseTrainingRange(content)?.max ?? null,
    weakTags: parseWeakTags(content),
    confidence: readNumber(metadata.confidence),
  };
}

function selectLatestValidReport(
  candidates: readonly LearningReportCandidate[],
  currentHandle: string | null,
): { valid: true; report: LearningReportCandidate } | { valid: false; reason: string | null } {
  const sorted = [...candidates].sort((left, right) =>
    reportTimestamp(right) - reportTimestamp(left),
  );
  let rejection: string | null = null;

  for (const report of sorted) {
    const validity = validateLearningReport(report, currentHandle);
    if (validity.valid) {
      return { valid: true, report };
    }
    rejection = validity.reason;
  }

  return { valid: false, reason: rejection };
}

function validateLearningReport(
  report: LearningReportCandidate,
  currentHandle: string | null,
): { valid: true } | { valid: false; reason: string } {
  const timestamp = reportTimestamp(report);
  if (timestamp <= 0) {
    return { valid: false, reason: "learning_report_invalid_generated_at" };
  }
  if (timestamp > Date.now() + REPORT_FUTURE_SKEW_MS) {
    return { valid: false, reason: "learning_report_generated_in_future" };
  }
  if (currentHandle && report.handle && normalizeHandle(currentHandle) !== normalizeHandle(report.handle)) {
    return { valid: false, reason: "learning_report_handle_mismatch" };
  }
  if (
    report.estimatedRealRating === null
    && (report.recommendedMinRating === null || report.recommendedMaxRating === null)
  ) {
    return { valid: false, reason: "learning_report_missing_rating_fields" };
  }
  return { valid: true };
}

function toPersonalizedCandidate(
  candidate: StagedCandidate,
  profile: LearnerTrainingProfile,
): PersonalizedCodeforcesCandidate {
  const weakMatches = matchWeakTags(candidate.tags, profile.weakTags);
  const ratingDelta = profile.effectiveTrainingRating !== null
    ? candidate.rating - profile.effectiveTrainingRating
    : null;
  const reasons = [
    candidateLevelReason(candidate.candidateLevel, candidate.rating, profile),
    ratingDelta !== null ? `与采用 Rating 差值 ${ratingDelta >= 0 ? "+" : ""}${ratingDelta}` : "",
    weakMatches.length > 0 ? `命中薄弱标签 ${weakMatches.join(", ")}` : "用于补足同区间训练题，避免题单过窄",
  ].filter((item) => item.length > 0);

  return {
    problemId: candidate.problemId,
    problemKey: candidate.problemKey,
    contestId: candidate.contestId,
    index: candidate.index,
    name: candidate.name,
    rating: candidate.rating,
    tags: candidate.tags,
    originalUrl: candidate.originalUrl || `https://codeforces.com/problemset/problem/${candidate.contestId}/${encodeURIComponent(candidate.index)}`,
    recommendationReason: reasons.join("；"),
    candidateLevel: candidate.candidateLevel,
    weakTagMatched: weakMatches.length > 0,
    matchedWeakTags: weakMatches,
    ratingDelta,
  };
}

function candidateLevelReason(
  level: CandidateSelectionLevel,
  rating: number,
  profile: LearnerTrainingProfile,
): string {
  switch (level) {
    case "target_range_weak_tag":
      return `Rating ${rating} 位于 ${profile.recommendedMinRating}-${profile.recommendedMaxRating} 训练区间，并优先匹配薄弱标签`;
    case "target_range_any_tag":
      return `Rating ${rating} 位于 ${profile.recommendedMinRating}-${profile.recommendedMaxRating} 训练区间，用于补足同区间训练`;
    case "expanded_range":
      return `Rating ${rating} 来自目标区间上下各放宽 100 的补充候选`;
    case "nearest_rating":
      return `Rating ${rating} 是当前有效题池中接近目标 Rating 的未完成题`;
  }
}

function diversifyCandidates(
  candidates: readonly StagedCandidate[],
  weakTags: readonly string[],
  limit: number,
): StagedCandidate[] {
  const selected: StagedCandidate[] = [];
  const usedKeys = new Set<string>();
  const tagCounts = new Map<string, number>();
  const normalizedWeakTags = normalizeTags(weakTags);

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }
    if (usedKeys.has(candidate.problemKey)) {
      continue;
    }
    const primaryTag = matchWeakTags(candidate.tags, normalizedWeakTags)[0] ?? candidate.tags[0] ?? "untagged";
    const current = tagCounts.get(primaryTag) ?? 0;
    if (current >= 2 && selected.length + remainingUnique(candidates, usedKeys) > limit) {
      continue;
    }
    selected.push(candidate);
    usedKeys.add(candidate.problemKey);
    tagCounts.set(primaryTag, current + 1);
  }

  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }
    if (usedKeys.has(candidate.problemKey)) {
      continue;
    }
    selected.push(candidate);
    usedKeys.add(candidate.problemKey);
  }

  return selected;
}

function mergeStagedCandidateLists(
  primary: readonly StagedCandidate[],
  fallback: readonly StagedCandidate[],
): StagedCandidate[] {
  const seen = new Set<string>();
  const merged: StagedCandidate[] = [];
  for (const candidate of [...primary, ...fallback]) {
    if (seen.has(candidate.problemKey)) {
      continue;
    }
    seen.add(candidate.problemKey);
    merged.push(candidate);
  }
  return merged;
}

function remainingUnique(candidates: readonly StagedCandidate[], usedKeys: ReadonlySet<string>): number {
  let count = 0;
  for (const candidate of candidates) {
    if (!usedKeys.has(candidate.problemKey)) {
      count += 1;
    }
  }
  return count;
}

function matchWeakTags(tags: readonly string[], weakTags: readonly string[]): string[] {
  const normalized = new Set(tags.map((tag) => tag.toLowerCase()));
  return normalizeTags(weakTags).filter((tag) => normalized.has(tag.toLowerCase()));
}

function resolveTrainingRange(
  baseRating: number,
  reportMin: number | null,
  reportMax: number | null,
): { min: number; max: number } {
  if (reportMin !== null && reportMax !== null && reportMin <= reportMax) {
    return {
      min: clampRating(reportMin),
      max: clampRating(reportMax),
    };
  }

  return {
    min: clampRating(baseRating - 100),
    max: clampRating(baseRating + 150),
  };
}

function buildProfileEvidenceSummary(
  officialRating: number | null,
  estimatedRealRating: number | null,
  effectiveRating: number | null,
): string {
  if (officialRating !== null && estimatedRealRating !== null && effectiveRating !== null) {
    return `你的 Codeforces 官方 Rating 是 ${officialRating}，但最近学习分析估计当前真实水平约为 ${estimatedRealRating}，因此本次训练建议以 ${effectiveRating} 为主要依据。`;
  }
  if (estimatedRealRating !== null && effectiveRating !== null) {
    return `最近学习分析估计当前真实水平约为 ${estimatedRealRating}，因此本次训练建议以 ${effectiveRating} 为主要依据。`;
  }
  return "训练画像依据不足。";
}

function reportTimestamp(report: LearningReportCandidate): number {
  const value = report.generatedAt ?? report.updatedAt;
  if (!value) {
    return 0;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function parseStringAfterLabel(content: string, label: string): string | null {
  const pattern = new RegExp(`${label}\\s+([^;]+)`, "i");
  const match = content.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function parseNumberAfterLabel(content: string, label: string): number | null {
  const value = parseStringAfterLabel(content, label);
  if (!value) {
    return null;
  }
  const match = value.match(/\d{2,4}/);
  if (!match) {
    return null;
  }
  return normalizeRating(Number.parseInt(match[0] ?? "", 10));
}

function parseTrainingRange(content: string): { min: number; max: number } | null {
  const match = content.match(/training\s+(\d{2,4})\s*[-~]\s*(\d{2,4})/i);
  if (!match) {
    return null;
  }
  const min = normalizeRating(Number.parseInt(match[1] ?? "", 10));
  const max = normalizeRating(Number.parseInt(match[2] ?? "", 10));
  return min !== null && max !== null && min <= max ? { min, max } : null;
}

function parseWeakTags(content: string): string[] {
  const match = content.match(/weak tags\s+([^;]+)/i);
  if (!match) {
    return [];
  }
  return normalizeTags((match[1] ?? "").split(","));
}

function formatContestStartTime(startTimeSeconds: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(startTimeSeconds * 1000));
}

function formatRelativeStart(deltaMs: number): string {
  if (deltaMs <= 0) {
    return "已经开始";
  }
  const totalMinutes = Math.ceil(deltaMs / 60_000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes - days * 24 * 60) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) {
    return `${days}天${hours}小时后`;
  }
  if (hours > 0) {
    return `${hours}小时${minutes}分钟后`;
  }
  return `${minutes}分钟后`;
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded > 0 ? clampRating(rounded) : null;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = String(tag ?? "").trim().toLowerCase();
    if (normalized.length === 0 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result.slice(0, 8);
}

function normalizeHandle(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) {
    return;
  }
  const reason = signal.reason;
  if (reason instanceof Error) {
    throw reason;
  }
  throw new DOMException("Operation aborted.", "AbortError");
}

function clampRating(value: number): number {
  return Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(value)));
}

function clampLimit(value: number, fallback: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.trunc(value)));
}
