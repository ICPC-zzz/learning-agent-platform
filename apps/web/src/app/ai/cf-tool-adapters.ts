/**
 * A492 — CF Tool Adapters (v3: /user algorithms + shared cache)
 *
 * Wraps the same estimateUserRating, computeWeakTags, generateReviewPlan
 * functions that the /user personal page uses, with a shared TTL cache
 * so /user and /ai don't recompute the same data within 5 minutes.
 *
 * @serverOnly
 */
"use server";

import { getPrismaClient, PrismaCodeforcesAccountRepository } from "@learning-agent-platform/db";
import { getCachedComputation, setCachedComputation } from "../../lib/cf-computation-cache.ts";
import type {
  CfSnapshotOutput,
  CfEstimatedRatingOutput,
  CfWeakTagsOutput,
  CfReviewPlanOutput,
  CfCandidatesInput,
  CfCandidatesOutput,
  CfRefreshOutput,
} from "@learning-agent-platform/ai-core/code-analysis/tools/cf-user-tools";

// ==========================================================================
// cf.user.snapshot.read — unchanged (uses DB directly)
// ==========================================================================

export async function getCfSnapshotForTool(userId: string): Promise<CfSnapshotOutput | null> {
  try {
    var prisma = getPrismaClient();
    var repo = new PrismaCodeforcesAccountRepository(prisma);
    var account = await repo.getAccountByUserId(userId);
    if (!account) return null;

    var stats = await repo.getProblemStatsByAccount(account.id);
    var accountStats = await repo.getAccountStats(account.id);

    var solvedCount = 0, unfinishedCount = 0;
    for (var i = 0; i < stats.length; i++) {
      if (stats[i].accepted) solvedCount++; else unfinishedCount++;
    }

    var tagMap = new Map();
    for (var j = 0; j < stats.length; j++) {
      var s = stats[j];
      for (var k = 0; k < s.tags.length; k++) {
        var t = s.tags[k];
        var e = tagMap.get(t) || { attempted: 0, solved: 0 };
        e.attempted++;
        if (s.accepted) e.solved++;
        tagMap.set(t, e);
      }
    }
    var tagEntries = Array.from(tagMap.entries());
    tagEntries.sort(function(a, b) { return b[1].attempted - a[1].attempted; });
    var tagSummary = tagEntries.slice(0, 5).map(function(e) { return e[0] + "(" + e[1].solved + "/" + e[1].attempted + ")"; }).join(", ");

    var trend = accountStats.totalSubmissions > 100 ? "活跃" : accountStats.totalSubmissions > 20 ? "一般" : "不活跃";

    return {
      handle: account.canonicalHandle,
      currentRating: account.currentRating,
      maxRating: account.maxRating,
      submissions: accountStats.totalSubmissions,
      solvedProblems: solvedCount,
      unfinishedProblems: unfinishedCount,
      lastSubmissionAt: account.lastSubmissionAt ? account.lastSubmissionAt.toISOString() : null,
      ratingHistorySummary: "N/A",
      tagStatsSummary: tagSummary,
      activityTrend: trend,
      dataQuality: {
        confidence: accountStats.totalSubmissions >= 20 ? "high" : accountStats.totalSubmissions >= 5 ? "medium" : "low",
        warnings: account.dataTruncated ? ["数据可能被截断"] : [],
      },
    };
  } catch (_) { return null; }
}

// ==========================================================================
// cf.user.estimated-rating.read — uses estimateUserRating from cf-rating-estimator.ts
// ==========================================================================

