import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const favoritePanel = readFileSync("apps/web/src/components/user/UserFavoriteArticlesPanel.tsx", "utf8");
const recentPanel = readFileSync("apps/web/src/components/user/UserRecentArticlesPanel.tsx", "utf8");
const userPage = readFileSync("apps/web/src/app/user/page.tsx", "utf8");
const recentReadingPageClient = readFileSync("apps/web/src/app/user/recent-reading/recent-reading-page-client.tsx", "utf8");
const favoriteBooksPageClient = readFileSync("apps/web/src/app/user/favorites/books/favorite-books-page-client.tsx", "utf8");
const favoriteProblemsPageClient = readFileSync("apps/web/src/app/user/favorites/problems/FavoriteProblemsPageClient.tsx", "utf8");

test("A524 formal user article panels do not hydrate browser localStorage", () => {
  for (const source of [favoritePanel, recentPanel]) {
    assert.doesNotMatch(source, /local-user-article-store/);
    assert.doesNotMatch(source, /loadFavoriteArticles|loadRecentArticleReadings/);
    assert.doesNotMatch(source, /persistFavoriteArticles|persistRecentArticleReadings/);
    assert.doesNotMatch(source, /localStorage/);
    assert.doesNotMatch(source, /local-storage-fallback/);
  }
});

test("A524 high-risk user subpages do not hydrate browser localStorage fallback", () => {
  for (const source of [recentReadingPageClient, favoriteBooksPageClient, favoriteProblemsPageClient]) {
    assert.doesNotMatch(source, /local-user-library-store|local-user-problem-store/);
    assert.doesNotMatch(source, /loadFavorites|loadRecentReadings|persistFavorites/);
    assert.doesNotMatch(source, /localStorage/);
  }
});

test("A524 formal user page passes authenticated user id into article loaders", () => {
  assert.match(userPage, /getCurrentAuthSession\(\)/);
  assert.match(userPage, /loadDbArticleFavoritesForUser\(session\.userId/);
  assert.match(userPage, /loadDbArticleRecentReadingsForUser\(session\.userId/);
  assert.doesNotMatch(userPage, /lap-web-dev-session/);
  assert.doesNotMatch(userPage, /userIdPreview/);
});

test("A524 formal user panels describe DB-only account-scoped data", () => {
  assert.match(favoritePanel, /只读取登录账号的数据库记录/);
  assert.match(recentPanel, /当前登录账号暂无数据库最近阅读记录/);
});
