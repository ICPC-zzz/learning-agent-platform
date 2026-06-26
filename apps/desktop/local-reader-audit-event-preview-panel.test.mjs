import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  SAFE_AUDIT_PREVIEW_COPY,
  READER_AUDIT_PREVIEW_STORAGE_KEY,
  buildLocalReaderAuditEventPreviewPanelScript,
  normalizeAuditEventPreviewRecord,
  readReaderAuditEventPreviewFromStorage,
} = require("./local-reader-audit-event-preview-panel");

class MiniElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.style = {};
    this.id = "";
    this.href = "";
    this.type = "";
    this.className = "";
    this.onclick = null;
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

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
    return child;
  }

  setAttribute(name, value) {
    if (name === "id") {
      this.id = String(value);
    }
  }

  get firstChild() {
    return this.children.length > 0 ? this.children[0] : null;
  }

  get nextSibling() {
    if (!this.parentNode) {
      return null;
    }

    const index = this.parentNode.children.indexOf(this);
    if (index === -1 || index + 1 >= this.parentNode.children.length) {
      return null;
    }

    return this.parentNode.children[index + 1];
  }

  get innerHTML() {
    return "";
  }

  set innerHTML(_value) {
    this.children = [];
    this.textContent = "";
  }

  click() {
    if (typeof this.onclick === "function") {
      this.onclick();
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

function collectText(node, bucket = []) {
  if (!node) {
    return bucket;
  }

  if (typeof node.textContent === "string" && node.textContent.length > 0) {
    bucket.push(node.textContent);
  }

  for (const child of node.children) {
    collectText(child, bucket);
  }

  return bucket;
}

function createLocalStorage(initialRecords) {
  const records = { ...initialRecords };
  const calls = {
    getItem: 0,
  };

  return {
    calls,
    records,
    get length() {
      return Object.keys(records).length;
    },
    key(index) {
      const keys = Object.keys(records);
      if (index < 0 || index >= keys.length) {
        return null;
      }
      return keys[index];
    },
    getItem(key) {
      calls.getItem += 1;
      return Object.prototype.hasOwnProperty.call(records, key) ? records[key] : null;
    },
    setRecord(key, value) {
      records[key] = value;
    },
  };
}

function createPanelScaffold(document) {
  const shell = document.createElement("div");
  shell.id = "desktop-navigation-shell";
  document.body.appendChild(shell);

  const learningActionCard = document.createElement("section");
  learningActionCard.id = "desktop-home-learning-action-card";
  document.body.appendChild(learningActionCard);
}

function renderPanel(records) {
  const document = new MiniDocument();
  createPanelScaffold(document);

  const storage = createLocalStorage(records);
  const script = buildLocalReaderAuditEventPreviewPanelScript();
  const result = vm.runInNewContext(script, {
    document,
    window: {
      localStorage: storage,
    },
    Date,
    JSON,
    Math,
    Number,
  });

  return {
    document,
    result,
    storage,
  };
}

test("audit preview helper: empty localStorage yields safe empty state", () => {
  const snapshot = readReaderAuditEventPreviewFromStorage({
    getItem() {
      return null;
    },
  });

  assert.equal(snapshot.stateKind, "empty");
  assert.equal(snapshot.statusText, "暂无本地审计事件预览");
  assert.equal(snapshot.noteText, SAFE_AUDIT_PREVIEW_COPY);
  assert.equal(snapshot.hintText, "请在 localStorage 中写入 lap.reader.audit.preview.events 后点击刷新。");
  assert.equal(snapshot.events.length, 0);
});

test("audit preview helper: bad JSON degrades safely", () => {
  const snapshot = readReaderAuditEventPreviewFromStorage({
    getItem(key) {
      return key === READER_AUDIT_PREVIEW_STORAGE_KEY ? "{ bad-json" : null;
    },
  });

  assert.equal(snapshot.stateKind, "degraded");
  assert.equal(snapshot.statusText, "本地审计预览已安全降级");
  assert.equal(snapshot.hintText.includes("不可解析"), true);
  assert.equal(snapshot.events.length, 0);
});

test("audit preview helper: invalid field types degrade and filter sensitive fields", () => {
  const event = normalizeAuditEventPreviewRecord({
    eventType: 123,
    status: true,
    reasonCode: null,
    bookId: "reader-book",
    chapterId: "reader-chapter",
    token: "secret-token-value",
    rawRequest: { body: "secret-body" },
    rawHeaders: { authorization: "Bearer raw-token" },
  });

  assert.equal(event?.eventTypeText, "unknown-event");
  assert.equal(event?.statusText, "error-preview");
  assert.equal(event?.reasonCodeText, "INVALID_AUDIT_EVENT_PREVIEW");
  assert.equal(event?.sensitiveText, "已过滤敏感字段");
  assert.equal(event?.degradedText, "事件结构不完整，已安全降级");
});

test("audit preview panel: refresh button only re-reads localStorage", () => {
  const { document, storage } = renderPanel({});

  assert.equal(
    document.getElementById("desktop-reader-audit-preview-status")?.textContent,
    "暂无本地审计事件预览"
  );
  assert.equal(
    document.getElementById("desktop-reader-audit-preview-note")?.textContent,
    SAFE_AUDIT_PREVIEW_COPY
  );

  const getItemCallsAfterInitialRender = storage.calls.getItem;
  assert.equal(getItemCallsAfterInitialRender > 0, true);

  storage.setRecord(
    READER_AUDIT_PREVIEW_STORAGE_KEY,
    JSON.stringify([
      {
        eventType: "reader-sync-audit-event-v1",
        status: "permission-blocked",
        reasonCode: "PERMISSION_DENIED",
        bookId: "book-001",
        chapterId: "chapter-010",
        source: "blocked-by-default",
        timestamp: "2026-06-08T10:30:00.000Z",
        permissionGateStatus: "blocked",
        previewOnly: true,
        writesDatabase: false,
        callsRepository: false,
        token: "secret-token-value",
        cookie: "cookie-value",
        session: "session-value",
        DATABASE_URL: "postgres://secret",
        secret: "another-secret",
        apiKey: "api-key-value",
        authorization: "Bearer raw-token",
        rawRequest: { body: "raw-body-value" },
        rawBody: "raw-body-value",
        rawHeaders: { "x-test": "header-value" },
        rawDbRecord: { id: 1 },
      },
    ])
  );

  document.getElementById("desktop-reader-audit-preview-refresh-button")?.click();

  assert.equal(
    storage.calls.getItem > getItemCallsAfterInitialRender,
    true,
    "refresh should re-read localStorage"
  );
  assert.equal(
    document.getElementById("desktop-reader-audit-preview-status")?.textContent,
    "已读取本地审计事件预览"
  );
  assert.equal(
    document.getElementById("desktop-reader-audit-preview-filtered")?.textContent,
    "已过滤敏感字段"
  );
  assert.equal(
    document.getElementById("desktop-reader-audit-preview-note")?.textContent,
    SAFE_AUDIT_PREVIEW_COPY
  );
  assert.equal(
    document.getElementById("desktop-reader-audit-preview-title")?.textContent,
    "Reader 审计事件（本地预览）"
  );
  assert.equal(
    document.getElementById("desktop-reader-audit-preview-list")?.children.length,
    1
  );

  const renderedText = collectText(document.body).join(" ");
  for (const forbidden of [
    "secret-token-value",
    "cookie-value",
    "session-value",
    "postgres://secret",
    "another-secret",
    "api-key-value",
    "Bearer raw-token",
    "raw-body-value",
    "header-value",
  ]) {
    assert.equal(renderedText.includes(forbidden), false, `should not expose ${forbidden}`);
  }

  assert.equal(renderedText.includes("bookId=book-001 / chapterId=chapter-010"), true);
  assert.equal(renderedText.includes("reader-sync-audit-event-v1"), true);
  assert.equal(renderedText.includes("PERMISSION_DENIED"), true);
  assert.equal(renderedText.includes("已过滤敏感字段"), true);
});
