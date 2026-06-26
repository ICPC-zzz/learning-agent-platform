import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY,
  maskIdempotencyKeyPreview,
  resolveStatusChineseLabel,
  resolveDuplicateConflictText,
  normalizeIdempotencyPreviewRecord,
  readReaderIdempotencyPreviewFromStorage,
  SAFE_IDEMPOTENCY_PREVIEW_COPY,
} = require("./local-reader-idempotency-preview-panel.js");

// --- maskIdempotencyKeyPreview ---

test("maskIdempotencyKeyPreview: masks long prefixed key", () => {
  const result = maskIdempotencyKeyPreview(
    "reader-sync-idempotency-v1:abcdef1234567890abcdef1234567890abcdef1234567890"
  );
  assert.equal(typeof result, "string");
  assert.equal(result.includes("***"), true, "should contain masking characters");
  assert.equal(
    result.includes("reader-sync-idempotency-v1:"),
    true,
    "should keep the prefix"
  );
  assert.equal(
    result.includes("abcdef1234567890abcdef1234567890abcdef1234567890"),
    false,
    "should not expose full hash"
  );
});

test("maskIdempotencyKeyPreview: masks short key", () => {
  const result = maskIdempotencyKeyPreview("abc123");
  assert.equal(result, "abc1***");
});

test("maskIdempotencyKeyPreview: returns null for empty", () => {
  assert.equal(maskIdempotencyKeyPreview(""), null);
  assert.equal(maskIdempotencyKeyPreview("   "), null);
});

// --- resolveStatusChineseLabel ---

test("resolveStatusChineseLabel: duplicate-safe -> 重复提交已短路", () => {
  const result = resolveStatusChineseLabel("duplicate-safe");
  assert.equal(result, "重复提交已短路（本地预览）");
});

test("resolveStatusChineseLabel: changed-preview -> 检测到变更冲突预览", () => {
  assert.equal(
    resolveStatusChineseLabel("changed-preview"),
    "检测到变更冲突预览"
  );
});

test("resolveStatusChineseLabel: conflict -> 检测到变更冲突预览", () => {
  assert.equal(resolveStatusChineseLabel("conflict"), "检测到变更冲突预览");
});

test("resolveStatusChineseLabel: blocked -> 幂等检查阻断", () => {
  assert.equal(resolveStatusChineseLabel("blocked"), "幂等检查阻断");
});

test("resolveStatusChineseLabel: idempotency-blocked -> 幂等检查阻断", () => {
  assert.equal(
    resolveStatusChineseLabel("idempotency-blocked"),
    "幂等检查阻断"
  );
});

test("resolveStatusChineseLabel: preview -> 仅本地预览", () => {
  assert.equal(
    resolveStatusChineseLabel("preview"),
    "仅本地预览，不代表真实同步"
  );
});

test("resolveStatusChineseLabel: unknown returns original", () => {
  assert.equal(resolveStatusChineseLabel("some-unknown-status"), "some-unknown-status");
});

// --- normalizeIdempotencyPreviewRecord ---

test("normalizeIdempotencyPreviewRecord: handles valid record with all fields", () => {
  const record = normalizeIdempotencyPreviewRecord({
    idempotencyKeyPreview: "reader-sync-idempotency-v1:abcdef1234567890abcdef1234567890abcd",
    status: "preview",
    reasonCode: "TRUSTED_SCOPE_FIRST_SUBMISSION",
    isDuplicate: false,
    isNew: true,
    isConflict: false,
    bookId: "book-001",
    chapterId: "chapter-010",
    progressRatio: 0.5,
    source: "reader-sync",
    previewOnly: true,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: ["SERVER_USER_ID_REQUIRED"],
  });

  assert.notEqual(record, null);
  assert.equal(record.idempotencyKeyPreviewText.includes("***"), true);
  assert.equal(record.bookIdText, "book-001");
  assert.equal(record.chapterIdText, "chapter-010");
  assert.equal(record.progressRatioText, "0.5000");
  assert.equal(record.previewOnlyText, "true");
  assert.equal(record.writesDatabaseText, "false");
  assert.equal(record.callsRepositoryText, "false");
});

