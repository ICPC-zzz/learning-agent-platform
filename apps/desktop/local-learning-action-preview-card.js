const LEARNING_ACTION_PREVIEW_STORAGE_KEYS = Object.freeze([
  "lap.learning.dailyTasks.today.v1",
  "lap.learning.dailyTasks.preview.v1",
  "lap.learning.dailyActionPreview.v1",
  "lap.learning.dailyAction.v1",
]);

const LEARNING_ACTION_PREVIEW_STORAGE_PREFIX = "lap.learning.dailyTasks.";

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNonNegativeNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function truncateText(text, maxLength) {
  if (typeof text !== "string") {
    return null;
  }

  const normalized = text.trim();
  if (normalized.length === 0) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, maxLength - 1) + "…";
}

function normalizeDisplayText(value, maxLength) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }

  return truncateText(normalized, maxLength);
}

function normalizeMinutes(value) {
  const normalized = normalizeNonNegativeNumber(value);
  if (normalized === null) {
    return null;
  }

  return Math.floor(normalized);
}

function isSensitiveFieldName(rawKey) {
  const normalized = String(rawKey || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!normalized) {
    return false;
  }

  return (
    normalized.includes("token") ||
    normalized.includes("cookie") ||
    normalized === "session" ||
    normalized === "sessionid" ||
    normalized.includes("secret") ||
    normalized === "databaseurl" ||
    normalized.includes("apikey") ||
    normalized.includes("authorization")
  );
}

function collectSensitiveFieldHits(value, path, hits) {
  const currentPath = Array.isArray(path) ? path : [];
  const currentHits = Array.isArray(hits) ? hits : [];

  if (!value || typeof value !== "object") {
    return currentHits;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectSensitiveFieldHits(value[i], currentPath.concat(String(i)), currentHits);
    }
    return currentHits;
  }

  for (const key of Object.keys(value)) {
    const nextPath = currentPath.concat(key);
    if (isSensitiveFieldName(key)) {
      currentHits.push(nextPath.join("."));
    }
    collectSensitiveFieldHits(value[key], nextPath, currentHits);
  }

  return currentHits;
}

function readNestedValue(value, path) {
  if (!value || typeof value !== "object" || !Array.isArray(path)) {
    return undefined;
  }

  let current = value;
  for (let i = 0; i < path.length; i += 1) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = current[path[i]];
  }

  return current;
}

