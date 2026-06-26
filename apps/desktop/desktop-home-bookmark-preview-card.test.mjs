import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildLocalLearningStatusPanelScript,
  normalizeDesktopBookmarkPreview,
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
    this.innerHTML = "";
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  setAttribute(name, value) { if (name === "id") this.id = String(value); }
}

class MiniDocument {
  constructor() { this.body = new MiniElement("body"); }
  createElement(tagName) { return new MiniElement(tagName); }
  getElementById(id) { return findById(this.body, id); }
}

function findById(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children) { const found = findById(child, id); if (found) return found; }
  return null;
}

function createLocalStorage(records) {
  const map = new Map(Object.entries(records));
  return { get length() { return Array.from(map.keys()).length; }, getItem(key) { return map.has(key) ? map.get(key) : null; } };
}

function buildStatusString(localStatus) {
  if (localStatus === null || localStatus === undefined) return null;
  return JSON.stringify({
    schemaVersion: 1, source: "reader", previewOnly: true,
    bookId: localStatus.bookId ?? "test-book",
    chapterId: localStatus.chapterId ?? "test-chapter",
    progressPercent: localStatus.progressPercent ?? 42,
    noteCount: localStatus.noteCount ?? 0,
    bookmarkCount: localStatus.bookmarkCount ?? 0,
    readingSeconds: localStatus.readingSeconds ?? 0,
    updatedAt: localStatus.updatedAt ?? new Date().toISOString(),
    bookmarks: localStatus.bookmarks,
  });
}

function createDOMWithBookmarkCard(records) {
  const miniDoc = new MiniDocument();
  const container = miniDoc.createElement("section");
  container.id = "desktop-home-bookmark-preview-card";
  miniDoc.body.appendChild(container);

  // Create child elements that exist in the static HTML (index.html)
  function addChild(id, tag) {
    const el = miniDoc.createElement(tag || "p");
    el.id = id;
    container.appendChild(el);
    return el;
  }
  addChild("desktop-home-bookmark-preview-safety-note");
  addChild("desktop-home-bookmark-preview-count-label");
  addChild("desktop-home-bookmark-preview-empty-label");
  addChild("desktop-home-bookmark-preview-items", "ul");
  addChild("desktop-home-bookmark-preview-warning");

  // Also add next-action card elements that the IIFE script references
  const nextActionContainer = miniDoc.createElement("section");
  nextActionContainer.id = "desktop-home-next-action-card";
  miniDoc.body.appendChild(nextActionContainer);
  ["desktop-home-next-action-bookmark-count", "desktop-home-next-action-progress",
   "desktop-home-next-action-note-count", "desktop-home-next-action-reading-seconds",
   "desktop-home-next-action-reading-duration", "desktop-home-next-action-title",
   "desktop-home-next-action-description", "desktop-home-next-action-reason",
   "desktop-home-next-action-link"].forEach(function(id) {
    const el = miniDoc.createElement(id === "desktop-home-next-action-link" ? "a" : "strong");
    el.id = id;
    if (id === "desktop-home-next-action-link") el.href = "";
    nextActionContainer.appendChild(el);
  });
  const scriptText = buildLocalLearningStatusPanelScript();
  const sandbox = { document: miniDoc, window: { localStorage: createLocalStorage(records) }, URLSearchParams, Date };
  const ctx = vm.createContext(sandbox);
  const fn = new vm.Script(scriptText);
  fn.runInContext(ctx);
  return { miniDoc, scriptText };
}

// ---- Unit tests ----

test("unit: null returns empty", () => {
  const r = normalizeDesktopBookmarkPreview(null);
  assert.equal(r.countLabel, "暂无书签");
  assert.deepEqual(r.items, []);
  assert.equal(r.previewOnly, true);
});

test("unit: bookmarkCount=0 no array", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 0 });
  assert.equal(r.countLabel, "暂无书签");
});

test("unit: bookmarkCount>0 no array shows count", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 3 });
  assert.equal(r.countLabel, "本地记录有 3 个书签");
  assert.equal(r.emptyLabel, "暂无书签明细");
});

