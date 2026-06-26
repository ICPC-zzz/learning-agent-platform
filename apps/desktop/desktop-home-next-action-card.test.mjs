import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildLocalLearningStatusPanelScript,
  formatDesktopReadingDuration,
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

function createNextActionCardScaffold(document) {
  const card = document.createElement("section");
  card.id = "desktop-home-next-action-card";
  document.body.appendChild(card);

  const safety = document.createElement("p");
  safety.id = "desktop-home-next-action-safety-note";
  safety.textContent =
    "基于本地浏览器记录（lap.reader.localStatus.v1）的确定性规则推导，不是 AI 生成；不会同步数据库，不会调用真实 AI，不会执行工具，不会启动 Agent loop。";
  card.appendChild(safety);

  const title = document.createElement("p");
  title.id = "desktop-home-next-action-title";
  title.textContent = "-";
  card.appendChild(title);

  const description = document.createElement("p");
  description.id = "desktop-home-next-action-description";
  description.textContent = "-";
  card.appendChild(description);

  const reason = document.createElement("p");
  reason.id = "desktop-home-next-action-reason";
  reason.textContent = "-";
  card.appendChild(reason);

  const fieldIds = [
    "desktop-home-next-action-progress",
    "desktop-home-next-action-note-count",
    "desktop-home-next-action-bookmark-count",
    "desktop-home-next-action-reading-seconds",
    "desktop-home-next-action-reading-duration",
  ];
  for (const id of fieldIds) {
    const field = document.createElement("strong");
    field.id = id;
    field.textContent = "-";
    card.appendChild(field);
  }

  const link = document.createElement("a");
  link.id = "desktop-home-next-action-link";
  link.href = "/reader";
  link.textContent = "打开 Reader";
  card.appendChild(link);
}

function runScriptWithStorage(records) {
  const script = buildLocalLearningStatusPanelScript();
  const document = new MiniDocument();
  createNextActionCardScaffold(document);

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

test("下一张行动卡片: 未检测到 key 时建议打开 Reader", () => {
  const { document, executionResult } = runScriptWithStorage({});
  assert.equal(executionResult, true);
  assert.equal(
    document.getElementById("desktop-home-next-action-title")?.textContent,
    "打开 Reader，选择一本书开始阅读"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-link")?.href,
    "/reader"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-link")?.textContent,
    "打开 Reader"
  );
});

test("下一张行动卡片: 进度 < 30% 时建议完成前 30%", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-1",
      chapterId: "ch-1",
      progressPercent: 20,
      noteCount: 1,
      bookmarkCount: 0,
      readingSeconds: 900,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-title")?.textContent,
    "继续完成本章前 30% 阅读"
  );
});

test("下一张行动卡片: 进度 30-80% 且 noteCount=0 时建议添加笔记/书签", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-2",
      chapterId: "ch-2",
      progressRatio: 0.56,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 800,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-title")?.textContent,
    "继续阅读，并补充 1 条笔记或书签"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-reason")?.textContent?.includes("当前还没有本地笔记。"),
    true
  );
});

test("下一张行动卡片: 进度 >= 80% 且 bookmarkCount > 0 时建议回顾", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-3",
      chapterId: "ch-3",
      progressPercent: 92,
      noteCount: 2,
      bookmarkCount: 3,
      readingSeconds: 1200,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-title")?.textContent,
    "回顾本章笔记/书签，准备进入下一章"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-reason")?.textContent?.includes("已有书签，可从关键位置继续。"),
    true
  );
});

test("下一张行动卡片: sessionSeconds 兼容且包含专注阅读提示", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-4",
      chapterId: "ch-4",
      progressPercent: 40,
      noteCount: 0,
      bookmarkCount: 1,
      sessionSeconds: 480,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-seconds")?.textContent,
    "480 秒"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-reason")?.textContent?.includes("建议进行 10～15 分钟专注阅读。"),
    true
  );
});

test("下一张行动卡片: 继续阅读 href 安全编码特殊字符", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book a/?",
      chapterId: "chapter=1&2",
      progressPercent: 45,
      noteCount: 1,
      bookmarkCount: 0,
      readingSeconds: 700,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-link")?.href,
    "/reader?bookId=book+a%2F%3F&chapterId=chapter%3D1%262"
  );
});

test("下一张行动卡片: 坏 JSON 安全降级", () => {
  const { document, executionResult } = runScriptWithStorage({
    "lap.reader.localStatus.v1": "{ bad-json",
  });

  assert.equal(executionResult, true);
  assert.equal(
    document.getElementById("desktop-home-next-action-title")?.textContent,
    "本地学习行动建议暂不可用，已安全降级"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-link")?.href,
    "/reader"
  );
});

