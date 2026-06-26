// ============================================================
// A489 v3 — Codeforces Contest Recommendation
// ============================================================
// Uses unified rating estimate with proper thresholds.
// No contest recommended when requirements aren't met.
//
// @serverOnly

import {
  evaluateCodeforcesGuard,
} from "./codeforces-client.ts";
import { createAssistantProviderEnvSnapshot } from "./assistant/config/assistant-provider-config.ts";
import { loadAssistantProviderConfig } from "./assistant/config/assistant-provider-config.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RATING_GROWTH_RECOMMEND_THRESHOLD = 100;
export const MIN_CONTEST_RECOMMEND_CONFIDENCE = 0.65;
export const UNRATED_MIN_RATING = 900;
export const UNRATED_MIN_CONFIDENCE = 0.55;
export const UNRATED_MIN_SOLVED = 20;
export const CONTEST_LOOKAHEAD_DAYS = 30;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CfContestEntry {
  id: number;
  name: string;
  type: "CF" | "IOI" | "ICPC";
  phase: "BEFORE" | "CODING" | "PENDING_SYSTEM_TEST" | "SYSTEM_TEST" | "FINISHED";
  frozen: boolean;
  durationSeconds: number;
  startTimeSeconds: number;
  relativeTimeSeconds: number;
}

export interface CfContestListResult {
  success: boolean;
  data: CfContestEntry[] | null;
  error: string | null;
  guardBlocked: boolean;
}

export interface ContestRecommendation {
  contestId: number;
  name: string;
  startTimeSeconds: number;
  durationSeconds: number;
  contestType: string;
  fitReason: string;
  eligibilityNotice: string;
}

interface RatingEstimate {
  modelType: "rated" | "unrated";
  estimatedRating: number;
  currentRating: number;
  confidence: number;
  recentRatedSolvedCount: number;
  ratedSolvedCount: number;
}

// ---------------------------------------------------------------------------
// Contest type preference by rating
// ---------------------------------------------------------------------------

function getContestTypePreference(estimatedRating: number): string[] {
  // Return ordered list: [bestMatch, ...]
  if (estimatedRating < 1200) return ["Div. 4", "Div. 3", "Educational"];
  if (estimatedRating < 1500) return ["Div. 3", "Educational", "Div. 2"];
  if (estimatedRating < 1900) return ["Div. 2", "Educational", "Div. 1 + Div. 2"];
  return ["Div. 1 + Div. 2", "Div. 1", "Div. 2", "Educational"];
}

function matchContestType(contestName: string, preferences: string[]): number {
  const lower = contestName.toLowerCase();
  // Check combined type first
  if (lower.includes("div. 1") && lower.includes("div. 2")) {
    const idx = preferences.indexOf("Div. 1 + Div. 2");
    return idx >= 0 ? (preferences.length - idx) * 100 : 0;
  }
  for (let i = 0; i < preferences.length; i++) {
    if (lower.includes(preferences[i].toLowerCase())) {
      return (preferences.length - i) * 100;
    }
  }
  // Educational is open to all
  if (lower.includes("educational")) return 70;
  return 10;
}

// ---------------------------------------------------------------------------
// Filter upcoming contests
// ---------------------------------------------------------------------------

function isExcluded(contest: CfContestEntry): boolean {
  const name = contest.name.toLowerCase();
  // Exclude gym
  // Exclude unrated special events
  if (
    name.includes("gym") ||
    name.includes("april fools") ||
    name.includes("kotlin") ||
    name.includes("q#") ||
    name.includes("testing round") ||
    name.includes("marathon") ||
    name.includes("icpc") && !name.includes("codeforces")
  ) return true;
  return false;
}

export function getUpcomingContests(contests: CfContestEntry[]): CfContestEntry[] {
  const now = Date.now() / 1000;
  return contests
    .filter((c) => c.phase === "BEFORE" && c.startTimeSeconds > now && !isExcluded(c))
    .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
}

// ---------------------------------------------------------------------------
// Fetch contest list
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function resolveBaseUrl(env: Record<string, string | undefined>): string {
  const config = loadAssistantProviderConfig(env);
  return config.codeforces.baseUrl || "https://codeforces.com/api";
}

async function safeFetch(url: string, timeoutMs = 15_000): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, signal: controller.signal });
    if (!r.ok) throw new Error(`CF_HTTP_${r.status}`);
    return await r.json();
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new Error(`CF_TIMEOUT`);
    if (e instanceof Error && /^CF_/.test(e.message)) throw e;
    throw new Error(`CF_FETCH_ERROR`);
  } finally { clearTimeout(timeoutId); }
}

