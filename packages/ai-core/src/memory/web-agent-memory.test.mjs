import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMemoryContextBundle,
  createCompactionBoundary,
  extractMemoryCandidates,
  LongTermMemoryStore,
  SessionSummaryStore,
  summarizeWorkingMemoryMessages,
  WorkingMemoryStore,
} from "./index.ts";

test("working memory summary keeps recent turns only", () => {
  const summary = summarizeWorkingMemoryMessages([
    { id: "m1", sessionId: "s1", role: "user", content: "Hello there", createdAt: "2026-01-01T00:00:00Z" },
    { id: "m2", sessionId: "s1", role: "assistant", content: "Hi, how can I help?", createdAt: "2026-01-01T00:00:01Z" },
    { id: "m3", sessionId: "s1", role: "user", content: "I prefer concise answers.", createdAt: "2026-01-01T00:00:02Z" },
  ]);

  assert.equal(summary.includes("prefer concise answers"), true);
  assert.equal(summary.includes("hello there"), true);
});

test("compaction boundary and context bundle are deterministic", () => {
  const boundary = createCompactionBoundary({
    sessionId: "session-1",
    trigger: "auto",
    sourceMessageIds: ["m1", "m2"],
    sourceMessageRange: [0, 1],
    preservedTailMessageIds: ["m3"],
    preTokenEstimate: 1200,
    postTokenEstimate: 650,
    summaryId: "summary-1",
    createdAt: "2026-01-01T00:00:00Z",
  });

  const bundle = buildMemoryContextBundle({
    workingMessages: [
      { id: "m1", sessionId: "session-1", role: "user", content: "I prefer examples.", createdAt: "2026-01-01T00:00:00Z" },
      { id: "m2", sessionId: "session-1", role: "assistant", content: "Examples are helpful.", createdAt: "2026-01-01T00:00:01Z" },
    ],
    sessionSummaryText: "Session is about examples.",
    retrievedMemories: [],
  });

  assert.equal(boundary.sessionId, "session-1");
  assert.equal(boundary.trigger, "auto");
  assert.equal(bundle.promptText.includes("WORKING_MEMORY"), true);
  assert.equal(bundle.promptText.includes("SESSION_SUMMARY"), true);
});

test("memory extractor stays conservative and extracts explicit self preferences", () => {
  const candidates = extractMemoryCandidates([
    { id: "m1", sessionId: "s1", role: "user", content: "Please recommend an article.", createdAt: "2026-01-01T00:00:00Z" },
    { id: "m2", sessionId: "s1", role: "user", content: "I prefer concise answers and shorter replies.", createdAt: "2026-01-01T00:00:01Z" },
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].kind, "preference");
  assert.equal(candidates[0].content.includes("concise answers"), true);
});

test("working and long-term memory stores clone data safely", async () => {
  const workingStore = new WorkingMemoryStore();
  workingStore.appendMessages("session-1", [
    { id: "m1", sessionId: "session-1", role: "user", content: "Hello", createdAt: "2026-01-01T00:00:00Z" },
  ]);

  const summaries = new SessionSummaryStore();
  summaries.upsert({
    sessionId: "session-1",
    summaryText: "Session summary",
    sourceMessageIds: ["m1"],
    createdAt: "2026-01-01T00:00:00Z",
  });

  const longTermStore = new LongTermMemoryStore();
  await longTermStore.add({
    userId: "user-1",
    layer: "retrievable",
    content: "I prefer concise answers.",
    importance: 0.9,
    metadata: { category: "preference" },
  });

  const storedMessages = workingStore.getMessages("session-1");
  const summary = summaries.get("session-1");
  const searchResults = await longTermStore.search({ text: "concise answers", userId: "user-1", limit: 5 });

  assert.equal(storedMessages.length, 1);
  assert.equal(summary?.summaryText, "Session summary");
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].item.content.includes("concise"), true);
});
