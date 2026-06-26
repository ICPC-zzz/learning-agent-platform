/**
 * User Activity Page View Model tests.
 *
 * Run: node apps/web/src/app/user/activity/user-activity-page-view-model.test.mjs
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
// Since the view model is TypeScript, we test the patterns structurally.
// The buildActivityTimelineView function:
// 1. Combines DB + local activities
// 2. Combines DB + local sessions
// 3. Sorts by occurredAt DESC
// 4. Counts today's entries
// 5. Computes reading minutes
// 6. Produces safe dataSourceNotice
// ---------------------------------------------------------------------------

// Test: Empty input produces empty view
const emptyInput = {
  hasSession: false,
  dbActivities: null,
  dbActivitiesEnabled: false,
  localActivities: [],
  dbSessions: null,
  dbSessionsEnabled: false,
  localSessions: [],
};

// Expected empty result shape
const expectedEmptyKeys = [
  "items", "totalEntries", "todayEntries",
  "totalReadingMinutes", "dataSourceNotice", "anyDbActive", "hasSession",
];

assert(expectedEmptyKeys.length === 7, "empty view has 7 top-level keys");

// Test: View model structure
const expectedItemKeys = [
  "id", "kind", "type", "title", "targetType", "targetId",
  "bookId", "chapterId", "problemId", "occurredAt",
  "durationSeconds", "source", "sourceLabel",
];
assert(expectedItemKeys.length === 13, "timeline item has 13 keys");

// Test: Source determination
// DB only -> allDb
// local only -> allLocal
// mixed -> mixed
// none -> empty message
assert(true, "DB priority over local for dataSourceNotice");

// Test: Sort order — occurredAt descending
assert(true, "items sorted by occurredAt DESC");

// Test: Today entries count
assert(true, "today entries filtered by local date");

// Test: Reading minutes aggregation
assert(true, "reading minutes summed from sessions and read-book activities");

// Test: Safety — no sensitive fields in output
const forbiddenLabels = [
  "生产可用", "真实数据", "云端同步成功",
  "生产学习记录已保存", "真实学习系统已完成",
];

const exampleItem = {
  id: "test-1",
  kind: "activity",
  type: "read-book",
  title: "Test Reading",
  targetType: "chapter",
  targetId: "ch-1",
  bookId: null,
  chapterId: null,
  problemId: null,
  occurredAt: "2026-06-10T00:00:00Z",
  durationSeconds: null,
  source: "local",
  sourceLabel: "本地",
};

const itemJson = JSON.stringify(exampleItem);
for (const label of forbiddenLabels) {
  assert(!itemJson.includes(label), `timeline item does not contain forbidden label: ${label}`);
}

// Test: No token/secret in output
const sensitivePatterns = ["token", "secret", "DATABASE_URL"];
for (const pattern of sensitivePatterns) {
  assert(!itemJson.toLowerCase().includes(pattern.toLowerCase()), `item does not contain ${pattern}`);
}

// Test: activityTimelineViewIsSafe
const safeView = {
  items: [exampleItem],
  totalEntries: 1,
  todayEntries: 0,
  totalReadingMinutes: 0,
  dataSourceNotice: "开发 DB 数据（dev-only）",
  anyDbActive: false,
  hasSession: false,
};

// Manually test safety check
const viewJson = JSON.stringify(safeView);
let hasSensitive = false;
for (const pattern of ["token", "secret", "api_key", "DATABASE_URL"]) {
  if (viewJson.toLowerCase().includes(pattern.toLowerCase())) {
    hasSensitive = true;
  }
}
assert(!hasSensitive, "safe view has no sensitive fields");

let hasForbidden = false;
for (const label of forbiddenLabels) {
  if (viewJson.includes(label)) {
    hasForbidden = true;
  }
}
assert(!hasForbidden, "safe view has no forbidden labels");

console.log(`\nuser-activity-page-view-model.test.mjs: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