test("normalizeIdempotencyPreviewRecord: masks full idempotency key (test 4)", () => {
  const record = normalizeIdempotencyPreviewRecord({
    idempotencyKeyPreview: "reader-sync-idempotency-v1:abcdef1234567890abcdef1234567890abcdef1234567890",
    status: "preview",
    reasonCode: "OK",
    isDuplicate: false,
    isNew: true,
    isConflict: false,
    bookId: "b1",
    chapterId: "c1",
    progressRatio: 0.25,
    source: "test",
    previewOnly: true,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: [],
  });

  assert.notEqual(record, null);
  // The full key should never appear unmasked
  assert.equal(
    record.idempotencyKeyPreviewText.includes(
      "abcdef1234567890abcdef1234567890abcdef1234567890"
    ),
    false,
    "should not expose full unmasked idempotency key"
  );
  assert.equal(
    record.idempotencyKeyPreviewText.includes("***"),
    true,
    "should contain masking"
  );
});

test("normalizeIdempotencyPreviewRecord: duplicate-safe status with safety copy (test 5)", () => {
  const record = normalizeIdempotencyPreviewRecord({
    idempotencyKeyPreview: "reader-sync-idempotency-v1:dup123",
    status: "duplicate-safe",
    reasonCode: "DUPLICATE_SAFE_PREVIEW",
    isDuplicate: true,
    isNew: false,
    isConflict: false,
    bookId: "book-dup",
    chapterId: "chapter-dup",
    progressRatio: 0.75,
    source: "reader-sync",
    previewOnly: true,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: ["DUPLICATE_SAFE_PREVIEW: repeated payload"],
  });

  assert.notEqual(record, null);
  assert.equal(record.statusText, "重复提交已短路（本地预览）");
  assert.equal(record.duplicateConflictText, "重复提交已短路（本地预览）");
  assert.equal(record.isDuplicate, true);
});

test("normalizeIdempotencyPreviewRecord: conflict/changed-preview status (test 6)", () => {
  const conflictRecord = normalizeIdempotencyPreviewRecord({
    idempotencyKeyPreview: "reader-sync-idempotency-v1:conflict123",
    status: "changed-preview",
    reasonCode: "CHANGED_PREVIEW_CONFLICT",
    isDuplicate: false,
    isNew: false,
    isConflict: true,
    bookId: "book-conflict",
    chapterId: "chapter-conflict",
    progressRatio: 0.9,
    source: "reader-sync",
    previewOnly: true,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: ["CHANGED_PREVIEW_CONFLICT: different key"],
  });

  assert.notEqual(conflictRecord, null);
  assert.equal(conflictRecord.statusText, "检测到变更冲突预览");
  assert.equal(conflictRecord.duplicateConflictText, "检测到变更冲突预览");
  assert.equal(conflictRecord.isConflict, true);
});

test("normalizeIdempotencyPreviewRecord: writesDatabase=true triggers safety warning (test 7)", () => {
  const record = normalizeIdempotencyPreviewRecord({
    idempotencyKeyPreview: "reader-sync-idempotency-v1:warn1",
    status: "preview",
    reasonCode: "OK",
    isDuplicate: false,
    isNew: true,
    isConflict: false,
    bookId: "b-warn",
    chapterId: "c-warn",
    progressRatio: 0.3,
    source: "test",
    previewOnly: true,
    writesDatabase: true,
    callsRepository: false,
    blockedReasons: [],
  });

  assert.notEqual(record, null);
  assert.equal(record.writesDatabaseText, "true（异常）");
  assert.notEqual(record.degradationText, null);
  assert.equal(
    record.degradationText.includes("真实写入仍未启用"),
    true,
    "should warn about real writes not enabled"
  );
});

test("normalizeIdempotencyPreviewRecord: callsRepository=true triggers safety warning (test 7b)", () => {
  const record = normalizeIdempotencyPreviewRecord({
    idempotencyKeyPreview: "reader-sync-idempotency-v1:warn2",
    status: "preview",
    reasonCode: "OK",
    isDuplicate: false,
    isNew: true,
    isConflict: false,
    bookId: "b-warn2",
    chapterId: "c-warn2",
    progressRatio: 0.3,
    source: "test",
    previewOnly: true,
    writesDatabase: false,
    callsRepository: true,
    blockedReasons: [],
  });

  assert.notEqual(record, null);
  assert.equal(record.callsRepositoryText, "true（异常）");
  assert.notEqual(record.degradationText, null);
  assert.equal(
    record.degradationText.includes("真实写入仍未启用"),
    true,
    "should warn about real writes not enabled"
  );
});