test("下一张行动卡片: preview/local-only 安全文案仍存在", () => {
  const { document } = runScriptWithStorage({});
  const text = document.getElementById("desktop-home-next-action-safety-note")?.textContent || "";

  assert.equal(text.includes("确定性规则推导"), true);
  assert.equal(text.includes("不是 AI 生成"), true);
  assert.equal(text.includes("不会同步数据库"), true);
  assert.equal(text.includes("不会调用真实 AI"), true);
  assert.equal(text.includes("不会执行工具"), true);
  assert.equal(text.includes("不会启动 Agent loop"), true);
});

// ===== formatDesktopReadingDuration unit tests =====

test("formatDesktopReadingDuration: null returns 暂无阅读时长", () => {
  assert.equal(formatDesktopReadingDuration(null), "暂无阅读时长");
});

test("formatDesktopReadingDuration: undefined returns 暂无阅读时长", () => {
  assert.equal(formatDesktopReadingDuration(undefined), "暂无阅读时长");
});

test("formatDesktopReadingDuration: non-number string returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration("abc"), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: object returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration({}), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: NaN returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration(NaN), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: Infinity returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration(Infinity), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: negative number returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration(-10), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: 0 seconds returns 已读 0 分钟", () => {
  assert.equal(formatDesktopReadingDuration(0), "已读 0 分钟");
});

test("formatDesktopReadingDuration: 30 seconds returns 已读 0 分钟", () => {
  assert.equal(formatDesktopReadingDuration(30), "已读 0 分钟");
});

test("formatDesktopReadingDuration: 59 seconds returns 已读 0 分钟", () => {
  assert.equal(formatDesktopReadingDuration(59), "已读 0 分钟");
});

test("formatDesktopReadingDuration: 60 seconds returns 已读 1 分钟", () => {
  assert.equal(formatDesktopReadingDuration(60), "已读 1 分钟");
});

test("formatDesktopReadingDuration: 720 seconds returns 已读 12 分钟", () => {
  assert.equal(formatDesktopReadingDuration(720), "已读 12 分钟");
});

test("formatDesktopReadingDuration: 3599 seconds returns 已读 59 分钟", () => {
  assert.equal(formatDesktopReadingDuration(3599), "已读 59 分钟");
});

test("formatDesktopReadingDuration: 3600 seconds returns 已读 1 小时", () => {
  assert.equal(formatDesktopReadingDuration(3600), "已读 1 小时");
});

test("formatDesktopReadingDuration: 3900 seconds returns 已读 1 小时 5 分钟", () => {
  assert.equal(formatDesktopReadingDuration(3900), "已读 1 小时 5 分钟");
});

test("formatDesktopReadingDuration: 7200 seconds returns 已读 2 小时", () => {
  assert.equal(formatDesktopReadingDuration(7200), "已读 2 小时");
});

test("formatDesktopReadingDuration: 7260 seconds returns 已读 2 小时 1 分钟", () => {
  assert.equal(formatDesktopReadingDuration(7260), "已读 2 小时 1 分钟");
});

test("formatDesktopReadingDuration: 86400 seconds returns 已读 24 小时", () => {
  assert.equal(formatDesktopReadingDuration(86400), "已读 24 小时");
});

// ===== Desktop home next-action card reading-duration integration tests =====

test("下一张行动卡片: 阅读时长显示 已读 12 分钟 (720 秒)", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-1",
      chapterId: "ch-1",
      progressPercent: 20,
      noteCount: 1,
      bookmarkCount: 0,
      readingSeconds: 720,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 12 分钟"
  );
});

test("下一张行动卡片: 阅读时长显示 已读 1 小时 5 分钟 (3900 秒)", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-2",
      chapterId: "ch-2",
      progressPercent: 45,
      noteCount: 3,
      bookmarkCount: 1,
      readingSeconds: 3900,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 1 小时 5 分钟"
  );
});

test("下一张行动卡片: 阅读时长显示 已读 1 小时 (3600 秒)", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-3",
      chapterId: "ch-3",
      progressPercent: 60,
      noteCount: 2,
      bookmarkCount: 2,
      readingSeconds: 3600,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 1 小时"
  );
});

test("下一张行动卡片: sessionSeconds 作为 readingSeconds 的回退", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-4",
      chapterId: "ch-4",
      progressPercent: 40,
      noteCount: 0,
      bookmarkCount: 1,
      sessionSeconds: 480,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 8 分钟"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-reading-seconds")?.textContent,
    "480 秒"
  );
});

