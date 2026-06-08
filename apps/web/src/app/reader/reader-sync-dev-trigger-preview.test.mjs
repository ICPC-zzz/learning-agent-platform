import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

const {
  ReaderSyncDevTriggerPreview,
  ReaderSyncDevTriggerPreviewResultFeedback,
  buildReaderSyncDevTriggerActionInput,
  buildReaderSyncDevTriggerPreviewSnapshot,
  advanceReaderSyncDevTriggerPreviewSnapshot,
  runReaderSyncDevTriggerPreviewAction,
} = await tsImport("./ReaderSyncDevTriggerPreview.tsx", import.meta.url);
const {
  createBlockedReaderSyncAuthSessionAdapter,
} = await tsImport("./reader-sync-auth-session-adapter.ts", import.meta.url);

function renderPreview(props) {
  return renderToStaticMarkup(createElement(ReaderSyncDevTriggerPreview, props));
}

function renderResultFeedback(view, actionInput) {
  return renderToStaticMarkup(
    createElement(ReaderSyncDevTriggerPreviewResultFeedback, { view, actionInput }),
  );
}

function assertContains(markup, needle, label) {
  assert.equal(markup.includes(needle), true, label + " must include " + needle);
}

function assertNotContains(markup, needle, label) {
  assert.equal(markup.includes(needle), false, label + " must not include " + needle);
}

test("dev trigger stays hidden unless explicitly enabled", function () {
  const markup = renderPreview({
    bookId: "book-hidden-001",
    chapterId: "chapter-hidden-001",
    showDevSyncTrigger: false,
    devSyncEnabled: false,
    allowDevOnlySyncPreview: false,
  });

  assert.equal(markup, "");
});

test("dev trigger renders a blocked preview card when the dev flags stay off", function () {
  const markup = renderPreview({
    bookId: "book-blocked-001",
    chapterId: "chapter-blocked-001",
    progressPreview: {
      bookId: "book-blocked-001",
      chapterId: "chapter-blocked-001",
      progressRatio: 0.34,
      source: "server-preview",
    },
    showDevSyncTrigger: true,
    devSyncEnabled: false,
    allowDevOnlySyncPreview: false,
    authSessionPreview: createBlockedReaderSyncAuthSessionAdapter().getPreview(),
  });

  [
    'data-testid="reader-sync-dev-trigger-preview"',
    "开发预览 / 本地测试 / 默认关闭 / 非生产功能",
    "blocked/preview/test-only/error",
    "showDevSyncTrigger=true",
    "devSyncEnabled=false",
    "allowDevOnlySyncPreview=false",
    "即将同步",
    "progressRatio=0.34",
    "explicitUserAuthorization=true",
    "<button type=\"button\"",
    "disabled",
    "blockedReasons",
    "warnings",
  ].forEach(function (needle) {
    assertContains(markup, needle, "blocked dev-trigger markup");
  });

  [
    "sync success",
    "already wrote DB",
    "DATABASE_URL",
    "write succeeded",
    'data-testid="reader-sync-dev-trigger-preview-result"',
  ].forEach(function (needle) {
    assertNotContains(markup, needle, "blocked dev-trigger markup");
  });
});

