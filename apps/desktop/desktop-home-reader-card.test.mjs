import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildLocalLearningStatusPanelScript,
  formatDesktopLocalStatusAge,
} = require("./local-learning-status-panel");

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
  const keys = Array.from(map.keys());
  return {
    get length() {
      return keys.length;
    },
    getItem(key) {
      if (!map.has(key)) {
        return null;
      }
      return map.get(key);
    },
  };
}

function createHomeCardScaffold(document) {
  const homeCard = document.createElement("section");
  homeCard.id = "desktop-home-reader-card";
  document.body.appendChild(homeCard);

  const safetyNote = document.createElement("p");
  safetyNote.id = "desktop-home-reader-safety-note";
  safetyNote.textContent =
    "开发预览，仅读取本地浏览器记录，不会同步数据库，不会调用真实 AI，不会执行工具，不会启动 Agent loop。";
  homeCard.appendChild(safetyNote);

  const hint = document.createElement("p");
  hint.id = "desktop-home-reader-hint";
  hint.textContent = "-";
  homeCard.appendChild(hint);

  const progressPercent = document.createElement("p");
  progressPercent.id = "desktop-home-reader-progress-percent";
  progressPercent.textContent = "当前进度 -";
  homeCard.appendChild(progressPercent);

  const progressBar = document.createElement("div");
  progressBar.id = "desktop-home-reader-progress-bar";
  progressBar.style.width = "0%";
  homeCard.appendChild(progressBar);

  const ids = [
    "desktop-home-reader-book-id",
    "desktop-home-reader-chapter-id",
    "desktop-home-reader-progress",
    "desktop-home-reader-note-count",
    "desktop-home-reader-bookmark-count",
    "desktop-home-reader-reading-seconds",
    "desktop-home-reader-updated-at",
    "desktop-home-reader-updated-at-friendly",
  ];

  for (const id of ids) {
    const field = document.createElement("strong");
    field.id = id;
    field.textContent = "-";
    homeCard.appendChild(field);
  }

  const continueLink = document.createElement("a");
  continueLink.id = "desktop-home-reader-continue-link";
  continueLink.href = "/reader";
  continueLink.textContent = "打开 Reader";
  homeCard.appendChild(continueLink);
}

function runScriptWithStorage(records) {
  const script = buildLocalLearningStatusPanelScript();
  const document = new MiniDocument();
  createHomeCardScaffold(document);

  const executionResult = vm.runInNewContext(script, {
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

  return { document, executionResult };
}

test("desktop home reader card: empty state keeps /reader fallback", () => {
  const { document, executionResult } = runScriptWithStorage({});
  assert.equal(executionResult, true);

  assert.equal(
    document.getElementById("desktop-home-reader-hint")?.textContent,
    "暂无本地阅读状态。可先打开 Reader 开始阅读。"
  );
  assert.equal(
    document.getElementById("desktop-home-reader-continue-link")?.textContent,
    "打开 Reader"
  );
  assert.equal(
    document.getElementById("desktop-home-reader-continue-link")?.href,
    "/reader"
  );
  assert.equal(
    document.getElementById("desktop-home-reader-progress-percent")?.textContent,
    "当前进度 -"
  );
  assert.equal(
    document.getElementById("desktop-home-reader-progress-bar")?.style.width,
    "0%"
  );
});

test("desktop home reader card: complete summary renders fields and continue href", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-001",
      chapterId: "chapter-002",
      progressRatio: 0.38,
      noteCount: 5,
      bookmarkCount: 3,
      readingSeconds: 720,
      updatedAt: "2026-05-27T10:00:00.000Z",
    }),
  });

  assert.equal(document.getElementById("desktop-home-reader-book-id")?.textContent, "book-001");
  assert.equal(document.getElementById("desktop-home-reader-chapter-id")?.textContent, "chapter-002");
  assert.equal(document.getElementById("desktop-home-reader-progress")?.textContent, "38%");
  assert.equal(document.getElementById("desktop-home-reader-progress-percent")?.textContent, "当前进度 38%");
  assert.equal(document.getElementById("desktop-home-reader-progress-bar")?.style.width, "38%");
  assert.equal(document.getElementById("desktop-home-reader-note-count")?.textContent, "5");
  assert.equal(document.getElementById("desktop-home-reader-bookmark-count")?.textContent, "3");
  assert.equal(document.getElementById("desktop-home-reader-reading-seconds")?.textContent, "12 分钟");
  assert.equal(document.getElementById("desktop-home-reader-updated-at")?.textContent?.length > 0, true);
  assert.equal(
    document.getElementById("desktop-home-reader-continue-link")?.href,
    "/reader?bookId=book-001&chapterId=chapter-002"
  );
  assert.equal(
    document.getElementById("desktop-home-reader-continue-link")?.textContent,
    "继续阅读"
  );
});

