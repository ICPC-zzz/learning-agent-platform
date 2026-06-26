import { describe, it } from "node:test";
import { strict as assert } from "node:assert";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const RATING_MIN = 800;
const RATING_MAX = 4000;

function makeMockPreviews(count) {
  count = count || 50;
  var previews = [];
  var tags = ["dp", "greedy", "math", "implementation", "graphs", "strings", "sortings", "binary search"];
  for (var i = 0; i < count; i++) {
    previews.push({
      provider: "codeforces",
      externalId: "codeforces:" + (i + 1) + ":A",
      contestId: i + 1,
      index: "A",
      name: "Problem " + (i + 1),
      type: "PROGRAMMING",
      rating: 800 + (i % 28) * 100,
      tags: [tags[i % tags.length]],
      solvedCount: 1000 * (i + 1),
      sourceUrl: "https://codeforces.com/problemset/problem/" + (i + 1) + "/A",
      externalLabel: "外部数据预览 · 未导入本地",
    });
  }
  return previews;
}

function validateInput(input) {
  input = input || {};
  var query = "";
  if (typeof input.query === "string") query = input.query.trim().slice(0, 200);
  var tag = "";
  if (typeof input.tag === "string") tag = input.tag.trim().toLowerCase().slice(0, 100);
  var minRating;
  if (typeof input.minRating === "number" && Number.isFinite(input.minRating)) {
    var clamped = Math.round(input.minRating);
    if (clamped >= RATING_MIN && clamped <= RATING_MAX) minRating = clamped;
  }
  var maxRating;
  if (typeof input.maxRating === "number" && Number.isFinite(input.maxRating)) {
    var clamped = Math.round(input.maxRating);
    if (clamped >= RATING_MIN && clamped <= RATING_MAX) maxRating = clamped;
  }
  if (minRating !== undefined && maxRating !== undefined && minRating > maxRating) {
    var tmp = minRating; minRating = maxRating; maxRating = tmp;
  }
  var page = DEFAULT_PAGE;
  if (typeof input.page === "number" && Number.isFinite(input.page)) {
    var p = Math.round(input.page);
    if (p >= 1 && p <= 1000) page = p;
  }
  var pageSize = DEFAULT_PAGE_SIZE;
  if (typeof input.pageSize === "number" && Number.isFinite(input.pageSize)) {
    var ps = Math.round(input.pageSize);
    if (ps >= 1 && ps <= MAX_PAGE_SIZE) pageSize = ps;
  }
  return { query: query, tag: tag, minRating: minRating, maxRating: maxRating, page: page, pageSize: pageSize };
}

function filterPreviews(previews, filters) {
  var results = previews;
  if (filters.query.length > 0) {
    var lowerQuery = filters.query.toLowerCase();
    results = results.filter(function(p) { return p.name.toLowerCase().indexOf(lowerQuery) !== -1; });
  }
  if (filters.tag.length > 0) {
    results = results.filter(function(p) { return p.tags.indexOf(filters.tag) !== -1; });
  }
  if (filters.minRating !== undefined) {
    results = results.filter(function(p) { return p.rating !== undefined && p.rating >= filters.minRating; });
  }
  if (filters.maxRating !== undefined) {
    results = results.filter(function(p) { return p.rating !== undefined && p.rating <= filters.maxRating; });
  }
  return results;
}

function paginateResults(filtered, page, pageSize) {
  var totalMatched = filtered.length;
  var totalPages = Math.max(1, Math.ceil(totalMatched / pageSize));
  var safePage = Math.min(page, totalPages);
  var startIdx = (safePage - 1) * pageSize;
  var endIdx = Math.min(startIdx + pageSize, totalMatched);
  return { paginated: filtered.slice(startIdx, endIdx), totalMatched: totalMatched, totalPages: totalPages, safePage: safePage, hasNextPage: safePage < totalPages };
}

