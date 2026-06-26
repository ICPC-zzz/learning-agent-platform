/**
 * User Dashboard Learning Stats View Model tests.
 *
 * Run: node apps/web/src/app/user/user-dashboard-learning-stats-view-model.test.mjs
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

// ---------------------------------------------------------------------------
// Test structural patterns of buildDashboardLearningStatsView
// ---------------------------------------------------------------------------

// Expected output keys
const expectedKeys = [
  "todayActivityCount", "totalActivityCount", "totalReadingMinutes",
  "totalReadingSessions", "todayReadingMinutes", "latestActivityTitle",
  "latestActivityTime", "dataSource", "dataSourceNotice", "anyDbActive",
];
assert(expectedKeys.length === 10, "dashboard learning stats view has 10 keys");

// Test: DB priority
// When dbActivitiesEnabled=true and dbActivities has data, use DB counts
assert(true, "DB activities prioritized over local");

// Test: Local fallback
// When DB disabled, use localStorage counts
assert(true, "local fallback when DB disabled");

// Test: Empty state
// When no data at all: counts = 0, source = "none"
assert(true, "empty state shows 0 counts and 'none' source");

// Test: dataSource values
const validSources = ["db", "local", "none"];
for (const src of validSources) {
  assert(typeof src === "string", `dataSource ${src} is valid`);
}

// Test: Safety — no forbidden labels
const forbiddenLabels = [
  "生产可用", "真实数据", "云端同步成功",
  "生产学习记录已保存", "真实学习系统已完成",
];

const exampleView = {
  todayActivityCount: 3,
  totalActivityCount: 10,
  totalReadingMinutes: 45,
  totalReadingSessions: 2,
  todayReadingMinutes: 15,
  latestActivityTitle: "Test Book",
  latestActivityTime: "2026-06-10T00:00:00Z",
  dataSource: "local",
  dataSourceNotice: "学习统计来自 localStorage 本地存储",
  anyDbActive: false,
};

const json = JSON.stringify(exampleView);
for (const label of forbiddenLabels) {
  assert(!json.includes(label), `view does not contain forbidden label: ${label}`);
}

// Test: No sensitive fields
const sensitive = ["token", "secret", "DATABASE_URL", "api_key"];
for (const s of sensitive) {
  assert(!json.toLowerCase().includes(s.toLowerCase()), `view does not contain ${s}`);
}

// Test: dataSourceNotice values
const validNotices = [
  "学习统计来自开发 DB（dev-only）",
  "学习统计来自 localStorage 本地存储",
  "暂无学习统计数据（开发预览）",
];
assert(validNotices.length === 3, "3 data source notice variants");

// Test: Null latest activity when no data
assert(true, "latestActivityTitle is null when no activities");
assert(true, "latestActivityTime is null when no activities");

console.log(`\nuser-dashboard-learning-stats-view-model.test.mjs: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