export async function getEstimatedRatingForTool(userId: string): Promise<CfEstimatedRatingOutput> {
  // Check shared cache — avoids recomputing if /user page already computed recently
  var cached = getCachedComputation<CfEstimatedRatingOutput>(userId, "estimated-rating");
  if (cached) return cached;

  try {
    var prisma = getPrismaClient();
    var repo = new PrismaCodeforcesAccountRepository(prisma);
    var account = await repo.getAccountByUserId(userId);
    if (!account) return { estimatedRating: null, confidence: 0, basis: [], currentOfficialRating: null, maxOfficialRating: null, source: "insufficient" };

    var dbStats = await repo.getProblemStatsByAccount(account.id);
    var ratingHistory = await repo.getRatingHistory(account.id);

    // Build CfProblemStat[] for the estimator (same format as /user page)
    var problemStats = dbStats.map(function(s) {
      return {
        problemKey: s.problemKey,
        contestId: s.contestId,
        index: s.index,
        name: s.name,
        rating: s.rating,
        tags: s.tags.slice(),
        attempts: s.attempts,
        accepted: s.accepted,
        firstAcceptedAt: s.firstAcceptedAt ? s.firstAcceptedAt.toISOString() : null,
        lastSubmittedAt: s.lastSubmittedAt ? s.lastSubmittedAt.toISOString() : null,
        lastVerdict: s.lastVerdict,
      };
    });

    // Build UserRatingInput
    var userRatingInput = {
      currentRating: account.currentRating,
      maxRating: account.maxRating,
      ratingHistory: ratingHistory.map(function(r) {
        return {
          contestId: r.contestId,
          contestName: r.contestName,
          newRating: r.newRating,
          oldRating: r.oldRating,
          ratingUpdateAt: r.ratingUpdateAt.toISOString(),
        };
      }),
      problemStats: problemStats,
      lastOnlineAt: account.lastOnlineAt ? account.lastOnlineAt.toISOString() : null,
    };

    // Use the same function as /user page
    var { estimateUserRating } = await import(
      "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-rating-estimator.ts"
    );
    var estimate = estimateUserRating(userRatingInput);

    var source: CfEstimatedRatingOutput["source"];
    if (estimate.modelType === "rated") source = "official_and_practice";
    else if (estimate.estimatedRating > 800) source = "practice_only";
    else source = "insufficient";

    var result: CfEstimatedRatingOutput = {
      estimatedRating: estimate.estimatedRating,
      confidence: estimate.confidence,
      basis: estimate.explanationItems,
      currentOfficialRating: estimate.currentRating > 0 ? estimate.currentRating : null,
      maxOfficialRating: estimate.maxRating > 0 ? estimate.maxRating : null,
      source: source,
    };
    setCachedComputation(userId, "estimated-rating", result);
    return result;
  } catch (_) {
    return { estimatedRating: null, confidence: 0, basis: [], currentOfficialRating: null, maxOfficialRating: null, source: "insufficient" };
  }
}

// ==========================================================================
// cf.user.weak-tags.read — uses computeWeakTags from cf-wrongbook-review.ts
// ==========================================================================

export async function getWeakTagsForTool(userId: string): Promise<CfWeakTagsOutput> {
  var cached = getCachedComputation<CfWeakTagsOutput>(userId, "weak-tags");
  if (cached) return cached;

  try {
    var prisma = getPrismaClient();
    var repo = new PrismaCodeforcesAccountRepository(prisma);
    var account = await repo.getAccountByUserId(userId);
    if (!account) return { weakTags: [], totalTagsAnalyzed: 0, dataQuality: "no_account" };

    var dbStats = await repo.getProblemStatsByAccount(account.id);

    // Build CfProblemStat[] (same as /user page)
    var problemStats = dbStats.map(function(s) {
      return {
        problemKey: s.problemKey,
        contestId: s.contestId,
        index: s.index,
        name: s.name,
        rating: s.rating,
        tags: s.tags.slice(),
        attempts: s.attempts,
        accepted: s.accepted,
        firstAcceptedAt: s.firstAcceptedAt ? s.firstAcceptedAt.toISOString() : null,
        lastSubmittedAt: s.lastSubmittedAt ? s.lastSubmittedAt.toISOString() : null,
        lastVerdict: s.lastVerdict,
      };
    });

    // Use computeWeakTags from /user page (Laplace smoothing, evidence levels)
    var { computeWeakTags } = await import(
      "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-wrongbook-review.ts"
    );
    var result = computeWeakTags(problemStats);

    // Map to CfWeakTagEntry format with backward-compatible enrichment
    var tagStatsMap = new Map();
    for (var i = 0; i < problemStats.length; i++) {
      var s = problemStats[i];
      for (var j = 0; j < s.tags.length; j++) {
        var tagName = s.tags[j];
        var e = tagStatsMap.get(tagName) || { attempted: 0, solved: 0, totalAttempts: 0, ratings: [] };
        e.attempted++;
        e.totalAttempts += s.attempts;
        if (s.accepted) e.solved++;
        if (s.rating) e.ratings.push(s.rating);
        tagStatsMap.set(tagName, e);
      }
    }

    var weakTags = result.map(function(wt) {
      var data = tagStatsMap.get(wt.tag) || { attempted: 0, solved: 0, totalAttempts: 0, ratings: [] };
      var avgRating = data.ratings.length > 0
        ? Math.round(data.ratings.reduce(function(a, b) { return a + b; }, 0) / data.ratings.length)
        : 0;
      return {
        tag: wt.tag,
        attempted: data.attempted,
        solved: data.solved,
        completionRate: data.attempted > 0 ? Math.round((data.solved / data.attempted) * 100) / 100 : 0,
        averageAttempts: data.attempted > 0 ? Math.round((data.totalAttempts / data.attempted) * 10) / 10 : 0,
        averageRating: avgRating,
        evidenceLevel: wt.evidenceLevel,
        reasonCodes: [wt.waRate >= 0.6 ? "high_failure_rate" : "low_completion_rate", "evidence_" + wt.evidenceLevel],
      };
    });

    var wtResult: CfWeakTagsOutput = {
      weakTags: weakTags,
      totalTagsAnalyzed: tagStatsMap.size,
      dataQuality: account.dataTruncated ? "truncated" : "complete",
    };
    setCachedComputation(userId, "weak-tags", wtResult);
    return wtResult;
  } catch (_) {
    return { weakTags: [], totalTagsAnalyzed: 0, dataQuality: "error" };
  }
}

