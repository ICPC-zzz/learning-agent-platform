import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SERVER_ACTIONS = path.join(
  ROOT,
  "apps/web/src/lib/assistant/assistant-server-actions.ts",
);

test("A518 client conversation snapshot keeps archived messages after compression", async () => {
  const source = await readFile(SERVER_ACTIONS, "utf-8");
  const snapshotBody = source.slice(
    source.indexOf("function toConversationSnapshot"),
    source.indexOf("function toActiveConversationSnapshot"),
  );
  const promptBody = source.slice(
    source.indexOf("function toConversationSnapshotForPrompt"),
    source.indexOf("function isProviderFailureOrSelfDenialMessage"),
  );

  assert.ok(snapshotBody.includes("state.messages"));
  assert.ok(snapshotBody.includes("archivedAt"));
  assert.doesNotMatch(snapshotBody, /\.filter\(\(message\) => message\.archivedAt === undefined\)/);
  assert.ok(promptBody.includes("toActiveConversationSnapshot"));
});