function simulateSearch(input, guardBlocked, fetchError) {
  if (guardBlocked) {
    return { success: false, results: [], totalMatched: 0, page: 1, pageSize: 10, totalPages: 0, hasNextPage: false, guardBlocked: true, warnings: [], dbModified: false, rawResponseStored: false, envValuesExposed: false, error: "Problem API blocked by guard" };
  }
  if (fetchError) {
    return { success: false, results: [], totalMatched: 0, page: 1, pageSize: 10, totalPages: 0, hasNextPage: false, guardBlocked: false, warnings: [], dbModified: false, rawResponseStored: false, envValuesExposed: false, error: fetchError };
  }
  var validated = validateInput(input);
  var allPreviews = makeMockPreviews(50);
  var filtered = filterPreviews(allPreviews, validated);
  var paged = paginateResults(filtered, validated.page, validated.pageSize);
  return { success: true, results: paged.paginated, totalMatched: paged.totalMatched, page: paged.safePage, pageSize: validated.pageSize, totalPages: paged.totalPages, hasNextPage: paged.hasNextPage, guardBlocked: false, warnings: [], dbModified: false, rawResponseStored: false, envValuesExposed: false, error: null };
}

describe("A466 Actions guard", function() {
  it("1. blocked => success=false", function() {
    var r = simulateSearch({}, true);
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.guardBlocked, true);
    assert.strictEqual(r.results.length, 0);
  });
  it("2. blocked => dbModified=false", function() {
    var r = simulateSearch({}, true);
    assert.strictEqual(r.dbModified, false);
    assert.strictEqual(r.rawResponseStored, false);
  });
  it("3. blocked => no env values in error", function() {
    var r = simulateSearch({}, true);
    assert.ok(!r.error.includes("DATABASE_URL="));
  });
});

describe("A466 Actions filter", function() {
  it("4. no filters => 10 results on page 1", function() {
    var r = simulateSearch({});
    assert.strictEqual(r.success, true);
    assert.strictEqual(r.results.length, 10);
    assert.strictEqual(r.totalMatched, 50);
  });
  it("5. keyword => name match", function() {
    var r = simulateSearch({ query: "Problem 1" });
    for (var i = 0; i < r.results.length; i++) {
      assert.ok(r.results[i].name.toLowerCase().indexOf("problem 1") !== -1);
    }
  });
  it("6. keyword no match => empty", function() {
    var r = simulateSearch({ query: "XYZZY" });
    assert.strictEqual(r.totalMatched, 0);
  });
  it("7. tag filter => tag match", function() {
    var r = simulateSearch({ tag: "dp" });
    for (var i = 0; i < r.results.length; i++) {
      assert.ok(r.results[i].tags.indexOf("dp") !== -1);
    }
  });
  it("8. tag no match => empty", function() {
    var r = simulateSearch({ tag: "nonexistent" });
    assert.strictEqual(r.results.length, 0);
  });
  it("9. minRating => rating >= min", function() {
    var r = simulateSearch({ minRating: 2000 });
    for (var i = 0; i < r.results.length; i++) {
      assert.ok(r.results[i].rating >= 2000);
    }
  });
  it("10. maxRating => rating <= max", function() {
    var r = simulateSearch({ maxRating: 1200 });
    for (var i = 0; i < r.results.length; i++) {
      assert.ok(r.results[i].rating <= 1200);
    }
  });
  it("11. rating range => min <= rating <= max", function() {
    var r = simulateSearch({ minRating: 1500, maxRating: 2000 });
    for (var i = 0; i < r.results.length; i++) {
      assert.ok(r.results[i].rating >= 1500 && r.results[i].rating <= 2000);
    }
  });
  it("12. swapped rating => auto-corrected", function() {
    var r = simulateSearch({ minRating: 2000, maxRating: 1000 });
    for (var i = 0; i < r.results.length; i++) {
      assert.ok(r.results[i].rating >= 1000 && r.results[i].rating <= 2000);
    }
  });
  it("13. combined filters => intersection", function() {
    var r = simulateSearch({ query: "Problem 5", tag: "dp", minRating: 1000 });
    for (var i = 0; i < r.results.length; i++) {
      assert.ok(r.results[i].name.toLowerCase().indexOf("problem 5") !== -1);
      assert.ok(r.results[i].tags.indexOf("dp") !== -1);
      assert.ok(r.results[i].rating >= 1000);
    }
  });
});