test("dev trigger stays clickable with explicit dev flags and blocked auth preview", function () {
  const props = {
    bookId: "book-clickable-001",
    chapterId: "chapter-clickable-001",
    progressPreview: {
      bookId: "book-clickable-001",
      chapterId: "chapter-clickable-001",
      progressRatio: 0.72,
      currentOffset: 256,
      currentCfi: "epubcfi(/6/2[chapter-clickable-001])",
      source: "server-preview",
    },
    showDevSyncTrigger: true,
    devSyncEnabled: true,
    allowDevOnlySyncPreview: true,
    onTriggerDevSync: async function () {
      return {
        status: "blocked",
        source: "blocked-by-default",
        message: "fake blocked result",
        blockedReasons: ["FAKE_BLOCKED"],
        warnings: ["fake blocked warning"],
      };
    },
  };

  const markup = renderPreview(props);
  assertContains(markup, 'data-testid="reader-sync-dev-trigger-preview"', "clickable dev-trigger markup");
  assertContains(markup, "开发预览 / 本地测试 / 默认关闭 / 非生产功能", "clickable dev-trigger markup");
  assertContains(markup, "触发本地 dev-only server action（预览）", "clickable dev-trigger markup");
  assertContains(markup, "即将同步", "clickable dev-trigger markup");
  assertContains(markup, "progressRatio=0.72", "clickable dev-trigger markup");
  assertContains(markup, "explicitUserAuthorization=true", "clickable dev-trigger markup");
  assertNotContains(markup, '<button type="button" disabled', "clickable dev-trigger markup");
  assertNotContains(
    markup,
    'data-testid="reader-sync-dev-trigger-preview-result"',
    "clickable dev-trigger markup",
  );

  const initialSnapshot = buildReaderSyncDevTriggerPreviewSnapshot(props);
  assert.equal(initialSnapshot.visible, true);
  assert.equal(initialSnapshot.bookId, "book-clickable-001");
  assert.equal(initialSnapshot.chapterId, "chapter-clickable-001");
  assert.equal(initialSnapshot.actionInjected, true);
  assert.equal(initialSnapshot.buttonDisabled, false);
  assert.equal(initialSnapshot.status, "blocked");
  assert.equal(initialSnapshot.progressPreview?.progressRatio, 0.72);
  assert.equal(initialSnapshot.progressPreviewSource, "server-preview");
  assert.equal(initialSnapshot.progressRatioWasNormalized, false);
  assertContains(initialSnapshot.summary, "开发预览入口已显示", "initial snapshot summary");
  assertContains(initialSnapshot.summary, "按钮可点击", "initial snapshot summary");

  const advancedSnapshot = advanceReaderSyncDevTriggerPreviewSnapshot(initialSnapshot);
  assert.equal(advancedSnapshot.visible, true);
  assert.equal(advancedSnapshot.bookId, "book-clickable-001");
  assert.equal(advancedSnapshot.chapterId, "chapter-clickable-001");
  assert.equal(advancedSnapshot.buttonDisabled, false);
  assert.equal(advancedSnapshot.triggered, true);
  assert.equal(advancedSnapshot.status, "preview");
  assert.equal(advancedSnapshot.blockedReasons.length, 0);
  assert.equal(advancedSnapshot.progressPreview?.progressRatio, 0.72);
  assertContains(
    advancedSnapshot.summary,
    "本地 dev-only 入口已经触发",
    "advanced snapshot summary",
  );
  assertContains(
    advancedSnapshot.warnings.join(" "),
    "local/test DB",
    "advanced snapshot warnings",
  );
  assertNotContains(
    JSON.stringify(advancedSnapshot),
    "DATABASE_URL",
    "advanced snapshot serialized output",
  );
});

test("dev trigger result feedback shows safe badges for blocked preview test-only and error phases", async function () {
  const actionInput = buildReaderSyncDevTriggerActionInput({
    bookId: "book-result-001",
    chapterId: "chapter-result-001",
    progressPreview: {
      bookId: "book-result-001",
      chapterId: "chapter-result-001",
      progressRatio: 0.72,
      currentOffset: 256,
      currentCfi: "epubcfi(/6/2[chapter-result-001])",
      source: "server-preview",
    },
  });

  assert.notEqual(actionInput, undefined);

  const cases = [
    {
      label: "blocked",
      expectedBadge: "\u9ed8\u8ba4\u963b\u65ad",
      expectedPhase: "blocked",
      action: async function () {
        return {
          status: "blocked",
          source: "blocked-by-default",
          message: "blocked by default with token session DATABASE_URL rawDbRecord",
          blockedReasons: [
            "DEFAULT_BLOCKED",
            "blocked token session DATABASE_URL rawDbRecord",
          ],
          authBlockedReasons: ["AUTH_BLOCKED"],
          warnings: ["blocked warning"],
        };
      },
    },
    {
      label: "preview",
      expectedBadge: "\u5f00\u53d1\u9884\u89c8",
      expectedPhase: "preview",
      action: async function () {
        return {
          status: "preview",
          source: "dev-preview",
          message: "preview path",
          blockedReasons: [],
          warnings: ["preview warning"],
        };
      },
    },
    {
      label: "test-only",
      expectedBadge: "\u6d4b\u8bd5\u8def\u5f84",
      expectedPhase: "test-only",
      action: async function () {
        return {
          status: "preview",
          source: "test-dev-only",
          message: "test path",
          executionAttempted: true,
          executionAllowed: true,
          executionSucceeded: true,
          executionMode: "test-dev-only-real-db",
          blockedReasons: [],
          warnings: ["test warning"],
        };
      },
    },
    {
      label: "error",
      expectedBadge: "\u672a\u5f00\u542f\u751f\u4ea7\u540c\u6b65",
      expectedPhase: "error",
      action: async function () {
        throw new Error("token session DATABASE_URL rawDbRecord");
      },
    },
  ];

  for (const testCase of cases) {
    const view = await runReaderSyncDevTriggerPreviewAction(testCase.action, actionInput);
    const markup = renderResultFeedback(view, actionInput);

    assertContains(markup, testCase.expectedBadge, testCase.label + " badge");
    assertContains(markup, `phase: ${testCase.expectedPhase}`, testCase.label + " phase");
    assertContains(markup, "bookId=book-result-001", testCase.label + " payload");
    assertContains(markup, "chapterId=chapter-result-001", testCase.label + " payload");
    assertContains(markup, "progressRatio=0.72", testCase.label + " payload");
    assertContains(markup, "explicitUserAuthorization=true", testCase.label + " payload");
    assertNotContains(markup, "sync success", testCase.label + " safety");
    assertNotContains(markup, "already wrote DB", testCase.label + " safety");
    assertNotContains(markup, "write succeeded", testCase.label + " safety");
    assertNotContains(markup, "\u751f\u4ea7\u53ef\u7528", testCase.label + " safety");
    assertNotContains(markup, "data-testid=\"reader-sync-dev-trigger-preview-action-result\"", testCase.label + " safety");
  }
});

