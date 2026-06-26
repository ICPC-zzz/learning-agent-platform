import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  READER_SYNC_HEALTH_STATUS,
  buildReaderSyncHealthPanelScript,
} = require("./local-reader-sync-health-panel");

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

  const script = buildReaderSyncHealthPanelScript();
  const executionResult = vm.runInNewContext(script, {
    document,
    Date,
    JSON,
    Math,
    Number,
  });

  return { document, executionResult };
}

test("reader sync health state is safe to expose", () => {
  assert.equal(Object.isFrozen(READER_SYNC_HEALTH_STATUS), true);
  assert.equal(READER_SYNC_HEALTH_STATUS.previewOnly, true);
  assert.equal(READER_SYNC_HEALTH_STATUS.readiness, "disabled / preview-only");
  assert.equal(READER_SYNC_HEALTH_STATUS.auth, "not connected");
  assert.equal(READER_SYNC_HEALTH_STATUS.databaseWrites, "disabled");
  assert.equal(READER_SYNC_HEALTH_STATUS.idempotency, "preview contract exists");
  assert.equal(
    READER_SYNC_HEALTH_STATUS.permissionGate,
    "required before any dev/test path"
  );
  assert.equal(READER_SYNC_HEALTH_STATUS.syncConnection, "真实同步未连接");
  assert.equal(READER_SYNC_HEALTH_STATUS.productionWrites, "生产写入默认关闭");
  assert.equal(READER_SYNC_HEALTH_STATUS.developmentMode, "开发预览");
  assert.equal(READER_SYNC_HEALTH_STATUS.visibility, "只读状态");
  assert.equal("token" in READER_SYNC_HEALTH_STATUS, false);
  assert.equal("cookie" in READER_SYNC_HEALTH_STATUS, false);
  assert.equal("session" in READER_SYNC_HEALTH_STATUS, false);
  assert.equal("DATABASE_URL" in READER_SYNC_HEALTH_STATUS, false);
  assert.equal("rawDbRecord" in READER_SYNC_HEALTH_STATUS, false);
  assert.equal("secret" in READER_SYNC_HEALTH_STATUS, false);
});

test("reader sync health panel renders a read-only development preview card", () => {
  const { document, executionResult } = runPanelScript();
  assert.equal(executionResult, true);

  const panel = document.getElementById("desktop-reader-sync-health-panel");
  assert.equal(panel !== null, true);
  assert.equal(
    document.getElementById("desktop-reader-sync-health-title")?.textContent,
    "Reader Sync 健康状态（开发预览）"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-health-summary")?.textContent,
    "开发预览 · 只读状态 · 真实同步未连接 · 生产写入默认关闭"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-health-status")?.textContent,
    "真实同步未连接"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-health-notes")?.textContent?.includes("safe-to-expose"),
    true
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-health-readiness-value")?.textContent,
    "disabled / preview-only"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-health-auth-value")?.textContent,
    "not connected"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-health-database-writes-value")?.textContent,
    "disabled"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-health-idempotency-value")?.textContent,
    "preview contract exists"
  );
  assert.equal(
    document.getElementById("desktop-reader-sync-health-permission-gate-value")?.textContent,
    "required before any dev/test path"
  );
});

test("reader sync health panel rerender stays idempotent", () => {
  const document = new MiniDocument();
  createDesktopShell(document);

  const script = buildReaderSyncHealthPanelScript();
  vm.runInNewContext(script, { document, Date, JSON, Math, Number });
  vm.runInNewContext(script, { document, Date, JSON, Math, Number });

  const panelCount = document.body.children.filter(
    (child) => child.id === "desktop-reader-sync-health-panel"
  ).length;
  assert.equal(panelCount, 1);
});
