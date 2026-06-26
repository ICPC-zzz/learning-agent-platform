const READER_AUDIT_PREVIEW_STORAGE_KEY = "lap.reader.audit.preview.events";
const MAX_RENDERED_EVENTS = 5;
const SAFE_AUDIT_PREVIEW_COPY = "开发预览 / 只读 / 真实审计未启用 / 未写入数据库";

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDisplayString(value, maxLength) {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }

  if (typeof maxLength !== "number" || !Number.isFinite(maxLength) || maxLength <= 0) {
    return normalized;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, Math.max(0, maxLength - 3)) + "...";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafePrototype(value) {
  if (!isRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype !== Object.prototype && prototype !== null;
}

function readNestedValue(value, path) {
  if (!isRecord(value) || !Array.isArray(path) || path.length === 0) {
    return undefined;
  }

  let current = value;
  for (let i = 0; i < path.length; i += 1) {
    if (!isRecord(current)) {
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
    const rawValue = Array.isArray(candidatePath)
      ? readNestedValue(value, candidatePath)
      : value && typeof value === "object"
        ? value[candidatePath]
        : undefined;
    const normalized = normalizeDisplayString(rawValue, maxLength);
    if (normalized) {
      return normalized;
    }
  }

  return null;
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
    normalized.includes("authorization") ||
    normalized === "rawrequest" ||
    normalized === "rawbody" ||
    normalized === "rawheaders" ||
    normalized === "rawdbrecord"
  );
}

function collectSensitiveFieldHits(value, path, hits) {
  const currentPath = Array.isArray(path) ? path : [];
  const currentHits = Array.isArray(hits) ? hits : [];

  if (!isRecord(value) && !Array.isArray(value)) {
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

function readEventTimeText(value) {
  const candidatePaths = [
    ["timestamp"],
    ["createdAt"],
    ["recordedAt"],
    ["eventTime"],
    ["time"],
    ["occurredAt"],
  ];

  for (let i = 0; i < candidatePaths.length; i += 1) {
    const rawValue = readNestedValue(value, candidatePaths[i]);
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      const normalizedTimestamp =
        rawValue < 10_000_000_000 ? rawValue * 1000 : rawValue;
      const date = new Date(normalizedTimestamp);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString("zh-CN", { hour12: false });
      }
      continue;
    }

    if (typeof rawValue === "string") {
      const normalized = rawValue.trim();
      if (!normalized) {
        continue;
      }

      const date = new Date(normalized);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString("zh-CN", { hour12: false });
      }

      return "时间不可解析";
    }
  }

  return null;
}

function isAuditEventLikeRecord(value) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(value, "eventType") ||
    Object.prototype.hasOwnProperty.call(value, "status") ||
    Object.prototype.hasOwnProperty.call(value, "reasonCode") ||
    Object.prototype.hasOwnProperty.call(value, "bookId") ||
    Object.prototype.hasOwnProperty.call(value, "chapterId") ||
    Object.prototype.hasOwnProperty.call(value, "source") ||
    Object.prototype.hasOwnProperty.call(value, "permissionGateStatus") ||
    Object.prototype.hasOwnProperty.call(value, "timestamp") ||
    Object.prototype.hasOwnProperty.call(value, "createdAt") ||
    Object.prototype.hasOwnProperty.call(value, "recordedAt") ||
    Object.prototype.hasOwnProperty.call(value, "eventTime") ||
    Object.prototype.hasOwnProperty.call(value, "time")
  );
}

