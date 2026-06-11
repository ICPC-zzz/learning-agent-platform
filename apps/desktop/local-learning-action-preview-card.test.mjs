import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  LEARNING_ACTION_PREVIEW_STORAGE_KEYS,
  buildLocalLearningActionPreviewCardScript,
  normalizeLearningActionPreviewRecord,
  readLearningActionPreviewFromStorage,
} = require("./local-learning-action-preview-card");

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
    this.onclick = null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child, beforeChild) {
    child.parentNode = this;
    const index = this.children.indexOf(beforeChild);
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

function createCardScaffold(document) {
  const root = document.createElement("section");
  root.id = "desktop-home-learning-action-card";
  document.body.appendChild(root);

  const title = document.createElement("h2");
  title.id = "desktop-home-learning-action-title";
  title.textContent = "今日学习行动（本地预览）";
  root.appendChild(title);

  const safety = document.createElement("p");
  safety.id = "desktop-home-learning-action-safety-note";
  root.appendChild(safety);

  const status = document.createElement("p");
  status.id = "desktop-home-learning-action-status";
  status.textContent = "暂无本地学习行动";
  root.appendChild(status);

  const summary = document.createElement("div");
  summary.className = "desktop-home-learning-action-summary";
  root.appendChild(summary);

  const highlight = document.createElement("div");
  highlight.className = "desktop-home-learning-action-highlight";
  summary.appendChild(highlight);

  const minutesLabel = document.createElement("span");
  minutesLabel.className = "desktop-home-learning-action-label";
  minutesLabel.textContent = "今日建议学习";
  highlight.appendChild(minutesLabel);

  const minutes = document.createElement("strong");
  minutes.id = "desktop-home-learning-action-minutes";
  minutes.textContent = "-";
  highlight.appendChild(minutes);

  const minutesUnit = document.createElement("span");
  minutesUnit.className = "desktop-home-learning-action-label";
  minutesUnit.textContent = "分钟";
  highlight.appendChild(minutesUnit);

  const note = document.createElement("p");
  note.className = "desktop-home-learning-action-note";
  summary.appendChild(note);

  const details = document.createElement("ul");
  details.id = "desktop-home-learning-action-details-list";
  summary.appendChild(details);

  const rows = [
    ["desktop-home-learning-action-book-title-row", "desktop-home-learning-action-book-title", "最近书籍", "-"],
    ["desktop-home-learning-action-chapter-title-row", "desktop-home-learning-action-chapter-title", "最近章节", "-"],
    ["desktop-home-learning-action-continue-hint-row", "desktop-home-learning-action-continue-hint", "待继续阅读提示", "暂无待继续阅读提示"],
    ["desktop-home-learning-action-recommendation-reason-row", "desktop-home-learning-action-recommendation-reason", "mock 推荐原因", "暂无 mock 推荐原因"],
    ["desktop-home-learning-action-sensitive-row", "desktop-home-learning-action-sensitive", "敏感字段", "-"],
  ];

  for (const [rowId, valueId, labelText, valueText] of rows) {
    const row = document.createElement("li");
    row.id = rowId;
    row.className = "desktop-home-learning-action-item";
    details.appendChild(row);

    const label = document.createElement("span");
    label.className = "desktop-home-learning-action-item-label";
    label.textContent = labelText;
    row.appendChild(label);

    const value = document.createElement("strong");
    value.id = valueId;
    value.className = "desktop-home-learning-action-item-value";
    value.textContent = valueText;
    row.appendChild(value);
  }

  const refreshRow = document.createElement("li");
  refreshRow.id = "desktop-home-learning-action-refresh-button-row";
  details.appendChild(refreshRow);

  const refreshButton = document.createElement("button");
  refreshButton.id = "desktop-home-learning-action-refresh-button";
  refreshButton.type = "button";
  refreshButton.textContent = "刷新本地预览";
  refreshRow.appendChild(refreshButton);

  return root;
}

function renderCard(records) {
  const document = new MiniDocument();
  createCardScaffold(document);

  const storage = createLocalStorage(records);
  const script = buildLocalLearningActionPreviewCardScript();
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

test("learning action card: empty localStorage renders safe empty state", () => {
  const { document, result } = renderCard({});

  assert.equal(result, true);
  assert.equal(
    document.getElementById("desktop-home-learning-action-status")?.textContent,
    "暂无本地学习行动"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-minutes")?.textContent,
    "-"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-book-title")?.textContent,
    "-"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-continue-hint")?.textContent,
    "暂无待继续阅读提示"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-recommendation-reason")?.textContent,
    "暂无 mock 推荐原因"
  );

  const renderedText = collectText(document.body).join(" ");
  for (const forbidden of ["token", "cookie", "session", "DATABASE_URL", "secret", "authorization"]) {
    assert.equal(renderedText.includes(forbidden), false, `should not expose ${forbidden}`);
  }
});

test("learning action card: valid mock data renders summary and safe field types", () => {
  const { document } = renderCard({
    [LEARNING_ACTION_PREVIEW_STORAGE_KEYS[0]]: JSON.stringify({
      suggestedMinutes: 35,
      recentBookTitle: "TypeScript 入门",
      recentChapterTitle: "第 4 章：类型守卫",
      continueHint: "继续阅读第 4 章并补 1 个小练习",
      recommendationReason: "最近停在中段，先补完当前章节更顺畅",
      misc: {
        note: "本地 mock",
      },
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-learning-action-status")?.textContent,
    "已读取本地学习行动摘要"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-minutes")?.textContent,
    "35 分钟"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-book-title")?.textContent,
    "TypeScript 入门"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-chapter-title")?.textContent,
    "第 4 章：类型守卫"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-sensitive")?.textContent,
    "未发现敏感字段"
  );
});

test("learning action card: field type errors are ignored safely", () => {
  const { document } = renderCard({
    [LEARNING_ACTION_PREVIEW_STORAGE_KEYS[0]]: JSON.stringify({
      suggestedMinutes: "35",
      recentBookTitle: "安全阅读",
      recentChapterTitle: 42,
      continueHint: "继续阅读并复盘",
      recommendationReason: "字段类型错误不应导致崩溃",
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-learning-action-status")?.textContent,
    "已读取本地学习行动摘要"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-minutes")?.textContent,
    "-"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-book-title")?.textContent,
    "安全阅读"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-chapter-title")?.textContent,
    "-"
  );
});

test("learning action card: bad JSON degrades to unavailable state", () => {
  const { document, result } = renderCard({
    [LEARNING_ACTION_PREVIEW_STORAGE_KEYS[0]]: "{ bad-json",
  });

  assert.equal(result, true);
  assert.equal(
    document.getElementById("desktop-home-learning-action-status")?.textContent,
    "本地预览数据不可用"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-minutes")?.textContent,
    "-"
  );
});

test("learning action card: sensitive fields are filtered", () => {
  const { document } = renderCard({
    [LEARNING_ACTION_PREVIEW_STORAGE_KEYS[0]]: JSON.stringify({
      suggestedMinutes: 20,
      recentBookTitle: "隐私保护",
      recentChapterTitle: "敏感字段过滤",
      continueHint: "继续阅读",
      recommendationReason: "危险字段不会原样展示",
      token: "secret-token-value",
      cookie: "cookie-value",
      session: "session-value",
      DATABASE_URL: "postgres://secret",
      secret: "another-secret",
      apiKey: "api-key-value",
      authorizationHeader: "Bearer raw-token",
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-learning-action-sensitive")?.textContent,
    "已过滤敏感字段"
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
  ]) {
    assert.equal(renderedText.includes(forbidden), false, `should not expose ${forbidden}`);
  }
});

test("learning action card: refresh button only re-reads localStorage", () => {
  const { document, storage } = renderCard({
    [LEARNING_ACTION_PREVIEW_STORAGE_KEYS[0]]: JSON.stringify({
      suggestedMinutes: 25,
      recentBookTitle: "第一版书名",
      recentChapterTitle: "第一版章节",
      continueHint: "先看完这段",
      recommendationReason: "初始原因",
    }),
  });

  const getItemCallsAfterInitialRender = storage.calls.getItem;
  assert.equal(getItemCallsAfterInitialRender > 0, true);

  storage.setRecord(
    LEARNING_ACTION_PREVIEW_STORAGE_KEYS[0],
    JSON.stringify({
      suggestedMinutes: 45,
      recentBookTitle: "第二版书名",
      recentChapterTitle: "第二版章节",
      continueHint: "刷新后重新读取",
      recommendationReason: "刷新后重新读取本地预览",
    })
  );

  document.getElementById("desktop-home-learning-action-refresh-button")?.click();

  assert.equal(
    storage.calls.getItem > getItemCallsAfterInitialRender,
    true,
    "refresh should re-read localStorage"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-minutes")?.textContent,
    "45 分钟"
  );
  assert.equal(
    document.getElementById("desktop-home-learning-action-book-title")?.textContent,
    "第二版书名"
  );
});

test("learning action card: direct storage reader returns safe defaults", () => {
  const snapshot = readLearningActionPreviewFromStorage({
    getItem(key) {
      return key === LEARNING_ACTION_PREVIEW_STORAGE_KEYS[0]
        ? JSON.stringify({
            suggestedMinutes: 30,
            recentBookTitle: "直接读取",
            recentChapterTitle: "直接读取章节",
          })
        : null;
    },
  });

  assert.equal(snapshot.stateKind, "ready");
  assert.equal(snapshot.minutesText, "30 分钟");
  assert.equal(snapshot.bookText, "直接读取");
  assert.equal(snapshot.chapterText, "直接读取章节");
  assert.equal(snapshot.sensitiveText, "未发现敏感字段");
});

test("learning action card: normalize helper handles sensitive fields", () => {
  const snapshot = normalizeLearningActionPreviewRecord({
    suggestedMinutes: 18,
    recentBookTitle: "安全书名",
    token: "secret-token",
  });

  assert.equal(snapshot?.stateKind, "ready");
  assert.equal(snapshot?.sensitiveText, "已过滤敏感字段");
});