export async function fetchCodeforcesContestList(
  env: Record<string, string | undefined> = createAssistantProviderEnvSnapshot(),
): Promise<CfContestListResult> {
  const guard = evaluateCodeforcesGuard(env);
  if (!guard.allowed) return { success: false, data: null, error: guard.blockedReason ?? "Blocked", guardBlocked: true };

  try {
    const base = resolveBaseUrl(env);
    const raw = await safeFetch(`${base}/contest.list?gym=false`);
    if (!isRecord(raw) || raw.status !== "OK" || !Array.isArray(raw.result)) {
      return { success: false, data: null, error: "CF_API_ERROR", guardBlocked: false };
    }
    return { success: true, data: raw.result as CfContestEntry[], error: null, guardBlocked: false };
  } catch (e) {
    return { success: false, data: null, error: e instanceof Error ? e.message : String(e), guardBlocked: false };
  }
}

// ---------------------------------------------------------------------------
// Recommend contest — unified entry point
// ---------------------------------------------------------------------------

export function recommendContestForUser(
  contests: CfContestEntry[],
  estimate: RatingEstimate,
): ContestRecommendation | null {
  return recommendContest(contests, estimate);
}

/**
 * Recommend the best upcoming contest. Returns null when:
 * - No upcoming contests in lookahead window
 * - Rating growth < threshold
 * - Confidence < threshold
 * - No type-matching contests available
 */
export function recommendContest(
  contests: CfContestEntry[],
  estimate: RatingEstimate,
): ContestRecommendation | null {
  const upcoming = getUpcomingContests(contests);
  if (upcoming.length === 0) return null;

  const now = Date.now() / 1000;
  const windowEnd = now + CONTEST_LOOKAHEAD_DAYS * 86_400;

  // ── Rated users ──
  if (estimate.modelType === "rated") {
    const growth = estimate.estimatedRating - estimate.currentRating;
    if (growth < RATING_GROWTH_RECOMMEND_THRESHOLD) return null;
    if (estimate.confidence < MIN_CONTEST_RECOMMEND_CONFIDENCE) return null;
    if (estimate.recentRatedSolvedCount < 15) return null;
  }

  // ── Unrated users ──
  if (estimate.modelType === "unrated") {
    if (estimate.estimatedRating < UNRATED_MIN_RATING) return null;
    if (estimate.confidence < UNRATED_MIN_CONFIDENCE) return null;
    if (estimate.ratedSolvedCount < UNRATED_MIN_SOLVED) return null;
  }

  // ── Type matching ──
  const preferences = getContestTypePreference(estimate.estimatedRating);

  const scored = upcoming
    .filter((c) => c.startTimeSeconds <= windowEnd)
    .map((c) => ({
      contest: c,
      typeScore: matchContestType(c.name, preferences),
      timeScore: Math.max(0, 50 - (c.startTimeSeconds - now) / 3600 * 0.3),
    }))
    .filter((s) => s.typeScore > 0) // must match at least some type
    .sort((a, b) => b.typeScore - a.typeScore || a.contest.startTimeSeconds - b.contest.startTimeSeconds);

  if (scored.length === 0) return null;

  const best = scored[0].contest;
  const startDate = new Date(best.startTimeSeconds * 1000);

  // Eligibility notice based on current official rating
  const currentOfficial = estimate.currentRating;
  const div = getDivisionByOfficialRating(currentOfficial);

  return {
    contestId: best.id,
    name: best.name,
    startTimeSeconds: best.startTimeSeconds,
    durationSeconds: best.durationSeconds,
    contestType: best.type,
    fitReason: `你的预估实力为 ${estimate.estimatedRating}，比当前官方 Rating 高约 ${estimate.estimatedRating - currentOfficial} 分。` +
      `近期做题数据可信度为"${estimate.confidence >= 0.8 ? "高" : estimate.confidence >= 0.6 ? "中" : "低"}"。` +
      `现在适合通过一场正式比赛验证训练成果。${startDate.toLocaleDateString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} 开始。`,
    eligibilityNotice: `以你当前官方 Rating（${currentOfficial}）可参加 ${div}。请在报名前查看比赛官方说明，确认当前 Rating 是否满足该场比赛的参赛和计分条件。`,
  };
}

function getDivisionByOfficialRating(rating: number): string {
  if (rating < 1200) return "Div.4 或 Div.3";
  if (rating < 1400) return "Div.3 或 Div.4";
  if (rating < 1600) return "Div.3 或 Div.2";
  if (rating < 1900) return "Div.2 或 Div.3";
  if (rating < 2100) return "Div.2 或 Div.1";
  return "Div.1 或 Div.2";
}
