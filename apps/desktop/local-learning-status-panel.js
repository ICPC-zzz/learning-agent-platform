const READER_LOCAL_STATUS_SUMMARY_KEY = "lap.reader.localStatus.v1";

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

function normalizeFiniteNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeCount(value) {
  const normalized = normalizeNonNegativeNumber(value);
  if (normalized === null) {
    return 0;
  }

  return Math.floor(normalized);
}

function normalizeProgressPercent(value) {
  const normalized = normalizeFiniteNumber(value);
  if (normalized === null) {
    return null;
  }

  return Math.min(Math.max(normalized, 0), 100);
}

function normalizeProgressRatio(value) {
  const normalized = normalizeFiniteNumber(value);
  if (normalized === null) {
    return null;
  }

  return Math.min(Math.max(normalized, 0), 1);
}

function parseReaderLocalStatusSummary(value) {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const summary = value;
  if (
    summary.schemaVersion !== 1 ||
    summary.source !== "reader" ||
    summary.previewOnly !== true
  ) {
    return null;
  }

  const progressPercent = normalizeProgressPercent(summary.progressPercent);
  const progressRatio = normalizeProgressRatio(summary.progressRatio);

  const resolvedProgressPercent =
    progressPercent === null && progressRatio !== null
      ? progressRatio * 100
      : progressPercent;
  const resolvedProgressRatio =
    progressRatio === null && progressPercent !== null
      ? progressPercent / 100
      : progressRatio;

  const readingSeconds =
    normalizeNonNegativeNumber(summary.readingSeconds) ??
    normalizeNonNegativeNumber(summary.sessionSeconds) ??
    0;

  return {
    schemaVersion: 1,
    source: "reader",
    previewOnly: true,
    bookId: normalizeNullableString(summary.bookId),
    chapterId: normalizeNullableString(summary.chapterId),
    progressPercent: resolvedProgressPercent,
    progressRatio: resolvedProgressRatio,
    noteCount: normalizeCount(summary.noteCount),
    bookmarkCount: normalizeCount(summary.bookmarkCount),
    readingSeconds: readingSeconds,
    updatedAt: normalizeNullableString(summary.updatedAt),
    lastReadAt: normalizeNullableString(summary.lastReadAt),
  };
}

function parseReaderLocalStatusSummaryRaw(rawValue) {
  if (rawValue === null) {
    return {
      summary: null,
      parseError: false,
    };
  }

  try {
    const parsed = JSON.parse(rawValue);
    const summary = parseReaderLocalStatusSummary(parsed);
    return {
      summary,
      parseError: summary === null,
    };
  } catch (_error) {
    return {
      summary: null,
      parseError: true,
    };
  }
}

function readReaderLocalStatusDiagnostics(storage) {
  if (!storage) {
    return {
      storageAvailable: false,
      hasSummaryKey: false,
      parseError: false,
      summary: null,
      statusText: "当前页面本地状态读取不可用",
      hintText: "请确认当前页面可访问 localStorage。",
    };
  }

  let rawValue;
  try {
    rawValue = storage.getItem(READER_LOCAL_STATUS_SUMMARY_KEY);
  } catch (_error) {
    return {
      storageAvailable: false,
      hasSummaryKey: false,
      parseError: false,
      summary: null,
      statusText: "当前页面本地状态读取不可用",
      hintText: "请确认当前页面可访问 localStorage。",
    };
  }

  if (rawValue === null) {
    return {
      storageAvailable: true,
      hasSummaryKey: false,
      parseError: false,
      summary: null,
      statusText: "暂无本地 Reader 学习状态摘要",
      hintText: "请先在 Reader 中阅读或刷新本地状态",
    };
  }

  const parsed = parseReaderLocalStatusSummaryRaw(rawValue);
  if (parsed.parseError || !parsed.summary) {
    return {
      storageAvailable: true,
      hasSummaryKey: true,
      parseError: true,
      summary: null,
      statusText: "本地状态不可解析，已安全降级",
      hintText: "请检查 lap.reader.localStatus.v1 是否为合法 JSON。",
    };
  }

  return {
    storageAvailable: true,
    hasSummaryKey: true,
    parseError: false,
    summary: parsed.summary,
    statusText: "已读取本地 Reader 学习状态摘要",
    hintText: "仅用于开发预览诊断，不代表生产能力。",
  };
}

function formatProgress(summary) {
  if (!summary || typeof summary !== "object") {
    return "-";
  }

  if (typeof summary.progressPercent === "number" && Number.isFinite(summary.progressPercent)) {
    return Math.round(summary.progressPercent) + "%";
  }

  if (typeof summary.progressRatio === "number" && Number.isFinite(summary.progressRatio)) {
    return Math.round(summary.progressRatio * 100) + "%";
  }

  return "-";
}

function formatReadingSeconds(summary) {
  if (!summary || typeof summary !== "object") {
    return "-";
  }

  if (typeof summary.readingSeconds !== "number" || !Number.isFinite(summary.readingSeconds)) {
    return "-";
  }

  return Math.max(0, Math.floor(summary.readingSeconds)) + " 秒";
}

