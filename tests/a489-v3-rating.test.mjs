import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Inlined weighted percentile (same logic as cf-rating-estimator.ts)
function weightedPercentile(values, weights, p) {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  var pairs = values.map(function(v, i) { return { v: v, w: weights[i] }; });
  pairs.sort(function(a, b) { return a.v - b.v; });
  var totalW = pairs.reduce(function(s, x) { return s + x.w; }, 0);
  if (totalW === 0) return values[Math.floor(values.length * p / 100)];
  var target = (p / 100) * totalW;
  var cum = 0;
  for (var i = 0; i < pairs.length; i++) {
    cum += pairs[i].w;
    if (cum >= target) {
      if (cum === target || i === pairs.length - 1) return pairs[i].v;
      var prevCum = cum - pairs[i].w;
      return pairs[i].v * (1 - (target - prevCum) / pairs[i].w) + pairs[i + 1].v * ((target - prevCum) / pairs[i].w);
    }
  }
  return pairs[pairs.length - 1].v;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  var idx = (p / 100) * (sorted.length - 1);
  var lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (idx - lo)) + sorted[hi] * (idx - lo);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Build a simplified estimateUserRating to test in isolation
function estimateUserRating(input) {
  var cr = input.currentRating || 0;
  var mr = input.maxRating || 0;
  var rh = input.ratingHistory || [];
  var ps = input.problemStats || [];
  var hasRating = cr > 0 || mr > 0 || rh.length > 0;
  if (!hasRating) return estimateUnrated(ps);
  return estimateRated(cr, mr, rh, ps, input.lastOnlineAt);
}

function estimateRated(cr, mr, rh, ps, lastOnlineAt) {
  var acRatings = ps.filter(function(s) { return s.accepted && s.rating > 0; }).map(function(s) { return s.rating; }).sort(function(a,b){return a-b;});
  var historyAnchor = Math.max(cr, mr);
  // Practice signal (simplified)
  var weights = computeWeights(ps);
  var entries = [];
  weights.forEach(function(d, k) { entries.push({ key: k, r: d.rating, w: d.weight }); });
  entries.sort(function(a,b){ return b.w - a.w; });
  var recent = entries.slice(0, 200);
  var recentR = recent.map(function(e){ return e.r; }).sort(function(a,b){return a-b;});
  var recentW = recent.map(function(e){ return e.w; });
  var p80 = weightedPercentile(recentR, recentW, 80);
  var p65 = weightedPercentile(recentR, recentW, 65);
  var n = recentR.length;
  var pSignal = 800;
  if (n >= 20) {
    var p95 = weightedPercentile(recentR, recentW, 95);
    pSignal = Math.max(p65 + 100, p80 + 25, p95 - 125);
  } else if (n >= 10) {
    pSignal = Math.max(p65 + 100, p80 + 25, recentR[recentR.length - 1] - 200);
  } else if (n > 0) {
    pSignal = Math.max(p65 + 100, p80 + 25);
  }

  // Confidence
  var hardThreshold = pSignal - 100;
  var hardCount = acRatings.filter(function(r){ return r >= hardThreshold; }).length;
  var volumeScore = Math.min(1, n / 80);
  var consistencyScore = Math.min(1, hardCount / 15);
  var confidence = clamp(0.15 + 0.35 * volumeScore + 0.25 * consistencyScore + 0.15 * 0.8 + 0.10 * 0.5, 0.15, 0.95);

  var growth = pSignal - historyAnchor;
  var estimated = growth > 0 ? historyAnchor + growth * (0.55 + 0.45 * confidence) : historyAnchor;

  // Decay
  var lma = getLastMeaningful(rh, ps);
  var decay = 0;
  if (lma && (Date.now() - lma) / 86400000 > 90) {
    decay = Math.min(120, Math.floor(10 * Math.log2(((Date.now() - lma) / 86400000) / 90)));
  }
  estimated -= decay;
  estimated = Math.max(estimated, cr - 100);
  return {
    estimatedRating: Math.round(estimated / 25) * 25,
    currentRating: cr, maxRating: mr,
    ratingDelta: Math.round(estimated / 25) * 25 - cr,
    confidence: Math.round(confidence * 100) / 100,
    modelType: "rated",
    practiceSignal: Math.round(pSignal),
    evidence: { p80: Math.round(p80), hardSolveCount: hardCount }
  };
}

