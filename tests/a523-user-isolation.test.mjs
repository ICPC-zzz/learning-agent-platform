import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const articleFavoriteAction = readFileSync("apps/web/src/app/user/article-favorites-db-server-action.ts", "utf8");
const articleReadingAction = readFileSync("apps/web/src/app/user/article-recent-reading-db-server-action.ts", "utf8");
const cfActions = readFileSync("apps/web/src/app/user/codeforces-server-actions.ts", "utf8");
const assistantSession = readFileSync("apps/web/src/lib/assistant/assistant-session.ts", "utf8");
const assistantActions = readFileSync("apps/web/src/lib/assistant/assistant-server-actions.ts", "utf8");
const memoryService = readFileSync("apps/web/src/lib/assistant/memory-service.ts", "utf8");
const conversationRepo = readFileSync("apps/web/src/lib/assistant/assistant-conversation-repository.ts", "utf8");

test("A523 article user data actions use server session user id only", () => {
  for (const source of [articleFavoriteAction, articleReadingAction]) {
    assert.match(source, /getCurrentAuthSession\(\)/);
    assert.match(source, /session\.userId/);
    assert.doesNotMatch(source, /userIdPreview/);
    assert.doesNotMatch(source, /lap-web-dev-session/);
  }
});

test("A523 Codeforces actions resolve authenticated user server-side", () => {
  assert.match(cfActions, /getCurrentAuthSession\(\)/);
  assert.match(cfActions, /session\.userId/);
  assert.doesNotMatch(cfActions, /lap-web-dev-session/);
});

test("A523 assistant conversation and memory are keyed by formal user id", () => {
  assert.match(assistantSession, /getCurrentAuthSession\(\)/);
  assert.match(assistantSession, /userId: session\.userId/);
  assert.match(assistantActions, /readAssistantSession\(\)/);
  assert.match(assistantActions, /session\.userId/);
  assert.match(assistantActions, /listAssistantLongTermMemories\(session\.userId\)/);
  assert.match(memoryService, /createAssistantMemoryDbContext\(userId/);
  assert.match(conversationRepo, /filePathForUser\(userId\)/);
  assert.match(conversationRepo, /record\.session\.userId !== userId/);
});

test("A523 client cannot submit role or owner user id to core user-data actions", () => {
  for (const source of [articleFavoriteAction, articleReadingAction, cfActions]) {
    assert.doesNotMatch(source, /formData\.get\(["']userId["']\)/);
    assert.doesNotMatch(source, /formData\.get\(["']role["']\)/);
    assert.doesNotMatch(source, /currentUserId|ownerIdFromClient/);
  }
});
