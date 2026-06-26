var RECENT_PRACTICE_WINDOW_DAYS = 7;

interface WrongBookCandidate {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  wrongCount: number;
  reviewStatus: string;
}

interface FavoriteCandidate {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
}

interface RecentPracticeCandidate {
  problemId: string;
  title: string;
  difficulty: string;
  status: string;
  updatedAt: string;
}

interface SampleProblemCandidate {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  estimatedMinutes: number;
}

export interface DailyChallengeRecommendation {
  problemId: string;
  title: string;
  difficulty: string;
  tags: string[];
  estimatedMinutes: number;
  recommendationSource: string;
  recommendationReason: string;
  isBuiltIn: boolean;
}

export interface DailyChallengeSelectionInput {
  sampleProblems: SampleProblemCandidate[];
  wrongBookEntries: WrongBookCandidate[];
  favoriteProblems: FavoriteCandidate[];
  recentPractice: RecentPracticeCandidate[];
  learningActivityCount: number;
  dateString: string;
}

var SENSITIVE_PATTERNS = [
  /\bDATABASE_URL\b/i,
  /\bapi_.*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
  /\braw_.*prompt\b/i,
  /\braw_.*response\b/i,
];

function deterministicHash(s: string): number {
  var hash = 5381;
  for (var i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function isWithinRecentWindow(dateStr: string, dateString: string): boolean {
  var today = new Date(dateString + "T00:00:00Z");
  var compare;
  try { compare = new Date(dateStr); } catch (e) { return false; }
  if (Number.isNaN(compare.getTime())) return false;
  var diffMs = today.getTime() - compare.getTime();
  var diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays < RECENT_PRACTICE_WINDOW_DAYS;
}

function tier1_wrongBookNeedsReview(entries: WrongBookCandidate[]): DailyChallengeRecommendation | null {
  var needsReview = entries.filter(function(e){return e.reviewStatus==="needs-review"}).sort(function(a,b){return b.wrongCount-a.wrongCount});
  if (needsReview.length === 0) return null;
  var e = needsReview[0];
  var reason = "wrong book needs-review: " + e.title + " (wrongs: " + e.wrongCount + ")";
  return { problemId: e.problemId, title: e.title, difficulty: e.difficulty, tags: e.tags.slice(), estimatedMinutes: 10, recommendationSource: "wrong-book-needs-review", recommendationReason: reason, isBuiltIn: false };
}

function tier2_wrongBookHighCount(entries: WrongBookCandidate[]): DailyChallengeRecommendation | null {
  if (entries.length === 0) return null;
  var sorted = entries.slice().sort(function(a,b){return b.wrongCount-a.wrongCount});
  var e = sorted[0];
  var reason = "wrong book high wrong count: " + e.title + " (" + e.wrongCount + " wrongs)";
  return { problemId: e.problemId, title: e.title, difficulty: e.difficulty, tags: e.tags.slice(), estimatedMinutes: 10, recommendationSource: "wrong-book-high-count", recommendationReason: reason, isBuiltIn: false };
}

function tier3_favoriteNotRecent(
  favs: FavoriteCandidate[],
  practice: RecentPracticeCandidate[],
  dateString: string,
): DailyChallengeRecommendation | null {
  if (favs.length === 0) return null;
  var recentIds: Record<string, true> = {};
  for (var i = 0; i < practice.length; i++) {
    if (isWithinRecentWindow(practice[i].updatedAt, dateString)) {
      recentIds[practice[i].problemId] = true;
    }
  }
  var unpracticed = favs.filter(function(f){return !recentIds[f.problemId]});
  if (unpracticed.length === 0) return null;
  var e = unpracticed[0];
  var reason = "favorite not recent: " + e.title;
  return { problemId: e.problemId, title: e.title, difficulty: e.difficulty, tags: e.tags.slice(), estimatedMinutes: 10, recommendationSource: "favorite-not-recent", recommendationReason: reason, isBuiltIn: false };
}

function tier4_recentPracticeNeedsReview(practice: RecentPracticeCandidate[]): DailyChallengeRecommendation | null {
  var needsReview = practice.filter(function(e){return e.status==="needs-review"});
  if (needsReview.length === 0) return null;
  var sorted = needsReview.slice().sort(function(a,b){return new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()});
  var e = sorted[0];
  var reason = "recent practice needs-review: " + e.title;
  return { problemId: e.problemId, title: e.title, difficulty: e.difficulty, tags: [], estimatedMinutes: 10, recommendationSource: "recent-practice-needs-review", recommendationReason: reason, isBuiltIn: false };
}

function tier5_builtinByDateHash(
  problems: SampleProblemCandidate[],
  dateString: string,
): DailyChallengeRecommendation | null {
  if (problems.length === 0) return null;
  var hash = deterministicHash(dateString);
  var idx = hash % problems.length;
  var p = problems[idx];
  var reason = "builtin date-hash pick (" + p.difficulty + ")";
  return { problemId: p.problemId, title: p.title, difficulty: p.difficulty, tags: p.tags.slice(), estimatedMinutes: p.estimatedMinutes, recommendationSource: "builtin-date-hash", recommendationReason: reason, isBuiltIn: true };
}

function tier6_builtinFallback(problems: SampleProblemCandidate[]): DailyChallengeRecommendation | null {
  if (problems.length === 0) return null;
  var p = problems[0];
  return { problemId: p.problemId, title: p.title, difficulty: p.difficulty, tags: p.tags.slice(), estimatedMinutes: p.estimatedMinutes, recommendationSource: "builtin-fallback", recommendationReason: "builtin fallback (no data)", isBuiltIn: true };
}

export function selectDailyChallenge(
  input: DailyChallengeSelectionInput,
): DailyChallengeRecommendation | null {
  var r = tier1_wrongBookNeedsReview(input.wrongBookEntries);
  if (r !== null) return r;
  r = tier2_wrongBookHighCount(input.wrongBookEntries);
  if (r !== null) return r;
  r = tier3_favoriteNotRecent(input.favoriteProblems, input.recentPractice, input.dateString);
  if (r !== null) return r;
  r = tier4_recentPracticeNeedsReview(input.recentPractice);
  if (r !== null) return r;
  r = tier5_builtinByDateHash(input.sampleProblems, input.dateString);
  if (r !== null) return r;
  return tier6_builtinFallback(input.sampleProblems);
}

export function recommendationIsSafe(rec: DailyChallengeRecommendation): {
  safe: boolean;
  violations: string[];
} {
  var violations: string[] = [];
  var json = JSON.stringify(rec);
  for (var i = 0; i < SENSITIVE_PATTERNS.length; i++) {
    if (SENSITIVE_PATTERNS[i].test(json)) {
      violations.push("sensitive: " + SENSITIVE_PATTERNS[i].source);
    }
  }
  return { safe: violations.length === 0, violations: violations };
}