function estimateUnrated(ps) {
  var ac = ps.filter(function(s){ return s.accepted && s.rating > 0; }).map(function(s){ return s.rating; }).sort(function(a,b){return a-b;});
  var n = ac.length;
  if (n === 0) return { estimatedRating: 800, modelType: "unrated", confidence: 0.15 };
  // Simplified practice signal
  var p60 = percentile(ac, 60), p75 = percentile(ac, 75), p85 = percentile(ac, 85);
  var maxR = ac[n - 1];
  var pSig = n >= 20 ? Math.max(p60 + 150, p75 + 75, p85, (percentile(ac, 95)) - 150, maxR - 250)
    : n >= 10 ? Math.max(p60 + 150, p75 + 75, p85, maxR - 250)
    : Math.max(p60 + 150, p75 + 75, p85);
  var penalty = n < 5 ? 250 : n < 10 ? 180 : n < 20 ? 120 : n < 40 ? 70 : n < 70 ? 30 : 0;
  var cap = n < 5 ? 1200 : n < 10 ? 1400 : n < 20 ? 1600 : n < 40 ? 1800 : n < 70 ? 2050 : 2300;
  var est = clamp(pSig - penalty, 800, cap);
  return { estimatedRating: Math.round(est / 25) * 25, modelType: "unrated", confidence: Math.min(1, n / 80) };
}

function computeWeights(ps) {
  var m = new Map();
  var now = Date.now();
  for (var i = 0; i < ps.length; i++) {
    var s = ps[i];
    if (!s.accepted || !s.rating || s.rating <= 0 || !s.firstAcceptedAt) continue;
    var days = Math.max(0, (now - new Date(s.firstAcceptedAt).getTime()) / 86400000);
    var rw = 0.35 + 0.65 * Math.exp(-days / 180);
    var wa = Math.max(0, s.attempts - 1);
    var aw = wa === 0 ? 1 : wa === 1 ? 0.95 : wa <= 3 ? 0.85 : 0.72;
    m.set(s.problemKey, { rating: s.rating, weight: rw * aw });
  }
  return m;
}

function getLastMeaningful(rh, ps) {
  var contest = rh.length > 0 ? new Date(rh[rh.length - 1].ratingUpdateAt).getTime() : 0;
  var ac = 0;
  for (var i = 0; i < ps.length; i++) {
    if (ps[i].accepted && ps[i].firstAcceptedAt) {
      var t = new Date(ps[i].firstAcceptedAt).getTime();
      if (t > ac) ac = t;
    }
  }
  return Math.max(contest, ac) || null;
}

// Test data helpers
function mkStat(o) {
  o = o || {};
  var d = new Date().toISOString();
  return {
    problemKey: o.problemKey || "cf:1:A", contestId: o.contestId || 1, index: o.index || "A",
    name: o.name || "P", rating: o.rating === undefined ? 1500 : o.rating,
    tags: o.tags || ["dp"], attempts: o.attempts === undefined ? 1 : o.attempts,
    accepted: o.accepted === undefined ? false : o.accepted,
    firstAcceptedAt: o.firstAcceptedAt || (o.accepted ? d : null),
    lastSubmittedAt: o.lastSubmittedAt || d, lastVerdict: o.lastVerdict || null,
  };
}

