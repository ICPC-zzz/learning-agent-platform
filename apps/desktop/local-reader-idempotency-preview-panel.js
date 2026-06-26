// Desktop 本地预览面板：Reader Sync 幂等与冲突检查
//
// 职责:
//   - 只读 localStorage（lap.reader.idempotency.preview）。
//   - 展示 mock 幂等预览摘要（idempotencyKeyPreview 掩码、status、conflict 等）。
//   - 复用 local-preview-safe-storage.js 过滤危险字段。
//   - 空态/JSON 损坏/字段类型错误安全降级。
//   - 只读刷新按钮，不写 localStorage，不调网络。
//
// Status: preview-only / local-only / read-only / disabled-by-default

const READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY = "lap.reader.idempotency.preview";
const SAFE_IDEMPOTENCY_PREVIEW_COPY =
  "开发预览 / 只读 / 真实幂等未连接 / 生产默认关闭 / 不会写入数据库 / 不会调用 repository";

// Reuse local-preview-safe-storage for danger field filtering
function normalizeSafeKey(rawKey) {
  if (typeof rawKey !== "string") {
    return "";
  }
  return rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

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

function maskIdempotencyKeyPreview(rawKey) {
  if (typeof rawKey !== "string" || rawKey.trim().length === 0) {
    return null;
  }

  const trimmed = rawKey.trim();

  // Prefix-like keys: "reader-sync-idempotency-v1:abc123..."
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex > 0 && colonIndex < 120) {
    const prefix = trimmed.slice(0, colonIndex + 1);
    const rest = trimmed.slice(colonIndex + 1);
    if (rest.length <= 12) {
      return prefix + rest.slice(0, 4) + "***";
    }
    return prefix + rest.slice(0, 8) + "***" + rest.slice(-4);
  }

  // Generic: first 8 chars + *** + last 4 chars
  if (trimmed.length <= 12) {
    return trimmed.slice(0, 4) + "***";
  }
  return trimmed.slice(0, 8) + "***" + trimmed.slice(-4);
}

