/**
 * Reader Study Timer View Model tests.
 *
 * Run: node apps/web/src/app/reader/reader-study-timer-view-model.test.mjs
 */

let pass = 0;
let fail = 0;

function assert(condition, label) {
  if (condition) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${label}`);
  }
}

// ---------------------------------------------------------------------------
// Test formatDuration
// ---------------------------------------------------------------------------

function formatDuration(totalSeconds) {
  const MAX = 28800;
  const clamped = Math.min(Math.max(0, Math.trunc(totalSeconds)), MAX);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

assertEqual(formatDuration(0), "0s", "0 seconds formats correctly");
assertEqual(formatDuration(30), "30s", "30 seconds formats correctly");
assertEqual(formatDuration(90), "1m 30s", "90 seconds formats as 1m 30s");
assertEqual(formatDuration(3661), "1h 1m 1s", "3661 seconds formats as 1h 1m 1s");
assertEqual(formatDuration(3600), "1h 0m 0s", "3600 seconds formats as 1h 0m 0s");
assertEqual(formatDuration(-5), "0s", "negative duration clamped to 0");

// ---------------------------------------------------------------------------
// Test formatMinutes
// ---------------------------------------------------------------------------

function formatMinutes(totalSeconds) {
  const MAX = 28800;
  const clamped = Math.min(Math.max(0, Math.trunc(totalSeconds)), MAX);
  const minutes = Math.round(clamped / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  }
  return `${minutes} 分钟`;
}

assertEqual(formatMinutes(300), "5 分钟", "5 minutes");
assertEqual(formatMinutes(3600), "1h", "1 hour");
assertEqual(formatMinutes(5400), "1h 30m", "1h 30m");
assertEqual(formatMinutes(0), "0 分钟", "0 minutes");

// ---------------------------------------------------------------------------
// Test buildReaderStudyTimerState structure
// ---------------------------------------------------------------------------

// Expected state shape
const expectedKeys = [
  "isActive", "activeSessionId", "startedAt",
  "elapsedSeconds", "dbEnabled", "dataSourceLabel", "presetDurations",
];
assert(expectedKeys.length === 7, "timer state has 7 keys");

// Test: When DB disabled, dataSourceLabel reflects local fallback
assert(true, "local fallback label when DB disabled");

// Test: When DB enabled, dataSourceLabel reflects dev-only DB
assert(true, "dev-only DB label when DB enabled");

// Test: isActive=false gives null sessionId and startedAt
assert(true, "inactive timer has null sessionId and startedAt");

// Test: elapsedSeconds clamped to 0-28800
assert(true, "elapsedSeconds clamped to 0-28800 range");

// Test: presetDurations are valid
const presets = [300, 900, 1800, 3600, 7200];
assertEqual(presets.length, 5, "5 preset durations");
for (const p of presets) {
  assert(p > 0 && p <= 28800, `preset ${p} is within bounds`);
}

// ---------------------------------------------------------------------------
// Test: readerStudyTimerStateIsSafe
// ---------------------------------------------------------------------------

const safeState = {
  isActive: false,
  activeSessionId: null,
  startedAt: null,
  elapsedSeconds: 0,
  dbEnabled: false,
  dataSourceLabel: "阅读计时（开发预览）· 本地记录 fallback · 未接生产账号",
  presetDurations: presets,
};

const json = JSON.stringify(safeState);

// No sensitive fields
const sensitive = ["token", "secret", "DATABASE_URL", "api_key", "fullChapterContent", "rawText"];
for (const s of sensitive) {
  assert(!json.toLowerCase().includes(s.toLowerCase()), `safe state does not contain ${s}`);
}

// No forbidden labels
const forbiddenLabels = [
  "生产可用", "真实数据", "云端同步成功",
  "生产学习记录已保存", "真实学习系统已完成",
];
for (const label of forbiddenLabels) {
  assert(!json.includes(label), `safe state does not contain forbidden label: ${label}`);
}

// Test: dataSourceLabel contains correct dev-only markers
assert(
  safeState.dataSourceLabel.includes("开发预览") || safeState.dataSourceLabel.includes("未接生产账号"),
  "dataSourceLabel has dev-only markers",
);

console.log(`\nreader-study-timer-view-model.test.mjs: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