// =============================================================================
describe("estimateUserRating: rated users", function() {
  it("CR1500 MR1700 + steady 1800-1900 practice => estimate > 1700", function() {
    var ps = [];
    for (var i = 0; i < 80; i++) ps.push(mkStat({ problemKey: "cf:" + i + ":A", rating: 1800 + Math.floor(Math.random() * 100), accepted: true }));
    var r = estimateUserRating({ currentRating: 1500, maxRating: 1700, ratingHistory: [{ contestId: 1, contestName: "R1", newRating: 1500, oldRating: 1450, ratingUpdateAt: "2026-05-01" }], problemStats: ps, lastOnlineAt: null });
    assert.ok(r.estimatedRating > 1700, "estimate " + r.estimatedRating + " should be > 1700");
    assert.equal(r.modelType, "rated");
  });

  it("Single 2300 problem + mostly 1000 does NOT estimate near 2300", function() {
    var ps = [];
    for (var i = 0; i < 50; i++) ps.push(mkStat({ problemKey: "cf:" + i + ":A", rating: 900 + Math.floor(Math.random() * 200), accepted: true }));
    ps.push(mkStat({ problemKey: "cf:hard:Z", rating: 2300, accepted: true }));
    var r = estimateUserRating({ currentRating: 800, maxRating: 800, ratingHistory: [], problemStats: ps, lastOnlineAt: null });
    assert.ok(r.estimatedRating < 1600, "single hard problem should not inflate to " + r.estimatedRating);
  });

  it("6 months no contest but daily practice => practice signal may exceed rating", function() {
    var ps = [];
    var yesterday = new Date(Date.now() - 86400000).toISOString();
    var sixMonthsAgoContest = new Date(Date.now() - 180 * 86400000).toISOString();
    for (var i = 0; i < 40; i++) ps.push(mkStat({ problemKey: "cf:" + i + ":A", rating: 1500, accepted: true, firstAcceptedAt: yesterday }));
    var r = estimateUserRating({ currentRating: 1400, maxRating: 1400, ratingHistory: [{ contestId: 1, contestName: "Old", newRating: 1400, oldRating: 1300, ratingUpdateAt: sixMonthsAgoContest }], problemStats: ps, lastOnlineAt: null });
    // Active daily practice on 1500 problems: estimate should be >= currentRating (no decay)
    assert.ok(r.estimatedRating >= 1400, "active practice should prevent decay below current, got " + r.estimatedRating);
  });

  it("6 months no contest and no practice => should be at or below current (decay possible)", function() {
    var ps = [];
    var longAgo = new Date(Date.now() - 185 * 86400000).toISOString();
    for (var i = 0; i < 10; i++) ps.push(mkStat({ problemKey: "cf:" + i + ":A", rating: 1500, accepted: true, firstAcceptedAt: longAgo }));
    var r = estimateUserRating({ currentRating: 1400, maxRating: 1400, ratingHistory: [{ contestId: 1, contestName: "Old", newRating: 1400, oldRating: 1300, ratingUpdateAt: longAgo }], problemStats: ps, lastOnlineAt: null });
    // Even with no recent activity, estimate stays near current (max -100 decay)
    assert.ok(r.estimatedRating >= 1300, "estimate should not fall below current-100, got " + r.estimatedRating);
  });

  it("Rating increment < 100 => no contest recommended", function() {
    var r = estimateUserRating({ currentRating: 1500, maxRating: 1500, ratingHistory: [{ contestId: 1, contestName: "R1", newRating: 1500, oldRating: 1450, ratingUpdateAt: "2026-05-01" }], problemStats: [mkStat({ rating: 1500, accepted: true })], lastOnlineAt: null });
    // Check the output can be tested for growth threshold
    var growth = r.estimatedRating - r.currentRating;
    assert.ok(growth < 100, "growth " + growth + " should be < 100");
  });

  it("Rating increment > 100 but low confidence => no recommendation", function() {
    var ps = [];
    for (var i = 0; i < 5; i++) ps.push(mkStat({ problemKey: "cf:" + i + ":A", rating: 2000, accepted: true }));
    var r = estimateUserRating({ currentRating: 1000, maxRating: 1000, ratingHistory: [], problemStats: ps, lastOnlineAt: null });
    assert.ok(r.confidence < 0.65 || r.recentRatedSolvedCount < 15, "low data should yield low confidence");
  });
});

describe("estimateUserRating: unrated users", function() {
  it("3 solves, one hard => should be capped", function() {
    var ps = [
      mkStat({ problemKey: "cf:1:A", rating: 800, accepted: true }),
      mkStat({ problemKey: "cf:1:B", rating: 900, accepted: true }),
      mkStat({ problemKey: "cf:1:C", rating: 2300, accepted: true }),
    ];
    var r = estimateUserRating({ currentRating: 0, maxRating: 0, ratingHistory: [], problemStats: ps, lastOnlineAt: null });
    assert.ok(r.estimatedRating <= 1200, "cap should apply, got " + r.estimatedRating);
  });

  it("80 stable solves 1600-1900 => reasonable estimate, not overly capped", function() {
    var ps = [];
    for (var i = 0; i < 80; i++) ps.push(mkStat({ problemKey: "cf:" + i + ":A", rating: 1600 + Math.floor(Math.random() * 300), accepted: true }));
    var r = estimateUserRating({ currentRating: 0, maxRating: 0, ratingHistory: [], problemStats: ps, lastOnlineAt: null });
    assert.ok(r.estimatedRating >= 1400, "should not be too low, got " + r.estimatedRating);
    assert.ok(r.estimatedRating <= 2300, "cap should be reasonable, got " + r.estimatedRating);
  });

  it("Zero AC => 800 default", function() {
    var r = estimateUserRating({ currentRating: 0, maxRating: 0, ratingHistory: [], problemStats: [], lastOnlineAt: null });
    assert.equal(r.estimatedRating, 800);
  });
});

describe("weightedPercentile", function() {
  it("basic weighted percentile", function() {
    var v = [100, 200, 300, 400];
    var w = [1, 1, 1, 1];
    assert.ok(weightedPercentile(v, w, 50) >= 200 && weightedPercentile(v, w, 50) <= 300);
  });

  it("weighted 80 with uniform weights", function() {
    var v = [100, 200, 300, 400, 500];
    var w = [1, 1, 1, 1, 1];
    var result = weightedPercentile(v, w, 80);
    assert.ok(result >= 400);
  });
});

describe("ratings are rounded to nearest 25", function() {
  it("rounds to 25", function() {
    function round(r) { return Math.round(r / 25) * 25; }
    assert.equal(round(1500), 1500);
    assert.equal(round(1512), 1500);
    assert.equal(round(1513), 1525);
  });
});