function isFiniteRatio(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isBooleanOrUndefined(value) {
  return value === undefined || typeof value === "boolean";
}

function resolveStatusChineseLabel(statusText) {
  if (typeof statusText !== "string") {
    return "未知状态";
  }

  const normalized = statusText.trim().toLowerCase();

  if (normalized === "duplicate-safe") {
    return "重复提交已短路（本地预览）";
  }
  if (normalized === "changed-preview" || normalized === "changed_preview") {
    return "检测到变更冲突预览";
  }
  if (normalized === "conflict") {
    return "检测到变更冲突预览";
  }
  if (normalized === "idempotency-blocked" || normalized === "blocked") {
    return "幂等检查阻断";
  }
  if (normalized === "preview") {
    return "仅本地预览，不代表真实同步";
  }
  if (normalized === "error-preview" || normalized === "error") {
    return "幂等检查异常预览";
  }

  return statusText;
}

function buildEmptyIdempotencyPreviewSnapshot() {
  return {
    stateKind: "empty",
    statusText: "暂无本地幂等检查预览",
    noteText: SAFE_IDEMPOTENCY_PREVIEW_COPY,
    hintText:
      "请在 localStorage 中写入 lap.reader.idempotency.preview 后点击刷新。",
    filteredText: null,
    records: [],
  };
}

function buildUnavailableIdempotencyPreviewSnapshot() {
  return {
    stateKind: "unavailable",
    statusText: "本地幂等预览不可用",
    noteText: SAFE_IDEMPOTENCY_PREVIEW_COPY,
    hintText: "当前环境无法读取 localStorage，已安全降级。",
    filteredText: null,
    records: [],
  };
}

function buildDegradedIdempotencyPreviewSnapshot(hintText, filteredText) {
  return {
    stateKind: "degraded",
    statusText: "本地幂等预览已安全降级",
    noteText: SAFE_IDEMPOTENCY_PREVIEW_COPY,
    hintText:
      normalizeDisplayString(hintText, 140) ??
      "本地幂等预览结构不兼容，已安全降级。",
    filteredText: filteredText ?? null,
    records: [],
  };
}

function buildReadyIdempotencyPreviewSnapshot(records, options) {
  const normalizedRecords = Array.isArray(records) ? records : [];
  const filteredText = options && options.filteredText ? options.filteredText : null;

  return {
    stateKind: "ready",
    statusText: "已读取本地幂等检查预览",
    noteText: SAFE_IDEMPOTENCY_PREVIEW_COPY,
    hintText: "点击刷新可重新读取 localStorage。",
    filteredText: filteredText,
    records: normalizedRecords,
  };
}

function normalizeIdempotencyPreviewRecord(value, filterSensitiveFields) {
  if (!isRecord(value)) {
    return null;
  }

  const doFilter = typeof filterSensitiveFields === "function" ? filterSensitiveFields : null;

  // idempotencyKeyPreview: always masked
  const rawIdempotencyKeyPreview =
    typeof value.idempotencyKeyPreview === "string"
      ? value.idempotencyKeyPreview.trim()
      : "";
  const idempotencyKeyPreviewText = rawIdempotencyKeyPreview
    ? maskIdempotencyKeyPreview(rawIdempotencyKeyPreview)
    : "-";

  // status: resolve chinese label
  const rawStatus =
    typeof value.status === "string" ? value.status.trim() : "";
  const statusText = rawStatus
    ? resolveStatusChineseLabel(rawStatus)
    : "未知状态";
  const statusRawText = rawStatus || "-";

  // reasonCode
  const reasonCodeText =
    normalizeDisplayString(value.reasonCode, 120) ?? "-";

  // boolean flags
  const isDuplicate = typeof value.isDuplicate === "boolean" ? value.isDuplicate : false;
  const isNew = typeof value.isNew === "boolean" ? value.isNew : false;
  const isConflict = typeof value.isConflict === "boolean" ? value.isConflict : false;

  // book / chapter
  const bookIdText =
    normalizeDisplayString(value.bookId, 80) ?? "-";
  const chapterIdText =
    normalizeDisplayString(value.chapterId, 80) ?? "-";

  // progressRatio: validate range
  let progressRatioText = "-";
  let progressRatioWarning = null;
  if (value.progressRatio !== undefined && value.progressRatio !== null) {
    if (isFiniteRatio(value.progressRatio)) {
      progressRatioText = value.progressRatio.toFixed(4);
    } else {
      progressRatioText = "越界";
      progressRatioWarning = "progressRatio 超出 [0, 1] 范围，已安全降级";
    }
  }

  // source
  const sourceText =
    normalizeDisplayString(value.source, 80) ?? "-";

  // previewOnly
  const previewOnly = value.previewOnly === true;

  // writesDatabase / callsRepository: validate they are false, else warn
  const writesDatabase = value.writesDatabase === true;
  const callsRepository = value.callsRepository === true;

  const safetyWarnings = [];
  if (writesDatabase) {
    safetyWarnings.push(
      "本地 mock 字段异常（writesDatabase=true），真实写入仍未启用"
    );
  }
  if (callsRepository) {
    safetyWarnings.push(
      "本地 mock 字段异常（callsRepository=true），真实写入仍未启用"
    );
  }
  if (!previewOnly) {
    safetyWarnings.push("previewOnly 字段异常，已安全降级");
  }
  if (progressRatioWarning) {
    safetyWarnings.push(progressRatioWarning);
  }

  // blockedReasons
  let blockedReasonsText = "-";
  let blockedReasonsWarning = null;
  if (value.blockedReasons !== undefined && value.blockedReasons !== null) {
    if (Array.isArray(value.blockedReasons)) {
      const validReasons = value.blockedReasons
        .filter(function (r) { return typeof r === "string" && r.trim().length > 0; })
        .slice(0, 5);
      blockedReasonsText =
        validReasons.length > 0
          ? validReasons.join(" | ")
          : "（空数组）";
      if (value.blockedReasons.length > 5) {
        blockedReasonsText += " …（截断）";
      }
      if (value.blockedReasons.some(function (r) { return typeof r !== "string"; })) {
        blockedReasonsWarning =
          "blockedReasons 包含非字符串条目，已安全降级";
      }
    } else {
      blockedReasonsText = "（类型错误）";
      blockedReasonsWarning =
        "blockedReasons 不是数组，已安全降级";
    }
  }

  if (blockedReasonsWarning) {
    safetyWarnings.push(blockedReasonsWarning);
  }

  // Danger field filtering
  let filteredText = null;
  if (doFilter) {
    var filtered = doFilter(value);
    if (filtered && typeof filtered === "object") {
      // Check if filtering was needed
      var hits = doFilter.collectHits
        ? doFilter.collectHits(value)
        : [];
      if (Array.isArray(hits) && hits.length > 0) {
        filteredText = "已过滤敏感字段";
      }
    }
  }

  const hasDegradation = safetyWarnings.length > 0;
  const degradationText = hasDegradation
    ? safetyWarnings.join("；")
    : null;

  return {
    idempotencyKeyPreviewText,
    statusText,
    statusRawText,
    reasonCodeText,
    isDuplicate,
    isNew,
    isConflict,
    duplicateConflictText: resolveDuplicateConflictText(rawStatus, isDuplicate, isConflict),
    bookIdText,
    chapterIdText,
    progressRatioText,
    sourceText,
    previewOnlyText: previewOnly ? "true" : "false",
    writesDatabaseText: writesDatabase ? "true（异常）" : "false",
    callsRepositoryText: callsRepository ? "true（异常）" : "false",
    blockedReasonsText,
    filteredText: filteredText,
    degradationText: degradationText,
  };
}

function resolveDuplicateConflictText(rawStatus, isDuplicate, isConflict) {
  if (typeof rawStatus === "string") {
    const normalized = rawStatus.trim().toLowerCase();
    if (normalized === "duplicate-safe") {
      return "重复提交已短路（本地预览）";
    }
    if (normalized === "changed-preview" || normalized === "changed_preview" || normalized === "conflict") {
      return "检测到变更冲突预览";
    }
    if (normalized === "idempotency-blocked" || normalized === "blocked") {
      return "幂等检查阻断";
    }
    if (normalized === "preview") {
      return "仅本地预览，不代表真实同步";
    }
  }

  if (isDuplicate) {
    return "重复提交已短路（本地预览）";
  }
  if (isConflict) {
    return "检测到变更冲突预览";
  }
  return "仅本地预览，不代表真实同步";
}

function readReaderIdempotencyPreviewFromStorage(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return buildUnavailableIdempotencyPreviewSnapshot();
  }

  let rawValue = null;
  try {
    rawValue = storage.getItem(READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY);
  } catch (_error) {
    return buildUnavailableIdempotencyPreviewSnapshot();
  }

  if (rawValue === null || rawValue === undefined) {
    return buildEmptyIdempotencyPreviewSnapshot();
  }

  let parsedValue = null;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch (_error) {
    return buildDegradedIdempotencyPreviewSnapshot(
      "本地幂等预览 JSON 不可解析，已安全降级。",
      null
    );
  }

  // Not an object
  if (!isRecord(parsedValue)) {
    return buildDegradedIdempotencyPreviewSnapshot(
      "本地幂等预览结构不兼容（值不是对象），已安全降级。",
      null
    );
  }

  // Check for danger fields at top level via safe-storage utility
  // We use the safeReadLocalStorage from local-preview-safe-storage
  const safeModule = loadSafeStorageModule();
  let filteredText = null;
  let record = parsedValue;

  if (safeModule) {
    const hits = safeModule.collectSensitiveFieldHits(parsedValue);
    if (hits.length > 0) {
      filteredText = "已过滤敏感字段";
      record = safeModule.sanitizeSensitiveFields(parsedValue);
    }
  }

  const normalizedRecord = normalizeIdempotencyPreviewRecord(record, null);
  if (!normalizedRecord) {
    return buildDegradedIdempotencyPreviewSnapshot(
      "本地幂等预览记录无法安全展示，已安全降级。",
      filteredText
    );
  }

  normalizedRecord.filteredText = filteredText || normalizedRecord.filteredText;

  return buildReadyIdempotencyPreviewSnapshot([normalizedRecord], {
    filteredText: normalizedRecord.filteredText,
  });
}

