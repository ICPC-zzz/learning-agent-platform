"use server";

/**
 * A489 v3 — CF Learning Analysis Server Action
 *
 * Pipeline: load data → estimateRating → zones → weakTags → reviewPlan → contest
 * Fully backward-compatible with CfLearningReport.tsx (A488 fields).
 *
 * SHARED CACHE: Uses cf-computation-cache to share rating/weak-tags/review-plan
 * computations with /ai code analysis. Same user, same data, no double compute.
 *
 * @serverOnly
 */

import { cookies } from "next/headers";
import { deserializeDevSession, getSafeSessionSummary } from "../../lib/web-auth-dev-session";
import {
  getPrismaClient,
  PrismaCodeforcesAccountRepository,
} from "@learning-agent-platform/db";
import { getCodeforcesUserAnalysisSnapshot } from "../../lib/codeforces-agent-snapshot";
import { queryCodeforcesCandidatesForUser } from "../../lib/codeforces-agent-candidates-user";
import type { AgentCandidateProblemRecord } from "../../lib/codeforces-agent-candidates";
import { getCachedComputation } from "../../lib/cf-computation-cache.ts";
import type { RatingEstimate } from "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-rating-estimator.ts";
import type {
  CodeforcesAgentCandidate as TrainingPlanCandidate,
  RecommendationEntry,
} from "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-training-plan.ts";

function isFeatureEnabled() { return process.env.ENABLE_CF_LEARNING_AGENT === "true"; }

export interface CfLearningAgentActionOutput {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  runId?: string;
  report?: Record<string, unknown>;
  safeEvents?: Array<{ type: string; sequence: number; timestamp: string; message: string }>;
}