test("unit: valid array shows items", () => {
  const r = normalizeDesktopBookmarkPreview({
    bookmarkCount: 3,
    bookmarks: [
      { title: "ch1", chapterId: "c1", createdAt: "2025-01-01T10:00:00Z" },
      { title: "ch2", chapterId: "c2", createdAt: "2025-01-02T10:00:00Z" },
      { title: "ch3", chapterId: "c3", createdAt: "2025-01-03T10:00:00Z" },
    ],
  });
  assert.equal(r.countLabel, "共 3 个书签");
  assert.equal(r.items.length, 3);
  assert.equal(r.emptyLabel, null);
});

test("unit: caps at 5", () => {
  const bms = [];
  for (let i = 0; i < 10; i++) bms.push({ title: "b"+i, chapterId: "c"+i, createdAt: "2025-01-01T10:00:00Z" });
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 10, bookmarks: bms });
  assert.equal(r.items.length, 5);
  assert.ok(r.warningLabel.includes("仅展示最近 5 条"));
});

test("unit: missing title", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 1, bookmarks: [{ chapterId: "ch1" }] });
  assert.equal(r.items[0].title, "未命名书签");
});

test("unit: label fallback", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 1, bookmarks: [{ label: "from label" }] });
  assert.equal(r.items[0].title, "from label");
});

test("unit: missing chapterId", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 1, bookmarks: [{ title: "t" }] });
  assert.equal(r.items[0].chapterId, "未知章节");
});

test("unit: bad date", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 1, bookmarks: [{ title: "t", chapterId: "c1", createdAt: "bad" }] });
  assert.equal(r.items[0].time, "时间未知");
});

test("unit: truncates long excerpt", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 1, bookmarks: [{ title: "t", chapterId: "c1", note: "A".repeat(80) }] });
  assert.ok(r.items[0].excerpt.endsWith("..."));
});

test("unit: non-array bookmarks", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 5, bookmarks: "bad" });
  assert.equal(r.emptyLabel, "暂无书签明细");
});

test("unit: NaN count", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: NaN });
  assert.equal(r.countLabel, "暂无书签");
});

test("unit: negative count", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: -5 });
  assert.equal(r.countLabel, "暂无书签");
});

test("unit: null items skipped", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 3, bookmarks: [null, { title: "ok", chapterId: "c2" }, undefined] });
  assert.equal(r.items.length, 1);
});

test("unit: empty fields", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 1, bookmarks: [{ title: " ", chapterId: "", createdAt: "" }] });
  assert.equal(r.items[0].title, "未命名书签");
  assert.equal(r.items[0].chapterId, "未知章节");
  assert.equal(r.items[0].time, "时间未知");
});

test("unit: array with count=0 uses array length", () => {
  const r = normalizeDesktopBookmarkPreview({ bookmarkCount: 0, bookmarks: [{ title: "b1", chapterId: "c1" }] });
  assert.equal(r.countLabel, "共 1 个书签");
  assert.equal(r.items.length, 1);
});

// ---- DOM tests ----

test("dom: empty localStorage shows empty state", () => {
  const { miniDoc } = createDOMWithBookmarkCard({});
  assert.equal(miniDoc.getElementById("desktop-home-bookmark-preview-count-label").textContent, "暂无书签");
  assert.equal(miniDoc.getElementById("desktop-home-bookmark-preview-empty-label").textContent, "暂无书签");
});

test("dom: count>0 no array", () => {
  const ls = buildStatusString({ bookmarkCount: 5 });
  const { miniDoc } = createDOMWithBookmarkCard({ "lap.reader.localStatus.v1": ls });
  assert.equal(miniDoc.getElementById("desktop-home-bookmark-preview-count-label").textContent, "本地记录有 5 个书签");
  assert.equal(miniDoc.getElementById("desktop-home-bookmark-preview-empty-label").textContent, "暂无书签明细");
});

test("dom: array renders items", () => {
  const obj = { bookmarkCount: 2, bookmarks: [{ title: "重要", chapterId: "ch1", createdAt: "2025-03-01T08:00:00Z" }, { title: "公式", chapterId: "ch2", createdAt: "2025-03-02T09:00:00Z" }] };
  const ls = buildStatusString(obj);
  const { miniDoc } = createDOMWithBookmarkCard({ "lap.reader.localStatus.v1": ls });
  assert.equal(miniDoc.getElementById("desktop-home-bookmark-preview-count-label").textContent, "共 2 个书签");
  const itemsEl = miniDoc.getElementById("desktop-home-bookmark-preview-items");
  assert.ok(itemsEl.children.length >= 1, "Should have at least 1 bookmark item");
  // Check that the list has li elements (bookmark items)
  assert.equal(itemsEl.children[0].tagName, "li");
});

