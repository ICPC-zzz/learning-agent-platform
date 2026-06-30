import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeLoader = readFileSync("apps/web/src/app/home-dashboard-loader.ts", "utf8");
const userPage = readFileSync("apps/web/src/app/user/page.tsx", "utf8");
const articleAction = readFileSync("apps/web/src/app/user/article-favorites-db-server-action.ts", "utf8");
const recentAction = readFileSync("apps/web/src/app/user/article-recent-reading-db-server-action.ts", "utf8");
const cfActions = readFileSync("apps/web/src/app/user/codeforces-server-actions.ts", "utf8");
const assistantSession = readFileSync("apps/web/src/lib/assistant/assistant-session.ts", "utf8");

test("A522 home dashboard uses real User.id for user-owned queries", () => {
  assert.match(homeLoader, /getCurrentAuthSession\(\)/);
  assert.match(homeLoader, /session\.userId/);
  assert.doesNotMatch(homeLoader, /userIdPreview/);
});

test("A522 user page article panels use authenticated User.id", () => {
  assert.match(userPage, /loadDbArticleFavoritesForUser\(session\.userId/);
  assert.match(userPage, /loadDbArticleRecentReadingsForUser\(session\.userId/);
});

test("A522 article and CF server actions resolve identity server-side", () => {
  assert.match(articleAction, /getCurrentAuthSession\(\)/);
  assert.match(articleAction, /session\.userId/);
  assert.match(recentAction, /getCurrentAuthSession\(\)/);
  assert.match(recentAction, /session\.userId/);
  assert.match(cfActions, /getCurrentAuthSession\(\)/);
  assert.doesNotMatch(cfActions, /lap-web-dev-session/);
});

test("A522 assistant session is a formal auth adapter", () => {
  assert.match(assistantSession, /getCurrentAuthSession\(\)/);
  assert.match(assistantSession, /session\.userId/);
  assert.doesNotMatch(assistantSession, /lap-web-dev-session/);
});
