/**
 * Tests for local-user-library-store pure functions.
 */
import assert from "node:assert/strict";
import test from "node:test";

const STORE_URL = new URL("./local-user-library-store.ts", import.meta.url).href;
const mod = await import(STORE_URL);
const {
  isFavorite,
  addFavorite,
  removeFavorite,
  addRecentReading,
  getRecentReadings,
  isValidFavoriteEntry,
  isValidRecentReadingEntry,
  hasSensitiveFields,
} = mod;

function makeFavEntry(overrides = {}) {
  return {
    bookId: "book-1",
    title: "Test Book",
    sourceType: "内置示例书",
    firstChapterId: "ch-1",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRecentEntry(overrides = {}) {
  return {
    bookId: "book-1",
    chapterId: "ch-1",
    bookTitle: "Test Book",
    chapterTitle: "Chapter 1",
    sourceType: "内置示例书",
    lastReadAt: new Date().toISOString(),
    ...overrides,
  };
}

// ---- Favorites ----

test("empty favorites has isFavorite=false", () => {
  assert.equal(isFavorite([], "any"), false);
});

test("isFavorite matches bookId", () => {
  assert.equal(isFavorite([makeFavEntry({ bookId: "b1" })], "b1"), true);
});

test("isFavorite non-match", () => {
  assert.equal(isFavorite([makeFavEntry({ bookId: "b1" })], "b2"), false);
});

test("addFavorite adds to empty", () => {
  const favs = addFavorite([], makeFavEntry());
  assert.equal(favs.length, 1);
});

test("addFavorite no duplicate", () => {
  const e = makeFavEntry();
  assert.equal(addFavorite([e], e).length, 1);
});

test("addFavorite prepends", () => {
  const a = makeFavEntry({ bookId: "a" });
  const b = makeFavEntry({ bookId: "b" });
  const favs = addFavorite([a], b);
  assert.equal(favs[0].bookId, "b");
});

test("removeFavorite by bookId", () => {
  const favs = removeFavorite([makeFavEntry({ bookId: "a" }), makeFavEntry({ bookId: "b" })], "a");
  assert.equal(favs.length, 1);
  assert.equal(favs[0].bookId, "b");
});

test("removeFavorite not found unchanged", () => {
  assert.equal(removeFavorite([makeFavEntry({ bookId: "a" })], "z").length, 1);
});

// ---- Recent reading ----

test("addRecentReading to empty", () => {
  assert.equal(addRecentReading([], makeRecentEntry()).length, 1);
});

test("addRecentReading deduplicates", () => {
  const old = makeRecentEntry({ bookId: "b", chapterId: "ch1", lastReadAt: "2025" });
  const upd = makeRecentEntry({ bookId: "b", chapterId: "ch1", lastReadAt: "2026" });
  assert.equal(addRecentReading([old], upd).length, 1);
  assert.equal(addRecentReading([old], upd)[0].lastReadAt, "2026");
});

test("addRecentReading prepends", () => {
  const a = makeRecentEntry({ bookId: "a", chapterId: "cha" });
  const b = makeRecentEntry({ bookId: "b", chapterId: "chb" });
  assert.equal(addRecentReading([a], b)[0].bookId, "b");
});

test("getRecentReadings limits", () => {
  const entries = [1, 2, 3, 4, 5].map(function(n) {
    return makeRecentEntry({ bookId: String(n) });
  });
  assert.equal(getRecentReadings(entries, 3).length, 3);
});

// ---- Validation ----

test("isValidFavoriteEntry valid", () => {
  assert.equal(isValidFavoriteEntry(makeFavEntry()), true);
});

test("isValidFavoriteEntry null", () => {
  assert.equal(isValidFavoriteEntry(null), false);
});

test("isValidFavoriteEntry missing bookId", () => {
  var e = makeFavEntry();
  delete e.bookId;
  assert.equal(isValidFavoriteEntry(e), false);
});

test("isValidFavoriteEntry empty bookId", () => {
  assert.equal(isValidFavoriteEntry(makeFavEntry({ bookId: "" })), false);
});

test("isValidFavoriteEntry sensitive field", () => {
  assert.equal(isValidFavoriteEntry(makeFavEntry({ DATABASE_URL: "x" })), false);
});

test("isValidRecentReadingEntry valid", () => {
  assert.equal(isValidRecentReadingEntry(makeRecentEntry()), true);
});

test("isValidRecentReadingEntry missing chapterId", () => {
  var e = makeRecentEntry();
  delete e.chapterId;
  assert.equal(isValidRecentReadingEntry(e), false);
});

test("isValidRecentReadingEntry token field", () => {
  assert.equal(isValidRecentReadingEntry({ ...makeRecentEntry(), token: "x" }), false);
});

// ---- Safety ----

test("hasSensitiveFields DATABASE_URL", () => {
  assert.equal(hasSensitiveFields({ DATABASE_URL: "x" }), true);
});

test("hasSensitiveFields api_key", () => {
  assert.equal(hasSensitiveFields({ api_key: "x" }), true);
});

test("hasSensitiveFields clean", () => {
  assert.equal(hasSensitiveFields(makeFavEntry()), false);
});

test("hasSensitiveFields null", () => {
  assert.equal(hasSensitiveFields(null), false);
});

// ---- Duplicates ----

test("triple favorite no duplicate", () => {
  var e = makeFavEntry();
  var favs = addFavorite([], e);
  favs = addFavorite(favs, e);
  favs = addFavorite(favs, e);
  assert.equal(favs.length, 1);
});

// ---- Data integrity ----

test("fav entry no body text", () => {
  var e = makeFavEntry();
  assert.equal(e.plainText === undefined, true);
  assert.equal(e.rawText === undefined, true);
});

test("recent entry no body text", () => {
  var e = makeRecentEntry();
  assert.equal(e.plainText === undefined, true);
  assert.equal(e.rawText === undefined, true);
});

// ---- Corrupted data recovery ----

test("filter bad entries from parsed array", () => {
  var parsed = [
    makeFavEntry(),
    { bookId: "b", title: 123 },
    { title: "no id" },
    makeFavEntry({ bookId: "c" }),
    "string",
  ];
  var valid = parsed.filter(isValidFavoriteEntry);
  assert.equal(valid.length, 2);
});

test("filter bad recent entries", () => {
  var parsed = [makeRecentEntry(), { bookId: "b", chapterId: "c" }, null];
  assert.equal(parsed.filter(isValidRecentReadingEntry).length, 1);
});