test("desktop home reader card: sessionSeconds fallback renders readable minutes", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-002",
      chapterId: "chapter-003",
      progressPercent: 25,
      noteCount: 1,
      bookmarkCount: 0,
      sessionSeconds: 125,
      updatedAt: "2026-05-27T10:00:00.000Z",
    }),
  });

  assert.equal(document.getElementById("desktop-home-reader-reading-seconds")?.textContent, "2 分钟");
});

test("desktop home reader card: out-of-range progress is clamped safely", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-003",
      chapterId: "chapter-004",
      progressPercent: 140,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 60,
    }),
  });

  assert.equal(document.getElementById("desktop-home-reader-progress")?.textContent, "100%");
  assert.equal(document.getElementById("desktop-home-reader-progress-bar")?.style.width, "100%");
  assert.equal(
    document.getElementById("desktop-home-reader-hint")?.textContent,
    "已读取本地阅读状态，进度越界值已安全修正到 0%～100%。"
  );
});

test("desktop home reader card: invalid updatedAt falls back safely", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-004",
      chapterId: "chapter-005",
      progressRatio: 0.42,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 500,
      updatedAt: "not-a-time",
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-reader-updated-at")?.textContent,
    "时间不可解析（已安全降级）"
  );
  assert.equal(
    document.getElementById("desktop-home-reader-hint")?.textContent,
    "已读取本地阅读状态，更新时间不可解析，已安全降级。"
  );
});

test("desktop home reader card: continue href safely encodes special chars", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book a/?",
      chapterId: "chapter=1&2",
      progressPercent: 50,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 1,
      lastReadAt: "2026-05-27T10:00:00.000Z",
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-reader-continue-link")?.href,
    "/reader?bookId=book+a%2F%3F&chapterId=chapter%3D1%262"
  );
});

test("desktop home reader card: bad JSON safely degrades without throwing", () => {
  const { document, executionResult } = runScriptWithStorage({
    "lap.reader.localStatus.v1": "{ bad-json",
  });

  assert.equal(executionResult, true);
  assert.equal(
    document.getElementById("desktop-home-reader-hint")?.textContent,
    "本地阅读状态暂不可用，已安全降级"
  );
  assert.equal(
    document.getElementById("desktop-home-reader-continue-link")?.href,
    "/reader"
  );
});

test("desktop home reader card: preview-only local-only safety copy remains", () => {
  const { document } = runScriptWithStorage({});
  const safetyText = document.getElementById("desktop-home-reader-safety-note")?.textContent || "";

  assert.equal(safetyText.includes("开发预览"), true);
  assert.equal(safetyText.includes("仅读取本地浏览器记录"), true);
  assert.equal(safetyText.includes("不会同步数据库"), true);
  assert.equal(safetyText.includes("不会调用真实 AI"), true);
  assert.equal(safetyText.includes("不会执行工具"), true);
  assert.equal(safetyText.includes("不会启动 Agent loop"), true);
});

// --- formatDesktopLocalStatusAge unit tests ---

test("formatDesktopLocalStatusAge: just updated returns 刚刚更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-28T11:59:50.000Z"; // 10 seconds ago
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "刚刚更新");
});

test("formatDesktopLocalStatusAge: 5 minutes ago returns 5 分钟前更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-28T11:55:00.000Z"; // 5 minutes ago
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "5 分钟前更新");
});

test("formatDesktopLocalStatusAge: 2 hours ago returns 2 小时前更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-28T10:00:00.000Z"; // 2 hours ago
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "2 小时前更新");
});

test("formatDesktopLocalStatusAge: 25 hours ago returns 超过 24 小时未更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-27T11:00:00.000Z"; // 25 hours ago
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "超过 24 小时未更新");
});

test("formatDesktopLocalStatusAge: exactly 24 hours returns 超过 24 小时未更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-27T12:00:00.000Z"; // exactly 24 hours
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "超过 24 小时未更新");
});

test("formatDesktopLocalStatusAge: missing updatedAt (null) returns 暂无更新时间", () => {
  const result = formatDesktopLocalStatusAge(null, new Date());
  assert.equal(result, "暂无更新时间");
});

test("formatDesktopLocalStatusAge: missing updatedAt (undefined) returns 暂无更新时间", () => {
  const result = formatDesktopLocalStatusAge(undefined, new Date());
  assert.equal(result, "暂无更新时间");
});

test("formatDesktopLocalStatusAge: empty string returns 暂无更新时间", () => {
  const result = formatDesktopLocalStatusAge("", new Date());
  assert.equal(result, "暂无更新时间");
});

test("formatDesktopLocalStatusAge: whitespace-only string returns 暂无更新时间", () => {
  const result = formatDesktopLocalStatusAge("   ", new Date());
  assert.equal(result, "暂无更新时间");
});

test("formatDesktopLocalStatusAge: unparseable string returns 更新时间暂不可用", () => {
  const result = formatDesktopLocalStatusAge("not-a-date", new Date());
  assert.equal(result, "更新时间暂不可用");
});