test("dev trigger result feedback redacts dangerous tokens from returned action text", async function () {
  const actionInput = buildReaderSyncDevTriggerActionInput({
    bookId: "book-sanitize-001",
    chapterId: "chapter-sanitize-001",
    progressPreview: {
      bookId: "book-sanitize-001",
      chapterId: "chapter-sanitize-001",
      progressRatio: 0.42,
      currentOffset: 99,
      currentCfi: "epubcfi(/6/2[chapter-sanitize-001])",
      source: "server-preview",
    },
  });

  assert.notEqual(actionInput, undefined);

  const view = await runReaderSyncDevTriggerPreviewAction(async function () {
    return {
      status: "blocked",
      source: "blocked-by-default",
      message: "token session DATABASE_URL rawDbRecord secret should be redacted",
      blockedReasons: [
        "BLOCKED token session DATABASE_URL rawDbRecord secret",
      ],
      authBlockedReasons: ["AUTH token session DATABASE_URL rawDbRecord secret"],
      warnings: ["warning token session DATABASE_URL rawDbRecord secret"],
    };
  }, actionInput);

  const markup = renderResultFeedback(view, actionInput);

  [
    "token",
    "session",
    "DATABASE_URL",
    "rawDbRecord",
    "secret",
    "同步成功",
    "已写入数据库",
    "生产可用",
  ].forEach(function (needle) {
    assertNotContains(markup, needle, "sanitized result feedback");
  });
  assertContains(markup, "\u9ed8\u8ba4\u963b\u65ad", "sanitized result feedback");
  assertContains(markup, "bookId=book-sanitize-001", "sanitized result feedback");
});

test("dev trigger action helper invokes an injected callback once and normalizes blocked results", async function () {
  let called = 0;
  const props = {
    bookId: "book-helper-001",
    chapterId: "chapter-helper-001",
    progressPreview: {
      bookId: "book-helper-001",
      chapterId: "chapter-helper-001",
      progressRatio: 1.2,
      currentOffset: 42,
      currentCfi: "epubcfi(/6/2[chapter-helper-001])",
      source: "server-preview",
    },
  };
  const expectedInput = buildReaderSyncDevTriggerActionInput(props);
  assert.notEqual(expectedInput, undefined);

  const result = await runReaderSyncDevTriggerPreviewAction(
    async function (receivedInput) {
      called += 1;
      assert.deepEqual(receivedInput, expectedInput);
      return {
        status: "blocked",
        source: "blocked-by-default",
        message: "fake blocked result",
        blockedReasons: ["FAKE_BLOCKED"],
        authBlockedReasons: ["FAKE_AUTH_BLOCKED"],
        warnings: ["fake warning"],
        dependencyPreview: {
          source: "default-core",
        },
        corePreview: {
          status: "blocked",
          message: "core blocked",
          guardPreview: {
            summary: "core readiness blocked",
          },
        },
      };
    },
    expectedInput,
  );

  assert.equal(called, 1);
  assert.equal(result.previewOnly, true);
  assert.equal(result.implemented, false);
  assert.equal(result.safeToExposeToClient, true);
  assert.equal(result.phase, "blocked");
  assert.equal(result.status, "blocked");
  assert.equal(result.source, "blocked-by-default");
  assert.equal(result.message, "fake blocked result");
  assert.deepEqual(result.blockedReasons, ["FAKE_BLOCKED"]);
  assert.deepEqual(result.authBlockedReasons, ["FAKE_AUTH_BLOCKED"]);
  assert.deepEqual(result.warnings, ["fake warning"]);
  assert.equal(result.dependencySource, "default-core");
  assert.equal(result.coreStatus, "blocked");
  assert.equal(result.readinessSummary, "core readiness blocked");
});

