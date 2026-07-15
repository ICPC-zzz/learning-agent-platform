import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reviewAction = readFileSync(
  new URL("../apps/web/src/app/user/cf-wrongbook-review-action.ts", import.meta.url),
  "utf8",
);
const refreshAction = readFileSync(
  new URL("../apps/web/src/app/user/codeforces-server-actions.ts", import.meta.url),
  "utf8",
);

test("错题复习计划与 Codeforces 刷新共用正式登录会话", () => {
  assert.match(reviewAction, /getCurrentAuthSession/);
  assert.match(refreshAction, /getCurrentAuthSession/);
  assert.doesNotMatch(reviewAction, /lap-web-dev-session/);
  assert.doesNotMatch(reviewAction, /deserializeDevSession/);
  assert.doesNotMatch(reviewAction, /userIdPreview/);
});
