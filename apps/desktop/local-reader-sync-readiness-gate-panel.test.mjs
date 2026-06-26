import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  READER_SYNC_READINESS_GATE_STATUS,
  buildReaderSyncReadinessGatePanelScript,
} = require("./local-reader-sync-readiness-gate-panel");

class MiniElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.style = {};
    this.id = "";
    this.href = "";
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, referenceNode) {
    child.parentNode = this;
    if (!referenceNode) {
      this.children.push(child);
      return child;
    }

    const index = this.children.indexOf(referenceNode);
    if (index === -1) {
      this.children.push(child);
      return child;
    }

    this.children.splice(index, 0, child);
    return child;
  }

  setAttribute(name, value) {
    if (name === "id") {
      this.id = String(value);
    }
  }
}

class MiniDocument {
  constructor() {
    this.body = new MiniElement("body");
  }

  createElement(tagName) {
    return new MiniElement(tagName);
  }

  getElementById(id) {
    return findById(this.body, id);
  }
}

function findById(root, id) {
  if (!root) {
    return null;
  }

  if (root.id === id) {
    return root;
  }

  for (const child of root.children) {
    const found = findById(child, id);
    if (found) {
      return found;
    }
  }

  return null;
}

function createDesktopShell(document) {
  const shell = document.createElement("div");
  shell.id = "desktop-navigation-shell";
  document.body.appendChild(shell);
  return shell;
}

function runPanelScript() {
  const document = new MiniDocument();
  createDesktopShell(document);

  const script = buildReaderSyncReadinessGatePanelScript();
  const executionResult = vm.runInNewContext(script, {
    document,
    Date,
    JSON,
    Math,
    Number,
  });

  return { document, executionResult };
}

test("reader sync readiness gate state is safe to expose", () => {
  assert.equal(Object.isFrozen(READER_SYNC_READINESS_GATE_STATUS), true);
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.previewOnly, true);
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.ready, false);
  assert.equal(
    READER_SYNC_READINESS_GATE_STATUS.mode,
    "preview-only / disabled-by-default"
  );
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.auth, "not connected");
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.permissionGate, "required");
  assert.equal(
    READER_SYNC_READINESS_GATE_STATUS.idempotencyKey,
    "preview contract only"
  );
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.databaseWrites, "disabled");
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.publicRoute, "not exposed");
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.syncConnection, "真实同步未连接");
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.productionDefault, "生产默认关闭");
  assert.equal(
    READER_SYNC_READINESS_GATE_STATUS.accessRequirement,
    "需要真实 auth/session 后才能进入生产路径"
  );
  assert.equal(READER_SYNC_READINESS_GATE_STATUS.visibility, "只读");
  assert.equal("token" in READER_SYNC_READINESS_GATE_STATUS, false);
  assert.equal("cookie" in READER_SYNC_READINESS_GATE_STATUS, false);
  assert.equal("session" in READER_SYNC_READINESS_GATE_STATUS, false);
  assert.equal("DATABASE_URL" in READER_SYNC_READINESS_GATE_STATUS, false);
  assert.equal("rawDbRecord" in READER_SYNC_READINESS_GATE_STATUS, false);
  assert.equal("secret" in READER_SYNC_READINESS_GATE_STATUS, false);
});

test("reader sync readiness gate panel renders a read-only development preview card", () => {
  const { document, executionResult } = runPanelScript();
  assert.equal(executionResult, true);

  const panel = document.getElementById("desktop-reader-sync-readiness-gate-panel");
  assert.equal(panel !== null, true);
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-title")?.textContent,
    "Reader Sync readiness gate（开发预览）"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-summary")?.textContent,
    "开发预览 · 只读 · 真实同步未连接 · 生产默认关闭"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-status")?.textContent,
    "ready: false / mode: preview-only / disabled-by-default"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-notes")?.textContent?.includes(
      "需要真实 auth/session 后才能进入生产路径"
    ),
    true
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-notes")?.textContent?.includes(
      "safe-to-expose"
    ),
    true
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-ready-value")?.textContent,
    "false"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-mode-value")?.textContent,
    "preview-only / disabled-by-default"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-auth-value")?.textContent,
    "not connected"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-permission-gate-value")?.textContent,
    "required"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-idempotency-key-value")?.textContent,
    "preview contract only"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-database-writes-value")?.textContent,
    "disabled"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-public-route-value")?.textContent,
    "not exposed"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-readiness-gate-production-default-value")?.textContent,
    "生产默认关闭"
  );
});

test("reader sync readiness gate panel rerender stays idempotent", () => {
  const document = new MiniDocument();
  createDesktopShell(document);

  const script = buildReaderSyncReadinessGatePanelScript();
  vm.runInNewContext(script, { document, Date, JSON, Math, Number });
  vm.runInNewContext(script, { document, Date, JSON, Math, Number });

  const panelCount = document.body.children.filter(
    (child) => child.id === "desktop-reader-sync-readiness-gate-panel"
  ).length;
  assert.equal(panelCount, 1);
});
