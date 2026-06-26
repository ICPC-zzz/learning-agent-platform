import assert from "node:assert/strict";
import test from "node:test";

const STORE_URL = new URL("./local-user-article-store.ts", import.meta.url).href;
const mod = await import(STORE_URL);
const {
  addFavoriteArticle,
  isFavoriteArticle,
  isValidFavoriteArticleEntry,
  loadFavoriteArticles,
  persistFavoriteArticles,
  removeFavoriteArticle,
} = mod;

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
    removeItem(key) {
      storage.delete(key);
    },
  },
};

function resetStorage() {
  storage.clear();
}

function makeEntry(overrides = {}) {
  return {
    articleId: "article-1",
    title: "TokenJuice: Agent 时代的 Token 疑问",
    sourcePlatform: "cnblogs",
    sourceName: "博客园",
    originalUrl: "https://example.com/articles/tokenjuice",
    updatedAt: "2026-06-20T00:00:00.000Z",
    ...overrides,
  };
}

test("token in article title remains valid for favorites storage", () => {
  const entry = makeEntry();
  assert.equal(isValidFavoriteArticleEntry(entry), true);
});

test("favorite articles persist and load when title contains token", () => {
  resetStorage();
  const entry = makeEntry();
  const next = addFavoriteArticle([], entry);
  assert.equal(isFavoriteArticle(next, entry.articleId), true);

  assert.equal(persistFavoriteArticles(next), true);
  const loaded = loadFavoriteArticles();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].title, entry.title);
});

test("removeFavoriteArticle removes matching articleId", () => {
  const entry = makeEntry();
  const next = removeFavoriteArticle([entry], entry.articleId);
  assert.equal(next.length, 0);
});
