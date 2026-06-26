import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  PERMISSION_GATE_STORAGE_KEY,
  SAFE_PERMISSION_GATE_COPY,
  maskServerUserIdPreview,
  collectSensitiveFieldHits,
  normalizePermissionGatePreviewRecord,
  readPermissionGatePreviewFromStorage,
  buildLocalReaderPermissionGatePreviewPanelScript,
} = require("./local-reader-permission-gate-preview-panel.js");

// --- Mini DOM for browser-script tests ---

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
  const calls = { getItem: 0 };
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
  const script = buildLocalReaderPermissionGatePreviewPanelScript();
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

test("maskServerUserIdPreview: masks short and long userIds", () => {
  assert.equal(maskServerUserIdPreview(null), "未提供（预览掩码）");
  assert.equal(maskServerUserIdPreview(""), "未提供（预览掩码）");
  assert.equal(maskServerUserIdPreview("ab"), "***（预览掩码）");
  assert.equal(maskServerUserIdPreview("abc"), "***（预览掩码）");
  assert.equal(maskServerUserIdPreview("user-abc-123"), "use***（预览掩码）");
});

test("maskServerUserIdPreview: never reveals full userId", () => {
  const result = maskServerUserIdPreview("real-user-id-12345");
  assert.equal(result.includes("real-user-id-12345"), false, "should mask the full id");
  assert.equal(result.includes("***"), true, "should contain mask indicator");
});

test("normalizePermissionGatePreviewRecord: filters danger fields", () => {
  const record = normalizePermissionGatePreviewRecord({
    serverUserId: "user-001",
    bookId: "book-abc",
    chapterId: "chapter-xyz",
    canAccessBook: false,
    canAccessChapter: false,
    canWriteProgress: false,
    explicitUserAuthorization: true,
    gateStatus: "blocked",
    blockedReasons: ["REASON_1", "REASON_2"],
    token: "secret-token",
    apiKey: "api-key-value",
    rawRequest: { body: "raw" },
  });

  assert.equal(record.sensitiveText, "已过滤敏感字段");
  assert.equal(record.serverUserIdPreview.includes("***"), true);
  assert.equal(record.serverUserIdPreview.includes("user-001"), false);
  assert.equal(record.bookId, "book-abc");
  assert.equal(record.chapterId, "chapter-xyz");
  assert.equal(record.canAccessBook, "false");
  assert.equal(record.explicitUserAuthorization, "true");
  assert.equal(record.gateStatusText, "blocked");
  assert.equal(record.blockedReasonsText.includes("REASON_1"), true);
  assert.equal(record.blockedReasonsText.includes("REASON_2"), true);
});

test("normalizePermissionGatePreviewRecord: handles missing boolean fields", () => {
  const record = normalizePermissionGatePreviewRecord({
    serverUserId: "u1",
    bookId: "b1",
    chapterId: "c1",
  });

  assert.equal(record.canAccessBook, "未提供");
  assert.equal(record.canAccessChapter, "未提供");
  assert.equal(record.canWriteProgress, "未提供");
  assert.equal(record.explicitUserAuthorization, "未提供");
});

test("normalizePermissionGatePreviewRecord: detects previewOnly violation", () => {
  const record = normalizePermissionGatePreviewRecord({
    previewOnly: false,
    serverUserId: "u1",
    bookId: "b1",
    chapterId: "c1",
  });

  assert.equal(record.degradedText, "权限门数据结构不完整，已安全降级");
});

test("readPermissionGatePreviewFromStorage: empty state", () => {
  const snapshot = readPermissionGatePreviewFromStorage({
    getItem(_key) {
      return null;
    },
  });

  assert.equal(snapshot.stateKind, "empty");
  assert.equal(snapshot.statusText, "暂无本地权限门预览");
  assert.equal(snapshot.noteText, SAFE_PERMISSION_GATE_COPY);
  assert.equal(snapshot.record, null);
});

test("readPermissionGatePreviewFromStorage: bad JSON", () => {
  const snapshot = readPermissionGatePreviewFromStorage({
    getItem(key) {
      return key === PERMISSION_GATE_STORAGE_KEY ? "{ bad-json" : null;
    },
  });

  assert.equal(snapshot.stateKind, "degraded");
  assert.equal(snapshot.hintText.includes("不可解析"), true);
});

test("readPermissionGatePreviewFromStorage: non-object data", () => {
  const snapshot = readPermissionGatePreviewFromStorage({
    getItem(key) {
      return key === PERMISSION_GATE_STORAGE_KEY ? JSON.stringify("just-a-string") : null;
    },
  });

  assert.equal(snapshot.stateKind, "degraded");
});

