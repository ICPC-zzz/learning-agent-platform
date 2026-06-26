import assert from "node:assert/strict";
import test from "node:test";

import { buildReaderSyncDraft } from "./reader-sync-draft.ts";
import { buildReaderSyncPayloadPreview } from "./reader-sync-payload-preview.ts";
import { buildReaderSyncSubmitPlan } from "./reader-sync-submit-plan.ts";

test("buildReaderSyncSubmitPlan returns empty and canSubmit false for empty payload preview", () => {
  const draft = buildReaderSyncDraft(null);
  const payloadPreview = buildReaderSyncPayloadPreview(draft);
  const plan = buildReaderSyncSubmitPlan(payloadPreview);

  assert.equal(plan.previewOnly, true);
  assert.equal(plan.status, "empty");
  assert.equal(plan.canSubmit, false);
  assert.equal(plan.idempotencyKeyPreview, null);
  assert.equal(plan.blockers.some((item) => item.code === "PAYLOAD_EMPTY"), true);
});

test("buildReaderSyncSubmitPlan returns invalid and canSubmit false for invalid payload preview", () => {
  const draft = buildReaderSyncDraft("broken-summary");
  const payloadPreview = buildReaderSyncPayloadPreview(draft);
  const plan = buildReaderSyncSubmitPlan(payloadPreview);

  assert.equal(plan.status, "invalid");
  assert.equal(plan.canSubmit, false);
  assert.equal(plan.idempotencyKeyPreview, null);
  assert.equal(plan.blockers.some((item) => item.code === "PAYLOAD_INVALID"), true);
});

test("buildReaderSyncSubmitPlan returns partial and canSubmit false for partial payload preview", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-partial",
    progressRatio: 0.2,
  });
  const payloadPreview = buildReaderSyncPayloadPreview(draft);
  const plan = buildReaderSyncSubmitPlan(payloadPreview);

  assert.equal(plan.status, "partial");
  assert.equal(plan.canSubmit, false);
  assert.equal(plan.idempotencyKeyPreview, null);
  assert.equal(plan.blockers.some((item) => item.code === "PAYLOAD_PARTIAL"), true);
});

test("buildReaderSyncSubmitPlan keeps ready status but canSubmit remains false in preview-only mode", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-ready",
    chapterId: "chapter-ready",
    progressRatio: 0.66,
  });
  const payloadPreview = buildReaderSyncPayloadPreview(draft);
  const plan = buildReaderSyncSubmitPlan(payloadPreview);

  assert.equal(plan.status, "ready");
  assert.equal(plan.canSubmit, false);
  assert.equal(plan.blockers.some((item) => item.code === "PREVIEW_ONLY_GUARD"), true);
});

test("buildReaderSyncSubmitPlan creates stable idempotencyKeyPreview from local fields", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-idempotency",
    chapterId: "chapter-idempotency",
    progressRatio: 0.6,
  });
  const payloadPreview = buildReaderSyncPayloadPreview(draft);
  const planA = buildReaderSyncSubmitPlan(payloadPreview);
  const planB = buildReaderSyncSubmitPlan(payloadPreview);

  assert.equal(
    planA.idempotencyKeyPreview,
    "reader-sync-preview:book-idempotency:chapter-idempotency:0.600000",
  );
  assert.equal(planA.idempotencyKeyPreview, planB.idempotencyKeyPreview);
});

test("buildReaderSyncSubmitPlan returns null idempotencyKeyPreview when core fields are missing", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-missing-core",
    chapterId: "chapter-missing-core",
  });
  const payloadPreview = buildReaderSyncPayloadPreview(draft);
  const plan = buildReaderSyncSubmitPlan(payloadPreview);

  assert.equal(plan.idempotencyKeyPreview, null);
});

test("buildReaderSyncSubmitPlan requiredContext includes auth permission audit and idempotency requirements", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-required-context",
    chapterId: "chapter-required-context",
    progressRatio: 0.3,
  });
  const payloadPreview = buildReaderSyncPayloadPreview(draft);
  const plan = buildReaderSyncSubmitPlan(payloadPreview);

  const contextText = plan.requiredContext.join(" | ");
  assert.equal(contextText.includes("userId"), true);
  assert.equal(contextText.includes("auth"), true);
  assert.equal(contextText.includes("permission"), true);
  assert.equal(contextText.includes("audit"), true);
  assert.equal(contextText.includes("idempotency"), true);
});

test("buildReaderSyncSubmitPlan blockers include no server action and no db write authorization", () => {
  const draft = buildReaderSyncDraft({
    bookId: "book-blockers",
    chapterId: "chapter-blockers",
    progressRatio: 0.42,
  });
  const payloadPreview = buildReaderSyncPayloadPreview(draft);
  const plan = buildReaderSyncSubmitPlan(payloadPreview);

  assert.equal(plan.blockers.some((item) => item.code === "SERVER_ACTION_UNAVAILABLE"), true);
  assert.equal(plan.blockers.some((item) => item.code === "DB_WRITE_NOT_AUTHORIZED"), true);
});
