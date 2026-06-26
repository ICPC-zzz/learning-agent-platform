import * as ctx from "./web-ai-context-builder.ts";

var GREEN = "\x1b[32m";
var RED = "\x1b[31m";
var RESET = "\x1b[0m";

var passed = 0;
var failed = 0;
var failures = [];

function assert(condition, label) {
  if (condition) { passed++; console.log(GREEN + "  PASS" + RESET + " " + label); }
  else { failed++; var msg = "FAIL: " + label; failures.push(msg); console.log(RED + "  " + msg + RESET); }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) { passed++; console.log(GREEN + "  PASS" + RESET + " " + label); }
  else { failed++; var msg = "FAIL: " + label + " - expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual); failures.push(msg); console.log(RED + "  " + msg + RESET); }
}

// Intent detection
assertEqual(ctx.detectIntent("总结本章内容", "reader"), "summarizeCurrentBook", "reader+总结");
assertEqual(ctx.detectIntent("解释这道题目", "problemDetail"), "explainCurrentProblem", "problem+解释");
assertEqual(ctx.detectIntent("建议下一步学习什么", "user"), "suggestNextLearningStep", "user+建议");
assertEqual(ctx.detectIntent("已导入的内容有哪些", "import"), "findImportedContent", "import+导入");
assertEqual(ctx.detectIntent("解释当前页面", "home"), "explainCurrentPage", "home+解释");
assertEqual(ctx.detectIntent("你好", "home"), "generalQuestion", "home+你好");
assertEqual(ctx.detectIntent("这本书讲了什么", "bookDetail"), "summarizeCurrentBook", "bookDetail+书");

// Empty question blocked
var r0 = ctx.buildWebAiPageContext({ currentPath: "/", pageTitle: "Home", pageType: "home" }, "");
assertEqual(r0.context, null, "empty q: null");
assert(r0.blockedReason !== null, "empty q: has reason");

// Too-long question blocked
var r0b = ctx.buildWebAiPageContext({ currentPath: "/", pageTitle: "Home", pageType: "home" }, "x".repeat(2000));
assertEqual(r0b.context, null, "long q: null");

// Home page context
var r1 = ctx.buildWebAiPageContext({ currentPath: "/", pageTitle: "首页", pageType: "home" }, "如何开始？");
assert(r1.context !== null, "home: built");
assertEqual(r1.context.pageType, "home", "home: pageType");
assertEqual(r1.context.currentPath, "/", "home: path");
assert(r1.context.safePromptPreview.includes("首页"), "home: includes title");

// Reader page context
var r2 = ctx.buildWebAiPageContext({
  currentPath: "/reader", pageTitle: "阅读器", pageType: "reader",
  bookTitle: "JS Guide", chapterTitle: "Functions",
  chapterExcerpt: "Functions are...", codeBlockCount: 3,
}, "解释作用域");
assert(r2.context !== null, "reader: built");
assert(r2.context.safePromptPreview.includes("JS Guide"), "reader: book");

// Problem page context
var r3 = ctx.buildWebAiPageContext({
  currentPath: "/problems/1", pageTitle: "题目", pageType: "problemDetail",
  problemTitle: "两数之和", problemDifficulty: "easy",
  problemTags: ["数组"], problemStatementPreview: "给定...",
}, "如何优化？");
assert(r3.context !== null, "problem: built");
assert(r3.context.safePromptPreview.includes("两数之和"), "problem: title");

// User data summary
var ud = ctx.buildUserDataSummary({ dbAvailable: true, importedBookCount: 5, importedProblemCount: 20, recentReadingSummary: "reading", learningStatsSummary: "15 done" });
var r4 = ctx.buildWebAiPageContext({ currentPath: "/user", pageTitle: "用户中心", pageType: "user" }, "进度？", ud);
assert(r4.context !== null, "user+data: built");
assert(r4.context.safePromptPreview.includes("5"), "user: book count");

// Sensitive redaction
var r5 = ctx.buildWebAiPageContext({ currentPath: "/", pageTitle: "首页", pageType: "home", visibleSummary: "DATABASE_URL=postgres://user:pass@host/db" }, "测试");
assert(r5.context !== null, "sensitive: built");
assert(!r5.context.safePromptPreview.includes("postgres"), "sensitive: redacted");
assert(r5.context.sensitiveFieldsDetected, "sensitive: detected");

// API key redaction
var r6 = ctx.buildWebAiPageContext({ currentPath: "/", pageTitle: "首页", pageType: "home", visibleSummary: "api_key=abc123" }, "测试");
assert(r6.context !== null, "apikey: built");
assert(!r6.context.safePromptPreview.includes("abc123"), "apikey: redacted");

// charCounts
var r7 = ctx.buildWebAiPageContext({ currentPath: "/", pageTitle: "Home", pageType: "home" }, "Hello");
assert(r7.context !== null, "basic: built");
assert(r7.context.charCounts.totalInput > 0, "basic: totalInput>0");
assert(r7.context.charCounts.totalInput <= 8000, "basic: totalInput<=8000");

// Empty summary
var es = ctx.buildEmptyUserDataSummary();
assertEqual(es.importedBookCount, 0, "empty: 0 books");
assertEqual(es.dbAvailable, false, "empty: db false");

console.log("\n" + (passed + failed) + " tests: " + GREEN + passed + " passed" + RESET + (failed ? ", " + RED + failed + " failed" + RESET : ""));
if (failures.length > 0) {
  console.log("\nFailures:");
  failures.forEach(function (f) { console.log("  " + RED + f + RESET); });
  process.exit(1);
}