function readStringCandidate(value, candidatePaths, maxLength) {
  if (!Array.isArray(candidatePaths)) {
    return null;
  }

  for (let i = 0; i < candidatePaths.length; i += 1) {
    const candidatePath = candidatePaths[i];
    let rawValue = undefined;

    if (Array.isArray(candidatePath)) {
      rawValue = readNestedValue(value, candidatePath);
    } else {
      rawValue = value ? value[candidatePath] : undefined;
    }

    const normalized = normalizeDisplayText(rawValue, maxLength);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function readNumberCandidate(value, candidatePaths) {
  if (!Array.isArray(candidatePaths)) {
    return null;
  }

  for (let i = 0; i < candidatePaths.length; i += 1) {
    const candidatePath = candidatePaths[i];
    let rawValue = undefined;

    if (Array.isArray(candidatePath)) {
      rawValue = readNestedValue(value, candidatePath);
    } else {
      rawValue = value ? value[candidatePath] : undefined;
    }

    const normalized = normalizeMinutes(rawValue);
    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function buildEmptyLearningActionSnapshot() {
  return {
    stateKind: "empty",
    statusText: "暂无本地学习行动",
    noteText: "本地预览 / 未连接云端 / 未同步数据库",
    minutesText: "-",
    bookText: "-",
    chapterText: "-",
    continueHintText: "暂无待继续阅读提示",
    reasonText: "暂无 mock 推荐原因",
    sensitiveText: "-",
  };
}

function buildUnavailableLearningActionSnapshot() {
  return {
    stateKind: "unavailable",
    statusText: "本地预览数据不可用",
    noteText: "本地预览 / 未连接云端 / 未同步数据库",
    minutesText: "-",
    bookText: "-",
    chapterText: "-",
    continueHintText: "暂无待继续阅读提示",
    reasonText: "暂无 mock 推荐原因",
    sensitiveText: "-",
  };
}

function normalizeLearningActionPreviewRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const sensitiveFieldHits = collectSensitiveFieldHits(value);
  const suggestedMinutes = readNumberCandidate(value, [
    "suggestedMinutes",
    "recommendedMinutes",
    "todayMinutes",
    "minutes",
  ]);
  const recentBookText = readStringCandidate(
    value,
    [
      "recentBookTitle",
      "bookTitle",
      ["recentBook", "title"],
      ["recentBook", "name"],
      ["recentBook", "bookTitle"],
      ["recentBook", "id"],
      "bookId",
    ],
    80
  );
  const recentChapterText = readStringCandidate(
    value,
    [
      "recentChapterTitle",
      "chapterTitle",
      ["recentChapter", "title"],
      ["recentChapter", "name"],
      ["recentChapter", "chapterTitle"],
      ["recentChapter", "id"],
      "chapterId",
    ],
    80
  );
  const continueHintText = readStringCandidate(
    value,
    [
      "continueHint",
      "continueReadingHint",
      "resumeHint",
      "nextStepHint",
      "continuePrompt",
    ],
    140
  );
  const reasonText = readStringCandidate(
    value,
    [
      "recommendationReason",
      "reason",
      "mockReason",
      "dailyReason",
      "why",
    ],
    180
  );

  const hasRenderableSafeField =
    suggestedMinutes !== null ||
    recentBookText !== null ||
    recentChapterText !== null ||
    continueHintText !== null ||
    reasonText !== null;

  if (!hasRenderableSafeField && sensitiveFieldHits.length === 0) {
    return null;
  }

  return {
    stateKind: "ready",
    statusText: "已读取本地学习行动摘要",
    noteText: "本地预览 / 未连接云端 / 未同步数据库",
    minutesText:
      suggestedMinutes === null ? "-" : String(suggestedMinutes) + " 分钟",
    bookText: recentBookText ?? "-",
    chapterText: recentChapterText ?? "-",
    continueHintText: continueHintText ?? "暂无待继续阅读提示",
    reasonText: reasonText ?? "暂无 mock 推荐原因",
    sensitiveText:
      sensitiveFieldHits.length > 0 ? "已过滤敏感字段" : "未发现敏感字段",
  };
}

function readLearningActionPreviewFromStorage(storage) {
  if (!storage) {
    return buildUnavailableLearningActionSnapshot();
  }

  let rawValue = null;
  let matchedKey = null;

  try {
    for (let i = 0; i < LEARNING_ACTION_PREVIEW_STORAGE_KEYS.length; i += 1) {
      const key = LEARNING_ACTION_PREVIEW_STORAGE_KEYS[i];
      const candidate = storage.getItem(key);
      if (candidate !== null) {
        rawValue = candidate;
        matchedKey = key;
        break;
      }
    }

    if (rawValue === null && typeof storage.length === "number" && typeof storage.key === "function") {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (
          typeof key === "string" &&
          key.startsWith(LEARNING_ACTION_PREVIEW_STORAGE_PREFIX)
        ) {
          const candidate = storage.getItem(key);
          if (candidate !== null) {
            rawValue = candidate;
            matchedKey = key;
            break;
          }
        }
      }
    }
  } catch (_error) {
    return buildUnavailableLearningActionSnapshot();
  }

  if (rawValue === null) {
    return buildEmptyLearningActionSnapshot();
  }

  let parsedValue = null;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch (_error) {
    return buildUnavailableLearningActionSnapshot();
  }

  const summary = normalizeLearningActionPreviewRecord(parsedValue);
  if (!summary) {
    return buildEmptyLearningActionSnapshot();
  }

  return {
    ...summary,
    matchedKey,
  };
}

function buildLocalLearningActionPreviewCardScript() {
  return `(() => {
    const rootId = "desktop-home-learning-action-card";
    const titleId = "desktop-home-learning-action-title";
    const safetyNoteId = "desktop-home-learning-action-safety-note";
    const statusId = "desktop-home-learning-action-status";
    const minutesId = "desktop-home-learning-action-minutes";
    const bookId = "desktop-home-learning-action-book-title";
    const chapterId = "desktop-home-learning-action-chapter-title";
    const continueHintId = "desktop-home-learning-action-continue-hint";
    const reasonId = "desktop-home-learning-action-recommendation-reason";
    const sensitiveId = "desktop-home-learning-action-sensitive";
    const detailsListId = "desktop-home-learning-action-details-list";
    const refreshButtonId = "desktop-home-learning-action-refresh-button";
    const previewKeys = ${JSON.stringify(LEARNING_ACTION_PREVIEW_STORAGE_KEYS)};
    const previewPrefix = ${JSON.stringify(LEARNING_ACTION_PREVIEW_STORAGE_PREFIX)};

    function buildEmptySnapshot() {
      return {
        stateKind: "empty",
        statusText: "暂无本地学习行动",
        noteText: "本地预览 / 未连接云端 / 未同步数据库",
        minutesText: "-",
        bookText: "-",
        chapterText: "-",
        continueHintText: "暂无待继续阅读提示",
        reasonText: "暂无 mock 推荐原因",
        sensitiveText: "-",
      };
    }

    function buildUnavailableSnapshot() {
      return {
        stateKind: "unavailable",
        statusText: "本地预览数据不可用",
        noteText: "本地预览 / 未连接云端 / 未同步数据库",
        minutesText: "-",
        bookText: "-",
        chapterText: "-",
        continueHintText: "暂无待继续阅读提示",
        reasonText: "暂无 mock 推荐原因",
        sensitiveText: "-",
      };
    }

    function normalizeNullableString(value) {
      if (typeof value !== "string") {
        return null;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }

    function normalizeNonNegativeNumber(value) {
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return null;
      }
      return value;
    }

    function truncateText(text, maxLength) {
      const normalized = normalizeNullableString(text);
      if (!normalized) {
        return null;
      }

      if (normalized.length <= maxLength) {
        return normalized;
      }

      return normalized.slice(0, maxLength - 1) + "…";
    }

    function normalizeDisplayText(value, maxLength) {
      return truncateText(value, maxLength);
    }

    function normalizeMinutes(value) {
      const normalized = normalizeNonNegativeNumber(value);
      if (normalized === null) {
        return null;
      }
      return Math.floor(normalized);
    }

    function isSensitiveFieldName(rawKey) {
      const normalized = String(rawKey || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

      if (!normalized) {
        return false;
      }

      return (
        normalized.includes("token") ||
        normalized.includes("cookie") ||
        normalized === "session" ||
        normalized === "sessionid" ||
        normalized.includes("secret") ||
        normalized === "databaseurl" ||
        normalized.includes("apikey") ||
        normalized.includes("authorization")
      );
    }

    function collectSensitiveFieldHits(value, path, hits) {
      const currentPath = Array.isArray(path) ? path : [];
      const currentHits = Array.isArray(hits) ? hits : [];

      if (!value || typeof value !== "object") {
        return currentHits;
      }

      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          collectSensitiveFieldHits(value[i], currentPath.concat(String(i)), currentHits);
        }
        return currentHits;
      }

      for (const key of Object.keys(value)) {
        const nextPath = currentPath.concat(key);
        if (isSensitiveFieldName(key)) {
          currentHits.push(nextPath.join("."));
        }
        collectSensitiveFieldHits(value[key], nextPath, currentHits);
      }

      return currentHits;
    }

    function readNestedValue(value, path) {
      if (!value || typeof value !== "object" || !Array.isArray(path)) {
        return undefined;
      }

      let current = value;
      for (let i = 0; i < path.length; i += 1) {
        if (!current || typeof current !== "object") {
          return undefined;
        }

        current = current[path[i]];
      }

      return current;
    }

    function readStringCandidate(value, candidatePaths, maxLength) {
      for (let i = 0; i < candidatePaths.length; i += 1) {
        const candidatePath = candidatePaths[i];
        const rawValue = Array.isArray(candidatePath)
          ? readNestedValue(value, candidatePath)
          : value ? value[candidatePath] : undefined;
        const normalized = normalizeDisplayText(rawValue, maxLength);
        if (normalized) {
          return normalized;
        }
      }

      return null;
    }

    function readNumberCandidate(value, candidatePaths) {
      for (let i = 0; i < candidatePaths.length; i += 1) {
        const candidatePath = candidatePaths[i];
        const rawValue = Array.isArray(candidatePath)
          ? readNestedValue(value, candidatePath)
          : value ? value[candidatePath] : undefined;
        const normalized = normalizeMinutes(rawValue);
        if (normalized !== null) {
          return normalized;
        }
      }

      return null;
    }

    function readFromStorage() {
      let storage = null;
      try {
        storage = window.localStorage;
        if (!storage) {
          return buildUnavailableSnapshot();
        }
      } catch (_error) {
        return buildUnavailableSnapshot();
      }

      let rawValue = null;
      try {
        for (let i = 0; i < previewKeys.length; i += 1) {
          const key = previewKeys[i];
          const candidate = storage.getItem(key);
          if (candidate !== null) {
            rawValue = candidate;
            break;
          }
        }

        if (rawValue === null && typeof storage.length === "number" && typeof storage.key === "function") {
          for (let i = 0; i < storage.length; i += 1) {
            const key = storage.key(i);
            if (typeof key === "string" && key.startsWith(previewPrefix)) {
              const candidate = storage.getItem(key);
              if (candidate !== null) {
                rawValue = candidate;
                break;
              }
            }
          }
        }
      } catch (_error) {
        return buildUnavailableSnapshot();
      }

      if (rawValue === null) {
        return buildEmptySnapshot();
      }

      let parsedValue = null;
      try {
        parsedValue = JSON.parse(rawValue);
      } catch (_error) {
        return buildUnavailableSnapshot();
      }

      if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
        return buildEmptySnapshot();
      }

      const sensitiveFieldHits = collectSensitiveFieldHits(parsedValue);
      const suggestedMinutes = readNumberCandidate(parsedValue, [
        "suggestedMinutes",
        "recommendedMinutes",
        "todayMinutes",
        "minutes",
      ]);
      const recentBookText = readStringCandidate(parsedValue, [
        "recentBookTitle",
        "bookTitle",
        ["recentBook", "title"],
        ["recentBook", "name"],
        ["recentBook", "bookTitle"],
        ["recentBook", "id"],
        "bookId",
      ], 80);
      const recentChapterText = readStringCandidate(parsedValue, [
        "recentChapterTitle",
        "chapterTitle",
        ["recentChapter", "title"],
        ["recentChapter", "name"],
        ["recentChapter", "chapterTitle"],
        ["recentChapter", "id"],
        "chapterId",
      ], 80);
      const continueHintText = readStringCandidate(parsedValue, [
        "continueHint",
        "continueReadingHint",
        "resumeHint",
        "nextStepHint",
        "continuePrompt",
      ], 140);
      const reasonText = readStringCandidate(parsedValue, [
        "recommendationReason",
        "reason",
        "mockReason",
        "dailyReason",
        "why",
      ], 180);

      const hasRenderableSafeField =
        suggestedMinutes !== null ||
        recentBookText !== null ||
        recentChapterText !== null ||
        continueHintText !== null ||
        reasonText !== null;

      if (!hasRenderableSafeField && sensitiveFieldHits.length === 0) {
        return buildEmptySnapshot();
      }

      return {
        stateKind: "ready",
        statusText: "已读取本地学习行动摘要",
        noteText: "本地预览 / 未连接云端 / 未同步数据库",
        minutesText: suggestedMinutes === null ? "-" : String(suggestedMinutes) + " 分钟",
        bookText: recentBookText || "-",
        chapterText: recentChapterText || "-",
        continueHintText: continueHintText || "暂无待继续阅读提示",
        reasonText: reasonText || "暂无 mock 推荐原因",
        sensitiveText: sensitiveFieldHits.length > 0 ? "已过滤敏感字段" : "未发现敏感字段",
      };
    }

    function ensureElement(parent, id, tagName) {
      let node = document.getElementById(id);
      if (node) {
        return node;
      }

      node = document.createElement(tagName);
      node.id = id;
      parent.appendChild(node);
      return node;
    }

    function insertAfter(anchor, node) {
      if (!anchor || !anchor.parentNode) {
        return false;
      }

      if (anchor.nextSibling) {
        anchor.parentNode.insertBefore(node, anchor.nextSibling);
      } else {
        anchor.parentNode.appendChild(node);
      }
      return true;
    }

    let root = document.getElementById(rootId);
    if (!root) {
      root = document.createElement("section");
      root.id = rootId;
      root.setAttribute("aria-live", "polite");
      root.style.marginTop = "12px";
      root.style.border = "1px solid #d9dee7";
      root.style.borderRadius = "10px";
      root.style.background = "#f8fafc";
      root.style.padding = "12px";
      root.style.boxShadow = "0 1px 0 rgba(15, 23, 42, 0.03)";

      const anchor =
        document.getElementById("desktop-home-next-action-card") ||
        document.getElementById("desktop-home-bookmark-preview-card") ||
        document.getElementById("desktop-home-reader-card") ||
        document.getElementById("desktop-navigation-shell");
      if (!insertAfter(anchor, root)) {
        return false;
      }
    }

    const titleNode = ensureElement(root, titleId, "p");
    titleNode.style.margin = "0";
    titleNode.style.fontWeight = "600";
    titleNode.textContent = "今日学习行动（本地预览）";

    const safetyNoteNode = ensureElement(root, safetyNoteId, "p");
    safetyNoteNode.style.marginTop = "6px";
    safetyNoteNode.style.color = "#5b6473";
    safetyNoteNode.style.fontSize = "13px";
    safetyNoteNode.textContent =
      "preview-only / local-only / no DB sync / no real AI / no tools / no Agent loop；本地预览 / 未连接云端 / 未同步数据库";

    const statusNode = ensureElement(root, statusId, "p");
    statusNode.style.marginTop = "6px";
    statusNode.style.fontWeight = "600";

    const minutesNode = ensureElement(root, minutesId, "strong");
    const bookNode = ensureElement(root, bookId, "strong");
    const chapterNode = ensureElement(root, chapterId, "strong");
    const continueHintNode = ensureElement(root, continueHintId, "strong");
    const reasonNode = ensureElement(root, reasonId, "strong");
    const sensitiveNode = ensureElement(root, sensitiveId, "strong");

    const refreshButtonNode = ensureElement(root, refreshButtonId, "button");
    refreshButtonNode.type = "button";
    refreshButtonNode.textContent = "刷新本地预览";

    const detailsList = ensureElement(root, detailsListId, "ul");
    detailsList.style.marginTop = "10px";
    detailsList.style.paddingLeft = "18px";
    detailsList.style.display = "grid";
    detailsList.style.gap = "6px";

    const rows = [
      { label: "今日建议学习分钟", valueNode: minutesNode, valueId: minutesId },
      { label: "最近书籍", valueNode: bookNode, valueId: bookId },
      { label: "最近章节", valueNode: chapterNode, valueId: chapterId },
      { label: "待继续阅读提示", valueNode: continueHintNode, valueId: continueHintId },
      { label: "mock 推荐原因", valueNode: reasonNode, valueId: reasonId },
      { label: "敏感字段", valueNode: sensitiveNode, valueId: sensitiveId },
    ];

    for (let i = 0; i < rows.length; i += 1) {
      const rowId = rows[i].valueId + "-row";
      let row = document.getElementById(rowId);
      if (!row) {
        row = document.createElement("li");
        row.id = rowId;
        const label = document.createElement("span");
        label.style.color = "#5b6473";
        label.textContent = rows[i].label + "：";
        row.appendChild(label);
        row.appendChild(rows[i].valueNode);
        detailsList.appendChild(row);
      }
    }

    let actionRow = document.getElementById(refreshButtonId + "-row");
    if (!actionRow) {
      actionRow = document.createElement("li");
      actionRow.id = refreshButtonId + "-row";
      actionRow.style.listStyle = "none";
      actionRow.style.marginTop = "4px";
      actionRow.appendChild(refreshButtonNode);
      detailsList.appendChild(actionRow);
    }

    function render() {
      const snapshot = readFromStorage();
      statusNode.textContent = snapshot.statusText;
      safetyNoteNode.textContent = snapshot.noteText + "；preview-only / local-only / no DB sync / no real AI / no tools / no Agent loop";
      minutesNode.textContent = snapshot.minutesText;
      bookNode.textContent = snapshot.bookText;
      chapterNode.textContent = snapshot.chapterText;
      continueHintNode.textContent = snapshot.continueHintText;
      reasonNode.textContent = snapshot.reasonText;
      sensitiveNode.textContent = snapshot.sensitiveText;
      return snapshot;
    }

    refreshButtonNode.onclick = function () {
      render();
    };

    render();
    return true;
  })();`;
}

module.exports = {
  LEARNING_ACTION_PREVIEW_STORAGE_KEYS,
  LEARNING_ACTION_PREVIEW_STORAGE_PREFIX,
  buildLocalLearningActionPreviewCardScript,
  buildEmptyLearningActionSnapshot,
  buildUnavailableLearningActionSnapshot,
  collectSensitiveFieldHits,
  normalizeLearningActionPreviewRecord,
  readLearningActionPreviewFromStorage,
};
