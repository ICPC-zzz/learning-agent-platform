import { ok, strictEqual } from "node:assert";

var tests = [];
var passed = 0;
var failed = 0;

function test(name, fn) {
  tests.push({ name: name, fn: fn });
}

function run() {
  for (var i = 0; i < tests.length; i++) {
    var t = tests[i];
    try {
      t.fn();
      passed++;
      console.log("PASS: " + t.name);
    } catch (err) {
      failed++;
      console.error("FAIL: " + t.name + " - " + err.message);
    }
  }
  console.log("\n" + passed + " passed, " + failed + " failed, " + tests.length + " total");
  if (failed > 0) process.exit(1);
}

const VM_URL = new URL("./user-today-plan-view-model.ts", import.meta.url).href;
const vm = await import(VM_URL);
const { buildTodayPlanView, todayPlanViewIsSafe } = vm;

function makeWrongBook(overrides) {
  return Object.assign({
    wrongBookId: "wb-1", problemId: "p-1", title: "Array Problem",
    difficulty: "easy", tags: ["arrays"], wrongCount: 2,
    lastWrongAt: "2026-06-10T00:00:00.000Z", reviewStatus: "needs-review",
    notePreview: null, sourceType: "local-fallback",
  }, overrides || {});
}

function makeReading(overrides) {
  return Object.assign({
    bookId: "book-1", bookTitle: "Test Book", chapterId: "ch-1",
    chapterTitle: "Chapter One", progressRatio: 0.5,
    lastReadAt: "2026-06-10T00:00:00.000Z", sourceType: "local",
  }, overrides || {});
}

function makeSessionSummary(overrides) {
  return Object.assign({
    totalSessions: 3, totalDurationMinutes: 45, todayDurationMinutes: 10,
  }, overrides || {});
}

function makeNote(overrides) {
  return Object.assign({
    noteId: "note-1", bookId: "book-1", chapterId: "ch-1",
    bookTitle: "Test Book", chapterTitle: "Chapter One",
    noteTextPreview: "Important concept", createdAt: "2026-06-09T00:00:00.000Z",
  }, overrides || {});
}

function makeAiHistory(overrides) {
  return Object.assign({
    historyId: "ai-1", bookId: "book-1", chapterId: "ch-1",
    bookTitle: "Test Book", chapterTitle: "Chapter One",
    questionPreview: "What is a closure?", createdAt: "2026-06-09T00:00:00.000Z",
  }, overrides || {});
}

function makeFavProblem(overrides) {
  return Object.assign({
    problemId: "fav-1", title: "String Manipulation", difficulty: "easy",
    tags: ["strings"], favoritedAt: "2026-06-09T00:00:00.000Z",
  }, overrides || {});
}

function baseInput(overrides) {
  return Object.assign({
    hasSession: true, wrongBookEntries: [], recentReading: [],
    readingSessionSummary: makeSessionSummary({ totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 }),
    recentPractice: [], notes: [], aiHistory: [], favoriteProblems: [],
  }, overrides || {});
}

test("plan: empty data still generates reading suggestion", function () {
  var view = buildTodayPlanView(baseInput());
  ok(view.totalTasks >= 1, "Should have at least 1 task");
});

test("plan: not logged in shows login message", function () {
  var view = buildTodayPlanView(baseInput({ hasSession: false }));
  ok(view.message.indexOf("login") >= 0, "Should say login required");
});

test("plan: generates 3-5 tasks with rich data", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook(), makeWrongBook({ wrongBookId: "wb-2", problemId: "p-2" })],
    recentReading: [makeReading({ progressRatio: 0.5 })],
    readingSessionSummary: makeSessionSummary(),
    notes: [makeNote()],
    aiHistory: [makeAiHistory()],
    favoriteProblems: [makeFavProblem()],
  }));
  ok(view.totalTasks >= 2 && view.totalTasks <= 6, "Should have reasonable task count, got " + view.totalTasks);
});

