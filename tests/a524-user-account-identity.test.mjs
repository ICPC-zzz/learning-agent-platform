import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const userPage = readFileSync("apps/web/src/app/user/page.tsx", "utf8");

function currentAccountPanelSource() {
  const match = userPage.match(
    /<section className="learningPanel" aria-labelledby="current-account-title">[\s\S]*?<\/section>/,
  );
  assert.ok(match, "user page should render a current-account panel");
  return match[0];
}

test("A524 user page renders visible current account identity", () => {
  const panel = currentAccountPanelSource();

  assert.match(panel, /当前账号/);
  assert.match(panel, /账号信息/);
  assert.match(panel, /显示名称/);
  assert.match(panel, /session\.displayName/);
  assert.match(panel, /登录邮箱/);
  assert.match(userPage, /const emailLabel = session\.email \?\? "未绑定邮箱";/);
  assert.match(panel, /emailLabel/);
  assert.match(panel, /账号角色/);
  assert.match(userPage, /const roleLabel = session\.role === "ADMIN" \? "管理员" : "学习者";/);
  assert.match(panel, /会话状态/);
  assert.match(panel, /数据库会话/);
});

test("A524 user page does not expose sensitive session internals in account panel", () => {
  const panel = currentAccountPanelSource();

  assert.doesNotMatch(panel, /session\.sessionId/);
  assert.doesNotMatch(panel, /session\.userId/);
  assert.doesNotMatch(panel, /token/i);
  assert.doesNotMatch(panel, /cookie/i);
});
