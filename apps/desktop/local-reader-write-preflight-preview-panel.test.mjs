import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  WRITE_PREFLIGHT_STORAGE_KEY,
  SAFE_WRITE_PREFLIGHT_COPY,
  normalizeBooleanDisplay,
  normalizeWritePreflightPreviewRecord,
  readWritePreflightPreviewFromStorage,
  buildLocalReaderWritePreflightPreviewPanelScript,
} = require("./local-reader-write-preflight-preview-panel.js");

// --- Mini DOM ---

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
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    if (index === -1 || index + 1 >= this.parentNode.children.length) return null;
    return this.parentNode.children[index + 1];
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
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function collectText(node, bucket = []) {
  if (!node) return bucket;
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
  const calls = { getItem: 0, setItem: 0 };
  return {
    calls,
    records,
    get length() {
      return Object.keys(records).length;
    },
    key(index) {
      const keys = Object.keys(records);
      if (index < 0 || index >= keys.length) return null;
      return keys[index];
    },
    getItem(key) {
      calls.getItem += 1;
      return Object.prototype.hasOwnProperty.call(records, key) ? records[key] : null;
    },
    setRecord(key, value) {
      records[key] = value;
    },
    setItem(key, value) {
      calls.setItem += 1;
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
  const script = buildLocalReaderWritePreflightPreviewPanelScript();
  const result = vm.runInNewContext(script, {
    document,
    window: { localStorage: storage },
    Date,
    JSON,
    Math,
    Number,
  });
  return { document, result, storage };
}

// --- Unit tests: helpers ---

test("normalizeBooleanDisplay: handles all cases", () => {
  assert.equal(normalizeBooleanDisplay(true), "true");
  assert.equal(normalizeBooleanDisplay(false), "false");
  assert.equal(normalizeBooleanDisplay(undefined), "未提供");
  assert.equal(normalizeBooleanDisplay(null), "未提供");
  assert.equal(normalizeBooleanDisplay("true"), "类型错误");
  assert.equal(normalizeBooleanDisplay(1), "类型错误");
});

test("normalizeWritePreflightPreviewRecord: normal preflight fields", () => {
  const record = normalizeWritePreflightPreviewRecord({
    authReady: true,
    permissionGateReady: true,
    idempotencyReady: false,
    auditReady: true,
    databaseWriteOptIn: false,
    publicRouteExposed: false,
    productionWriteReady: false,
    writesDatabase: false,
    callsRepository: false,
    previewOnly: true,
    status: "blocked",
    blockedReasons: ["AUTH_MISSING", "DB_OPT_IN_MISSING"],
  });

  assert.equal(record.authReady, "true");
  assert.equal(record.permissionGateReady, "true");
  assert.equal(record.idempotencyReady, "false");
  assert.equal(record.productionWriteReadyText, "false");
  assert.equal(record.writesDatabaseText, "false");
  assert.equal(record.callsRepositoryText, "false");
  assert.equal(record.writesDatabaseWarning, null);
  assert.equal(record.callsRepositoryWarning, null);
  assert.equal(record.blockedReasonsText.includes("AUTH_MISSING"), true);
  assert.equal(record.previewOnlyText, "true");
});

test("normalizeWritePreflightPreviewRecord: productionWriteReady=true still annotated as local preview", () => {
  const record = normalizeWritePreflightPreviewRecord({
    authReady: true,
    permissionGateReady: true,
    idempotencyReady: true,
    auditReady: true,
    databaseWriteOptIn: true,
    publicRouteExposed: true,
    productionWriteReady: true,
    writesDatabase: false,
    callsRepository: false,
    previewOnly: true,
  });

  assert.equal(record.productionWriteReadyText.includes("仅本地预览字段"), true);
  assert.equal(record.productionWriteReadyText.includes("true"), true);
  assert.equal(
    record.productionWriteReadyText.includes("不代表真实写入已启用"),
    true,
    "must explicitly say real write is not enabled"
  );
});

test("normalizeWritePreflightPreviewRecord: writesDatabase=true triggers safety warning", () => {
  const record = normalizeWritePreflightPreviewRecord({
    authReady: false,
    writesDatabase: true,
    previewOnly: true,
  });

  assert.equal(record.writesDatabaseWarning !== null, true);
  assert.equal(
    record.writesDatabaseWarning.includes("安全警告"),
    true
  );
  assert.equal(
    record.writesDatabaseWarning.includes("真实写入未启用"),
    true
  );
  assert.equal(
    record.writesDatabaseText.includes("安全警告"),
    true
  );
  assert.equal(record.degradedText !== null, true);
});

test("normalizeWritePreflightPreviewRecord: callsRepository=true triggers safety warning", () => {
  const record = normalizeWritePreflightPreviewRecord({
    authReady: false,
    callsRepository: true,
    previewOnly: true,
  });

  assert.equal(record.callsRepositoryWarning !== null, true);
  assert.equal(
    record.callsRepositoryWarning.includes("安全警告"),
    true
  );
  assert.equal(record.degradedText !== null, true);
});

test("normalizeWritePreflightPreviewRecord: danger fields are filtered", () => {
  const record = normalizeWritePreflightPreviewRecord({
    authReady: false,
    previewOnly: true,
    token: "top-secret",
    apiKey: "api-secret",
    secret: "deep-secret",
    rawRequest: { body: "raw-body" },
    session: "session-value",
    DATABASE_URL: "postgres://localhost/secret",
  });

  assert.equal(record.sensitiveText, "已过滤敏感字段");
});

// --- Storage-level tests ---

test("readWritePreflightPreviewFromStorage: empty state", () => {
  const snapshot = readWritePreflightPreviewFromStorage({
    getItem(_key) {
      return null;
    },
  });

  assert.equal(snapshot.stateKind, "empty");
  assert.equal(snapshot.statusText, "暂无本地写入预检预览");
  assert.equal(snapshot.noteText, SAFE_WRITE_PREFLIGHT_COPY);
  assert.equal(snapshot.record, null);
});

test("readWritePreflightPreviewFromStorage: bad JSON", () => {
  const snapshot = readWritePreflightPreviewFromStorage({
    getItem(key) {
      return key === WRITE_PREFLIGHT_STORAGE_KEY ? "{ bad!! }" : null;
    },
  });

  assert.equal(snapshot.stateKind, "degraded");
  assert.equal(snapshot.hintText.includes("不可解析"), true);
});

test("readWritePreflightPreviewFromStorage: unavailable storage", () => {
  const snapshot = readWritePreflightPreviewFromStorage(null);
  assert.equal(snapshot.stateKind, "unavailable");
});

// --- Browser-script tests ---

test("write preflight panel: no data renders empty state", () => {
  const { document } = renderPanel({});

  assert.equal(
    document.getElementById("desktop-reader-write-preflight-preview-title")?.textContent,
    "Reader 写入预检（本地预览）"
  );
  assert.equal(
    document.getElementById("desktop-reader-write-preflight-preview-status")?.textContent,
    "暂无本地写入预检预览"
  );
  assert.equal(
    document.getElementById("desktop-reader-write-preflight-preview-note")?.textContent,
    SAFE_WRITE_PREFLIGHT_COPY
  );
});

test("write preflight panel: mock data with productionWriteReady=false renders correctly", () => {
  const mockData = {
    authReady: true,
    permissionGateReady: true,
    idempotencyReady: false,
    auditReady: true,
    databaseWriteOptIn: false,
    publicRouteExposed: false,
    productionWriteReady: false,
    writesDatabase: false,
    callsRepository: false,
    previewOnly: true,
    status: "blocked",
    blockedReasons: ["DB_OPT_IN_MISSING", "PUBLIC_ROUTE_MISSING"],
  };

  const { document, storage } = renderPanel({});
  storage.setRecord(WRITE_PREFLIGHT_STORAGE_KEY, JSON.stringify(mockData));
  document.getElementById("desktop-reader-write-preflight-preview-refresh-button")?.click();

  assert.equal(
    document.getElementById("desktop-reader-write-preflight-preview-status")?.textContent,
    "已读取本地写入预检预览"
  );

  const renderedText = collectText(document.body).join(" ");
  assert.equal(renderedText.includes("authReady"), true);
  assert.equal(renderedText.includes("permissionGateReady"), true);
  assert.equal(renderedText.includes("DB_OPT_IN_MISSING"), true);
  assert.equal(renderedText.includes("PUBLIC_ROUTE_MISSING"), true);

  // Safety copy must be present
  assert.equal(renderedText.includes("开发预览"), true);
  assert.equal(renderedText.includes("只读"), true);
  assert.equal(renderedText.includes("真实写入未启用"), true);
  assert.equal(renderedText.includes("不会调用 repository"), true);

  // Warning div should be hidden for safe data
  const warningNode = document.getElementById("desktop-reader-write-preflight-preview-warning");
  assert.equal(warningNode?.style.display, "none", "warning should be hidden for safe data");
});

test("write preflight panel: productionWriteReady=true still shows safety annotation", () => {
  const mockData = {
    authReady: true,
    permissionGateReady: true,
    idempotencyReady: true,
    auditReady: true,
    databaseWriteOptIn: true,
    publicRouteExposed: true,
    productionWriteReady: true,
    writesDatabase: false,
    callsRepository: false,
    previewOnly: true,
    status: "ready_preview",
    blockedReasons: [],
  };

  const { document, storage } = renderPanel({});
  storage.setRecord(WRITE_PREFLIGHT_STORAGE_KEY, JSON.stringify(mockData));
  document.getElementById("desktop-reader-write-preflight-preview-refresh-button")?.click();

  const renderedText = collectText(document.body).join(" ");
  assert.equal(
    renderedText.includes("仅本地预览字段"),
    true,
    "productionWriteReady=true should be annotated as local preview only"
  );
  assert.equal(
    renderedText.includes("不代表真实写入已启用"),
    true,
    "must explicitly say real write is not enabled"
  );

  // Must not imply production availability
  for (const forbidden of ["生产可用", "同步成功", "已写入数据库", "已授权"]) {
    assert.equal(
      renderedText.includes(forbidden),
      false,
      `should not imply ${forbidden}`
    );
  }
});

test("write preflight panel: writesDatabase=true and callsRepository=true show warnings", () => {
  const mockData = {
    authReady: false,
    permissionGateReady: false,
    writesDatabase: true,
    callsRepository: true,
    previewOnly: true,
  };

  const { document, storage } = renderPanel({});
  storage.setRecord(WRITE_PREFLIGHT_STORAGE_KEY, JSON.stringify(mockData));
  document.getElementById("desktop-reader-write-preflight-preview-refresh-button")?.click();

  const renderedText = collectText(document.body).join(" ");
  assert.equal(
    renderedText.includes("安全警告"),
    true,
    "should show safety warning for writesDatabase=true"
  );
  assert.equal(
    renderedText.includes("真实写入未启用"),
    true,
    "should clarify real write is not enabled"
  );

  // Warning div should be visible
  const warningNode = document.getElementById("desktop-reader-write-preflight-preview-warning");
  assert.equal(
    warningNode?.style.display,
    "block",
    "warning should be visible for dangerous mock data"
  );
});

test("write preflight panel: danger fields are filtered in browser script", () => {
  const mockData = {
    authReady: false,
    previewOnly: true,
    token: "top-secret-token-value",
    apiKey: "api-secret-key",
    secret: "classified-secret",
    rawRequest: { body: "raw-request-body" },
  };

  const { document, storage } = renderPanel({});
  storage.setRecord(WRITE_PREFLIGHT_STORAGE_KEY, JSON.stringify(mockData));
  document.getElementById("desktop-reader-write-preflight-preview-refresh-button")?.click();

  const renderedText = collectText(document.body).join(" ");
  assert.equal(renderedText.includes("已过滤敏感字段"), true);

  for (const forbidden of [
    "top-secret-token-value",
    "api-secret-key",
    "classified-secret",
    "raw-request-body",
  ]) {
    assert.equal(
      renderedText.includes(forbidden),
      false,
      `should not expose ${forbidden}`
    );
  }
});

test("write preflight panel: refresh button only re-reads localStorage, never writes", () => {
  const { document, storage } = renderPanel({});

  const getItemCallsBefore = storage.calls.getItem;
  document.getElementById("desktop-reader-write-preflight-preview-refresh-button")?.click();
  assert.equal(
    storage.calls.getItem > getItemCallsBefore,
    true,
    "refresh should re-read localStorage"
  );

  assert.equal(storage.calls.setItem, 0, "should never write to localStorage");
});