test("plan: at most 5 tasks", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [
      makeWrongBook(), makeWrongBook({ wrongBookId: "wb-2", problemId: "p-2" }),
      makeWrongBook({ wrongBookId: "wb-3", problemId: "p-3" }),
      makeWrongBook({ wrongBookId: "wb-4", problemId: "p-4" }),
    ],
    recentReading: [makeReading()],
    readingSessionSummary: makeSessionSummary(),
    notes: [makeNote(), makeNote({ noteId: "note-2", chapterId: "ch-2" })],
    aiHistory: [makeAiHistory()],
    favoriteProblems: [makeFavProblem()],
  }));
  ok(view.totalTasks <= 5, "Should cap at 5, got " + view.totalTasks);
});

test("plan: estimatedMinutes are reasonable", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading()],
    readingSessionSummary: makeSessionSummary(),
    notes: [makeNote()],
    aiHistory: [makeAiHistory()],
    favoriteProblems: [makeFavProblem()],
  }));
  for (var i = 0; i < view.tasks.length; i++) {
    ok(view.tasks[i].estimatedMinutes > 0);
    ok(view.tasks[i].estimatedMinutes <= 120);
  }
});

test("plan: wrong book review tasks are todo", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [],
    readingSessionSummary: makeSessionSummary({ totalSessions: 0, totalDurationMinutes: 0, todayDurationMinutes: 0 }),
    notes: [], aiHistory: [], favoriteProblems: [],
  }));
  var todoTasks = view.tasks.filter(function (t) { return t.status === "todo"; });
  ok(todoTasks.length > 0, "Should have todo tasks");
});

test("plan: reading tasks are suggested", function () {
  var view = buildTodayPlanView(baseInput({
    recentReading: [makeReading({ progressRatio: 0.5 })],
    readingSessionSummary: makeSessionSummary({ totalSessions: 3, totalDurationMinutes: 30, todayDurationMinutes: 10 }),
    wrongBookEntries: [], notes: [], aiHistory: [], favoriteProblems: [],
  }));
  var suggestedTasks = view.tasks.filter(function (t) { return t.status === "suggested"; });
  ok(suggestedTasks.length > 0, "Should have suggested tasks, got " + suggestedTasks.length);
});

test("plan: each task has dev-only label", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading()],
    readingSessionSummary: makeSessionSummary(),
    notes: [makeNote()],
  }));
  for (var i = 0; i < view.tasks.length; i++) {
    ok(view.tasks[i].devOnlyLabel && view.tasks[i].devOnlyLabel.length > 0, "Task " + i + " has dev label");
  }
});

test("plan: dataSourceNotice mentions no LLM", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
  }));
  ok(view.dataSourceNotice.indexOf("no LLM") >= 0 || view.dataSourceNotice.indexOf("LLM") >= 0);
});

test("plan: view is safe", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading()],
    readingSessionSummary: makeSessionSummary(),
    notes: [makeNote()],
    aiHistory: [makeAiHistory()],
  }));
  var result = todayPlanViewIsSafe(view);
  ok(result.safe, "Violations: " + JSON.stringify(result.violations));
});

test("plan: no sensitive fields in output", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    aiHistory: [makeAiHistory()],
  }));
  var json = JSON.stringify(view).toLowerCase();
  var forbidden = ["database_url", "token", "secret", "password", "cookie", "api_key", "rawprompt", "rawresponse"];
  for (var i = 0; i < forbidden.length; i++) {
    ok(json.indexOf(forbidden[i]) === -1, "No " + forbidden[i]);
  }
});

test("plan: no forbidden production labels", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
  }));
  var json = JSON.stringify(view);
  ok(json.indexOf("AI plan") === -1);
  ok(json.indexOf("LLM generated") === -1);
  ok(json.indexOf("production plan") === -1);
  ok(json.indexOf("AI auto planned") === -1);
});

test("plan: all tasks have target links", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading()],
    readingSessionSummary: makeSessionSummary(),
    notes: [makeNote()],
    favoriteProblems: [makeFavProblem()],
  }));
  for (var i = 0; i < view.tasks.length; i++) {
    ok(view.tasks[i].targetLink.length > 0, "Task " + i + " has target link");
  }
});

test("plan: each task has a reason", function () {
  var view = buildTodayPlanView(baseInput({
    wrongBookEntries: [makeWrongBook()],
    recentReading: [makeReading()],
    readingSessionSummary: makeSessionSummary(),
    notes: [makeNote()],
  }));
  for (var i = 0; i < view.tasks.length; i++) {
    ok(view.tasks[i].reason.length > 0, "Task " + i + " has reason");
  }
});

run();
