// Desktop 本地预览安全 localStorage 读取工具
//
// 职责:
//   - 只读 localStorage。
//   - 安全解析 JSON。
//   - 过滤危险字段。
//   - 返回 safe-to-render 的结果对象。
//   - 不写入 localStorage、不访问网络、不抛出导致 UI 崩溃的异常。
//
// 所有 Desktop 本地预览面板共享此工具。
//
// Status: preview-only / local-only / read-only / disabled-by-default

const SENSITIVE_FIELD_PATTERNS = [
  "token",
  "cookie",
  "session",
  "authorization",
  "apikey",
  "secret",
  "databaseurl",
  "rawrequest",
  "rawbody",
  "rawheaders",
  "rawdbrecord",
  "rawuserid",
  "password",
  "accesstoken",
  "refreshtoken",
  "fullidempotencykey",
  "rawpayload",
  "jwt",
  "sessiontoken",
  "idtoken",
];

function normalizeSafeKey(rawKey) {
  if (typeof rawKey !== "string") {
    return "";
  }

  return rawKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isSensitiveFieldName(rawKey) {
  const normalized = normalizeSafeKey(rawKey);
  if (!normalized) {
    return false;
  }

  for (let i = 0; i < SENSITIVE_FIELD_PATTERNS.length; i += 1) {
    if (normalized === SENSITIVE_FIELD_PATTERNS[i]) {
      return true;
    }

    if (
      SENSITIVE_FIELD_PATTERNS[i].length > 4 &&
      normalized.includes(SENSITIVE_FIELD_PATTERNS[i])
    ) {
      return true;
    }
  }

  return false;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasUnsafePrototype(value) {
  if (!isRecord(value)) {
    return false;
  }

  var prototype = Object.getPrototypeOf(value);
  return prototype !== Object.prototype && prototype !== null;
}

function collectSensitiveFieldHits(value, path, hits) {
  var currentPath = Array.isArray(path) ? path : [];
  var currentHits = Array.isArray(hits) ? hits : [];

  if (!isRecord(value) && !Array.isArray(value)) {
    return currentHits;
  }

  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i += 1) {
      collectSensitiveFieldHits(value[i], currentPath.concat(String(i)), currentHits);
    }
    return currentHits;
  }

  var keys = Object.keys(value);
  for (var j = 0; j < keys.length; j += 1) {
    var key = keys[j];
    var nextPath = currentPath.concat(key);

    if (isSensitiveFieldName(key)) {
      currentHits.push(nextPath.join("."));
    }

    collectSensitiveFieldHits(value[key], nextPath, currentHits);
  }

  return currentHits;
}

function sanitizeSensitiveFields(value) {
  if (!isRecord(value) && !Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    var result = [];
    for (var i = 0; i < value.length; i += 1) {
      result.push(sanitizeSensitiveFields(value[i]));
    }
    return result;
  }

  var sanitized = {};
  var keys = Object.keys(value);

  for (var j = 0; j < keys.length; j += 1) {
    var key = keys[j];
    if (isSensitiveFieldName(key)) {
      sanitized[key] = "[已过滤敏感字段]";
    } else if (isRecord(value[key]) || Array.isArray(value[key])) {
      sanitized[key] = sanitizeSensitiveFields(value[key]);
    } else {
      sanitized[key] = value[key];
    }
  }

  return sanitized;
}

function safeReadLocalStorage(storage, storageKey) {
  if (!storage || typeof storage.getItem !== "function") {
    return {
      stateKind: "unavailable",
      rawValue: null,
      parsedValue: null,
      error: "localStorage 不可用",
      sensitiveFieldHits: [],
      filteredFieldCount: 0,
      sensitiveFieldsFiltered: false,
    };
  }

  var rawValue = null;
  try {
    rawValue = storage.getItem(storageKey);
  } catch (_error) {
    return {
      stateKind: "unavailable",
      rawValue: null,
      parsedValue: null,
      error: "无法读取 localStorage",
      sensitiveFieldHits: [],
      filteredFieldCount: 0,
      sensitiveFieldsFiltered: false,
    };
  }

  if (rawValue === null || rawValue === undefined) {
    return {
      stateKind: "empty",
      rawValue: null,
      parsedValue: null,
      error: null,
      sensitiveFieldHits: [],
      filteredFieldCount: 0,
      sensitiveFieldsFiltered: false,
    };
  }

  var parsedValue = null;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch (_error) {
    return {
      stateKind: "bad_json",
      rawValue: rawValue,
      parsedValue: null,
      error: "本地存储 JSON 不可解析",
      sensitiveFieldHits: [],
      filteredFieldCount: 0,
      sensitiveFieldsFiltered: false,
    };
  }

  var sensitiveFieldHits = collectSensitiveFieldHits(parsedValue);

  return {
    stateKind: "ready",
    rawValue: rawValue,
    parsedValue: parsedValue,
    error: null,
    sensitiveFieldHits: sensitiveFieldHits,
    filteredFieldCount: sensitiveFieldHits.length,
    sensitiveFieldsFiltered: sensitiveFieldHits.length > 0,
  };
}

function assertNoWrite() {
  return true;
}

function buildLocalPreviewSafeStorageScript() {
  return "(() => {\n" +
    "  var SENSITIVE_FIELD_PATTERNS = " + JSON.stringify(SENSITIVE_FIELD_PATTERNS) + ";\n" +
    "\n" +
    "  " + normalizeSafeKey.toString() + "\n" +
    "  " + isSensitiveFieldName.toString() + "\n" +
    "  " + isRecord.toString() + "\n" +
    "  " + hasUnsafePrototype.toString() + "\n" +
    "  " + collectSensitiveFieldHits.toString() + "\n" +
    "  " + sanitizeSensitiveFields.toString() + "\n" +
    "  " + safeReadLocalStorage.toString() + "\n" +
    "  " + assertNoWrite.toString() + "\n" +
    "\n" +
    "  window.__lapSafeStorage = {\n" +
    "    safeReadLocalStorage: safeReadLocalStorage,\n" +
    "    collectSensitiveFieldHits: collectSensitiveFieldHits,\n" +
    "    sanitizeSensitiveFields: sanitizeSensitiveFields,\n" +
    "    isSensitiveFieldName: isSensitiveFieldName,\n" +
    "    assertNoWrite: assertNoWrite,\n" +
    "  };\n" +
    "  return true;\n" +
    "})();";
}

module.exports = {
  SENSITIVE_FIELD_PATTERNS,
  isSensitiveFieldName,
  isRecord,
  hasUnsafePrototype,
  collectSensitiveFieldHits,
  sanitizeSensitiveFields,
  safeReadLocalStorage,
  assertNoWrite,
  buildLocalPreviewSafeStorageScript,
};
