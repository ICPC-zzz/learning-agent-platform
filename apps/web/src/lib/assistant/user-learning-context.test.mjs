import assert from "node:assert/strict";
import test from "node:test";

const mod = await import("./user-learning-context.ts");

test("summarizeRecentReadings includes article and practice signals", () => {
  const summary = mod.summarizeRecentReadings(
    [
      {
        articleTitle: "Article A",
        sourcePlatform: "cnblogs",
        sourceName: "博客园",
        originalUrl: "https://example.com/a",
        lastReadAt: "2026-06-20T00:00:00.000Z",
      },
    ],
    [
      {
        bookTitle: "Book B",
        chapterTitle: "Chapter 1",
        durationSeconds: 600,
        progressRatio: 0.5,
      },
    ],
    {
      totalSessions: 1,
      totalDurationSeconds: 600,
      totalDurationMinutes: 10,
    },
  );

  assert.ok(summary.includes("Article A"));
  assert.ok(summary.includes("Book B / Chapter 1"));
});

test("summarizeRecentReadings falls back to article reading only", () => {
  const summary = mod.summarizeRecentReadings(
    [
      {
        articleTitle: "Article A",
        sourcePlatform: "csdn",
        sourceName: "CSDN",
        originalUrl: "https://example.com/a",
        lastReadAt: "2026-06-20T00:00:00.000Z",
      },
    ],
    [],
    {
      totalSessions: 0,
      totalDurationSeconds: 0,
      totalDurationMinutes: 0,
    },
  );

  assert.equal(summary, "最近阅读 1 篇文章，最近一篇是《Article A》");
});

test("mergeAssistantLearningContext keeps base summary when override is placeholder", () => {
  const merged = mod.mergeAssistantLearningContext(
    {
      userLabel: "server",
      hasSession: true,
      abilityBand: "intermediate",
      currentLevel: "intermediate",
      recentPracticeCount: 3,
      recentProblemIds: ["p-1"],
      recentAttemptSummary: "DB recent practice summary",
      recentWrongBookSummary: "",
      recentReadingSummary: "DB recent reading summary",
      learningGoalSummary: "DB goal",
      recentRouteHint: "/problems/p-1",
    },
    {
      userLabel: "client",
      hasSession: false,
      abilityBand: undefined,
      currentLevel: undefined,
      recentPracticeCount: 0,
      recentProblemIds: [],
      recentAttemptSummary: "本地暂无最近刷题记录。",
      recentWrongBookSummary: "",
      recentReadingSummary: "",
      learningGoalSummary: "",
      recentRouteHint: undefined,
    },
  );

  assert.equal(merged.recentAttemptSummary, "DB recent practice summary");
  assert.equal(merged.recentReadingSummary, "DB recent reading summary");
  assert.equal(merged.recentPracticeCount, 3);
});

test("mergeAssistantLearningContext prefers base DB summaries over client fallback", () => {
  const merged = mod.mergeAssistantLearningContext(
    {
      userLabel: "server",
      hasSession: true,
      abilityBand: "advanced",
      currentLevel: "advanced",
      recentPracticeCount: 4,
      recentProblemIds: ["p-1", "p-2"],
      recentAttemptSummary: "DB practice summary",
      recentWrongBookSummary: "DB wrong-book summary",
      recentReadingSummary: "DB reading summary",
      learningGoalSummary: "DB goal summary",
      recentRouteHint: "/problems/p-1",
    },
    {
      userLabel: "client",
      hasSession: false,
      abilityBand: "starting",
      currentLevel: "starting",
      recentPracticeCount: 1,
      recentProblemIds: ["local-1"],
      recentAttemptSummary: "本地最近刷题 1 次",
      recentWrongBookSummary: "本地错题摘要",
      recentReadingSummary: "本地最近阅读摘要",
      learningGoalSummary: "本地目标",
      recentRouteHint: "/problems/local-1",
    },
  );

  assert.equal(merged.userLabel, "server");
  assert.equal(merged.abilityBand, "advanced");
  assert.equal(merged.currentLevel, "advanced");
  assert.equal(merged.recentPracticeCount, 4);
  assert.equal(merged.recentAttemptSummary, "DB practice summary");
  assert.equal(merged.recentWrongBookSummary, "DB wrong-book summary");
  assert.equal(merged.recentReadingSummary, "DB reading summary");
  assert.equal(merged.learningGoalSummary, "DB goal summary");
  assert.equal(merged.recentRouteHint, "/problems/p-1");
  assert.deepEqual(merged.recentProblemIds, ["p-1", "p-2", "local-1"]);
});