function normalizeAuditEventPreviewRecord(value) {
  if (!isRecord(value)) {
    return null;
  }

  const sensitiveFieldHits = collectSensitiveFieldHits(value);
  const eventTypeText =
    readStringCandidate(value, [["eventType"], ["type"], ["eventName"], ["event"]], 80) ??
    "unknown-event";
  const statusText =
    readStringCandidate(value, [["status"], ["state"]], 60) ?? "error-preview";
  const reasonCodeText =
    readStringCandidate(value, [["reasonCode"], ["reason"], ["blockedReason"]], 120) ??
    "INVALID_AUDIT_EVENT_PREVIEW";
  const bookIdText =
    readStringCandidate(value, [["bookId"], ["book", "id"], ["book", "bookId"]], 80) ?? "-";
  const chapterIdText =
    readStringCandidate(value, [["chapterId"], ["chapter", "id"], ["chapter", "chapterId"]], 80) ??
    "-";
  const sourceText =
    readStringCandidate(value, [["source"], ["origin"], ["sourceType"]], 80) ?? "unknown";
  const permissionGateStatusText =
    readStringCandidate(
      value,
      [["permissionGateStatus"], ["permissionGate"], ["gateStatus"]],
      40
    ) ?? "preview";
  const timeText = readEventTimeText(value) ?? "时间不可解析";

  const contractViolation =
    value.previewOnly !== undefined && value.previewOnly !== true ||
    value.writesDatabase === true ||
    value.callsRepository === true;

  const coreFieldIssue =
    normalizeNullableString(value.eventType) === null ||
    normalizeNullableString(value.status) === null ||
    normalizeNullableString(value.reasonCode) === null;

  return {
    eventTypeText,
    statusText,
    reasonCodeText,
    bookIdText,
    chapterIdText,
    bookChapterSummaryText: "bookId=" + bookIdText + " / chapterId=" + chapterIdText,
    sourceText,
    timeText,
    permissionGateStatusText,
    previewOnlyText: "true",
    writesDatabaseText: "false",
    callsRepositoryText: "false",
    sensitiveText: sensitiveFieldHits.length > 0 ? "已过滤敏感字段" : "-",
    degradedText: contractViolation || coreFieldIssue ? "事件结构不完整，已安全降级" : null,
  };
}

function normalizeAuditPreviewItems(items) {
  if (!Array.isArray(items)) {
    return {
      events: [],
      skippedCount: 0,
      truncated: false,
      degradedCount: 0,
    };
  }

  const normalizedEvents = [];
  let skippedCount = 0;
  let degradedCount = 0;
  const renderLimit = Math.min(items.length, MAX_RENDERED_EVENTS);

  for (let i = 0; i < renderLimit; i += 1) {
    const event = normalizeAuditEventPreviewRecord(items[i]);
    if (!event) {
      skippedCount += 1;
      continue;
    }

    if (event.degradedText) {
      degradedCount += 1;
    }

    normalizedEvents.push(event);
  }

  for (let i = renderLimit; i < items.length; i += 1) {
    skippedCount += 1;
  }

  return {
    events: normalizedEvents,
    skippedCount,
    truncated: items.length > MAX_RENDERED_EVENTS,
    degradedCount,
  };
}

function buildEmptyReaderAuditEventPreviewSnapshot() {
  return {
    stateKind: "empty",
    statusText: "暂无本地审计事件预览",
    noteText: SAFE_AUDIT_PREVIEW_COPY,
    hintText: "请在 localStorage 中写入 lap.reader.audit.preview.events 后点击刷新。",
    filteredText: null,
    events: [],
  };
}

function buildUnavailableReaderAuditEventPreviewSnapshot() {
  return {
    stateKind: "unavailable",
    statusText: "本地审计预览数据不可用",
    noteText: SAFE_AUDIT_PREVIEW_COPY,
    hintText: "当前环境无法读取 localStorage，已安全降级。",
    filteredText: null,
    events: [],
  };
}

function buildDegradedReaderAuditEventPreviewSnapshot(hintText, filteredText, events) {
  return {
    stateKind: "degraded",
    statusText: "本地审计预览已安全降级",
    noteText: SAFE_AUDIT_PREVIEW_COPY,
    hintText:
      normalizeDisplayString(hintText, 140) ??
      "本地审计预览结构不兼容，已安全降级。",
    filteredText: filteredText ?? null,
    events: Array.isArray(events) ? events : [],
  };
}