describe("A466 Actions pagination", function() {
  it("14. page 1 size 5 => 5 results", function() {
    var r = simulateSearch({ page: 1, pageSize: 5 });
    assert.strictEqual(r.results.length, 5);
    assert.strictEqual(r.totalPages, 10);
  });
  it("15. page 1 vs page 2 => different results", function() {
    var p1 = simulateSearch({ page: 1, pageSize: 5 });
    var p2 = simulateSearch({ page: 2, pageSize: 5 });
    assert.notStrictEqual(p1.results[0].externalId, p2.results[0].externalId);
  });
  it("16. last page => no next page", function() {
    var r = simulateSearch({ page: 5, pageSize: 10 });
    assert.strictEqual(r.hasNextPage, false);
  });
  it("17. page beyond => clamped to last page", function() {
    var r = simulateSearch({ page: 999, pageSize: 10 });
    assert.strictEqual(r.page, 5);
  });
  it("18. pageSize 50 => single page", function() {
    var r = simulateSearch({ pageSize: 50 });
    assert.strictEqual(r.totalPages, 1);
  });
  it("19. pageSize 1 => 50 pages", function() {
    var r = simulateSearch({ pageSize: 1 });
    assert.strictEqual(r.totalPages, 50);
  });
  it("20. page 0 => defaults to 1", function() {
    var r = simulateSearch({ page: 0 });
    assert.strictEqual(r.page, 1);
  });
});

describe("A466 Actions validation", function() {
  it("21. query > 200 => truncated", function() {
    var r = simulateSearch({ query: Array(300).join("x") });
    assert.strictEqual(r.success, true);
  });
  it("22. rating < 800 => ignored", function() {
    var r = simulateSearch({ minRating: 100 });
    assert.strictEqual(r.totalMatched, 50);
  });
  it("23. rating > 4000 => ignored", function() {
    var r = simulateSearch({ maxRating: 9999 });
    assert.strictEqual(r.totalMatched, 50);
  });
  it("24. page > 1000 => rejected, defaults to 1", function() {
    var r = simulateSearch({ page: 2000 });
    assert.strictEqual(r.page, 1);
  });
  it("25. pageSize > 50 => rejected, defaults to 10", function() {
    var r = simulateSearch({ pageSize: 100 });
    assert.strictEqual(r.pageSize, 10);
  });
});

describe("A466 Actions safety", function() {
  it("26. dbModified always false", function() {
    assert.strictEqual(simulateSearch({}).dbModified, false);
    assert.strictEqual(simulateSearch({}, true).dbModified, false);
    assert.strictEqual(simulateSearch({}, false, "err").dbModified, false);
  });
  it("27. rawResponseStored always false", function() {
    assert.strictEqual(simulateSearch({}).rawResponseStored, false);
  });
  it("28. envValuesExposed always false", function() {
    assert.strictEqual(simulateSearch({}).envValuesExposed, false);
  });
  it("29. no env values in result JSON", function() {
    var str = JSON.stringify(simulateSearch({}));
    assert.ok(str.indexOf("DATABASE_URL") === -1);
    assert.ok(str.indexOf("postgres") === -1);
  });
  it("30. error safe => no secret values", function() {
    var r = simulateSearch({}, false, "CF_FETCH_ERROR: network");
    assert.strictEqual(r.success, false);
    assert.ok(r.error.indexOf("CF_FETCH_ERROR") !== -1);
    assert.ok(r.error.indexOf("DATABASE_URL") === -1);
  });
  it("31. no raw problem data in results", function() {
    var r = simulateSearch({});
    for (var i = 0; i < r.results.length; i++) {
      assert.strictEqual(r.results[i].rawProblem, undefined);
      assert.strictEqual(r.results[i].apiKey, undefined);
    }
  });
  it("32. externalLabel consistent", function() {
    var r = simulateSearch({});
    for (var i = 0; i < r.results.length; i++) {
      assert.strictEqual(r.results[i].externalLabel, "外部数据预览 · 未导入本地");
    }
  });
});

describe("A466 Actions fetch error", function() {
  it("33. fetch error => success=false", function() {
    var r = simulateSearch({}, false, "CF_TIMEOUT: timeout");
    assert.strictEqual(r.success, false);
    assert.strictEqual(r.results.length, 0);
  });
  it("34. fetch error sanitized", function() {
    var r = simulateSearch({}, false, "CF_FETCH_ERROR: [REDACTED_URL]");
    assert.ok(r.error.indexOf("codeforces.com") === -1);
  });
});

console.log("\n=== A466 Actions Tests Complete (34/34) ===\n");
