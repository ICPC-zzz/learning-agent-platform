import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildLocalLearningStatusPanelScript,
} = require("./local-learning-status-panel");

class MiniElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.style = {};
    this.id = "";
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

  get firstChild() {
    return this.children.length > 0 ? this.children[0] : null;
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

function createLocalStorage(records) {
  const map = new Map(Object.entries(records));
  const keys = Array.from(map.keys());
  return {
    get length() {
      return keys.length;
    },
    key(index) {
      if (index < 0 || index >= keys.length) {
        return null;
      }
      return keys[index];
    },
    getItem(key) {
      if (!map.has(key)) {
        return null;
      }
      return map.get(key);
    },
  };
}

test("local reading status diagnostics panel injects preview/local-only safety copy", () => {
  const script = buildLocalLearningStatusPanelScript();

  const document = new MiniDocument();
  const navRoot = document.createElement("div");
  navRoot.id = "desktop-navigation-shell";
  document.body.appendChild(navRoot);

  const executionResult = vm.runInNewContext(script, {
    document,
    window: {
      localStorage: createLocalStorage({}),
    },
    Date,
    JSON,
    Math,
    Number,
    URLSearchParams,
  });

  assert.equal(executionResult, true);

  const panel = document.getElementById("desktop-local-learning-status-panel");
  assert.ok(panel, "expected local learning status panel to be injected");

  const joinedText = collectText(panel).join(" ");
  assert.equal(joinedText.includes("本地阅读状态诊断（开发预览）"), true);
  assert.equal(
    joinedText.includes("preview-only / local-only / no DB sync / no real AI / no tools / no Agent loop"),
    true
  );
  assert.equal(joinedText.includes("lap.reader.localStatus.v1"), true);

  const stateNode = document.getElementById("desktop-reader-local-status-state");
  const keyNode = document.getElementById("desktop-reader-local-status-key");
  const hintNode = document.getElementById("desktop-reader-local-status-hint");
  const continueLinkNode = document.getElementById("desktop-reader-local-status-continue-link");

  assert.equal(stateNode?.textContent, "暂无本地 Reader 学习状态摘要");
  assert.equal(keyNode?.textContent, "未发现");
  assert.equal(hintNode?.textContent, "请先在 Reader 中阅读或刷新本地状态");
  assert.equal(continueLinkNode?.textContent, "前往 Reader 选择内容");
  assert.equal(continueLinkNode?.href, "/reader");
});

test("local reading status diagnostics panel renders localStatus.v1 core fields", () => {
  const script = buildLocalLearningStatusPanelScript();

  const document = new MiniDocument();
  const navRoot = document.createElement("div");
  navRoot.id = "desktop-navigation-shell";
  document.body.appendChild(navRoot);

  const executionResult = vm.runInNewContext(script, {
    document,
    window: {
      localStorage: createLocalStorage({
        "lap.reader.localStatus.v1": JSON.stringify({
          schemaVersion: 1,
          source: "reader",
          previewOnly: true,
          bookId: "book-001",
          chapterId: "chapter-010",
          progressRatio: 0.42,
          noteCount: 3,
          bookmarkCount: 2,
          readingSeconds: 901,
          updatedAt: "2026-05-27T12:00:00.000Z",
        }),
      }),
    },
    Date,
    JSON,
    Math,
    Number,
    URLSearchParams,
  });

  assert.equal(executionResult, true);

  assert.equal(
    document.getElementById("desktop-reader-local-status-state")?.textContent,
    "已读取本地 Reader 学习状态摘要"
  );
  assert.equal(document.getElementById("desktop-reader-local-status-key")?.textContent, "已发现");
  assert.equal(document.getElementById("desktop-reader-local-status-book-id")?.textContent, "book-001");
  assert.equal(
    document.getElementById("desktop-reader-local-status-chapter-id")?.textContent,
    "chapter-010"
  );
  assert.equal(document.getElementById("desktop-reader-local-status-progress")?.textContent, "42%");
  assert.equal(document.getElementById("desktop-reader-local-status-note-count")?.textContent, "3");
  assert.equal(document.getElementById("desktop-reader-local-status-bookmark-count")?.textContent, "2");
  assert.equal(document.getElementById("desktop-reader-local-status-reading-seconds")?.textContent, "901 秒");
  assert.equal(
    document.getElementById("desktop-reader-local-status-updated-at")?.textContent?.length > 0,
    true
  );
  assert.equal(
    document.getElementById("desktop-reader-local-status-continue-link")?.textContent,
    "继续阅读"
  );
  assert.equal(
    document.getElementById("desktop-reader-local-status-continue-link")?.href,
    "/reader?bookId=book-001&chapterId=chapter-010"
  );
});

test("local reading status diagnostics panel keeps safe reader fallback for bad JSON", () => {
  const script = buildLocalLearningStatusPanelScript();

  const document = new MiniDocument();
  const navRoot = document.createElement("div");
  navRoot.id = "desktop-navigation-shell";
  document.body.appendChild(navRoot);

  const executionResult = vm.runInNewContext(script, {
    document,
    window: {
      localStorage: createLocalStorage({
        "lap.reader.localStatus.v1": "{ bad-json",
      }),
    },
    Date,
    JSON,
    Math,
    Number,
    URLSearchParams,
  });

  assert.equal(executionResult, true);
  assert.equal(
    document.getElementById("desktop-reader-local-status-state")?.textContent,
    "本地状态不可解析，已安全降级"
  );
  assert.equal(
    document.getElementById("desktop-reader-local-status-hint")?.textContent,
    "请检查 lap.reader.localStatus.v1 内容格式。"
  );
  assert.equal(
    document.getElementById("desktop-reader-local-status-continue-link")?.textContent,
    "前往 Reader 选择内容"
  );
  assert.equal(
    document.getElementById("desktop-reader-local-status-continue-link")?.href,
    "/reader"
  );
});