function buildReadyReaderAuditEventPreviewSnapshot(events, options) {
  const normalizedEvents = Array.isArray(events) ? events : [];
  const filteredText = options && options.filteredText ? options.filteredText : null;
  const truncated = Boolean(options && options.truncated);
  const degradedCount =
    options && typeof options.degradedCount === "number" && Number.isFinite(options.degradedCount)
      ? options.degradedCount
      : 0;
  const skippedCount =
    options && typeof options.skippedCount === "number" && Number.isFinite(options.skippedCount)
      ? options.skippedCount
      : 0;

  const isDegraded = degradedCount > 0 || skippedCount > 0 || truncated;

  return {
    stateKind: isDegraded ? "degraded" : "ready",
    statusText: isDegraded
      ? "已读取本地审计事件预览，部分字段已安全降级"
      : "已读取本地审计事件预览",
    noteText: SAFE_AUDIT_PREVIEW_COPY,
    hintText: truncated
      ? "仅展示前 " + MAX_RENDERED_EVENTS + " 条，点击刷新可重新读取 localStorage。"
      : "点击刷新可重新读取 localStorage。",
    filteredText: filteredText,
    events: normalizedEvents,
  };
}

function readReaderAuditEventPreviewFromStorage(storage) {
  if (!storage) {
    return buildUnavailableReaderAuditEventPreviewSnapshot();
  }

  let rawValue = null;
  try {
    rawValue = storage.getItem(READER_AUDIT_PREVIEW_STORAGE_KEY);
  } catch (_error) {
    return buildUnavailableReaderAuditEventPreviewSnapshot();
  }

  if (rawValue === null) {
    return buildEmptyReaderAuditEventPreviewSnapshot();
  }

  let parsedValue = null;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch (_error) {
    return buildDegradedReaderAuditEventPreviewSnapshot(
      "本地审计预览 JSON 不可解析，已安全降级。",
      null,
      []
    );
  }

  let items = null;
  let filteredText = null;

  if (Array.isArray(parsedValue)) {
    items = parsedValue;
  } else if (isRecord(parsedValue)) {
    const sensitiveFieldHits = collectSensitiveFieldHits(parsedValue);
    if (sensitiveFieldHits.length > 0) {
      filteredText = "已过滤敏感字段";
    }

    if (Array.isArray(parsedValue.events)) {
      items = parsedValue.events;
    } else if (Array.isArray(parsedValue.items)) {
      items = parsedValue.items;
    } else if (isAuditEventLikeRecord(parsedValue)) {
      items = [parsedValue];
    } else {
      return buildDegradedReaderAuditEventPreviewSnapshot(
        "本地审计预览结构不兼容，已安全降级。",
        filteredText,
        []
      );
    }
  } else {
    return buildDegradedReaderAuditEventPreviewSnapshot(
      "本地审计预览结构不兼容，已安全降级。",
      null,
      []
    );
  }

  if (!items || items.length === 0) {
    return buildEmptyReaderAuditEventPreviewSnapshot();
  }

  const normalized = normalizeAuditPreviewItems(items);
  if (normalized.events.length === 0) {
    return buildDegradedReaderAuditEventPreviewSnapshot(
      "本地审计事件条目无法安全展示，已安全降级。",
      filteredText,
      []
    );
  }

  const combinedFilteredText =
    filteredText || normalized.events.some((event) => event.sensitiveText === "已过滤敏感字段")
      ? "已过滤敏感字段"
      : null;

  return buildReadyReaderAuditEventPreviewSnapshot(normalized.events, {
    filteredText: combinedFilteredText,
    truncated: normalized.truncated,
    degradedCount: normalized.degradedCount,
    skippedCount: normalized.skippedCount,
  });
}