function formatUpdatedAt(summary) {
  if (!summary || typeof summary !== "object") {
    return "-";
  }

  const resolvedTime =
    normalizeNullableString(summary.updatedAt) ??
    normalizeNullableString(summary.lastReadAt);

  if (!resolvedTime) {
    return "-";
  }

  const date = new Date(resolvedTime);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("zh-CN", {
    hour12: false,
  });
}

function formatDesktopLocalStatusAge(updatedAt, now) {
  if (updatedAt === null || updatedAt === undefined) {
    return "暂无更新时间";
  }

  if (typeof updatedAt !== "string") {
    return "更新时间暂不可用";
  }

  const trimmed = updatedAt.trim();
  if (trimmed.length === 0) {
    return "暂无更新时间";
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return "更新时间暂不可用";
  }

  const resolvedNow = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(resolvedNow.getTime())) {
    return "更新时间暂不可用";
  }

  const diffMs = resolvedNow.getTime() - date.getTime();

  if (diffMs < 0) {
    return "刚刚更新";
  }

  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) {
    return "刚刚更新";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return diffMinutes + " 分钟前更新";
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours + " 小时前更新";
  }

  return "超过 24 小时未更新";
}

function formatDesktopReadingDuration(secondsLike) {
  if (secondsLike === null || secondsLike === undefined) {
    return "暂无阅读时长";
  }

  if (typeof secondsLike !== "number") {
    return "阅读时长暂不可用";
  }

  if (!Number.isFinite(secondsLike)) {
    return "阅读时长暂不可用";
  }

  if (secondsLike < 0) {
    return "阅读时长暂不可用";
  }

  const totalSeconds = Math.floor(secondsLike);

  if (totalSeconds < 60) {
    return "已读 0 分钟";
  }

  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    return "已读 " + minutes + " 分钟";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);

  if (remainingMinutes === 0) {
    return "已读 " + hours + " 小时";
  }

  return "已读 " + hours + " 小时 " + remainingMinutes + " 分钟";
}

function normalizeDesktopBookmarkPreview(localStatus) {
  const MAX_ITEMS = 5;

  const result = {
    countLabel: "暂无书签",
    items: [],
    emptyLabel: "暂无书签",
    warningLabel: null,
    previewOnly: true,
  };

  if (!localStatus || typeof localStatus !== "object") {
    return result;
  }

  const bookmarkCount = normalizeCount(localStatus.bookmarkCount);
  const bookmarks = localStatus.bookmarks;
  const hasValidArray = Array.isArray(bookmarks) && bookmarks.length > 0;

  // No count and no array: show empty state
  if (bookmarkCount === 0 && !hasValidArray) {
    return result;
  }

  // Has valid bookmarks array: extract items
  if (hasValidArray) {
    const displayCount = bookmarkCount > 0 ? bookmarkCount : bookmarks.length;
    result.countLabel = "共 " + displayCount + " 个书签";

    const items = [];
    for (let i = 0; i < Math.min(bookmarks.length, MAX_ITEMS); i += 1) {
      const bm = bookmarks[i];
      if (!bm || typeof bm !== "object") {
        continue;
      }

      const title =
        normalizeNullableString(bm.title) ??
        normalizeNullableString(bm.label) ??
        normalizeNullableString(bm.text) ??
        "未命名书签";

      const chapterId = normalizeNullableString(bm.chapterId) ?? "未知章节";

      let time = "时间未知";
      const resolvedTime =
        normalizeNullableString(bm.createdAt) ??
        normalizeNullableString(bm.updatedAt);
      if (resolvedTime) {
        const date = new Date(resolvedTime);
        if (!Number.isNaN(date.getTime())) {
          time = date.toLocaleString("zh-CN", { hour12: false });
        }
      }

      let excerpt =
        normalizeNullableString(bm.note) ??
        normalizeNullableString(bm.excerpt) ??
        "";
      if (excerpt.length > 60) {
        excerpt = excerpt.slice(0, 60) + "...";
      }

      items.push({
        title,
        chapterId,
        time,
        excerpt,
      });
    }

    result.items = items;
    if (items.length === 0) {
      result.emptyLabel = "暂无有效书签明细";
    } else {
      result.emptyLabel = null;
    }

    if (bookmarks.length > MAX_ITEMS) {
      result.warningLabel =
        "仅展示最近 " + MAX_ITEMS + " 条书签预览，更多书签请在 Reader 中查看。";
    }

    return result;
  }

  // Has bookmarkCount > 0 but no valid bookmarks array
  result.countLabel = "本地记录有 " + bookmarkCount + " 个书签";
  result.emptyLabel = "暂无书签明细";
  return result;
}

function buildDesktopReaderContinueHref(summary) {
  const readerPath = "/reader";
  if (!summary || typeof summary !== "object") {
    return readerPath;
  }

  const bookId = normalizeNullableString(summary.bookId);
  const chapterId = normalizeNullableString(summary.chapterId);
  if (!bookId || !chapterId) {
    return readerPath;
  }

  const query = new URLSearchParams();
  query.set("bookId", bookId);
  query.set("chapterId", chapterId);
  return readerPath + "?" + query.toString();
}