test("下一张行动卡片: readingSeconds=0 时显示 已读 0 分钟", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-5",
      chapterId: "ch-5",
      progressPercent: 10,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 0,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 0 分钟"
  );
});

test("下一张行动卡片: readingSeconds/sessionSeconds 缺失时显示 已读 0 分钟", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-6",
      chapterId: "ch-6",
      progressPercent: 10,
      noteCount: 0,
      bookmarkCount: 0,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 0 分钟"
  );
});

test("下一张行动卡片: 坏 JSON 时阅读时长安全降级", () => {
  const { document, executionResult } = runScriptWithStorage({
    "lap.reader.localStatus.v1": "{ bad-json",
  });

  assert.equal(executionResult, true);
  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "暂无阅读时长"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-title")?.textContent,
    "本地学习行动建议暂不可用，已安全降级"
  );
});

test("下一张行动卡片: 无 storage key 时显示 暂无阅读时长", () => {
  const { document } = runScriptWithStorage({});

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "暂无阅读时长"
  );
});

test("下一张行动卡片: 继续阅读 href 在新增阅读时长后仍安全", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book a/?",
      chapterId: "chapter=1&2",
      progressPercent: 45,
      noteCount: 1,
      bookmarkCount: 0,
      readingSeconds: 700,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-link")?.href,
    "/reader?bookId=book+a%2F%3F&chapterId=chapter%3D1%262"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 11 分钟"
  );
});

test("下一张行动卡片: preview/local-only 安全文案在新增阅读时长后仍保持", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-safe",
      chapterId: "ch-safe",
      progressPercent: 50,
      noteCount: 1,
      bookmarkCount: 2,
      readingSeconds: 1800,
    }),
  });

  const safetyText = document.getElementById("desktop-home-next-action-safety-note")?.textContent || "";
  assert.equal(safetyText.includes("确定性规则推导"), true);
  assert.equal(safetyText.includes("不是 AI 生成"), true);
  assert.equal(safetyText.includes("不会同步数据库"), true);
  assert.equal(safetyText.includes("不会调用真实 AI"), true);
  assert.equal(safetyText.includes("不会执行工具"), true);
  assert.equal(safetyText.includes("不会启动 Agent loop"), true);

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 30 分钟"
  );
});

// ===== formatDesktopReadingDuration unit tests =====

test("formatDesktopReadingDuration: null returns 暂无阅读时长", () => {
  assert.equal(formatDesktopReadingDuration(null), "暂无阅读时长");
});

test("formatDesktopReadingDuration: undefined returns 暂无阅读时长", () => {
  assert.equal(formatDesktopReadingDuration(undefined), "暂无阅读时长");
});

test("formatDesktopReadingDuration: non-number string returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration("abc"), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: object returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration({}), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: NaN returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration(NaN), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: Infinity returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration(Infinity), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: negative number returns 阅读时长暂不可用", () => {
  assert.equal(formatDesktopReadingDuration(-10), "阅读时长暂不可用");
});

test("formatDesktopReadingDuration: 0 seconds returns 已读 0 分钟", () => {
  assert.equal(formatDesktopReadingDuration(0), "已读 0 分钟");
});

test("formatDesktopReadingDuration: 30 seconds returns 已读 0 分钟", () => {
  assert.equal(formatDesktopReadingDuration(30), "已读 0 分钟");
});

test("formatDesktopReadingDuration: 59 seconds returns 已读 0 分钟", () => {
  assert.equal(formatDesktopReadingDuration(59), "已读 0 分钟");
});

test("formatDesktopReadingDuration: 60 seconds returns 已读 1 分钟", () => {
  assert.equal(formatDesktopReadingDuration(60), "已读 1 分钟");
});

test("formatDesktopReadingDuration: 720 seconds returns 已读 12 分钟", () => {
  assert.equal(formatDesktopReadingDuration(720), "已读 12 分钟");
});

test("formatDesktopReadingDuration: 3599 seconds returns 已读 59 分钟", () => {
  assert.equal(formatDesktopReadingDuration(3599), "已读 59 分钟");
});

test("formatDesktopReadingDuration: 3600 seconds returns 已读 1 小时", () => {
  assert.equal(formatDesktopReadingDuration(3600), "已读 1 小时");
});

test("formatDesktopReadingDuration: 3900 seconds returns 已读 1 小时 5 分钟", () => {
  assert.equal(formatDesktopReadingDuration(3900), "已读 1 小时 5 分钟");
});