function buildLocalReaderAuditEventPreviewPanelScript() {
  return `(() => {
    const STORAGE_KEY = ${JSON.stringify(READER_AUDIT_PREVIEW_STORAGE_KEY)};
    const PANEL_ID = "desktop-reader-audit-preview-panel";
    const TITLE_ID = "desktop-reader-audit-preview-title";
    const NOTE_ID = "desktop-reader-audit-preview-note";
    const STATUS_ID = "desktop-reader-audit-preview-status";
    const HINT_ID = "desktop-reader-audit-preview-hint";
    const FILTERED_ID = "desktop-reader-audit-preview-filtered";
    const LIST_ID = "desktop-reader-audit-preview-list";
    const REFRESH_BUTTON_ID = "desktop-reader-audit-preview-refresh-button";
    const SAFE_COPY = ${JSON.stringify(SAFE_AUDIT_PREVIEW_COPY)};
    const MAX_RENDERED_EVENTS = ${JSON.stringify(MAX_RENDERED_EVENTS)};

    function normalizeNullableString(value) {
      if (typeof value !== "string") {
        return null;
      }
      const normalized = value.trim();
      return normalized.length > 0 ? normalized : null;
    }

    function normalizeDisplayString(value, maxLength) {
      const normalized = normalizeNullableString(value);
      if (!normalized) {
        return null;
      }
      if (typeof maxLength !== "number" || !Number.isFinite(maxLength) || maxLength <= 0) {
        return normalized;
      }
      if (normalized.length <= maxLength) {
        return normalized;
      }
      return normalized.slice(0, Math.max(0, maxLength - 3)) + "...";
    }

    function isRecord(value) {
      return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    function readNestedValue(value, path) {
      if (!isRecord(value) || !Array.isArray(path) || path.length === 0) {
        return undefined;
      }
      let current = value;
      for (let i = 0; i < path.length; i += 1) {
        if (!isRecord(current)) {
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
          : value && typeof value === "object"
            ? value[candidatePath]
            : undefined;
        const normalized = normalizeDisplayString(rawValue, maxLength);
        if (normalized) {
          return normalized;
        }
      }
      return null;
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
        normalized.includes("authorization") ||
        normalized === "rawrequest" ||
        normalized === "rawbody" ||
        normalized === "rawheaders" ||
        normalized === "rawdbrecord"
      );
    }

    function collectSensitiveFieldHits(value, path, hits) {
      const currentPath = Array.isArray(path) ? path : [];
      const currentHits = Array.isArray(hits) ? hits : [];

      if (!isRecord(value) && !Array.isArray(value)) {
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

    function readEventTimeText(value) {
      const candidatePaths = [
        ["timestamp"],
        ["createdAt"],
        ["recordedAt"],
        ["eventTime"],
        ["time"],
        ["occurredAt"],
      ];

      for (let i = 0; i < candidatePaths.length; i += 1) {
        const rawValue = readNestedValue(value, candidatePaths[i]);
        if (rawValue === undefined || rawValue === null) {
          continue;
        }

        if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
          const normalizedTimestamp = rawValue < 10000000000 ? rawValue * 1000 : rawValue;
          const date = new Date(normalizedTimestamp);
          if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString("zh-CN", { hour12: false });
          }
          continue;
        }

        if (typeof rawValue === "string") {
          const normalized = rawValue.trim();
          if (!normalized) {
            continue;
          }

          const date = new Date(normalized);
          if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString("zh-CN", { hour12: false });
          }

          return "时间不可解析";
        }
      }

      return null;
    }

    function isAuditEventLikeRecord(value) {
      if (!isRecord(value)) {
        return false;
      }

      return (
        Object.prototype.hasOwnProperty.call(value, "eventType") ||
        Object.prototype.hasOwnProperty.call(value, "status") ||
        Object.prototype.hasOwnProperty.call(value, "reasonCode") ||
        Object.prototype.hasOwnProperty.call(value, "bookId") ||
        Object.prototype.hasOwnProperty.call(value, "chapterId") ||
        Object.prototype.hasOwnProperty.call(value, "source") ||
        Object.prototype.hasOwnProperty.call(value, "permissionGateStatus") ||
        Object.prototype.hasOwnProperty.call(value, "timestamp") ||
        Object.prototype.hasOwnProperty.call(value, "createdAt") ||
        Object.prototype.hasOwnProperty.call(value, "recordedAt") ||
        Object.prototype.hasOwnProperty.call(value, "eventTime") ||
        Object.prototype.hasOwnProperty.call(value, "time")
      );
    }

    function normalizeAuditEventPreviewRecord(value) {
      if (!isRecord(value)) {
        return null;
      }

      const sensitiveFieldHits = collectSensitiveFieldHits(value);
      const eventTypeText =
        readStringCandidate(value, [["eventType"], ["type"], ["eventName"], ["event"]], 80) ||
        "unknown-event";
      const statusText =
        readStringCandidate(value, [["status"], ["state"]], 60) || "error-preview";
      const reasonCodeText =
        readStringCandidate(value, [["reasonCode"], ["reason"], ["blockedReason"]], 120) ||
        "INVALID_AUDIT_EVENT_PREVIEW";
      const bookIdText =
        readStringCandidate(value, [["bookId"], ["book", "id"], ["book", "bookId"]], 80) || "-";
      const chapterIdText =
        readStringCandidate(value, [["chapterId"], ["chapter", "id"], ["chapter", "chapterId"]], 80) ||
        "-";
      const sourceText =
        readStringCandidate(value, [["source"], ["origin"], ["sourceType"]], 80) || "unknown";
      const permissionGateStatusText =
        readStringCandidate(value, [["permissionGateStatus"], ["permissionGate"], ["gateStatus"]], 40) ||
        "preview";
      const timeText = readEventTimeText(value) || "时间不可解析";

      const contractViolation =
        (value.previewOnly !== undefined && value.previewOnly !== true) ||
        value.writesDatabase === true ||
        value.callsRepository === true;

      const coreFieldIssue =
        normalizeNullableString(value.eventType) === null ||
        normalizeNullableString(value.status) === null ||
        normalizeNullableString(value.reasonCode) === null;

      return {
        eventTypeText,
        statusText,
        reasonCodeText,
        bookIdText,
        chapterIdText,
        bookChapterSummaryText: "bookId=" + bookIdText + " / chapterId=" + chapterIdText,
        sourceText,
        timeText,
        permissionGateStatusText,
        previewOnlyText: "true",
        writesDatabaseText: "false",
        callsRepositoryText: "false",
        sensitiveText: sensitiveFieldHits.length > 0 ? "已过滤敏感字段" : "-",
        degradedText: contractViolation || coreFieldIssue ? "事件结构不完整，已安全降级" : null,
      };
    }

    function normalizeAuditPreviewItems(items) {
      if (!Array.isArray(items)) {
        return {
          events: [],
          skippedCount: 0,
          truncated: false,
          degradedCount: 0,
        };
      }

      const normalizedEvents = [];
      let skippedCount = 0;
      let degradedCount = 0;
      const renderLimit = Math.min(items.length, MAX_RENDERED_EVENTS);

      for (let i = 0; i < renderLimit; i += 1) {
        const event = normalizeAuditEventPreviewRecord(items[i]);
        if (!event) {
          skippedCount += 1;
          continue;
        }

        if (event.degradedText) {
          degradedCount += 1;
        }

        normalizedEvents.push(event);
      }

      for (let i = renderLimit; i < items.length; i += 1) {
        skippedCount += 1;
      }

      return {
        events: normalizedEvents,
        skippedCount,
        truncated: items.length > MAX_RENDERED_EVENTS,
        degradedCount,
      };
    }

    function buildEmptySnapshot() {
      return {
        stateKind: "empty",
        statusText: "暂无本地审计事件预览",
        noteText: SAFE_COPY,
        hintText: "请在 localStorage 中写入 lap.reader.audit.preview.events 后点击刷新。",
        filteredText: null,
        events: [],
      };
    }

    function buildUnavailableSnapshot() {
      return {
        stateKind: "unavailable",
        statusText: "本地审计预览数据不可用",
        noteText: SAFE_COPY,
        hintText: "当前环境无法读取 localStorage，已安全降级。",
        filteredText: null,
        events: [],
      };
    }

    function buildDegradedSnapshot(hintText, filteredText, events) {
      return {
        stateKind: "degraded",
        statusText: "本地审计预览已安全降级",
        noteText: SAFE_COPY,
        hintText: normalizeDisplayString(hintText, 140) || "本地审计预览结构不兼容，已安全降级。",
        filteredText: filteredText || null,
        events: Array.isArray(events) ? events : [],
      };
    }

    function buildReadySnapshot(events, options) {
      const normalizedEvents = Array.isArray(events) ? events : [];
      const filteredText = options && options.filteredText ? options.filteredText : null;
      const truncated = Boolean(options && options.truncated);
      const degradedCount =
        options && typeof options.degradedCount === "number" && Number.isFinite(options.degradedCount)
          ? options.degradedCount
          : 0;
      const skippedCount =
        options && typeof options.skippedCount === "number" && Number.isFinite(options.skippedCount)
          ? options.skippedCount
          : 0;
      const isDegraded = degradedCount > 0 || skippedCount > 0 || truncated;

      return {
        stateKind: isDegraded ? "degraded" : "ready",
        statusText: isDegraded
          ? "已读取本地审计事件预览，部分字段已安全降级"
          : "已读取本地审计事件预览",
        noteText: SAFE_COPY,
        hintText: truncated
          ? "仅展示前 " + MAX_RENDERED_EVENTS + " 条，点击刷新可重新读取 localStorage。"
          : "点击刷新可重新读取 localStorage。",
        filteredText: filteredText,
        events: normalizedEvents,
      };
    }

    function readSnapshot() {
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
        rawValue = storage.getItem(STORAGE_KEY);
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
        return buildDegradedSnapshot("本地审计预览 JSON 不可解析，已安全降级。", null, []);
      }

      let items = null;
      let filteredText = null;

      if (Array.isArray(parsedValue)) {
        items = parsedValue;
      } else if (isRecord(parsedValue)) {
        const sensitiveFieldHits = collectSensitiveFieldHits(parsedValue);
        if (sensitiveFieldHits.length > 0) {
          filteredText = "已过滤敏感字段";
        }

        if (Array.isArray(parsedValue.events)) {
          items = parsedValue.events;
        } else if (Array.isArray(parsedValue.items)) {
          items = parsedValue.items;
        } else if (isAuditEventLikeRecord(parsedValue)) {
          items = [parsedValue];
        } else {
          return buildDegradedSnapshot(
            "本地审计预览结构不兼容，已安全降级。",
            filteredText,
            []
          );
        }
      } else {
        return buildDegradedSnapshot("本地审计预览结构不兼容，已安全降级。", null, []);
      }

      if (!items || items.length === 0) {
        return buildEmptySnapshot();
      }

      const normalized = normalizeAuditPreviewItems(items);
      if (normalized.events.length === 0) {
        return buildDegradedSnapshot(
          "本地审计事件条目无法安全展示，已安全降级。",
          filteredText,
          []
        );
      }

      const combinedFilteredText =
        filteredText || normalized.events.some((event) => event.sensitiveText === "已过滤敏感字段")
          ? "已过滤敏感字段"
          : null;

      return buildReadySnapshot(normalized.events, {
        filteredText: combinedFilteredText,
        truncated: normalized.truncated,
        degradedCount: normalized.degradedCount,
        skippedCount: normalized.skippedCount,
      });
    }

    function ensureElement(id, tagName, parent) {
      let node = document.getElementById(id);
      if (node) {
        return node;
      }

      node = document.createElement(tagName);
      node.id = id;
      if (parent) {
        parent.appendChild(node);
      }
      return node;
    }

    function insertAfter(targetNode, node) {
      if (!targetNode || !targetNode.parentNode) {
        return false;
      }

      const parent = targetNode.parentNode;
      if (targetNode.nextSibling) {
        parent.insertBefore(node, targetNode.nextSibling);
      } else {
        parent.appendChild(node);
      }
      return true;
    }

    function renderEventCard(parent, event, index) {
      const card = document.createElement("li");
      card.style.border = "1px solid #d9dee7";
      card.style.borderRadius = "10px";
      card.style.background = "#ffffff";
      card.style.padding = "12px";

      const title = document.createElement("p");
      title.style.margin = "0";
      title.style.fontWeight = "600";
      title.textContent = "事件 " + String(index + 1);
      card.appendChild(title);

      const summary = document.createElement("p");
      summary.style.marginTop = "6px";
      summary.style.color = "#5b6473";
      summary.style.fontSize = "13px";
      summary.textContent = event.bookChapterSummaryText;
      card.appendChild(summary);

      const list = document.createElement("ul");
      list.style.marginTop = "8px";
      list.style.paddingLeft = "18px";
      list.style.display = "grid";
      list.style.gap = "4px";

      const rows = [
        ["事件类型", event.eventTypeText],
        ["状态", event.statusText],
        ["reasonCode", event.reasonCodeText],
        ["source", event.sourceText],
        ["时间", event.timeText],
        ["permissionGateStatus", event.permissionGateStatusText],
        ["previewOnly", event.previewOnlyText],
        ["writesDatabase", event.writesDatabaseText],
        ["callsRepository", event.callsRepositoryText],
        ["敏感字段", event.sensitiveText],
      ];

      if (event.degradedText) {
        rows.push(["降级", event.degradedText]);
      }

      for (let i = 0; i < rows.length; i += 1) {
        const row = document.createElement("li");
        const label = document.createElement("span");
        label.style.color = "#5b6473";
        label.textContent = rows[i][0] + "：";
        const value = document.createElement("strong");
        value.style.marginLeft = "6px";
        value.textContent = rows[i][1];
        row.appendChild(label);
        row.appendChild(value);
        list.appendChild(row);
      }

      card.appendChild(list);
      parent.appendChild(card);
    }

    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = PANEL_ID;
      panel.setAttribute("aria-live", "polite");
      panel.style.marginTop = "12px";
      panel.style.border = "1px solid #d9dee7";
      panel.style.borderRadius = "10px";
      panel.style.background = "#f8fafc";
      panel.style.padding = "12px";
      panel.style.boxShadow = "0 1px 0 rgba(15, 23, 42, 0.03)";

      const anchor =
        document.getElementById("desktop-home-learning-action-card") ||
        document.getElementById("desktop-home-bookmark-preview-card") ||
        document.getElementById("desktop-navigation-shell");
      if (!insertAfter(anchor, panel)) {
        document.body.appendChild(panel);
      }
    }

    const titleNode = ensureElement(TITLE_ID, "p", panel);
    titleNode.style.margin = "0";
    titleNode.style.fontWeight = "600";
    titleNode.textContent = "Reader 审计事件（本地预览）";

    const noteNode = ensureElement(NOTE_ID, "p", panel);
    noteNode.style.marginTop = "6px";
    noteNode.style.color = "#5b6473";
    noteNode.style.fontSize = "13px";
    noteNode.textContent = SAFE_COPY;

    const statusNode = ensureElement(STATUS_ID, "p", panel);
    statusNode.style.marginTop = "6px";
    statusNode.style.fontWeight = "600";

    const hintNode = ensureElement(HINT_ID, "p", panel);
    hintNode.style.marginTop = "6px";
    hintNode.style.color = "#5b6473";
    hintNode.style.fontSize = "13px";

    const filteredNode = ensureElement(FILTERED_ID, "p", panel);
    filteredNode.style.marginTop = "6px";
    filteredNode.style.color = "#5b6473";
    filteredNode.style.fontSize = "13px";
    filteredNode.style.fontWeight = "600";

    const refreshButtonNode = ensureElement(REFRESH_BUTTON_ID, "button", panel);
    refreshButtonNode.type = "button";
    refreshButtonNode.textContent = "刷新本地审计预览";
    refreshButtonNode.style.display = "inline-flex";
    refreshButtonNode.style.alignItems = "center";
    refreshButtonNode.style.justifyContent = "center";
    refreshButtonNode.style.border = "1px solid #d9dee7";
    refreshButtonNode.style.borderRadius = "8px";
    refreshButtonNode.style.background = "#ffffff";
    refreshButtonNode.style.color = "#1f2937";
    refreshButtonNode.style.fontWeight = "600";
    refreshButtonNode.style.fontSize = "14px";
    refreshButtonNode.style.minHeight = "38px";
    refreshButtonNode.style.padding = "0 14px";
    refreshButtonNode.style.cursor = "pointer";
    refreshButtonNode.style.marginTop = "10px";

    const listNode = ensureElement(LIST_ID, "ul", panel);
    listNode.style.listStyle = "none";
    listNode.style.paddingLeft = "0";
    listNode.style.marginTop = "12px";
    listNode.style.display = "grid";
    listNode.style.gap = "10px";

    function render() {
      const snapshot = readSnapshot();
      statusNode.textContent = snapshot.statusText;
      hintNode.textContent = snapshot.hintText;
      filteredNode.textContent = snapshot.filteredText || "";
      listNode.innerHTML = "";

      if (snapshot.events.length === 0) {
        return snapshot;
      }

      for (let i = 0; i < snapshot.events.length; i += 1) {
        renderEventCard(listNode, snapshot.events[i], i);
      }

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
  READER_AUDIT_PREVIEW_STORAGE_KEY,
  MAX_RENDERED_EVENTS,
  SAFE_AUDIT_PREVIEW_COPY,
  collectSensitiveFieldHits,
  normalizeAuditEventPreviewRecord,
  readReaderAuditEventPreviewFromStorage,
  buildLocalReaderAuditEventPreviewPanelScript,
};