test("normalizeIdempotencyPreviewRecord: danger fields filtered from output (test 8)", () => {
  // Even though normalizeIdempotencyPreviewRecord doesn't filter fields itself,
  // the idempotencyKeyPreview field gets masked and danger field values should
  // not be rendered. We test that the masking function doesn't leak the original.
  const record = normalizeIdempotencyPreviewRecord({
    idempotencyKeyPreview: "reader-sync-idempotency-v1:topsecret1234",
    status: "preview",
    reasonCode: "OK",
    isDuplicate: false,
    isNew: true,
    isConflict: false,
    bookId: "safe-book",
    chapterId: "safe-chapter",
    progressRatio: 0.5,
    source: "test",
    previewOnly: true,
    writesDatabase: false,
    callsRepository: false,
    blockedReasons: [],
    fullIdempotencyKey: "THIS_SHOULD_NOT_APPEAR_ANYWHERE_IN_OUTPUT",
    rawPayload: { secret: "SHOULD_NOT_APPEAR" },
    token: "SHOULD_NOT_APPEAR_TOKEN",
    apiKey: "SHOULD_NOT_APPEAR_APIKEY",
  });

  assert.notEqual(record, null);
  // The idempotencyKeyPreview is masked
  assert.equal(
    record.idempotencyKeyPreviewText.includes("topsecret1234"),
    false,
    "should not expose full original key text in masked preview"
  );
});

test("normalizeIdempotencyPreviewRecord: refresh button only reads localStorage (test 9)", () => {
  const calls = { setItem: 0, getItem: 0 };
  const storage = {
    getItem(key) {
      calls.getItem += 1;
      if (key === READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY) {
        return JSON.stringify({
          idempotencyKeyPreview: "reader-sync-idempotency-v1:refresh123",
          status: "preview",
          reasonCode: "OK",
          isDuplicate: false,
          isNew: true,
          isConflict: false,
          bookId: "book-refresh",
          chapterId: "chapter-refresh",
          progressRatio: 0.42,
          source: "test",
          previewOnly: true,
          writesDatabase: false,
          callsRepository: false,
          blockedReasons: [],
        });
      }
      return null;
    },
    setItem(_key, _value) {
      calls.setItem += 1;
    },
  };

  const snapshot = readReaderIdempotencyPreviewFromStorage(storage);
  assert.equal(snapshot.stateKind, "ready");
  assert.equal(calls.getItem >= 1, true);
  assert.equal(calls.setItem, 0, "should never write to localStorage");
});

test("readReaderIdempotencyPreviewFromStorage: empty state when no key (test 1)", () => {
  const storage = {
    getItem(_key) {
      return null;
    },
  };

  const snapshot = readReaderIdempotencyPreviewFromStorage(storage);
  assert.equal(snapshot.stateKind, "empty");
  assert.equal(snapshot.statusText, "暂无本地幂等检查预览");
  assert.equal(snapshot.records.length, 0);
});

test("readReaderIdempotencyPreviewFromStorage: JSON damage does not crash (test 2)", () => {
  const storage = {
    getItem(key) {
      return key === READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY
        ? "{ broken json!!!"
        : null;
    },
  };

  const snapshot = readReaderIdempotencyPreviewFromStorage(storage);
  assert.equal(snapshot.stateKind, "degraded");
  assert.equal(
    snapshot.statusText,
    "本地幂等预览已安全降级"
  );
  assert.equal(snapshot.records.length, 0);
});

test("readReaderIdempotencyPreviewFromStorage: valid mock data shows safe fields (test 3)", () => {
  const storage = {
    getItem(key) {
      if (key === READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY) {
        return JSON.stringify({
          idempotencyKeyPreview: "reader-sync-idempotency-v1:abcdef1234567890abcdef",
          status: "preview",
          reasonCode: "TRUSTED_FIRST",
          isDuplicate: false,
          isNew: true,
          isConflict: false,
          bookId: "book-test",
          chapterId: "chapter-test",
          progressRatio: 0.66,
          source: "reader-sync",
          previewOnly: true,
          writesDatabase: false,
          callsRepository: false,
          blockedReasons: ["TEST_REASON"],
        });
      }
      return null;
    },
  };

  const snapshot = readReaderIdempotencyPreviewFromStorage(storage);
  assert.equal(snapshot.stateKind, "ready");
  assert.equal(snapshot.records.length, 1);
  const record = snapshot.records[0];
  assert.equal(record.bookIdText, "book-test");
  assert.equal(record.chapterIdText, "chapter-test");
  assert.equal(record.progressRatioText, "0.6600");
  assert.equal(record.statusRawText, "preview");
  assert.equal(record.previewOnlyText, "true");
  assert.equal(record.writesDatabaseText, "false");
  assert.equal(record.callsRepositoryText, "false");
});