function loadSafeStorageModule() {
  try {
    return require("./local-preview-safe-storage.js");
  } catch (_error) {
    return null;
  }
}

function buildLocalReaderIdempotencyPreviewPanelScript() {
  return (
    "(() => {\n" +
    "  var STORAGE_KEY = " +
    JSON.stringify(READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY) +
    ";\n" +
    "  var PANEL_ID = \"desktop-reader-idempotency-preview-panel\";\n" +
    "  var TITLE_ID = \"desktop-reader-idempotency-preview-title\";\n" +
    "  var NOTE_ID = \"desktop-reader-idempotency-preview-note\";\n" +
    "  var STATUS_ID = \"desktop-reader-idempotency-preview-status\";\n" +
    "  var HINT_ID = \"desktop-reader-idempotency-preview-hint\";\n" +
    "  var FILTERED_ID = \"desktop-reader-idempotency-preview-filtered\";\n" +
    "  var LIST_ID = \"desktop-reader-idempotency-preview-list\";\n" +
    "  var REFRESH_BUTTON_ID = \"desktop-reader-idempotency-preview-refresh-button\";\n" +
    "  var SAFE_COPY = " +
    JSON.stringify(SAFE_IDEMPOTENCY_PREVIEW_COPY) +
    ";\n" +
    "\n" +
    "  " + normalizeNullableString.toString() + "\n" +
    "  " + normalizeDisplayString.toString() + "\n" +
    "  " + isRecord.toString() + "\n" +
    "  " + isFiniteRatio.toString() + "\n" +
    "  " + maskIdempotencyKeyPreview.toString() + "\n" +
    "  " + resolveStatusChineseLabel.toString() + "\n" +
    "  " + resolveDuplicateConflictText.toString() + "\n" +
    "  " + normalizeIdempotencyPreviewRecord.toString() + "\n" +
    "\n" +
    "  function buildEmptySnapshot() {\n" +
    "    return {\n" +
    "      stateKind: \"empty\",\n" +
    "      statusText: \"暂无本地幂等检查预览\",\n" +
    "      noteText: SAFE_COPY,\n" +
    "      hintText: \"请在 localStorage 中写入 lap.reader.idempotency.preview 后点击刷新。\",\n" +
    "      filteredText: null,\n" +
    "      records: [],\n" +
    "    };\n" +
    "  }\n" +
    "\n" +
    "  function buildUnavailableSnapshot() {\n" +
    "    return {\n" +
    "      stateKind: \"unavailable\",\n" +
    "      statusText: \"本地幂等预览不可用\",\n" +
    "      noteText: SAFE_COPY,\n" +
    "      hintText: \"当前环境无法读取 localStorage，已安全降级。\",\n" +
    "      filteredText: null,\n" +
    "      records: [],\n" +
    "    };\n" +
    "  }\n" +
    "\n" +
    "  function buildDegradedSnapshot(hintText, filteredText) {\n" +
    "    return {\n" +
    "      stateKind: \"degraded\",\n" +
    "      statusText: \"本地幂等预览已安全降级\",\n" +
    "      noteText: SAFE_COPY,\n" +
    "      hintText: normalizeDisplayString(hintText, 140) || \"本地幂等预览结构不兼容，已安全降级。\",\n" +
    "      filteredText: filteredText || null,\n" +
    "      records: [],\n" +
    "    };\n" +
    "  }\n" +
    "\n" +
    "  function buildReadySnapshot(records, filteredText) {\n" +
    "    return {\n" +
    "      stateKind: \"ready\",\n" +
    "      statusText: \"已读取本地幂等检查预览\",\n" +
    "      noteText: SAFE_COPY,\n" +
    "      hintText: \"点击刷新可重新读取 localStorage。\",\n" +
    "      filteredText: filteredText || null,\n" +
    "      records: Array.isArray(records) ? records : [],\n" +
    "    };\n" +
    "  }\n" +
    "\n" +
    "  function readSnapshot() {\n" +
    "    var storage = null;\n" +
    "    try {\n" +
    "      storage = window.localStorage;\n" +
    "      if (!storage) {\n" +
    "        return buildUnavailableSnapshot();\n" +
    "      }\n" +
    "    } catch (_error) {\n" +
    "      return buildUnavailableSnapshot();\n" +
    "    }\n" +
    "\n" +
    "    var rawValue = null;\n" +
    "    try {\n" +
    "      rawValue = storage.getItem(STORAGE_KEY);\n" +
    "    } catch (_error) {\n" +
    "      return buildUnavailableSnapshot();\n" +
    "    }\n" +
    "\n" +
    "    if (rawValue === null) {\n" +
    "      return buildEmptySnapshot();\n" +
    "    }\n" +
    "\n" +
    "    var parsedValue = null;\n" +
    "    try {\n" +
    "      parsedValue = JSON.parse(rawValue);\n" +
    "    } catch (_error) {\n" +
    "      return buildDegradedSnapshot(\"本地幂等预览 JSON 不可解析，已安全降级。\", null);\n" +
    "    }\n" +
    "\n" +
    "    if (!isRecord(parsedValue)) {\n" +
    "      return buildDegradedSnapshot(\"本地幂等预览结构不兼容（值不是对象），已安全降级。\", null);\n" +
    "    }\n" +
    "\n" +
    "    var filteredText = null;\n" +
    "    var record = parsedValue;\n" +
    "\n" +
    "    // Use safe storage if available\n" +
    "    if (window.__lapSafeStorage && typeof window.__lapSafeStorage.collectSensitiveFieldHits === \"function\") {\n" +
    "      var hits = window.__lapSafeStorage.collectSensitiveFieldHits(parsedValue);\n" +
    "      if (hits.length > 0) {\n" +
    "        filteredText = \"已过滤敏感字段\";\n" +
    "        record = window.__lapSafeStorage.sanitizeSensitiveFields(parsedValue);\n" +
    "      }\n" +
    "    }\n" +
    "\n" +
    "    var normalizedRecord = normalizeIdempotencyPreviewRecord(record, null);\n" +
    "    if (!normalizedRecord) {\n" +
    "      return buildDegradedSnapshot(\"本地幂等预览记录无法安全展示，已安全降级。\", filteredText);\n" +
    "    }\n" +
    "\n" +
    "    normalizedRecord.filteredText = filteredText || normalizedRecord.filteredText;\n" +
    "\n" +
    "    return buildReadySnapshot([normalizedRecord], normalizedRecord.filteredText);\n" +
    "  }\n" +
    "\n" +
    "  function ensureElement(id, tagName, parent) {\n" +
    "    var node = document.getElementById(id);\n" +
    "    if (node) {\n" +
    "      return node;\n" +
    "    }\n" +
    "    node = document.createElement(tagName);\n" +
    "    node.id = id;\n" +
    "    if (parent) {\n" +
    "      parent.appendChild(node);\n" +
    "    }\n" +
    "    return node;\n" +
    "  }\n" +
    "\n" +
    "  function insertAfter(targetNode, node) {\n" +
    "    if (!targetNode || !targetNode.parentNode) {\n" +
    "      return false;\n" +
    "    }\n" +
    "    var parent = targetNode.parentNode;\n" +
    "    if (targetNode.nextSibling) {\n" +
    "      parent.insertBefore(node, targetNode.nextSibling);\n" +
    "    } else {\n" +
    "      parent.appendChild(node);\n" +
    "    }\n" +
    "    return true;\n" +
    "  }\n" +
    "\n" +
    "  var panel = document.getElementById(PANEL_ID);\n" +
    "  if (!panel) {\n" +
    "    panel = document.createElement(\"section\");\n" +
    "    panel.id = PANEL_ID;\n" +
    "    panel.setAttribute(\"aria-live\", \"polite\");\n" +
    "    panel.style.marginTop = \"12px\";\n" +
    "    panel.style.border = \"1px solid #d9dee7\";\n" +
    "    panel.style.borderRadius = \"10px\";\n" +
    "    panel.style.background = \"#f8fafc\";\n" +
    "    panel.style.padding = \"12px\";\n" +
    "    panel.style.boxShadow = \"0 1px 0 rgba(15, 23, 42, 0.03)\";\n" +
    "\n" +
    "    var anchor =\n" +
    "      document.getElementById(\"desktop-reader-write-preflight-preview-panel\") ||\n" +
    "      document.getElementById(\"desktop-reader-permission-gate-preview-panel\") ||\n" +
    "      document.getElementById(\"desktop-reader-audit-preview-panel\") ||\n" +
    "      document.getElementById(\"desktop-reader-sync-readiness-gate-panel\") ||\n" +
    "      document.getElementById(\"desktop-reader-sync-health-panel\") ||\n" +
    "      document.getElementById(\"desktop-navigation-shell\");\n" +
    "    if (!insertAfter(anchor, panel)) {\n" +
    "      document.body.appendChild(panel);\n" +
    "    }\n" +
    "  }\n" +
    "\n" +
    "  var titleNode = ensureElement(TITLE_ID, \"p\", panel);\n" +
    "  titleNode.style.margin = \"0\";\n" +
    "  titleNode.style.fontWeight = \"600\";\n" +
    "  titleNode.textContent = \"Reader Sync 幂等检查（本地预览）\";\n" +
    "\n" +
    "  var noteNode = ensureElement(NOTE_ID, \"p\", panel);\n" +
    "  noteNode.style.marginTop = \"6px\";\n" +
    "  noteNode.style.color = \"#5b6473\";\n" +
    "  noteNode.style.fontSize = \"13px\";\n" +
    "  noteNode.textContent = SAFE_COPY;\n" +
    "\n" +
    "  var statusNode = ensureElement(STATUS_ID, \"p\", panel);\n" +
    "  statusNode.style.marginTop = \"6px\";\n" +
    "  statusNode.style.fontWeight = \"600\";\n" +
    "\n" +
    "  var hintNode = ensureElement(HINT_ID, \"p\", panel);\n" +
    "  hintNode.style.marginTop = \"6px\";\n" +
    "  hintNode.style.color = \"#5b6473\";\n" +
    "  hintNode.style.fontSize = \"13px\";\n" +
    "\n" +
    "  var filteredNode = ensureElement(FILTERED_ID, \"p\", panel);\n" +
    "  filteredNode.style.marginTop = \"6px\";\n" +
    "  filteredNode.style.color = \"#5b6473\";\n" +
    "  filteredNode.style.fontSize = \"13px\";\n" +
    "  filteredNode.style.fontWeight = \"600\";\n" +
    "\n" +
    "  var refreshButtonNode = ensureElement(REFRESH_BUTTON_ID, \"button\", panel);\n" +
    "  refreshButtonNode.type = \"button\";\n" +
    "  refreshButtonNode.textContent = \"刷新本地幂等预览\";\n" +
    "  refreshButtonNode.style.display = \"inline-flex\";\n" +
    "  refreshButtonNode.style.alignItems = \"center\";\n" +
    "  refreshButtonNode.style.justifyContent = \"center\";\n" +
    "  refreshButtonNode.style.border = \"1px solid #d9dee7\";\n" +
    "  refreshButtonNode.style.borderRadius = \"8px\";\n" +
    "  refreshButtonNode.style.background = \"#ffffff\";\n" +
    "  refreshButtonNode.style.color = \"#1f2937\";\n" +
    "  refreshButtonNode.style.fontWeight = \"600\";\n" +
    "  refreshButtonNode.style.fontSize = \"14px\";\n" +
    "  refreshButtonNode.style.minHeight = \"38px\";\n" +
    "  refreshButtonNode.style.padding = \"0 14px\";\n" +
    "  refreshButtonNode.style.cursor = \"pointer\";\n" +
    "  refreshButtonNode.style.marginTop = \"10px\";\n" +
    "\n" +
    "  var listNode = ensureElement(LIST_ID, \"div\", panel);\n" +
    "  listNode.style.marginTop = \"12px\";\n" +
    "\n" +
    "  function renderRecordCard(parent, record) {\n" +
    "    var card = document.createElement(\"div\");\n" +
    "    card.style.border = \"1px solid #d9dee7\";\n" +
    "    card.style.borderRadius = \"10px\";\n" +
    "    card.style.background = \"#ffffff\";\n" +
    "    card.style.padding = \"12px\";\n" +
    "\n" +
    "    var list = document.createElement(\"ul\");\n" +
    "    list.style.margin = \"0\";\n" +
    "    list.style.paddingLeft = \"18px\";\n" +
    "    list.style.display = \"grid\";\n" +
    "    list.style.gap = \"4px\";\n" +
    "\n" +
    "    var rows = [\n" +
    "      [\"幂等 key 预览\", record.idempotencyKeyPreviewText],\n" +
    "      [\"状态\", record.statusText],\n" +
    "      [\"原始状态\", record.statusRawText],\n" +
    "      [\"原因码\", record.reasonCodeText],\n" +
    "      [\"重复\", record.isDuplicate ? \"是\" : \"否\"],\n" +
    "      [\"新提交\", record.isNew ? \"是\" : \"否\"],\n" +
    "      [\"冲突\", record.isConflict ? \"是\" : \"否\"],\n" +
    "      [\"冲突/重复判定\", record.duplicateConflictText],\n" +
    "      [\"bookId\", record.bookIdText],\n" +
    "      [\"chapterId\", record.chapterIdText],\n" +
    "      [\"进度比例\", record.progressRatioText],\n" +
    "      [\"来源\", record.sourceText],\n" +
    "      [\"previewOnly\", record.previewOnlyText],\n" +
    "      [\"writesDatabase\", record.writesDatabaseText],\n" +
    "      [\"callsRepository\", record.callsRepositoryText],\n" +
    "      [\"阻断原因\", record.blockedReasonsText],\n" +
    "    ];\n" +
    "\n" +
    "    if (record.filteredText) {\n" +
    "      rows.push([\"敏感字段\", record.filteredText]);\n" +
    "    }\n" +
    "\n" +
    "    if (record.degradationText) {\n" +
    "      rows.push([\"安全警告\", record.degradationText]);\n" +
    "    }\n" +
    "\n" +
    "    for (var i = 0; i < rows.length; i += 1) {\n" +
    "      var row = document.createElement(\"li\");\n" +
    "      var label = document.createElement(\"span\");\n" +
    "      label.style.color = \"#5b6473\";\n" +
    "      label.textContent = rows[i][0] + \"：\";\n" +
    "      var value = document.createElement(\"strong\");\n" +
    "      value.style.marginLeft = \"6px\";\n" +
    "      value.textContent = rows[i][1];\n" +
    "      row.appendChild(label);\n" +
    "      row.appendChild(value);\n" +
    "      list.appendChild(row);\n" +
    "    }\n" +
    "\n" +
    "    card.appendChild(list);\n" +
    "    parent.appendChild(card);\n" +
    "  }\n" +
    "\n" +
    "  function render() {\n" +
    "    var snapshot = readSnapshot();\n" +
    "    statusNode.textContent = snapshot.statusText;\n" +
    "    hintNode.textContent = snapshot.hintText;\n" +
    "    filteredNode.textContent = snapshot.filteredText || \"\";\n" +
    "    listNode.innerHTML = \"\";\n" +
    "\n" +
    "    if (snapshot.records.length === 0) {\n" +
    "      return snapshot;\n" +
    "    }\n" +
    "\n" +
    "    for (var j = 0; j < snapshot.records.length; j += 1) {\n" +
    "      renderRecordCard(listNode, snapshot.records[j]);\n" +
    "    }\n" +
    "\n" +
    "    return snapshot;\n" +
    "  }\n" +
    "\n" +
    "  refreshButtonNode.onclick = function () {\n" +
    "    render();\n" +
    "  };\n" +
    "\n" +
    "  render();\n" +
    "  return true;\n" +
    "})();"
  );
}

module.exports = {
  READER_IDEMPOTENCY_PREVIEW_STORAGE_KEY,
  SAFE_IDEMPOTENCY_PREVIEW_COPY,
  maskIdempotencyKeyPreview,
  resolveStatusChineseLabel,
  resolveDuplicateConflictText,
  normalizeIdempotencyPreviewRecord,
  readReaderIdempotencyPreviewFromStorage,
  buildLocalReaderIdempotencyPreviewPanelScript,
};