test("dev trigger action input clamps out-of-range progressRatio into the safe range", function () {
  const input = buildReaderSyncDevTriggerActionInput({
    bookId: "book-normalized-001",
    chapterId: "chapter-normalized-001",
    progressPreview: {
      bookId: "book-normalized-001",
      chapterId: "chapter-normalized-001",
      progressRatio: -0.4,
      source: "server-preview",
    },
  });

  assert.notEqual(input, undefined);
  assert.equal(input.explicitUserAuthorization, true);
  assert.equal(input.localProgress.progressRatio, 0);
  assert.equal(input.localProgress.bookId, "book-normalized-001");
  assert.equal(input.localProgress.chapterId, "chapter-normalized-001");
  assert.equal(input.localProgress.source, "server-preview");
});

test("dev trigger action input prefers the live progress preview passed from the snapshot", function () {
  const input = buildReaderSyncDevTriggerActionInput(
    {
      bookId: "book-live-001",
      chapterId: "chapter-live-001",
      progressPreview: {
        bookId: "book-live-001",
        chapterId: "chapter-live-001",
        progressRatio: 0.12,
        currentOffset: 12,
        currentCfi: "epubcfi(/6/2[chapter-live-001-old])",
        source: "server-preview",
      },
    },
    {
      bookId: "book-live-001",
      chapterId: "chapter-live-001",
      progressRatio: 0.81,
      currentOffset: 720,
      currentCfi: "reader-local-block:18",
      source: "client-scroll-visible-block-preview",
    },
  );

  assert.notEqual(input, undefined);
  assert.equal(input.explicitUserAuthorization, true);
  assert.equal(input.localProgress.progressRatio, 0.81);
  assert.equal(input.localProgress.currentOffset, 720);
  assert.equal(input.localProgress.currentCfi, "reader-local-block:18");
  assert.equal(input.localProgress.source, "client-scroll-visible-block-preview");
});

test("dev trigger action helper surfaces test-only results and keeps them preview-only", async function () {
  const result = await runReaderSyncDevTriggerPreviewAction(async function () {
    return {
      status: "preview",
      source: "test-dev-only",
      message: "test-only wrapper preview",
      executionAttempted: true,
      executionAllowed: true,
      executionSucceeded: true,
      executionMode: "test-dev-only-real-db",
      blockedReasons: [],
      authBlockedReasons: [],
      warnings: ["test-only warning"],
      dependencyPreview: {
        source: "test-only-fake-core",
      },
      corePreview: {
        status: "test_only_fake_preview",
        message: "core test-only preview",
        guardPreview: {
          summary: "test-only guard preview",
        },
      },
    };
  });

  assert.equal(result.phase, "test-only");
  assert.equal(result.status, "preview");
  assert.equal(result.source, "test-dev-only");
  assert.equal(result.executionAttempted, true);
  assert.equal(result.executionAllowed, true);
  assert.equal(result.testOnlyExecutionCompleted, true);
  assert.equal(result.executionMode, "test-dev-only-real-db");
  assert.equal(result.dependencySource, "test-only-fake-core");
  assert.equal(result.coreStatus, "test_only_fake_preview");
  assert.equal(result.readinessSummary, "test-only guard preview");
  assertNotContains(JSON.stringify(result), "DATABASE_URL", "test-only action result");
});

test("dev trigger action helper sanitizes thrown errors", async function () {
  const result = await runReaderSyncDevTriggerPreviewAction(async function () {
    throw new Error("stack token session DATABASE_URL should not leak");
  });

  assert.equal(result.phase, "error");
  assert.equal(result.status, "error");
  assertContains(result.message, "preview-only", "sanitized error message");
  assertNotContains(result.message, "DATABASE_URL", "sanitized error message");
  assertNotContains(result.message, "token", "sanitized error message");
  assertNotContains(result.message, "session", "sanitized error message");
});