test("formatDesktopReadingDuration: 7200 seconds returns 已读 2 小时", () => {
  assert.equal(formatDesktopReadingDuration(7200), "已读 2 小时");
});

test("formatDesktopReadingDuration: 7260 seconds returns 已读 2 小时 1 分钟", () => {
  assert.equal(formatDesktopReadingDuration(7260), "已读 2 小时 1 分钟");
});

test("formatDesktopReadingDuration: 86400 seconds returns 已读 24 小时", () => {
  assert.equal(formatDesktopReadingDuration(86400), "已读 24 小时");
});

// ===== Desktop home next-action card reading-duration integration tests =====

test("下一张行动卡片: 阅读时长显示 已读 12 分钟 (720 秒)", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-1",
      chapterId: "ch-1",
      progressPercent: 20,
      noteCount: 1,
      bookmarkCount: 0,
      readingSeconds: 720,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 12 分钟"
  );
});

test("下一张行动卡片: 阅读时长显示 已读 1 小时 5 分钟 (3900 秒)", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-2",
      chapterId: "ch-2",
      progressPercent: 45,
      noteCount: 3,
      bookmarkCount: 1,
      readingSeconds: 3900,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 1 小时 5 分钟"
  );
});

test("下一张行动卡片: 阅读时长显示 已读 1 小时 (3600 秒)", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-3",
      chapterId: "ch-3",
      progressPercent: 60,
      noteCount: 2,
      bookmarkCount: 2,
      readingSeconds: 3600,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 1 小时"
  );
});

test("下一张行动卡片: sessionSeconds 作为 readingSeconds 的回退", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-4",
      chapterId: "ch-4",
      progressPercent: 40,
      noteCount: 0,
      bookmarkCount: 1,
      sessionSeconds: 480,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 8 分钟"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-reading-seconds")?.textContent,
    "480 秒"
  );
});

test("下一张行动卡片: readingSeconds=0 时显示 已读 0 分钟", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-5",
      chapterId: "ch-5",
      progressPercent: 10,
      noteCount: 0,
      bookmarkCount: 0,
      readingSeconds: 0,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 0 分钟"
  );
});

test("下一张行动卡片: readingSeconds/sessionSeconds 缺失时显示 已读 0 分钟", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-6",
      chapterId: "ch-6",
      progressPercent: 10,
      noteCount: 0,
      bookmarkCount: 0,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 0 分钟"
  );
});

test("下一张行动卡片: 坏 JSON 时阅读时长安全降级", () => {
  const { document, executionResult } = runScriptWithStorage({
    "lap.reader.localStatus.v1": "{ bad-json",
  });

  assert.equal(executionResult, true);
  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "暂无阅读时长"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-title")?.textContent,
    "本地学习行动建议暂不可用，已安全降级"
  );
});

test("下一张行动卡片: 无 storage key 时显示 暂无阅读时长", () => {
  const { document } = runScriptWithStorage({});

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "暂无阅读时长"
  );
});

test("下一张行动卡片: 继续阅读 href 在新增阅读时长后仍安全", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book a/?",
      chapterId: "chapter=1&2",
      progressPercent: 45,
      noteCount: 1,
      bookmarkCount: 0,
      readingSeconds: 700,
    }),
  });

  assert.equal(
    document.getElementById("desktop-home-next-action-link")?.href,
    "/reader?bookId=book+a%2F%3F&chapterId=chapter%3D1%262"
  );
  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 11 分钟"
  );
});

test("下一张行动卡片: preview/local-only 安全文案在新增阅读时长后仍保持", () => {
  const { document } = runScriptWithStorage({
    "lap.reader.localStatus.v1": JSON.stringify({
      schemaVersion: 1,
      source: "reader",
      previewOnly: true,
      bookId: "book-safe",
      chapterId: "ch-safe",
      progressPercent: 50,
      noteCount: 1,
      bookmarkCount: 2,
      readingSeconds: 1800,
    }),
  });

  const safetyText = document.getElementById("desktop-home-next-action-safety-note")?.textContent || "";
  assert.equal(safetyText.includes("确定性规则推导"), true);
  assert.equal(safetyText.includes("不是 AI 生成"), true);
  assert.equal(safetyText.includes("不会同步数据库"), true);
  assert.equal(safetyText.includes("不会调用真实 AI"), true);
  assert.equal(safetyText.includes("不会执行工具"), true);
  assert.equal(safetyText.includes("不会启动 Agent loop"), true);

  assert.equal(
    document.getElementById("desktop-home-next-action-reading-duration")?.textContent,
    "已读 30 分钟"
  );
});