// ==========================================================================
// cf.user.review-plan.read — uses generateReviewPlan from cf-wrongbook-review.ts
// ==========================================================================

export async function getReviewPlanForTool(userId: string): Promise<CfReviewPlanOutput> {
  var cached = getCachedComputation<CfReviewPlanOutput>(userId, "review-plan");
  if (cached) return cached;

  try {
    var prisma = getPrismaClient();
    var repo = new PrismaCodeforcesAccountRepository(prisma);
    var account = await repo.getAccountByUserId(userId);
    if (!account) return { focusTags: [], unfinishedCount: 0, reviewNeededCount: 0, recentSuggestions: [], associatedProblemKeys: [] };

    var dbStats = await repo.getProblemStatsByAccount(account.id);
    var ratingHistory = await repo.getRatingHistory(account.id);

    // Build CfProblemStat[]
    var problemStats = dbStats.map(function(s) {
      return {
        problemKey: s.problemKey,
        contestId: s.contestId,
        index: s.index,
        name: s.name,
        rating: s.rating,
        tags: s.tags.slice(),
        attempts: s.attempts,
        accepted: s.accepted,
        firstAcceptedAt: s.firstAcceptedAt ? s.firstAcceptedAt.toISOString() : null,
        lastSubmittedAt: s.lastSubmittedAt ? s.lastSubmittedAt.toISOString() : null,
        lastVerdict: s.lastVerdict,
      };
    });

    // Estimate rating first (needed for zones)
    var { estimateUserRating } = await import(
      "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-rating-estimator.ts"
    );
    var userRatingInput = {
      currentRating: account.currentRating,
      maxRating: account.maxRating,
      ratingHistory: ratingHistory.map(function(r) {
        return { contestId: r.contestId, contestName: r.contestName, newRating: r.newRating, oldRating: r.oldRating, ratingUpdateAt: r.ratingUpdateAt.toISOString() };
      }),
      problemStats: problemStats,
      lastOnlineAt: account.lastOnlineAt ? account.lastOnlineAt.toISOString() : null,
    };
    var estimate = estimateUserRating(userRatingInput);

    // Get weak tags + zones + generate plan
    var { computeRatingZones, computeWeakTags, generateReviewPlan } = await import(
      "../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-wrongbook-review.ts"
    );
    var isUnrated = estimate.modelType === "unrated";
    var zones = computeRatingZones(estimate.estimatedRating, isUnrated);
    var weakTags = computeWeakTags(problemStats);

    // Load local pool for review plan
    var problems = await prisma.problem.findMany({
      where: { source: "codeforces" },
      select: { id: true, title: true, source: true, sourceUrl: true, metadata: true, tags: true },
    });
    var localPool = [];
    for (var i = 0; i < problems.length; i++) {
      var p = problems[i];
      var m = (p.metadata || {}) as Record<string, unknown>;
      var pk = (m.contestId != null && m.index != null) ? String(m.contestId) + "/" + String(m.index) : "";
      if (!pk) continue;
      localPool.push({
        problemKey: pk,
        problemId: p.id,
        name: p.title,
        rating: typeof m.rating === "number" ? m.rating : null,
        tags: Array.isArray(p.tags) ? p.tags : [],
        originalUrl: p.sourceUrl || ("https://codeforces.com/problemset/problem/" + pk),
      });
    }

    var plan = generateReviewPlan({
      estimatedRating: estimate.estimatedRating,
      isUnrated: isUnrated,
      zones: zones,
      allStats: problemStats,
      weakTags: weakTags,
      localPool: localPool,
    });

    var rpResult: CfReviewPlanOutput = {
      focusTags: (plan.focusTags || []).map(function(t) { return t.tag; }),
      unfinishedCount: problemStats.filter(function(s) { return !s.accepted; }).length,
      reviewNeededCount: problemStats.filter(function(s) { return s.accepted && s.attempts >= 3; }).length,
      recentSuggestions: (plan.recommendations || []).slice(0, 5).map(function(r) {
        return String(r.name) + " (Rating " + String(r.rating || "?") + ") — " + String(r.priorityLevel);
      }),
      associatedProblemKeys: (plan.recommendations || []).slice(0, 5).map(function(r) { return r.problemKey; }),
    };
    setCachedComputation(userId, "review-plan", rpResult);
    return rpResult;
  } catch (_) {
    return { focusTags: [], unfinishedCount: 0, reviewNeededCount: 0, recentSuggestions: [], associatedProblemKeys: [] };
  }
}

