import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildLocalLearningStatusPanelScript, READER_LOCAL_STATUS_SUMMARY_KEY } = require("./local-learning-status-panel");

class MiniElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.textContent = "";
    this.style = {};
    this.id = "";
    this.href = "";
    this.innerHTML = "";
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
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

function createLocalStorage(records) {
  const map = new Map(Object.entries(records));
  return {
    get length() {
      return map.size;
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
  };
}

function addChild(parent, tagName, id, textContent = "") {
  const node = new MiniElement(tagName);
  node.id = id;
  node.textContent = textContent;
  parent.appendChild(node);
  return node;
}

function buildHomePreviewScaffold() {
  const document = new MiniDocument();

  const readerCard = document.createElement("section");
  readerCard.id = "desktop-home-reader-card";
  document.body.appendChild(readerCard);

  addChild(readerCard, "p", "desktop-home-reader-safety-note", "仅读取本地浏览器记录（lap.reader.localStatus.v1），不会同步数据库，不会调用真实 AI，不会执行工具，不会启动 Agent loop。");
  addChild(readerCard, "p", "desktop-home-reader-hint", "暂无本地阅读状态。可先打开 Reader 开始阅读。");
  addChild(readerCard, "p", "desktop-home-reader-progress-percent", "当前进度 -");

  const progressTrack = document.createElement("div");
  progressTrack.id = "desktop-home-reader-progress-track";
  readerCard.appendChild(progressTrack);

  const progressBar = document.createElement("div");
  progressBar.id = "desktop-home-reader-progress-bar";
  progressBar.style.width = "0%";
  progressTrack.appendChild(progressBar);

  for (const id of [
    "desktop-home-reader-book-id",
    "desktop-home-reader-chapter-id",
    "desktop-home-reader-progress",
    "desktop-home-reader-note-count",
    "desktop-home-reader-bookmark-count",
    "desktop-home-reader-reading-seconds",
    "desktop-home-reader-updated-at",
    "desktop-home-reader-updated-at-friendly",
  ]) {
    addChild(readerCard, "strong", id, "-");
  }

  const continueLink = document.createElement("a");
  continueLink.id = "desktop-home-reader-continue-link";
  continueLink.href = "/reader";
  continueLink.textContent = "打开 Reader";
  readerCard.appendChild(continueLink);

  const bookmarkCard = document.createElement("section");
  bookmarkCard.id = "desktop-home-bookmark-preview-card";
  document.body.appendChild(bookmarkCard);

  addChild(bookmarkCard, "p", "desktop-home-bookmark-preview-safety-note", "仅读取本地浏览器记录（lap.reader.localStatus.v1），不会同步数据库，不会调用真实 AI，不会执行工具，不会启动 Agent loop。");
  addChild(bookmarkCard, "p", "desktop-home-bookmark-preview-count-label", "暂无书签");
  addChild(bookmarkCard, "p", "desktop-home-bookmark-preview-empty-label", "暂无书签");

  const list = document.createElement("ul");
  list.id = "desktop-home-bookmark-preview-items";
  bookmarkCard.appendChild(list);

  addChild(bookmarkCard, "p", "desktop-home-bookmark-preview-warning", "");

  return document;
}

function renderHomePreview(records) {
  const document = buildHomePreviewScaffold();
  const script = buildLocalLearningStatusPanelScript();
  const result = vm.runInNewContext(script, {
    document,
    window: {
      localStorage: createLocalStorage(records),
    },
    Date,
    JSON,
    Math,
    Number,
    URLSearchParams,
  });

  return { document, result };
}

function collectText(root) {
  const parts = [];

  function walk(node) {
    if (!node) {
      return;
    }

    if (typeof node.textContent === "string" && node.textContent.length > 0) {
      parts.push(node.textContent);
    }

    for (const child of node.children || []) {
      walk(child);
    }
  }

  walk(root);
  return parts.join("\n");
}

function assertNoDangerousFields(document) {
  const renderedText = collectText(document.body);
  for (const forbidden of ["token", "cookie", "session", "DATABASE_URL", "secret"]) {
    assert.equal(
      renderedText.includes(forbidden),
      false,
      `Rendered UI should not contain forbidden field: ${forbidden}`
    );
  }
}

test("desktop home local preview: empty localStorage renders safe empty states", () => {
  const { document, result } = renderHomePreview({});

  assert.equal(result, true);
  assert.equal(document.getElementById("desktop-home-reader-hint")?.textContent, "暂无本地阅读状态。可先打开 Reader 开始阅读。");
  assert.equal(document.getElementById("desktop-home-reader-progress-percent")?.textContent, "当前进度 -");
  assert.equal(document.getElementById("desktop-home-reader-progress-bar")?.style.width, "0%");
  assert.equal(document.getElementById("desktop-home-reader-continue-link")?.href, "/reader");
  assert.equal(document.getElementById("desktop-home-bookmark-preview-count-label")?.textContent, "暂无书签");
  assert.equal(document.getElementById("desktop-home-bookmark-preview-empty-label")?.textContent, "暂无书签");
  assert.equal(document.getElementById("desktop-home-bookmark-preview-items")?.children.length, 0);
  assert.equal(document.getElementById("desktop-home-bookmark-preview-warning")?.textContent, "");

  assertNoDangerousFields(document);
  const renderedText = collectText(document.body);
  assert.equal(renderedText.includes("本地"), true);
  assert.equal(renderedText.includes("仅读取"), true);
  assert.equal(renderedText.includes("不会同步数据库"), true);
});

test("desktop home local preview: localStorage data renders progress and bookmark summary", () => {
  const { document, result } = renderHomePreview({
    [READER_LOCAL_STATUS_SUMMARY_KEY]: JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-demo-1",
      chapterId: "chapter-demo-2",
      progressPercent: 45,
      noteCount: 2,
      bookmarkCount: 1,
      readingSeconds: 900,
      updatedAt: "2026-05-28T10:00:00.000Z",
      bookmarks: [
        {
          title: "本地书签标题",
          chapterId: "chapter-demo-2",
          createdAt: "2026-05-28T09:45:00.000Z",
          note: "最近阅读摘要",
        },
      ],
    }),
  });

  assert.equal(result, true);
  assert.equal(document.getElementById("desktop-home-reader-book-id")?.textContent, "book-demo-1");
  assert.equal(document.getElementById("desktop-home-reader-chapter-id")?.textContent, "chapter-demo-2");
  assert.equal(document.getElementById("desktop-home-reader-progress")?.textContent, "45%");
  assert.equal(document.getElementById("desktop-home-reader-progress-percent")?.textContent, "当前进度 45%");
  assert.equal(document.getElementById("desktop-home-reader-progress-bar")?.style.width, "45%");
  assert.equal(document.getElementById("desktop-home-reader-note-count")?.textContent, "2");
  assert.equal(document.getElementById("desktop-home-reader-bookmark-count")?.textContent, "1");
  assert.equal(document.getElementById("desktop-home-reader-reading-seconds")?.textContent, "15 分钟");
  assert.equal(document.getElementById("desktop-home-reader-updated-at")?.textContent?.length > 0, true);
  assert.equal(document.getElementById("desktop-home-reader-updated-at-friendly")?.textContent?.length > 0, true);
  assert.equal(document.getElementById("desktop-home-reader-continue-link")?.href, "/reader?bookId=book-demo-1&chapterId=chapter-demo-2");
  assert.equal(document.getElementById("desktop-home-reader-continue-link")?.textContent, "继续阅读");

  assert.equal(document.getElementById("desktop-home-bookmark-preview-count-label")?.textContent, "共 1 个书签");
  assert.equal(document.getElementById("desktop-home-bookmark-preview-empty-label")?.textContent, "");
  assert.equal(document.getElementById("desktop-home-bookmark-preview-warning")?.textContent, "");

  const items = document.getElementById("desktop-home-bookmark-preview-items");
  assert.equal(items?.children.length, 1);
  assert.equal(items?.children[0]?.tagName, "li");
  assert.equal(items?.children[0]?.children[0]?.textContent, "本地书签标题");
  assert.equal(items?.children[0]?.children[1]?.textContent.includes("chapter-demo-2"), true);
  assert.equal(items?.children[0]?.children[2]?.textContent.includes("最近阅读摘要"), true);

  assertNoDangerousFields(document);
});