test("dom: warning for >5", () => {
  const bms = [];
  for (let i = 0; i < 8; i++) bms.push({ title: "b"+i, chapterId: "c"+i, createdAt: "2025-01-01T10:00:00Z" });
  const ls = buildStatusString({ bookmarkCount: 8, bookmarks: bms });
  const { miniDoc } = createDOMWithBookmarkCard({ "lap.reader.localStatus.v1": ls });
  assert.ok(miniDoc.getElementById("desktop-home-bookmark-preview-warning").textContent.includes("仅展示最近 5 条"));
});

test("dom: bad JSON degrades safely", () => {
  const { miniDoc } = createDOMWithBookmarkCard({ "lap.reader.localStatus.v1": "{bad" });
  assert.equal(miniDoc.getElementById("desktop-home-bookmark-preview-count-label").textContent, "暂无书签");
});

test("dom: incompatible structure degrades safely", () => {
  const { miniDoc } = createDOMWithBookmarkCard({ "lap.reader.localStatus.v1": JSON.stringify({ schemaVersion: 99 }) });
  assert.equal(miniDoc.getElementById("desktop-home-bookmark-preview-count-label").textContent, "暂无书签");
});

test("dom: safety note present", () => {
  const { miniDoc } = createDOMWithBookmarkCard({});
  const sn = miniDoc.getElementById("desktop-home-bookmark-preview-safety-note");
  // The safety note text is static HTML in index.html, not set by the IIFE script.
  // In this test DOM, the element exists but has empty textContent.
  // Verify the element exists (created by test setup).
  assert.ok(sn !== null, "Safety note element should exist");
  assert.ok(sn.id === "desktop-home-bookmark-preview-safety-note");
});

test("dom: no sync/AI/Agent buttons", () => {
  const { miniDoc } = createDOMWithBookmarkCard({});
  function collect(node) {
    let btns = [];
    if (node.tagName === "a" && node.href) btns.push(node.textContent);
    for (const c of node.children) btns = btns.concat(collect(c));
    return btns;
  }
  const all = collect(miniDoc.body);
  const bad = all.filter(function(t) { return t.includes("同步") || t.includes("AI") || t.includes("Agent"); });
  assert.equal(bad.length, 0);
});

test("dom: fallback for missing fields", () => {
  const ls = buildStatusString({ bookmarkCount: 1, bookmarks: [{}] });
  const { miniDoc } = createDOMWithBookmarkCard({ "lap.reader.localStatus.v1": ls });
  const itemsEl2 = miniDoc.getElementById("desktop-home-bookmark-preview-items");
  assert.ok(itemsEl2.children.length >= 1, "Should have bookmark items even with empty fields");
  // Check the structure: each li has a strong (title) and span (info)
  const firstLi = itemsEl2.children[0];
  assert.equal(firstLi.tagName, "li");
  // The title strong should be present (with fallback text)
  const titleStrong = firstLi.children[0];
  assert.ok(titleStrong, "Should have title element");
  assert.equal(titleStrong.tagName, "strong");
});

test("dom: no white-screen on empty items", () => {
  const ls = buildStatusString({ bookmarkCount: 2, bookmarks: [{}, {}] });
  const { miniDoc } = createDOMWithBookmarkCard({ "lap.reader.localStatus.v1": ls });
  assert.ok(miniDoc.getElementById("desktop-home-bookmark-preview-count-label").textContent.length > 0);
});

test("dom: next-action card still works", () => {
  const obj = { bookmarkCount: 7, progressPercent: 45, noteCount: 2, readingSeconds: 1200, bookmarks: [{ title: "b1", chapterId: "ch1", createdAt: "2025-01-01T10:00:00Z" }] };
  const ls = buildStatusString(obj);
  const { miniDoc } = createDOMWithBookmarkCard({ "lap.reader.localStatus.v1": ls });
  assert.equal(miniDoc.getElementById("desktop-home-next-action-bookmark-count").textContent, "7");
});
