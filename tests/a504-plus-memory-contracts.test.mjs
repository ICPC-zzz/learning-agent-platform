import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  COMPRESSION_REASONS,
  CompressionReason,
  CompressionResultStatus,
  ContextBudgetStatus,
  MEMORY_SOURCES,
  MEMORY_TIERS,
  MemoryRecordStatus,
  MemorySource,
  MemoryTier,
  authorizeMemoryWrite,
  createCompressionRequest,
  createPreviewCompressionResult,
  evaluateContextBudget,
  isCompressionReason,
  isMemorySource,
  isMemoryTier,
} from "../packages/ai-core/src/memory/index.ts";
import {
  InMemoryToolRuntime,
  ToolRiskLevel,
} from "../packages/ai-core/src/tools/index.ts";

describe("A504+ memory contracts", () => {
  it("exports runtime memory contract values through the package subpath", () => {
    assert.equal(typeof MemoryTier, "object");
    assert.equal(typeof MemorySource, "object");
    assert.equal(typeof CompressionReason, "object");
    assert.equal(typeof evaluateContextBudget, "function");
    assert.equal(typeof createCompressionRequest, "function");
    assert.equal(typeof authorizeMemoryWrite, "function");
  });

  it("maps the memory package subpath to a real source module", async () => {
    const packageJson = JSON.parse(
      await readFile("packages/ai-core/package.json", "utf8"),
    );

    assert.equal(packageJson.exports["./memory"], "./src/memory/index.ts");
    assert.equal(packageJson.exports["./tools"], "./src/tools/index.ts");
  });

  it("defines the required memory tier values", () => {
    assert.deepEqual([...MEMORY_TIERS], [
      "long_term",
      "working",
      "short_term",
    ]);
    assert.equal(isMemoryTier(MemoryTier.LongTerm), true);
    assert.equal(isMemoryTier("profile"), false);
  });

  it("defines the required memory source values", () => {
    assert.deepEqual([...MEMORY_SOURCES], [
      "conversation",
      "user_explicit",
      "learning_report",
      "review_plan",
      "codeforces_profile",
      "code_analysis",
    ]);
    assert.equal(isMemorySource(MemorySource.CodeforcesProfile), true);
    assert.equal(isMemorySource("raw_database_dump"), false);
  });

  it("represents manual compression reasons without invoking a model", () => {
    assert.deepEqual([...COMPRESSION_REASONS], [
      "context_budget",
      "user_requested",
      "conversation_boundary",
    ]);
    assert.equal(isCompressionReason(CompressionReason.UserRequested), true);

    const request = createCompressionRequest({
      reason: CompressionReason.UserRequested,
      sessionId: "session-a",
      sourceMessageIds: ["m1", "m2"],
      preserveMessageIds: ["m2"],
      inputTokenEstimate: 12000,
      targetTokenBudget: 4000,
      requestedByUser: true,
    });
    const result = createPreviewCompressionResult(request);

    assert.equal(result.status, CompressionResultStatus.PreviewOnly);
    assert.equal(result.modelInvoked, false);
    assert.equal(result.request.reason, CompressionReason.UserRequested);
    assert.equal(result.request.requestedByUser, true);
  });

  it("calculates context budget boundaries and asks for compression before blocking", () => {
    const budget = {
      contextWindowTokens: 100000,
      reservedOutputTokens: 20000,
      warningBufferTokens: 20000,
      compressionBufferTokens: 13000,
      blockingBufferTokens: 3000,
    };

    const warning = evaluateContextBudget({
      budget,
      currentInputTokens: 61000,
    });
    assert.equal(warning.status, ContextBudgetStatus.Warning);
    assert.equal(warning.needsCompression, false);
    assert.equal(warning.canContinueWithoutCompression, true);

    const needsCompression = evaluateContextBudget({
      budget,
      currentInputTokens: 67000,
    });
    assert.equal(needsCompression.status, ContextBudgetStatus.NeedsCompression);
    assert.equal(needsCompression.needsCompression, true);
    assert.equal(needsCompression.canContinueWithoutCompression, true);

    const blocking = evaluateContextBudget({
      budget,
      currentInputTokens: 78000,
    });
    assert.equal(blocking.status, ContextBudgetStatus.Blocking);
    assert.equal(blocking.needsCompression, true);
    assert.equal(blocking.canContinueWithoutCompression, false);
  });

  it("denies unauthorized memory writes by default", () => {
    const result = authorizeMemoryWrite({
      tier: MemoryTier.LongTerm,
      source: MemorySource.Conversation,
      status: MemoryRecordStatus.Candidate,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reason, "memory_write_permission_missing");
  });

  it("requires explicit confirmation before confirmed long-term memory writes", () => {
    const missingConfirmation = authorizeMemoryWrite({
      tier: MemoryTier.LongTerm,
      source: MemorySource.UserExplicit,
      status: MemoryRecordStatus.Confirmed,
      permissionGranted: true,
    });
    assert.equal(missingConfirmation.allowed, false);
    assert.equal(
      missingConfirmation.reason,
      "confirmed_memory_requires_user_confirmation",
    );

    const authorized = authorizeMemoryWrite({
      tier: MemoryTier.LongTerm,
      source: MemorySource.UserExplicit,
      status: MemoryRecordStatus.Confirmed,
      permissionGranted: true,
      userConfirmed: true,
    });
    assert.equal(authorized.allowed, true);
  });

  it("keeps readonly business context separate from writable long-term memory", () => {
    const result = authorizeMemoryWrite({
      tier: MemoryTier.LongTerm,
      source: MemorySource.LearningReport,
      status: MemoryRecordStatus.ReadonlyContext,
      permissionGranted: true,
      userConfirmed: true,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.reason, "readonly_context_is_not_writable_memory");
  });

  it("keeps the public tools runtime as the package tool entry", async () => {
    assert.equal(typeof InMemoryToolRuntime, "function");
    assert.equal(ToolRiskLevel.Low, "low");

    const toolsModule = await import("../packages/ai-core/src/tools/index.ts");
    assert.equal("SkeletonAgentToolExecutor" in toolsModule, false);
  });
});
