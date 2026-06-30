import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeEntry = readFileSync("apps/web/src/app/_components/HomeLoginEntry.tsx", "utf8");
const homePage = readFileSync("apps/web/src/app/page.tsx", "utf8");
const userPage = readFileSync("apps/web/src/app/user/page.tsx", "utf8");
const articleAction = readFileSync("apps/web/src/app/user/article-favorites-db-server-action.ts", "utf8");
const recentAction = readFileSync("apps/web/src/app/user/article-recent-reading-db-server-action.ts", "utf8");

test("A522 home auth UI no longer labels primary auth as dev-only", () => {
  assert.doesNotMatch(homeEntry, /非生产 Auth|dev-only Auth|dev-only 路/);
  assert.match(homeEntry, /数据库会话/);
});

test("A522 protected home and user pages do not read localStorage or dev session", () => {
  for (const source of [homePage, userPage]) {
    assert.doesNotMatch(source, /localStorage/);
    assert.doesNotMatch(source, /lap-web-dev-session/);
    assert.doesNotMatch(source, /deserializeDevSession/);
  }
});

test("A522 core article user-data actions do not use browser fallback as authority", () => {
  for (const source of [articleAction, recentAction]) {
    assert.doesNotMatch(source, /localStorage/);
    assert.doesNotMatch(source, /lap-web-dev-session/);
    assert.match(source, /getCurrentAuthSession\(\)/);
  }
});
