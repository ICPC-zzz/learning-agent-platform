import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

const { ReaderSyncPreviewPanel } = await tsImport("./ReaderSyncPreviewPanel.tsx", import.meta.url);
const { resolveReaderSyncDevTriggerConfig } = await tsImport(
  "./reader-sync-dev-trigger-config.ts",
  import.meta.url,
);
const { evaluateReaderSyncReadinessGate } = await tsImport(
  "./reader-sync-readiness-gate.ts",
  import.meta.url,
);

function renderPanel(props) {
  return renderToStaticMarkup(createElement(ReaderSyncPreviewPanel, props));
}

function assertContains(markup, needle, label) {
  assert.equal(markup.includes(needle), true, label + " must include " + needle);
}

function assertNotContains(markup, needle, label) {
  assert.equal(markup.includes(needle), false, label + " must not include " + needle);
}

function createStubbedPreviewPanelModule(stubGateResult) {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const tempDir = fs.mkdtempSync(path.join(moduleDir, "reader-sync-preview-panel-"));
  const tempPanelPath = path.join(tempDir, "ReaderSyncPreviewPanel.tsx");
  const stubGatePath = path.join(tempDir, "reader-sync-readiness-gate.ts");
  const panelSourcePath = path.join(moduleDir, "ReaderSyncPreviewPanel.tsx");
  const panelSource = fs.readFileSync(panelSourcePath, "utf-8");

  const replacements = [
    ["./reader-local-storage", pathToFileURL(path.join(moduleDir, "reader-local-storage.ts")).href],
    ["./reader-sync-preview", pathToFileURL(path.join(moduleDir, "reader-sync-preview.ts")).href],
    ["./reader-sync-draft", pathToFileURL(path.join(moduleDir, "reader-sync-draft.ts")).href],
    [
      "./reader-sync-payload-preview",
      pathToFileURL(path.join(moduleDir, "reader-sync-payload-preview.ts")).href,
    ],
    ["./reader-sync-submit-plan", pathToFileURL(path.join(moduleDir, "reader-sync-submit-plan.ts")).href],
    [
      "./reader-sync-server-action-contract",
      pathToFileURL(path.join(moduleDir, "reader-sync-server-action-contract.ts")).href,
    ],
    ["./reader-sync-readiness-gate", pathToFileURL(stubGatePath).href],
    [
      "./ReaderSyncDevTriggerPreview",
      pathToFileURL(path.join(moduleDir, "ReaderSyncDevTriggerPreview.tsx")).href,
    ],
  ];

  try {
    fs.writeFileSync(
      stubGatePath,
      "export function evaluateReaderSyncReadinessGate() {\n" +
        "  return " +
        JSON.stringify(stubGateResult) +
        ";\n}\n",
    );

    let transformedSource = panelSource;
    replacements.forEach(function ([needle, replacement]) {
      transformedSource = transformedSource.split(needle).join(replacement);
    });
    fs.writeFileSync(tempPanelPath, transformedSource);

    return {
      modulePath: tempPanelPath,
      cleanup: function cleanup() {
        fs.rmSync(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

function assertPreviewOnlyGate(result, label) {
  assert.equal(result.previewOnly, true, label + " must stay preview-only");
  assert.equal(result.implemented, false, label + " must stay not implemented");
  assert.equal(result.safeToExposeToClient, true, label + " must stay client-safe");
  assert.equal(result.writesDatabase, false, label + " must never write DB");
  assert.equal(result.callsRepository, false, label + " must never call repository");
  assert.equal(result.success, false, label + " must never report success");
  assert.equal(result.mustRemainPreviewOnly, true, label + " must stay preview-only");
  assert.equal(result.canEnableRealSync, false, label + " must not enable real sync");
  assert.equal(result.status, "blocked", label + " must stay blocked");
}

test("Reader preview panel renders the default readiness gate as a read-only preview card", function () {
  const markup = renderPanel({
    bookId: "book-preview-001",
    chapterId: "chapter-preview-001",
    devSyncProgressPreview: {
      bookId: "book-preview-001",
      chapterId: "chapter-preview-001",
      progressRatio: 0.55,
      source: "server-preview",
    },
  });

  [
    'data-testid="reader-sync-readiness-gate"',
    'data-testid="reader-sync-real-sync-authorization-checklist"',
    "previewOnly",
    "implemented",
    "safeToExposeToClient",
    "writesDatabase",
    "callsRepository",
    "blockedReasons",
    "nextSafeSteps",
    "server action",
    "localStorage",
    "repository",
    "AUTH_NOT_READY",
    "REPOSITORY_NOT_READY",
    "DB_WRITE_NOT_READY",
    "AUDIT_NOT_READY",
    "IDEMPOTENCY_NOT_READY",
    "CONFLICT_RESOLUTION_NOT_READY",
    "SERVER_ACTION_NOT_READY",
    "EXPLICIT_USER_AUTHORIZATION_REQUIRED",
    "Server Action Readiness Checklist",
    "Reader sync readiness gate",
  ].forEach(function (needle) {
    assertContains(markup, needle, "readiness panel markup");
  });

  [
    "sync success",
    "already wrote DB",
    "real sync enabled",
    "ready to write",
    "write succeeded",
    "backend connected",
    "blocked/preview/test-only/error",
    "showDevSyncTrigger",
    'data-testid="reader-sync-dev-trigger-preview"',
    "production route",
    "Dev trigger 即将同步",
    "progressRatio=0.55",
    "explicitUserAuthorization=true",
  ].forEach(function (needle) {
    assertNotContains(markup, needle, "readiness panel markup");
  });
});

test("Reader preview panel can accept an injected dev-only trigger callback", function () {
  const markup = renderPanel({
    bookId: "book-injected-001",
    chapterId: "chapter-injected-001",
    devSyncProgressPreview: {
      bookId: "book-injected-001",
      chapterId: "chapter-injected-001",
      progressRatio: 0.86,
      currentOffset: 512,
      source: "server-preview",
    },
    showDevSyncTrigger: true,
    devSyncEnabled: true,
    allowDevOnlySyncPreview: true,
    onTriggerDevSync: async function () {
      return {
        status: "preview",
        source: "test-only-fake",
        message: "panel injected preview",
        blockedReasons: [],
        warnings: ["panel warning"],
      };
    },
  });

  [
    'data-testid="reader-sync-dev-trigger-preview"',
    "onTriggerDevSync=true",
    "Dev trigger 即将同步",
    "progressRatio=0.86",
    "explicitUserAuthorization=true",
    "触发本地 dev-only server action（预览）",
    "开发预览 / 本地测试 / 默认关闭 / 非生产功能",
    "showDevSyncTrigger=true",
    "devSyncEnabled=true",
    "allowDevOnlySyncPreview=true",
  ].forEach(function (needle) {
    assertContains(markup, needle, "injected dev-trigger markup");
  });

  assertNotContains(markup, '<button type="button" disabled', "injected dev-trigger markup");
});

test("Reader preview panel stays safe when the readiness gate returns empty arrays", async function () {
  const stubbedModule = createStubbedPreviewPanelModule({
    previewOnly: true,
    implemented: false,
    safeToExposeToClient: true,
    status: "blocked",
    mustRemainPreviewOnly: true,
    canEnableRealSync: false,
    executed: false,
    writesDatabase: false,
    callsRepository: false,
    success: false,
    blocked: true,
    blockedReasons: [],
    warnings: [],
    nextSafeSteps: [],
    readinessChecklist: [],
    summary: "dev-preview / read-only / no-backend",
  });

  try {
    const { ReaderSyncPreviewPanel: StubbedReaderSyncPreviewPanel } = await tsImport(
      pathToFileURL(stubbedModule.modulePath).href,
      import.meta.url,
    );
    const markup = renderToStaticMarkup(
      createElement(StubbedReaderSyncPreviewPanel, {
        bookId: "book-preview-empty-001",
        chapterId: "chapter-preview-empty-001",
        devSyncProgressPreview: {
          bookId: "book-preview-empty-001",
          chapterId: "chapter-preview-empty-001",
          progressRatio: 0,
          source: "fallback-preview",
        },
      }),
    );

    [
      'data-testid="reader-sync-readiness-gate"',
      'data-testid="reader-sync-real-sync-authorization-checklist"',
      "previewOnly",
      "blockedReasons",
      "nextSafeSteps",
      "dev-preview / read-only / no-backend",
    ].forEach(function (needle) {
      assertContains(markup, needle, "empty-readiness gate markup");
    });

    [
      "sync success",
      "already wrote DB",
      "real sync enabled",
      'data-testid="reader-sync-dev-trigger-preview"',
      "showDevSyncTrigger",
      "blocked/preview/test-only/error",
      "Dev trigger 即将同步",
    ].forEach(function (needle) {
      assertNotContains(markup, needle, "empty-readiness gate markup");
    });
  } finally {
    stubbedModule.cleanup();
  }
});

test("Reader readiness gate keeps preview-only semantics when input is missing or malformed", function () {
  const missingInputResult = evaluateReaderSyncReadinessGate(null);
  const malformedInputResult = evaluateReaderSyncReadinessGate({
    previewOnly: false,
    authReady: "yes",
    repositoryReady: 1,
    dbWriteReady: [],
    auditReady: {},
    idempotencyReady: "no",
    conflictResolutionReady: null,
    serverActionReady: undefined,
    explicitUserAuthorization: "maybe",
    blockedReasons: [],
    readinessChecklist: [],
    missingRequirements: [],
    checklist: [],
  });

  [missingInputResult, malformedInputResult].forEach(function (result, index) {
    const label = index === 0 ? "missing gate input" : "malformed gate input";

    assertPreviewOnlyGate(result, label);
    assert.ok(result.blockedReasons.length > 0, label + " must surface blocked reasons");
    assert.ok(result.readinessChecklist.length > 0, label + " must still surface checklist items");
    assert.ok(result.nextSafeSteps.length > 0, label + " must still surface safe next steps");
    assertContains(result.summary, "preview-only", label + " summary");
    assertNotContains(result.summary, "sync success", label + " summary");
    assertNotContains(result.summary, "already wrote DB", label + " summary");
  });

  assertContains(
    malformedInputResult.blockedReasons.join(" | "),
    "INVALID_INPUT",
    "malformed gate input blocked reasons",
  );
  assertContains(
    malformedInputResult.blockedReasons.join(" | "),
    "EXPLICIT_USER_AUTHORIZATION_REQUIRED",
    "malformed gate input blocked reasons",
  );
  assert.equal(
    malformedInputResult.readinessChecklist.every(function (item) {
      return item.ready === false;
    }),
    true,
    "malformed gate input checklist must stay blocked",
  );
});

test("Reader dev trigger config defaults off and only turns on for explicit local dev opt-in", function () {
  const defaultConfig = resolveReaderSyncDevTriggerConfig({
    LAP_READER_SYNC_DEV_TRIGGER: undefined,
    NODE_ENV: "development",
  });
  const productionOverride = resolveReaderSyncDevTriggerConfig({
    LAP_READER_SYNC_DEV_TRIGGER: "true",
    NODE_ENV: "production",
  });
  const localDevOverride = resolveReaderSyncDevTriggerConfig({
    LAP_READER_SYNC_DEV_TRIGGER: "true",
    NODE_ENV: "development",
  });

  assert.deepEqual(defaultConfig, {
    showDevSyncTrigger: false,
    devSyncEnabled: false,
    allowDevOnlySyncPreview: false,
  });
  assert.deepEqual(productionOverride, {
    showDevSyncTrigger: false,
    devSyncEnabled: false,
    allowDevOnlySyncPreview: false,
  });
  assert.deepEqual(localDevOverride, {
    showDevSyncTrigger: true,
    devSyncEnabled: true,
    allowDevOnlySyncPreview: true,
  });
});