// ==========================================================================
// cf.problem.candidates.read — unchanged
// ==========================================================================

export async function getCandidatesForTool(userId: string, query: CfCandidatesInput): Promise<CfCandidatesOutput> {
  try {
    var prisma = getPrismaClient();
    var repo = new PrismaCodeforcesAccountRepository(prisma);
    var account = await repo.getAccountByUserId(userId);

    var solvedKeys = [];
    if (account) {
      var stats = await repo.getProblemStatsByAccount(account.id);
      solvedKeys = stats.filter(function(s) { return s.accepted; }).map(function(s) { return s.problemKey; });
    }

    var { getAllLocalCodeforcesProblems } = await import("../../lib/codeforces-curated-pool.ts");
    var { queryCodeforcesCandidatesForUser } = await import("../../lib/codeforces-agent-candidates-user.ts");

    var records = await getAllLocalCodeforcesProblems();
    if (!records || records.length === 0) return { candidates: [], totalAvailable: 0, excludedCount: solvedKeys.length };

    var result = await queryCodeforcesCandidatesForUser(userId, records, {
      mode: "new_training",
      tags: query.tags,
      ratingMin: query.ratingMin,
      ratingMax: query.ratingMax,
      limit: query.limit || 3,
    }, repo);

    return {
      candidates: result.candidates.map(function(c) {
        return {
          cfContestId: c.cfContestId,
          cfIndex: c.cfIndex,
          name: c.name,
          rating: c.rating || null,
          tags: c.tags || [],
          cfUrl: "https://codeforces.com/problemset/problem/" + c.cfContestId + "/" + c.cfIndex,
        };
      }),
      totalAvailable: result.totalCandidates,
      excludedCount: result.querySummary.solvedKeysExcluded,
    };
  } catch (_) { return { candidates: [], totalAvailable: 0, excludedCount: 0 }; }
}

// ==========================================================================
// cf.user.refresh — unchanged
// ==========================================================================

export async function refreshCfForTool(userId: string): Promise<CfRefreshOutput> {
  try {
    var prisma = getPrismaClient();
    var repo = new PrismaCodeforcesAccountRepository(prisma);
    var account = await repo.getAccountByUserId(userId);
    if (!account) return { success: false, newRating: null, submissionsFetched: 0, message: "未绑定 Codeforces 账号" };

    var { syncCodeforcesUserData } = await import("../../lib/codeforces-sync-service.ts");
    var result = await syncCodeforcesUserData({
      userId: userId,
      accountId: account.id,
      handle: account.canonicalHandle || "unknown",
      repository: repo,
    });

    var msg = result.success
      ? "数据刷新成功，获取 " + (result.submissionsFetched || 0) + " 条记录"
      : "刷新失败: " + (result.error || "服务不可用");

    return {
      success: result.success,
      newRating: null as number | null,
      submissionsFetched: result.submissionsFetched || 0,
      message: msg,
    };
  } catch (err) {
    var errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("fetch failed") || errMsg.includes("ENOTFOUND") || errMsg.includes("ETIMEDOUT")) {
      errMsg = "Codeforces 服务器暂时不可用，已使用本地缓存数据";
    }
    return { success: false, newRating: null, submissionsFetched: 0, message: errMsg };
  }
}