function buildLocalLearningStatusPanelScript() {
  return `(() => {
    const diagnosticsRoot = document.getElementById("diagnostics-reader-local-status-panel");
    const navRoot = document.getElementById("desktop-navigation-shell");
    const homeCardRoot = document.getElementById("desktop-home-reader-card");
    const nextActionRoot = document.getElementById("desktop-home-next-action-card");
    const bookmarkPreviewRoot = document.getElementById("desktop-home-bookmark-preview-card");
    if (!diagnosticsRoot && !navRoot && !homeCardRoot && !nextActionRoot && !bookmarkPreviewRoot) {
      return false;
    }

    let panel = diagnosticsRoot || document.getElementById("desktop-local-learning-status-panel");
    if (!panel && navRoot) {
      panel = document.createElement("section");
      panel.id = "desktop-local-learning-status-panel";
      panel.style.marginTop = "10px";
      panel.style.border = "1px solid #d9dee7";
      panel.style.borderRadius = "10px";
      panel.style.background = "#f8fafc";
      panel.style.padding = "10px 12px";

      const title = document.createElement("p");
      title.textContent = "本地阅读状态诊断（开发预览）";
      title.style.fontWeight = "600";
      title.style.margin = "0";

      const note = document.createElement("p");
      note.id = "desktop-reader-local-status-note";
      note.textContent = "preview-only / local-only / no DB sync / no real AI / no tools / no Agent loop";
      note.style.marginTop = "6px";
      note.style.color = "#5b6473";
      note.style.fontSize = "13px";

      const hint = document.createElement("p");
      hint.id = "desktop-reader-local-status-hint";
      hint.style.marginTop = "6px";
      hint.style.color = "#5b6473";
      hint.style.fontSize = "13px";

      const continueContainer = document.createElement("p");
      continueContainer.id = "desktop-reader-local-status-continue-container";
      continueContainer.style.marginTop = "8px";

      const continueLink = document.createElement("a");
      continueLink.id = "desktop-reader-local-status-continue-link";
      continueLink.textContent = "前往 Reader 选择内容";
      continueLink.href = "/reader";
      continueLink.style.display = "inline-flex";
      continueLink.style.alignItems = "center";
      continueLink.style.justifyContent = "center";
      continueLink.style.textDecoration = "none";
      continueLink.style.border = "1px solid #d9dee7";
      continueLink.style.borderRadius = "8px";
      continueLink.style.background = "#ffffff";
      continueLink.style.color = "#1f2937";
      continueLink.style.fontWeight = "600";
      continueLink.style.fontSize = "13px";
      continueLink.style.padding = "6px 10px";
      continueContainer.appendChild(continueLink);

      const list = document.createElement("ul");
      list.style.marginTop = "8px";
      list.style.paddingLeft = "18px";
      list.style.display = "grid";
      list.style.gap = "4px";
      const fields = [
        { id: "desktop-reader-local-status-state", label: "状态" },
        { id: "desktop-reader-local-status-key", label: "lap.reader.localStatus.v1" },
        { id: "desktop-reader-local-status-book-id", label: "bookId" },
        { id: "desktop-reader-local-status-chapter-id", label: "chapterId" },
        { id: "desktop-reader-local-status-progress", label: "progress" },
        { id: "desktop-reader-local-status-note-count", label: "noteCount" },
        { id: "desktop-reader-local-status-bookmark-count", label: "bookmarkCount" },
        { id: "desktop-reader-local-status-reading-seconds", label: "readingSeconds/sessionSeconds" },
        { id: "desktop-reader-local-status-updated-at", label: "updatedAt" },
      ];
      for (let i = 0; i < fields.length; i += 1) {
        const item = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = fields[i].label + "：";
        label.style.color = "#5b6473";
        const value = document.createElement("strong");
        value.id = fields[i].id;
        value.style.marginLeft = "6px";
        value.textContent = "-";
        item.appendChild(label);
        item.appendChild(value);
        list.appendChild(item);
      }

      panel.appendChild(title);
      panel.appendChild(note);
      panel.appendChild(hint);
      panel.appendChild(continueContainer);
      panel.appendChild(list);
      navRoot.appendChild(panel);
    }

    function setText(id, text) {
      const node = document.getElementById(id);
      if (node) {
        node.textContent = text;
      }
    }

    function setDiagnosticsText(id, text) {
      setText(id, text);
    }

    function setHomeCardText(id, text) {
      setText(id, text);
    }

    function setNextActionText(id, text) {
      setText(id, text);
    }

    function ensureReaderContinueAction() {
      let action = document.getElementById("desktop-reader-local-status-continue-link");
      if (action) {
        return action;
      }

      let container = document.getElementById("desktop-reader-local-status-continue-container");
      if (!container && panel) {
        container = document.createElement("p");
        container.id = "desktop-reader-local-status-continue-container";
        container.style.marginTop = "8px";
        panel.appendChild(container);
      }

      if (!container) {
        return null;
      }

      action = document.createElement("a");
      action.id = "desktop-reader-local-status-continue-link";
      action.style.display = "inline-flex";
      action.style.alignItems = "center";
      action.style.justifyContent = "center";
      action.style.textDecoration = "none";
      action.style.border = "1px solid #d9dee7";
      action.style.borderRadius = "8px";
      action.style.background = "#ffffff";
      action.style.color = "#1f2937";
      action.style.fontWeight = "600";
      action.style.fontSize = "13px";
      action.style.padding = "6px 10px";
      container.appendChild(action);
      return action;
    }

    function setReaderContinueAction(href, label) {
      const action = ensureReaderContinueAction();
      if (!action) {
        return;
      }
      action.href = href;
      action.textContent = label;
    }

    function setHomeReaderContinueAction(href, label) {
      const action = document.getElementById("desktop-home-reader-continue-link");
      if (!action) {
        return;
      }
      action.href = href;
      action.textContent = label;
    }

    function setNextActionLink(href, label) {
      const action = document.getElementById("desktop-home-next-action-link");
      if (!action) {
        return;
      }
      action.href = href;
      action.textContent = label;
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

    function normalizeFiniteNumber(value) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }
      return value;
    }

    function normalizeCount(value) {
      const normalized = normalizeNonNegativeNumber(value);
      if (normalized === null) {
        return 0;
      }
      return Math.floor(normalized);
    }

    function normalizeProgressPercent(value) {
      const normalized = normalizeFiniteNumber(value);
      if (normalized === null) {
        return null;
      }
      return Math.min(Math.max(normalized, 0), 100);
    }

    function normalizeProgressRatio(value) {
      const normalized = normalizeFiniteNumber(value);
      if (normalized === null) {
        return null;
      }
      return Math.min(Math.max(normalized, 0), 1);
    }

    function parseSummary(value) {
      if (value === null || typeof value !== "object") {
        return null;
      }
      if (value.schemaVersion !== 1 || value.source !== "reader" || value.previewOnly !== true) {
        return null;
      }
      const progressPercentRaw = normalizeFiniteNumber(value.progressPercent);
      const progressRatioRaw = normalizeFiniteNumber(value.progressRatio);
      const progressPercent = normalizeProgressPercent(value.progressPercent);
      const progressRatio = normalizeProgressRatio(value.progressRatio);
      const resolvedProgressPercent =
        progressPercent === null && progressRatio !== null
          ? progressRatio * 100
          : progressPercent;
      const progressClamped =
        (progressPercentRaw !== null && progressPercentRaw !== progressPercent) ||
        (progressRatioRaw !== null && progressRatio !== progressRatioRaw);
      let readingSeconds = normalizeNonNegativeNumber(value.readingSeconds);
      if (readingSeconds === null) {
        readingSeconds = normalizeNonNegativeNumber(value.sessionSeconds);
      }
      if (readingSeconds === null) {
        readingSeconds = 0;
      }
      return {
        bookId: normalizeNullableString(value.bookId),
        chapterId: normalizeNullableString(value.chapterId),
        progressPercent: resolvedProgressPercent,
        progressClamped,
        noteCount: normalizeCount(value.noteCount),
        bookmarkCount: normalizeCount(value.bookmarkCount),
        readingSeconds: readingSeconds,
        updatedAt: normalizeNullableString(value.updatedAt),
        lastReadAt: normalizeNullableString(value.lastReadAt),
        bookmarks: Array.isArray(value.bookmarks) ? value.bookmarks : null,
      };
    }

    function formatUpdatedAt(iso, fallbackIso) {
      const resolvedTime = normalizeNullableString(iso) || normalizeNullableString(fallbackIso);
      if (!resolvedTime) {
        return "-";
      }
      const date = new Date(resolvedTime);
      if (Number.isNaN(date.getTime())) {
        return "时间不可解析（已安全降级）";
      }
      return date.toLocaleString("zh-CN", { hour12: false });
    }

    function formatDesktopLocalStatusAge(updatedAt, now) {
      if (updatedAt === null || updatedAt === undefined) {
        return "暂无更新时间";
      }

      if (typeof updatedAt !== "string") {
        return "更新时间暂不可用";
      }

      const trimmed = updatedAt.trim();
      if (trimmed.length === 0) {
        return "暂无更新时间";
      }

      const date = new Date(trimmed);
      if (Number.isNaN(date.getTime())) {
        return "更新时间暂不可用";
      }

      const resolvedNow = now instanceof Date ? now : new Date(now);
      if (Number.isNaN(resolvedNow.getTime())) {
        return "更新时间暂不可用";
      }

      const diffMs = resolvedNow.getTime() - date.getTime();

      if (diffMs < 0) {
        return "刚刚更新";
      }

      const diffSeconds = Math.floor(diffMs / 1000);

      if (diffSeconds < 60) {
        return "刚刚更新";
      }

      const diffMinutes = Math.floor(diffSeconds / 60);
      if (diffMinutes < 60) {
        return diffMinutes + " 分钟前更新";
      }

      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) {
        return diffHours + " 小时前更新";
      }

      return "超过 24 小时未更新";
    }

    function formatDesktopReadingDuration(secondsLike) {
      if (secondsLike === null || secondsLike === undefined) {
        return "暂无阅读时长";
      }

      if (typeof secondsLike !== "number") {
        return "阅读时长暂不可用";
      }

      if (!Number.isFinite(secondsLike)) {
        return "阅读时长暂不可用";
      }

      if (secondsLike < 0) {
        return "阅读时长暂不可用";
      }

      const totalSeconds = Math.floor(secondsLike);

      if (totalSeconds < 60) {
        return "已读 0 分钟";
      }

      if (totalSeconds < 3600) {
        const minutes = Math.floor(totalSeconds / 60);
        return "已读 " + minutes + " 分钟";
      }

      const hours = Math.floor(totalSeconds / 3600);
      const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);

      if (remainingMinutes === 0) {
        return "已读 " + hours + " 小时";
      }

      return "已读 " + hours + " 小时 " + remainingMinutes + " 分钟";
    }

    function normalizeDesktopBookmarkPreview(localStatus) {
      const MAX_ITEMS = 5;

      const result = {
        countLabel: "暂无书签",
        items: [],
        emptyLabel: "暂无书签",
        warningLabel: null,
        previewOnly: true,
      };

      if (!localStatus || typeof localStatus !== "object") {
        return result;
      }

      var bookmarkCount = normalizeCount(localStatus.bookmarkCount);
      var bookmarks = localStatus.bookmarks;
      var hasValidArray = Array.isArray(bookmarks) && bookmarks.length > 0;

      if (bookmarkCount === 0 && !hasValidArray) {
        return result;
      }

      if (hasValidArray) {
        var displayCount = bookmarkCount > 0 ? bookmarkCount : bookmarks.length;
        result.countLabel = "共 " + displayCount + " 个书签";

        var items = [];
        for (var i = 0; i < Math.min(bookmarks.length, MAX_ITEMS); i += 1) {
          var bm = bookmarks[i];
          if (!bm || typeof bm !== "object") {
            continue;
          }

          var title =
            normalizeNullableString(bm.title) ??
            normalizeNullableString(bm.label) ??
            normalizeNullableString(bm.text) ??
            "未命名书签";

          var chapterId = normalizeNullableString(bm.chapterId) ?? "未知章节";

          var time = "时间未知";
          var resolvedTime =
            normalizeNullableString(bm.createdAt) ??
            normalizeNullableString(bm.updatedAt);
          if (resolvedTime) {
            var date = new Date(resolvedTime);
            if (!Number.isNaN(date.getTime())) {
              time = date.toLocaleString("zh-CN", { hour12: false });
            }
          }

          var excerpt =
            normalizeNullableString(bm.note) ??
            normalizeNullableString(bm.excerpt) ??
            "";
          if (excerpt.length > 60) {
            excerpt = excerpt.slice(0, 60) + "...";
          }

          items.push({
            title: title,
            chapterId: chapterId,
            time: time,
            excerpt: excerpt,
          });
        }

        result.items = items;
        if (items.length === 0) {
          result.emptyLabel = "暂无有效书签明细";
        } else {
          result.emptyLabel = null;
        }

        if (bookmarks.length > MAX_ITEMS) {
          result.warningLabel =
            "仅展示最近 " + MAX_ITEMS + " 条书签预览，更多书签请在 Reader 中查看。";
        }

        return result;
      }

      result.countLabel = "本地记录有 " + bookmarkCount + " 个书签";
      result.emptyLabel = "暂无书签明细";
      return result;
    }

    function toRoundedPercent(progressPercent) {
      if (typeof progressPercent !== "number" || !Number.isFinite(progressPercent)) {
        return null;
      }
      return Math.round(Math.min(Math.max(progressPercent, 0), 100));
    }

    function formatReaderDurationMinutes(readingSeconds) {
      if (typeof readingSeconds !== "number" || !Number.isFinite(readingSeconds)) {
        return "-";
      }
      const safeSeconds = Math.max(0, Math.floor(readingSeconds));
      const minutes = Math.round(safeSeconds / 60);
      return String(minutes) + " 分钟";
    }

    function setHomeProgress(percent) {
      const roundedPercent = toRoundedPercent(percent);
      const text = roundedPercent === null ? "-" : String(roundedPercent) + "%";
      const widthPercent = roundedPercent === null ? 0 : roundedPercent;
      const progressText =
        roundedPercent === null ? "当前进度 -" : "当前进度 " + String(roundedPercent) + "%";

      setHomeCardText("desktop-home-reader-progress", text);
      setHomeCardText("desktop-home-reader-progress-percent", progressText);

      const barNode = document.getElementById("desktop-home-reader-progress-bar");
      if (barNode) {
        barNode.style.width = String(widthPercent) + "%";
      }
    }

    function buildReaderContinueHref(summary) {
      if (!summary || typeof summary !== "object") {
        return "/reader";
      }
      const bookId = normalizeNullableString(summary.bookId);
      const chapterId = normalizeNullableString(summary.chapterId);
      if (!bookId || !chapterId) {
        return "/reader";
      }
      const query = new URLSearchParams();
      query.set("bookId", bookId);
      query.set("chapterId", chapterId);
      return "/reader?" + query.toString();
    }

    function setFieldDefaults() {
      setDiagnosticsText("desktop-reader-local-status-book-id", "-");
      setDiagnosticsText("desktop-reader-local-status-chapter-id", "-");
      setDiagnosticsText("desktop-reader-local-status-progress", "-");
      setDiagnosticsText("desktop-reader-local-status-note-count", "-");
      setDiagnosticsText("desktop-reader-local-status-bookmark-count", "-");
      setDiagnosticsText("desktop-reader-local-status-reading-seconds", "-");
      setDiagnosticsText("desktop-reader-local-status-updated-at", "-");
      setHomeCardText("desktop-home-reader-book-id", "-");
      setHomeCardText("desktop-home-reader-chapter-id", "-");
      setHomeProgress(null);
      setHomeCardText("desktop-home-reader-note-count", "-");
      setHomeCardText("desktop-home-reader-bookmark-count", "-");
      setHomeCardText("desktop-home-reader-reading-seconds", "-");
      setHomeCardText("desktop-home-reader-updated-at", "-");
      setHomeCardText("desktop-home-reader-updated-at-friendly", "-");
      setNextActionText("desktop-home-next-action-progress", "-");
      setNextActionText("desktop-home-next-action-note-count", "-");
      setNextActionText("desktop-home-next-action-bookmark-count", "-");
      setNextActionText("desktop-home-next-action-reading-seconds", "-");
      setNextActionText("desktop-home-next-action-reading-duration", "-");
    }

    function setFallbackAction() {
      setReaderContinueAction("/reader", "前往 Reader 选择内容");
      setHomeReaderContinueAction("/reader", "打开 Reader");
      setNextActionLink("/reader", "打开 Reader");
    }

    function setHomeHint(message) {
      setHomeCardText("desktop-home-reader-hint", message);
    }

    function setDiagnosticsHint(message) {
      setDiagnosticsText("desktop-reader-local-status-hint", message);
    }

    function setNextActionFallback(message) {
      setNextActionText("desktop-home-next-action-title", "本地学习行动建议暂不可用，已安全降级");
      setNextActionText("desktop-home-next-action-description", "可以先打开 Reader，继续本地阅读。");
      setNextActionText("desktop-home-next-action-reason", message);
      setNextActionText("desktop-home-next-action-progress", "-");
      setNextActionText("desktop-home-next-action-note-count", "-");
      setNextActionText("desktop-home-next-action-bookmark-count", "-");
      setNextActionText("desktop-home-next-action-reading-seconds", "-");
      setNextActionText("desktop-home-next-action-reading-duration", "暂无阅读时长");
      setNextActionLink("/reader", "打开 Reader");
    }

    function formatProgressText(progressPercent) {
      if (progressPercent === null) {
        return "进度未知";
      }
      return "当前进度 " + String(Math.round(progressPercent)) + "%";
    }

    function createNextAction(summary) {
      if (!summary || typeof summary !== "object") {
        return {
          title: "打开 Reader，选择一本书开始阅读",
          description: "当前浏览器还没有可用的本地阅读摘要，先进入 Reader 建立学习记录。",
          reason: "未检测到 lap.reader.localStatus.v1，本地规则无法推导章节进度。",
          progressText: "-",
          noteCountText: "-",
          bookmarkCountText: "-",
          readingSecondsText: "-",
          readingDurationText: "暂无阅读时长",
          href: "/reader",
          actionLabel: "打开 Reader",
        };
      }

      const progressPercent =
        typeof summary.progressPercent === "number" && Number.isFinite(summary.progressPercent)
          ? summary.progressPercent
          : null;
      const progressReasonText = formatProgressText(progressPercent);
      const progressText =
        progressPercent === null ? "-" : String(Math.round(progressPercent)) + "%";
      const noteCountText = String(summary.noteCount);
      const bookmarkCountText = String(summary.bookmarkCount);
      const readingSecondsText = String(Math.max(0, Math.floor(summary.readingSeconds))) + " 秒";
      const readingDurationText = formatDesktopReadingDuration(summary.readingSeconds);

      const reasons = [
        "根据本地摘要推导：" +
          progressReasonText +
          "，笔记 " +
          noteCountText +
          " 条，书签 " +
          bookmarkCountText +
          " 条。",
      ];

      if (summary.noteCount === 0) {
        reasons.push("当前还没有本地笔记。");
      }
      if (summary.bookmarkCount > 0) {
        reasons.push("已有书签，可从关键位置继续。");
      }
      if (summary.readingSeconds < 600) {
        reasons.push("建议进行 10～15 分钟专注阅读。");
      }

      const href = buildReaderContinueHref(summary);
      const actionLabel = href === "/reader" ? "打开 Reader" : "继续阅读";

      if (progressPercent !== null && progressPercent >= 80) {
        return {
          title: "回顾本章笔记/书签，准备进入下一章",
          description: "当前章节已接近完成，建议先回顾关键点再推进下一章。",
          reason: reasons.join(" "),
          progressText,
          noteCountText,
          bookmarkCountText,
          readingSecondsText,
          readingDurationText,
          href,
          actionLabel,
        };
      }

      if (progressPercent !== null && progressPercent >= 30) {
        return {
          title: "继续阅读，并补充 1 条笔记或书签",
          description: "章节已进入中段，建议边读边沉淀关键信息。",
          reason: reasons.join(" "),
          progressText,
          noteCountText,
          bookmarkCountText,
          readingSecondsText,
          readingDurationText,
          href,
          actionLabel,
        };
      }

      return {
        title: "继续完成本章前 30% 阅读",
        description: "建议先把当前章节推进到 30% 左右，再进入下一阶段学习。",
        reason: reasons.join(" "),
        progressText,
        noteCountText,
        bookmarkCountText,
        readingSecondsText,
        readingDurationText,
        href,
        actionLabel,
      };
    }

    function renderNextAction(action) {
      if (!action || typeof action !== "object") {
        setNextActionFallback("本地规则推导不可用，已安全降级。");
        return;
      }
      setNextActionText("desktop-home-next-action-title", action.title || "-");
      setNextActionText("desktop-home-next-action-description", action.description || "-");
      setNextActionText("desktop-home-next-action-reason", action.reason || "-");
      setNextActionText("desktop-home-next-action-progress", action.progressText || "-");
      setNextActionText("desktop-home-next-action-note-count", action.noteCountText || "-");
      setNextActionText("desktop-home-next-action-bookmark-count", action.bookmarkCountText || "-");
      setNextActionText("desktop-home-next-action-reading-seconds", action.readingSecondsText || "-");
      setNextActionText("desktop-home-next-action-reading-duration", action.readingDurationText || "-");
      setNextActionLink(action.href || "/reader", action.actionLabel || "打开 Reader");
    }

    function setBookmarkCardText(id, text) {
      setText(id, text);
    }

    function renderBookmarkCard(preview) {
      if (!preview || typeof preview !== "object") {
        setBookmarkCardText("desktop-home-bookmark-preview-count-label", "暂无书签");
        setBookmarkCardText("desktop-home-bookmark-preview-empty-label", "暂无书签");
        clearBookmarkItems();
        setBookmarkCardText("desktop-home-bookmark-preview-warning", "");
        return;
      }

      setBookmarkCardText("desktop-home-bookmark-preview-count-label", preview.countLabel || "暂无书签");

      if (preview.items && preview.items.length > 0) {
        setBookmarkCardText("desktop-home-bookmark-preview-empty-label", "");
        renderBookmarkItems(preview.items);
      } else {
        setBookmarkCardText("desktop-home-bookmark-preview-empty-label", preview.emptyLabel || "");
        clearBookmarkItems();
      }

      setBookmarkCardText("desktop-home-bookmark-preview-warning", preview.warningLabel || "");
    }

    function clearBookmarkItems() {
      var list = document.getElementById("desktop-home-bookmark-preview-items");
      if (list) {
        list.innerHTML = "";
      }
    }

    function renderBookmarkItems(items) {
      var list = document.getElementById("desktop-home-bookmark-preview-items");
      if (!list) {
        return;
      }
      list.innerHTML = "";

      for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        var li = document.createElement("li");

        var titleSpan = document.createElement("strong");
        titleSpan.textContent = item.title || "未命名书签";

        var infoSpan = document.createElement("span");
        infoSpan.style.color = "#5b6473";
        infoSpan.style.fontSize = "13px";
        var infoParts = [];
        if (item.chapterId) {
          infoParts.push("章节 " + item.chapterId);
        }
        if (item.time) {
          infoParts.push(item.time);
        }
        infoSpan.textContent = " — " + infoParts.join(" · ");

        li.appendChild(titleSpan);
        li.appendChild(infoSpan);

        if (item.excerpt && item.excerpt.length > 0) {
          var excerptP = document.createElement("p");
          excerptP.style.marginTop = "4px";
          excerptP.style.color = "#5b6473";
          excerptP.style.fontSize = "13px";
          excerptP.textContent = item.excerpt;
          li.appendChild(excerptP);
        }

        list.appendChild(li);
      }
    }

    setFieldDefaults();
    setFallbackAction();
    renderNextAction(createNextAction(null));
    renderBookmarkCard(normalizeDesktopBookmarkPreview(null));

    let storage = null;
    try {
      storage = window.localStorage;
      const probe = storage.length;
      if (!Number.isFinite(probe)) {
        throw new Error("storage-length-unavailable");
      }
    } catch (_storageError) {
      setDiagnosticsText("desktop-reader-local-status-state", "当前页面本地状态读取不可用");
      setDiagnosticsText("desktop-reader-local-status-key", "不可读取");
      setDiagnosticsHint("localStorage 不可用，已安全降级。");
      setHomeHint("本地阅读状态暂不可用，已安全降级");
      setNextActionFallback("localStorage 不可用，本地规则推导已安全降级。");
      renderBookmarkCard(normalizeDesktopBookmarkPreview(null));
      return true;
    }

    let rawValue = null;
    try {
      rawValue = storage.getItem("lap.reader.localStatus.v1");
    } catch (_readError) {
      setDiagnosticsText("desktop-reader-local-status-state", "当前页面本地状态读取不可用");
      setDiagnosticsText("desktop-reader-local-status-key", "不可读取");
      setDiagnosticsHint("读取 localStorage 失败，已安全降级。");
      setHomeHint("本地阅读状态暂不可用，已安全降级");
      setNextActionFallback("读取 localStorage 失败，本地规则推导已安全降级。");
      renderBookmarkCard(normalizeDesktopBookmarkPreview(null));
      return true;
    }

    if (rawValue === null) {
      setDiagnosticsText("desktop-reader-local-status-state", "暂无本地 Reader 学习状态摘要");
      setDiagnosticsText("desktop-reader-local-status-key", "未发现");
      setDiagnosticsHint("请先在 Reader 中阅读或刷新本地状态");
      setHomeHint("暂无本地阅读状态。可先打开 Reader 开始阅读。");
      renderNextAction(createNextAction(null));
      renderBookmarkCard(normalizeDesktopBookmarkPreview(null));
      return true;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(rawValue);
    } catch (_parseError) {
      setDiagnosticsText("desktop-reader-local-status-state", "本地状态不可解析，已安全降级");
      setDiagnosticsText("desktop-reader-local-status-key", "已发现（解析失败）");
      setDiagnosticsHint("请检查 lap.reader.localStatus.v1 内容格式。");
      setHomeHint("本地阅读状态暂不可用，已安全降级");
      setNextActionFallback("本地摘要不可解析，本地规则推导已安全降级。");
      renderBookmarkCard(normalizeDesktopBookmarkPreview(null));
      return true;
    }

    const summary = parseSummary(parsed);
    if (!summary) {
      setDiagnosticsText("desktop-reader-local-status-state", "本地状态不可解析，已安全降级");
      setDiagnosticsText("desktop-reader-local-status-key", "已发现（结构不兼容）");
      setDiagnosticsHint("摘要结构不兼容，已安全降级。");
      setHomeHint("本地阅读状态暂不可用，已安全降级");
      setNextActionFallback("本地摘要结构不兼容，本地规则推导已安全降级。");
      renderBookmarkCard(normalizeDesktopBookmarkPreview(null));
      return true;
    }

    const roundedProgress = toRoundedPercent(summary.progressPercent);
    const progressText = roundedProgress === null ? "-" : String(roundedProgress) + "%";
    const readingSecondsText = String(Math.max(0, Math.floor(summary.readingSeconds))) + " 秒";
    const readingMinutesText = formatReaderDurationMinutes(summary.readingSeconds);
    const updatedAtText = formatUpdatedAt(summary.updatedAt, summary.lastReadAt);

    setDiagnosticsText("desktop-reader-local-status-state", "已读取本地 Reader 学习状态摘要");
    setDiagnosticsText("desktop-reader-local-status-key", "已发现");
    setDiagnosticsText("desktop-reader-local-status-book-id", summary.bookId || "-");
    setDiagnosticsText("desktop-reader-local-status-chapter-id", summary.chapterId || "-");
    setDiagnosticsText("desktop-reader-local-status-progress", progressText);
    setDiagnosticsText("desktop-reader-local-status-note-count", String(summary.noteCount));
    setDiagnosticsText("desktop-reader-local-status-bookmark-count", String(summary.bookmarkCount));
    setDiagnosticsText("desktop-reader-local-status-reading-seconds", readingSecondsText);
    setDiagnosticsText("desktop-reader-local-status-updated-at", updatedAtText);
    setDiagnosticsHint("仅本地只读展示，不会同步数据库或触发真实能力。");

    setHomeCardText("desktop-home-reader-book-id", summary.bookId || "-");
    setHomeCardText("desktop-home-reader-chapter-id", summary.chapterId || "-");
    setHomeProgress(summary.progressPercent);
    setHomeCardText("desktop-home-reader-note-count", String(summary.noteCount));
    setHomeCardText("desktop-home-reader-bookmark-count", String(summary.bookmarkCount));
    setHomeCardText("desktop-home-reader-reading-seconds", readingMinutesText);
    setHomeCardText("desktop-home-reader-updated-at", updatedAtText);
    const friendlyAgeText = formatDesktopLocalStatusAge(summary.updatedAt, new Date());
    setHomeCardText("desktop-home-reader-updated-at-friendly", friendlyAgeText);
    if (summary.progressClamped === true) {
      setHomeHint("已读取本地阅读状态，进度越界值已安全修正到 0%～100%。");
    } else if (updatedAtText === "时间不可解析（已安全降级）") {
      setHomeHint("已读取本地阅读状态，更新时间不可解析，已安全降级。");
    } else {
      setHomeHint("已读取本地阅读状态，仅用于开发预览，不会触发真实能力。");
    }

    const continueHref = buildReaderContinueHref(summary);
    const continueLabel = continueHref === "/reader" ? "打开 Reader" : "继续阅读";
    setReaderContinueAction(continueHref, continueHref === "/reader" ? "前往 Reader 选择内容" : "继续阅读");
    setHomeReaderContinueAction(continueHref, continueLabel);
    renderNextAction(createNextAction(summary));
    renderBookmarkCard(normalizeDesktopBookmarkPreview(summary));
    return true;
  })();`;
}

module.exports = {
  READER_LOCAL_STATUS_SUMMARY_KEY,
  parseReaderLocalStatusSummary,
  parseReaderLocalStatusSummaryRaw,
  readReaderLocalStatusDiagnostics,
  formatProgress,
  formatReadingSeconds,
  formatUpdatedAt,
  formatDesktopLocalStatusAge,
  formatDesktopReadingDuration,
  normalizeDesktopBookmarkPreview,
  buildDesktopReaderContinueHref,
  buildLocalLearningStatusPanelScript,
};
