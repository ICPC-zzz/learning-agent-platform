"use server";

/**
 * A489 v3 — CF Wrong Book Review Server Action
 *
 * Reads CF problem stats directly. Uses unified estimateUserRating.
 *
 * @serverOnly
 */

import { cookies } from "next/headers";
import { deserializeDevSession, getSafeSessionSummary } from "../../lib/web-auth-dev-session";
import { getPrismaClient, PrismaCodeforcesAccountRepository } from "@learning-agent-platform/db";
import type { ReviewReportData } from "./CfWrongBookReviewReport";

function isFeatureEnabled(): boolean {
  return process.env.ENABLE_CF_WRONGBOOK_AGENT === "true" || process.env.ENABLE_CF_LEARNING_AGENT === "true";
}

export interface CfWrongBookReviewActionOutput {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  runId?: string;
  report?: ReviewReportData;
  safeEvents?: Array<{ type: string; sequence: number; timestamp: string; message: string }>;
}

export async function generateCfWrongBookReview(): Promise<CfWrongBookReviewActionOutput> {
  if (!isFeatureEnabled()) return { success: false, errorCode: "FEATURE_DISABLED", errorMessage: "错题复习功能尚未启用" };

  let userId: string | null = null;
  try { const ck = await cookies(); userId = getSafeSessionSummary(deserializeDevSession(ck.get("lap-web-dev-session")?.value)).user?.userIdPreview ?? null; } catch {}

  if (!userId) return { success: false, errorCode: "NOT_LOGGED_IN", errorMessage: "请先登录" };

  const prisma = getPrismaClient();
  const cfRepo = new PrismaCodeforcesAccountRepository(prisma);

  try {
    const runId = `run_cf_wb_${Date.now()}`;
    const events: NonNullable<CfWrongBookReviewActionOutput["safeEvents"]> = [];
    let seq = 0;
    function emit(t: string, m: string) { seq++; events.push({ type: t, sequence: seq, timestamp: new Date().toISOString().slice(11, 19), message: m }); }

    emit("run.started", "正在创建复习任务...");

    // 1. Load account
    const account = await cfRepo.getAccountByUserId(userId);
    if (!account) {
      emit("run.completed", "请先绑定 Codeforces 账号");
      return { success: true, runId, safeEvents: events, report: { generatedAt: new Date().toISOString(), estimatedRating: 800, estimationMethod: "unrated", ratingZones: [], summary: { totalAcProblems: 0, totalWaProblems: 0, weakTagCount: 0, activeDays: null }, focusTags: [], recommendations: [], reviewAdvice: { suggestedSessionMinutes: 0, suggestedOrder: [], reminderLevel: "none" }, dataQuality: { confidence: "low", warnings: ["未绑定 Codeforces 账号"] } } };
    }

    // 2. Load stats
    emit("agent.progress", "正在加载Codeforces提交数据...");
    const allStats = await cfRepo.getProblemStatsByAccount(account.id);
    if (allStats.length === 0) {
      emit("run.completed", "尚无提交数据");
      return { success: true, runId, safeEvents: events, report: { generatedAt: new Date().toISOString(), estimatedRating: 800, estimationMethod: "unrated", ratingZones: [], summary: { totalAcProblems: 0, totalWaProblems: 0, weakTagCount: 0, activeDays: null }, focusTags: [], recommendations: [], reviewAdvice: { suggestedSessionMinutes: 0, suggestedOrder: [], reminderLevel: "none" }, dataQuality: { confidence: "low", warnings: ["尚无提交数据"] } } };
    }

    // Build CfProblemStat array
    const cfProblemStats = allStats.map((s) => ({
      problemKey: s.problemKey, contestId: s.contestId, index: s.index,
      name: s.name, rating: s.rating, tags: [...s.tags],
      attempts: s.attempts, accepted: s.accepted,
      firstAcceptedAt: s.firstAcceptedAt?.toISOString() ?? null,
      lastSubmittedAt: s.lastSubmittedAt?.toISOString() ?? null,
      lastVerdict: s.lastVerdict,
    }));

    // 3. Estimate rating
    emit("agent.progress", "正在计算预估Rating...");
    const { estimateUserRating } = await import("../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-rating-estimator.ts");
    const estimate = estimateUserRating({
      currentRating: account.currentRating, maxRating: account.maxRating,
      ratingHistory: [], problemStats: cfProblemStats,
      lastOnlineAt: account.lastOnlineAt?.toISOString() ?? null,
    });

    // 4. Compute zones and weak tags
    emit("agent.progress", "正在分析薄弱标签...");
    const { computeRatingZones, computeWeakTags, generateReviewPlan, buildReviewReport } = await import("../../../../../packages/ai-core/src/agent-runtime/cf-analysis/cf-wrongbook-review.ts");
    const isUnrated = estimate.modelType === "unrated";
    const zones = computeRatingZones(estimate.estimatedRating, isUnrated);
    const focusTags = computeWeakTags(cfProblemStats);

    // 5. Load local pool
    emit("agent.progress", "正在筛选本地题目...");
    const problems = await prisma.problem.findMany({ where: { source: "codeforces" }, select: { id: true, title: true, source: true, sourceUrl: true, metadata: true, tags: true } });
    const localPool: Array<{ problemKey: string; problemId: string; name: string; rating: number | null; tags: string[]; originalUrl: string }> = [];
    for (const p of problems) {
      const m = p.metadata as Record<string, unknown> | null;
      const key = buildKey(m); if (!key) continue;
      localPool.push({ problemKey: key, problemId: p.id, name: p.title, rating: m && typeof m.rating === "number" ? m.rating : null, tags: (Array.isArray(p.tags) ? p.tags : []) as string[], originalUrl: buildUrl(m, p.sourceUrl) });
    }

    // 6. Generate plan
    emit("agent.progress", "正在生成复习计划...");
    const plan = generateReviewPlan({ estimatedRating: estimate.estimatedRating, isUnrated, zones, allStats: cfProblemStats, weakTags: focusTags, localPool });

    // 7. Build report
    emit("agent.progress", "复习计划生成完成");
    const report = buildReviewReport({ estimatedRating: estimate.estimatedRating, estimationMethod: estimate.modelType, zones, allStats: cfProblemStats, focusTags, recommendations: plan.recommendations, reviewAdvice: plan.reviewAdvice, hasCfBinding: true, additionalWarnings: plan.warnings });

    emit("run.completed", "复习计划生成完成");
    return { success: true, runId, safeEvents: events, report };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cf-wrongbook-review] Internal error:", msg);
    return { success: false, errorCode: "INTERNAL_ERROR", errorMessage: "分析过程中发生内部错误，请稍后重试" };
  }
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