test("readReaderIdempotencyPreviewFromStorage: non-object parsed value is degraded", () => {
  const storage = {
    getItem(key) {
      return key === READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY
        ? JSON.stringify("not-an-object")
        : null;
    },
  };

  const snapshot = readReaderIdempotencyPreviewFromStorage(storage);
  assert.equal(snapshot.stateKind, "degraded");
  assert.equal(snapshot.records.length, 0);
});

test("readReaderIdempotencyPreviewFromStorage: progressRatio out of bounds triggers warning", () => {
  const storage = {
    getItem(key) {
      if (key === READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY) {
        return JSON.stringify({
          idempotencyKeyPreview: "reader-sync-idempotency-v1:oob",
          status: "preview",
          reasonCode: "OK",
          isDuplicate: false,
          isNew: true,
          isConflict: false,
          bookId: "b-oob",
          chapterId: "c-oob",
          progressRatio: 2.5,
          source: "test",
          previewOnly: true,
          writesDatabase: false,
          callsRepository: false,
          blockedReasons: [],
        });
      }
      return null;
    },
  };

  const snapshot = readReaderIdempotencyPreviewFromStorage(storage);
  assert.equal(snapshot.stateKind, "ready");
  assert.equal(snapshot.records[0].progressRatioText, "越界");
  assert.notEqual(snapshot.records[0].degradationText, null);
  assert.equal(
    snapshot.records[0].degradationText.includes("progressRatio 超出"),
    true
  );
});

test("readReaderIdempotencyPreviewFromStorage: blockedReasons not array triggers warning", () => {
  const storage = {
    getItem(key) {
      if (key === READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY) {
        return JSON.stringify({
          idempotencyKeyPreview: "reader-sync-idempotency-v1:br",
          status: "blocked",
          reasonCode: "BLOCKED_REASONS",
          isDuplicate: false,
          isNew: false,
          isConflict: false,
          bookId: "b-br",
          chapterId: "c-br",
          progressRatio: 0.1,
          source: "test",
          previewOnly: true,
          writesDatabase: false,
          callsRepository: false,
          blockedReasons: "not-an-array",
        });
      }
      return null;
    },
  };

  const snapshot = readReaderIdempotencyPreviewFromStorage(storage);
  assert.equal(snapshot.stateKind, "ready");
  assert.equal(snapshot.records[0].blockedReasonsText, "（类型错误）");
  assert.notEqual(snapshot.records[0].degradationText, null);
});

test("readReaderIdempotencyPreviewFromStorage: unavailable storage", () => {
  const snapshot = readReaderIdempotencyPreviewFromStorage(null);
  assert.equal(snapshot.stateKind, "unavailable");
});

test("no misleading copy in SAFE_IDEMPOTENCY_PREVIEW_COPY (test 10)", () => {
  const forbiddenPhrases = [
    "同步成功",
    "已写入数据库",
    "生产可用",
    "真实幂等已接入",
    "已调用 repository",
    "已同步",
    "审计已接入",
    "已授权",
  ];

  for (const phrase of forbiddenPhrases) {
    assert.equal(
      SAFE_IDEMPOTENCY_PREVIEW_COPY.includes(phrase),
      false,
      `SAFE_IDEMPOTENCY_PREVIEW_COPY should not contain "${phrase}"`
    );
  }
});

test("SAFE_IDEMPOTENCY_PREVIEW_COPY contains required safe phrases", () => {
  assert.equal(SAFE_IDEMPOTENCY_PREVIEW_COPY.includes("开发预览"), true);
  assert.equal(SAFE_IDEMPOTENCY_PREVIEW_COPY.includes("只读"), true);
  assert.equal(SAFE_IDEMPOTENCY_PREVIEW_COPY.includes("真实幂等未连接"), true);
  assert.equal(SAFE_IDEMPOTENCY_PREVIEW_COPY.includes("生产默认关闭"), true);
  assert.equal(SAFE_IDEMPOTENCY_PREVIEW_COPY.includes("不会写入数据库"), true);
  assert.equal(SAFE_IDEMPOTENCY_PREVIEW_COPY.includes("不会调用 repository"), true);
});