test("formatDesktopLocalStatusAge: non-string input returns 更新时间暂不可用", () => {
  const result = formatDesktopLocalStatusAge(12345, new Date());
  assert.equal(result, "更新时间暂不可用");
});

test("formatDesktopLocalStatusAge: future time returns 刚刚更新 (conservative)", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-28T13:00:00.000Z"; // 1 hour in future
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "刚刚更新");
});

test("formatDesktopLocalStatusAge: 59 seconds returns 刚刚更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-28T11:59:01.000Z"; // 59 seconds ago
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "刚刚更新");
});

test("formatDesktopLocalStatusAge: 1 minute returns 1 分钟前更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-28T11:59:00.000Z"; // 1 minute ago
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "1 分钟前更新");
});

test("formatDesktopLocalStatusAge: 59 minutes returns 59 分钟前更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-28T11:01:00.000Z"; // 59 minutes ago
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "59 分钟前更新");
});

test("formatDesktopLocalStatusAge: 23 hours returns 23 小时前更新", () => {
  const now = new Date("2026-05-28T12:00:00.000Z");
  const updatedAt = "2026-05-27T13:00:00.000Z"; // 23 hours ago
  const result = formatDesktopLocalStatusAge(updatedAt, now);
  assert.equal(result, "23 小时前更新");
});

test("formatDesktopLocalStatusAge: default now parameter works without explicit now", () => {
  // When no now is passed, it should use current time and not throw
  const updatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
  const result = formatDesktopLocalStatusAge(updatedAt);
  assert.equal(typeof result, "string");
  assert.equal(result.length > 0, true);
});

// --- Integration tests: friendly time in home card DOM ---

test("desktop home reader card: friendly age element is populated for valid summary", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-010",
      chapterId: "chapter-010",
      progressPercent: 50,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 60,
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    }),
  });

  const friendlyEl = document.getElementById("desktop-home-reader-updated-at-friendly");
  assert.equal(friendlyEl !== null, true);
  const text = friendlyEl?.textContent || "";
  assert.equal(text !== "-", true);
  assert.equal(text !== "暂无更新时间", true);
  assert.equal(text !== "更新时间暂不可用", true);
});

test("desktop home reader card: friendly age element shows fallback for missing updatedAt", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-011",
      chapterId: "chapter-011",
      progressPercent: 50,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 60,
    }),
  });

  const friendlyEl = document.getElementById("desktop-home-reader-updated-at-friendly");
  assert.equal(friendlyEl !== null, true);
  assert.equal(friendlyEl?.textContent, "暂无更新时间");
});

test("desktop home reader card: friendly age fallback for unparseable updatedAt", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-012",
      chapterId: "chapter-012",
      progressRatio: 0.42,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 500,
      updatedAt: "not-a-time",
    }),
  });

  const friendlyEl = document.getElementById("desktop-home-reader-updated-at-friendly");
  assert.equal(friendlyEl !== null, true);
  assert.equal(friendlyEl?.textContent, "更新时间暂不可用");
});

test("desktop home reader card: friendly age not broken by bad JSON", () => {
  const { document, executionResult } = runScriptWithStorage({
    "lap.reader.localStatus.v1": "{ bad-json",
  });

  assert.equal(executionResult, true);
  const friendlyEl = document.getElementById("desktop-home-reader-updated-at-friendly");
  assert.equal(friendlyEl !== null, true);
  // Should show default "-" since the script short-circuits before setting friendly time
  assert.equal(friendlyEl?.textContent, "-");
});

test("desktop home reader card: continue href still safe after friendly time changes", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book a/?",
      chapterId: "chapter=1&2",
      progressPercent: 50,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 1,
      lastReadAt: "2026-05-27T10:00:00.000Z",
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-reader-continue-link")?.href,
    "/reader?bookId=book+a%2F%3F&chapterId=chapter%3D1%262"
  );
});

test("desktop home reader card: preview-only safety copy still intact after friendly time", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-013",
      chapterId: "chapter-013",
      progressPercent: 30,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 60,
      updatedAt: new Date().toISOString(),
    }),
  });

  const safetyText = document.getElementById("desktop-home-reader-safety-note")?.textContent || "";

  assert.equal(safetyText.includes("开发预览"), true, "should include 开发预览");
  assert.equal(safetyText.includes("仅读取本地浏览器记录"), true, "should include 仅读取本地浏览器记录");
  assert.equal(safetyText.includes("不会同步数据库"), true, "should include 不会同步数据库");
  assert.equal(safetyText.includes("不会调用真实 AI"), true, "should include 不会调用真实 AI");
  assert.equal(safetyText.includes("不会执行工具"), true, "should include 不会执行工具");
  assert.equal(safetyText.includes("不会启动 Agent loop"), true, "should include 不会启动 Agent loop");
});