// --- Browser-script tests ---

test("permission gate panel: no data renders empty state", () => {
  const { document } = renderPanel({});

  assert.equal(
    document.getElementById("desktop-reader-permission-gate-preview-title")?.textContent,
    "Reader 权限门（本地预览）"
  );
  assert.equal(
    document.getElementById("desktop-reader-permission-gate-preview-status")?.textContent,
    "暂无本地权限门预览"
  );
  assert.equal(
    document.getElementById("desktop-reader-permission-gate-preview-note")?.textContent,
    SAFE_PERMISSION_GATE_COPY
  );
  assert.equal(
    document.getElementById("desktop-reader-permission-gate-preview-hint")?.textContent,
    "请在 localStorage 中写入 lap.reader.permission.preview 后点击刷新。"
  );
});

test("permission gate panel: mock data renders safe fields, masks userId, filters danger fields", () => {
  const mockData = {
    serverUserId: "real-user-abc-123",
    bookId: "book-perm-001",
    chapterId: "chapter-perm-010",
    canAccessBook: false,
    canAccessChapter: false,
    canWriteProgress: false,
    explicitUserAuthorization: false,
    gateStatus: "blocked",
    blockedReasons: ["NO_AUTH", "NO_PERMISSION"],
    previewOnly: true,
    token: "secret-token-value",
    cookie: "session-cookie",
    accessToken: "access-secret",
    rawRequest: { body: "secret-body" },
  };

  const { document, storage } = renderPanel({});
  storage.setRecord(PERMISSION_GATE_STORAGE_KEY, JSON.stringify(mockData));

  document.getElementById("desktop-reader-permission-gate-preview-refresh-button")?.click();

  assert.equal(
    document.getElementById("desktop-reader-permission-gate-preview-status")?.textContent,
    "已读取本地权限门预览"
  );

  const renderedText = collectText(document.body).join(" ");

  // Danger field values must not be exposed
  for (const forbidden of [
    "secret-token-value",
    "session-cookie",
    "access-secret",
    "secret-body",
    "real-user-abc-123",
  ]) {
    assert.equal(
      renderedText.includes(forbidden),
      false,
      `should not expose ${forbidden}`
    );
  }

  // Safe fields must be visible
  assert.equal(renderedText.includes("book-perm-001"), true);
  assert.equal(renderedText.includes("chapter-perm-010"), true);
  assert.equal(renderedText.includes("已过滤敏感字段"), true);
  assert.equal(renderedText.includes("NO_AUTH"), true);
  assert.equal(renderedText.includes("NO_PERMISSION"), true);

  // Safety copy must be present
  assert.equal(
    renderedText.includes("开发预览"),
    true,
    "should mention preview"
  );
  assert.equal(
    renderedText.includes("只读"),
    true,
    "should mention read-only"
  );
  assert.equal(
    renderedText.includes("未连接真实权限"),
    true,
    "should mention not connected to real permissions"
  );

  // Misleading text must NOT appear
  for (const forbidden of [
    "已授权",
    "生产可用",
    "权限已接入",
    "同步成功",
  ]) {
    assert.equal(
      renderedText.includes(forbidden),
      false,
      `should not imply ${forbidden}`
    );
  }
});

test("permission gate panel: preview button only re-reads localStorage", () => {
  const { document, storage } = renderPanel({});

  const getItemCallsBefore = storage.calls.getItem;
  document.getElementById("desktop-reader-permission-gate-preview-refresh-button")?.click();
  assert.equal(
    storage.calls.getItem > getItemCallsBefore,
    true,
    "refresh should re-read localStorage"
  );

  // No writes happened
  const setItemCount = storage.calls.setItem ?? 0;
  assert.equal(setItemCount, 0, "should never write to localStorage");
});

test("permission gate panel: missing fields degrade safely", () => {
  const mockData = {
    // serverUserId is missing
    // bookId is missing
    chapterId: 123, // wrong type
    canAccessBook: "not-a-boolean",
  };

  const { document, storage } = renderPanel({});
  storage.setRecord(PERMISSION_GATE_STORAGE_KEY, JSON.stringify(mockData));
  document.getElementById("desktop-reader-permission-gate-preview-refresh-button")?.click();

  const renderedText = collectText(document.body).join(" ");
  assert.equal(renderedText.includes("类型错误") || renderedText.includes("未提供"), true);
});