export async function generateCfLearningAnalysis(
  targetRating?: number | null,
): Promise<CfLearningAgentActionOutput> {
  if (!isFeatureEnabled()) return { success: false, errorCode: "FEATURE_DISABLED", errorMessage: "学习分析功能尚未启用" };

  let userId: string | null = null;
  try {
    const ck = await cookies();
    userId = getSafeSessionSummary(deserializeDevSession(ck.get("lap-web-dev-session")?.value)).user?.userIdPreview ?? null;
  } catch {}

  if (!userId) return { success: false, errorCode: "NOT_LOGGED_IN", errorMessage: "请先登录" };

  const prisma = getPrismaClient();
  const repo = new PrismaCodeforcesAccountRepository(prisma);
  const account = await repo.getAccountByUserId(userId);
  if (!account) return { success: false, errorCode: "CF_NOT_BOUND", errorMessage: "尚未绑定 Codeforces 账号" };

  const accountStats = await repo.getAccountStats(account.id);
  if (!accountStats || accountStats.totalSubmissions === 0) {
    return { success: false, errorCode: "CF_NOT_SYNCED", errorMessage: "请先同步 Codeforces 数据" };
  }

  try {
    const runId = `run_cf_${Date.now()}`;
    const events: NonNullable<CfLearningAgentActionOutput["safeEvents"]> = [];
    let seq = 0;
    function emit(t: string, m: string) { seq++; events.push({ type: t, sequence: seq, timestamp: new Date().toISOString().slice(11, 19), message: m }); }

    emit("run.started", "正在加载数据...");

    // 1. Load all data
    emit("agent.progress", "正在读取Codeforces数据...");
    const snapshot = await getCodeforcesUserAnalysisSnapshot(account.id, userId, repo);
    if (!snapshot) return { success: false, errorCode: "SNAPSHOT_NOT_FOUND", errorMessage: "未找到数据" };

    const problemStats = await repo.getProblemStatsByAccount(account.id);
    const ratingHistory = await repo.getRatingHistory(account.id);

    // 2. Estimate rating (UNIFIED) — check shared cache first
    // Always build cfProblemStats first (needed later for weak tags + review plan)
    const cfProblemStats = problemStats.map((s) => ({
      problemKey: s.problemKey, contestId: s.contestId, index: s.index,
      name: s.name, rating: s.rating, tags: [...s.tags],
      attempts: s.attempts, accepted: s.accepted,
      firstAcceptedAt: s.firstAcceptedAt?.toISOString() ?? null,
      lastSubmittedAt: s.lastSubmittedAt?.toISOString() ?? null,
      lastVerdict: s.lastVerdict,
    }));

    emit("agent.progress", "正在计算预估Rating...");
    var cachedRating = getCachedComputation<Record<string, unknown>>(userId, "estimated-rating");
    var estimate: RatingEstimate;
    if (cachedRating) {
      emit("agent.progress", "Rating 命中共享缓存，跳过重复计算");
      const estimatedRating = readFiniteNumber(cachedRating.estimatedRating, 800);
      const currentRating = readFiniteNumber(cachedRating.currentOfficialRating, 0);
      const maxRating = readFiniteNumber(cachedRating.maxOfficialRating, currentRating);
      estimate = {
        estimatedRating,
        currentRating,
        maxRating,
        ratingDelta: estimatedRating - currentRating,
        confidence: readFiniteNumber(cachedRating.confidence, 0.3),
        modelType: cachedRating.source === "official_and_practice" ? "rated" : "unrated",
        historyAnchor: currentRating > 0 ? currentRating : null,
        practiceSignal: estimatedRating,
        trendBonus: 0,
        inactivityDecay: 0,
        ratedSolvedCount: 0,
        recentRatedSolvedCount: 0,
        evidence: {
          p65: null,
          p80: null,
          p95: null,
          hardSolveCount: 0,
          tagBreadth: 0,
          lastMeaningfulActivity: null,
        },
        explanationItems: Array.isArray(cachedRating.basis)
          ? cachedRating.basis.filter((item): item is string => typeof item === "string")
          : [],
      };
    } else {
      const { estimateUserRating } = await import(
        "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-rating-estimator.ts"
      );

      estimate = estimateUserRating({
        currentRating: account.currentRating,
        maxRating: account.maxRating,
        ratingHistory: ratingHistory.map((r) => ({
          contestId: r.contestId, contestName: r.contestName,
          newRating: r.newRating, oldRating: r.oldRating,
          ratingUpdateAt: r.ratingUpdateAt.toISOString(),
        })),
        problemStats: cfProblemStats,
        lastOnlineAt: account.lastOnlineAt?.toISOString() ?? null,
      });
    }

    // 3. Compute zones, weak tags, review plan
    emit("agent.progress", "正在分析复习区间和薄弱标签...");
    const { computeRatingZones, computeWeakTags, generateReviewPlan, buildReviewReport } = await import(
      "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-wrongbook-review.ts"
    );
    const isUnrated = estimate.modelType === "unrated";
    const zones = computeRatingZones(estimate.estimatedRating, isUnrated);
    const v3WeakTags = computeWeakTags(cfProblemStats);

    // Load local pool
    emit("agent.progress", "正在筛选本地题目...");
    const problems = await prisma.problem.findMany({
      where: { source: "codeforces" },
      select: { id: true, title: true, source: true, sourceUrl: true, metadata: true, tags: true },
    });
    const localPool: Array<{ problemKey: string; problemId: string; name: string; rating: number | null; tags: string[]; originalUrl: string }> = [];
    for (const p of problems) {
      const m = p.metadata as Record<string, unknown> | null;
      const key = buildKey(m);
      if (!key) continue;
      localPool.push({ problemKey: key, problemId: p.id, name: p.title, rating: m && typeof m.rating === "number" ? m.rating : null, tags: (Array.isArray(p.tags) ? p.tags : []) as string[], originalUrl: buildUrl(m, p.sourceUrl) });
    }

    // Generate review plan
    emit("agent.progress", "正在生成复习计划...");
    const plan = generateReviewPlan({ estimatedRating: estimate.estimatedRating, isUnrated, zones, allStats: cfProblemStats, weakTags: v3WeakTags, localPool });
    const reviewReport = buildReviewReport({ estimatedRating: estimate.estimatedRating, estimationMethod: estimate.modelType, zones, allStats: cfProblemStats, focusTags: v3WeakTags, recommendations: plan.recommendations, reviewAdvice: plan.reviewAdvice, hasCfBinding: true, additionalWarnings: plan.warnings });

    // 4. Contest recommendation
    emit("agent.progress", "正在检查比赛推荐...");
    let contestRecommendation: Record<string, unknown> | null = null;
    try {
      const { fetchCodeforcesContestList, recommendContest } = await import("../../lib/cf-contest-service");
      const cr = await fetchCodeforcesContestList();
      if (cr.success && cr.data) {
        const rec = recommendContest(cr.data, estimate);
        if (rec) contestRecommendation = { contestId: rec.contestId, name: rec.name, startTimeSeconds: rec.startTimeSeconds, durationHours: Math.round(rec.durationSeconds / 3600), type: rec.contestType, reason: rec.fitReason, eligibilityNotice: rec.eligibilityNotice };
      }
    } catch {}

    // 5. Compute legacy-compatible activity
    const now = Date.now();
    const lastSub = snapshot.profile.lastSubmissionAt ? new Date(snapshot.profile.lastSubmissionAt).getTime() : null;
    const daysSinceLastSubmission = lastSub ? Math.floor((now - lastSub) / 86_400_000) : null;

    const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString().slice(0, 10);
    let submissionsLast7Days = 0, submissionsLast30Days = 0, solvedLast30Days = 0;
    for (const day of snapshot.activitySeries) {
      if (day.date >= thirtyDaysAgo) { submissionsLast30Days += day.submissions; solvedLast30Days += day.solved; if (day.date >= sevenDaysAgo) submissionsLast7Days += day.submissions; }
    }

    let reminderLevel: "none" | "light" | "strong" | "restart";
    if (daysSinceLastSubmission == null) reminderLevel = "restart";
    else if (daysSinceLastSubmission <= 6) reminderLevel = "none";
    else if (daysSinceLastSubmission <= 13) reminderLevel = "light";
    else if (daysSinceLastSubmission <= 29) reminderLevel = "strong";
    else reminderLevel = "restart";

    // 6. Compute rating trend from history
    const hist = snapshot.ratingHistory;
    let ratingTrend: string = "insufficient";
    if (hist.length >= 2) {
      const recent = hist.slice(-Math.min(5, hist.length));
      let inc = 0, dec = 0, totalChange = 0;
      for (const e of recent) { const d = e.newRating - e.oldRating; totalChange += d; if (d > 0) inc++; else if (d < 0) dec++; }
      if (inc === 0 && dec === 0) ratingTrend = "stable";
      else if (totalChange > 50 && inc >= dec) ratingTrend = "up";
      else if (totalChange < -50 && dec >= inc) ratingTrend = "down";
      else if (Math.abs(totalChange) <= 50) ratingTrend = "stable";
      else if (totalChange > 0) ratingTrend = "up";
      else ratingTrend = "down";
    }

    // 7. Compute legacy weak tags
    const { selectWeakTags } = await import(
      "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-learning-analysis.ts"
    );
    const legacyWeakTags = selectWeakTags(snapshot);

    // 8. Rating gap
    const hasGap = estimate.estimatedRating - estimate.currentRating >= 80;
    const ratingGap = hasGap && estimate.currentRating > 0 ? {
      cfRating: estimate.currentRating,
      recentAvgRating: estimate.practiceSignal,
      gap: estimate.estimatedRating - estimate.currentRating,
      suggestion: estimate.explanationItems.slice(0, 2).join("；") + (contestRecommendation ? "。建议参加一场比赛来同步真实水平。" : "。继续训练巩固后再参赛。"),
      contestRecommendation,
    } : null;

    // 9. Generate legacy training plan (queryCandidates + generateTrainingPlan)
    // Uses targetRating if provided, otherwise uses estimatedRating
    emit("agent.progress", "正在生成训练题单...");
    const { generateTrainingPlan } = await import(
      "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-training-plan.ts"
    );

    const baseForPlan = Math.max(estimate.estimatedRating, targetRating ?? 0, estimate.currentRating);
    const warmupRange: [number, number] = [Math.max(800, baseForPlan - 250), Math.min(3500, baseForPlan - 50)];
    const trainingRange: [number, number] = [Math.max(800, baseForPlan - 100), Math.min(3500, baseForPlan + 150)];
    const challengeRange: [number, number] = [Math.max(800, baseForPlan + 100), Math.min(3500, baseForPlan + 350)];

    const weakTagNames = legacyWeakTags.map((wt) => wt.tag);
    const records: AgentCandidateProblemRecord[] = problems.map((p) => ({
      id: p.id, title: p.title, tags: p.tags as string[],
      source: p.source, sourceUrl: p.sourceUrl,
      metadata: p.metadata, difficulty: "unknown" as const,
    }));

    const [warmupResult, trainingResult, challengeResult] = await Promise.all([
      queryCodeforcesCandidatesForUser(userId, records, { mode: "new_training", minRating: warmupRange[0], maxRating: warmupRange[1], limit: 10 }, repo),
      queryCodeforcesCandidatesForUser(userId, records, { mode: "new_training", minRating: trainingRange[0], maxRating: trainingRange[1], includeTags: weakTagNames, limit: 15 }, repo),
      queryCodeforcesCandidatesForUser(userId, records, { mode: "new_training", minRating: challengeRange[0], maxRating: challengeRange[1], limit: 10 }, repo),
    ]);

    // Unfinished candidates
    const unfinishedKeys = snapshot.problemStates.unfinishedProblemKeys;
    let unfinishedCandidates: TrainingPlanCandidate[] = [];
    if (unfinishedKeys.length > 0) {
      const allResult = await queryCodeforcesCandidatesForUser(userId, records, { mode: "new_training", minRating: 800, maxRating: 3500, limit: 100 }, repo);
      unfinishedCandidates = allResult.candidates
        .filter((c) => unfinishedKeys.includes(c.problemKey))
        .map(toTrainingPlanCandidate);
    }

    const solvedKeys = new Set(snapshot.problemStates.solvedProblemKeys);
    const legacyPlan = generateTrainingPlan({
      warmupCandidates: (warmupResult?.candidates ?? []).map(toTrainingPlanCandidate),
      weakTagCandidates: (trainingResult?.candidates ?? []).map(toTrainingPlanCandidate),
      challengeCandidates: (challengeResult?.candidates ?? []).map(toTrainingPlanCandidate),
      unfinishedCandidates,
      weakTags: legacyWeakTags as Parameters<typeof generateTrainingPlan>[0]["weakTags"],
      solvedProblemKeys: solvedKeys,
    });

    // Merge v3 review recommendations into legacy format
    const v3Recs: RecommendationEntry[] = reviewReport.recommendations.map((r) => ({
      problemKey: r.problemKey, name: r.name, rating: r.rating ?? estimate.estimatedRating, tags: r.tags,
      originalUrl: r.originalUrl,
      recommendationType: r.recommendationType === "historical_failure" ? "unfinished_review" : r.recommendationType === "spaced_review" ? "warmup" : r.recommendationType === "close_call" ? "unfinished_review" : "weak_tag",
      reasonCodes: r.reasonCodes,
    }));

    // Use legacy plan first, supplement with v3 recs if needed
    const allRecommendations = [...legacyPlan.recommendations];
    const usedKeys = new Set(allRecommendations.map((r) => r.problemKey));
    for (const r of v3Recs) {
      if (!usedKeys.has(r.problemKey) && allRecommendations.length < 8) {
        allRecommendations.push(r);
        usedKeys.add(r.problemKey);
      }
    }

    // 11. Assemble final report
    const confidenceLabel = estimate.confidence >= 0.8 ? "高" : estimate.confidence >= 0.6 ? "中" : "低";
    const allWarnings = [...snapshot.dataQuality.warnings, ...reviewReport.dataQuality.warnings, ...legacyPlan.warnings];

    // Rating plan uses targetRating-influenced zones
    const ratingPlan = {
      warmup: warmupRange,
      training: trainingRange,
      challenge: challengeRange,
    };

    emit("run.completed", "学习分析完成");

    const report: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      profileSummary: { handle: snapshot.profile.handle, currentRating: snapshot.profile.currentRating, maxRating: snapshot.profile.maxRating, effectiveRating: estimate.estimatedRating, recentActivityStatus: lastSub ? "active" : "inactive" },
      activity: { daysSinceLastSubmission, submissionsLast7Days, submissionsLast30Days, solvedLast30Days, reminderLevel },
      progress: { attemptedProblems: snapshot.totals.attemptedProblems, solvedProblems: snapshot.totals.solvedProblems, unfinishedProblems: snapshot.totals.unfinishedProblems, ratingTrend },
      weakTags: legacyWeakTags,
      ratingPlan,
      ratingGap,
      recommendations: allRecommendations,
      dataQuality: { confidence: snapshot.dataQuality.confidence, truncated: snapshot.dataQuality.truncated, warnings: allWarnings },
      ratingEstimate: { estimatedRating: estimate.estimatedRating, currentRating: estimate.currentRating, maxRating: estimate.maxRating, ratingDelta: estimate.ratingDelta, confidence: estimate.confidence, confidenceLabel, modelType: estimate.modelType, evidence: estimate.evidence, explanationItems: estimate.explanationItems },
      reviewPlan: { zones: zones.map((z: { name: string; minRating: number; maxRating: number }) => ({ name: z.name, range: `${z.minRating}-${z.maxRating}` })), focusTags: reviewReport.focusTags, v3Recommendations: reviewReport.recommendations, reviewAdvice: reviewReport.reviewAdvice, summary: reviewReport.summary },
      contestRecommendation,
    };

    return { success: true, runId, safeEvents: events, report };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cf-analysis] Internal error:", msg);
    return { success: false, errorCode: "INTERNAL_ERROR", errorMessage: "分析过程中发生内部错误，请稍后重试" };
  }
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toTrainingPlanCandidate(candidate: {
  problemKey: string;
  name: string;
  rating: number;
  tags: readonly string[];
  originalUrl: string;
  solvedCount?: number | null;
}): TrainingPlanCandidate {
  return {
    problemKey: candidate.problemKey,
    name: candidate.name,
    rating: candidate.rating,
    tags: [...candidate.tags],
    originalUrl: candidate.originalUrl,
    ...(typeof candidate.solvedCount === "number" ? { solvedCount: candidate.solvedCount } : {}),
  };
}

function buildKey(m: Record<string, unknown> | null): string | null {
  if (!m) return null;
  const cid = m.contestId ?? m.contest_id; const idx = m.index;
  if (typeof cid === "number" && typeof idx === "string" && idx.length > 0) return `codeforces:${cid}:${idx}`;
  return null;
}
function buildUrl(m: Record<string, unknown> | null, s: string | null): string {
  if (s) return s; if (!m) return "";
  const cid = m.contestId ?? m.contest_id; const idx = m.index;
  if (typeof cid === "number" && typeof idx === "string") return `https://codeforces.com/problemset/problem/${cid}/${idx}`;
  return "";
}
