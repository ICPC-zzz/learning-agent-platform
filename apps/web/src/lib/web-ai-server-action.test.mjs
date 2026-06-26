import * as sa from "./web-ai-server-action.ts";

var GREEN = "\x1b[32m";
var RED = "\x1b[31m";
var YELLOW = "\x1b[33m";
var RESET = "\x1b[0m";

var passed = 0;
var failed = 0;
var skipped = 0;
var failures = [];

function assert(condition, label) {
  if (condition) { passed++; console.log(GREEN + "  PASS" + RESET + " " + label); }
  else { failed++; var m = "FAIL: " + label; failures.push(m); console.log(RED + "  " + m + RESET); }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) { passed++; console.log(GREEN + "  PASS" + RESET + " " + label); }
  else { failed++; var m = "FAIL: " + label + " - expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual); failures.push(m); console.log(RED + "  " + m + RESET); }
}

function allEnv() {
  return { NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "true", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://dev-llm.example.com/v1/chat/completions", LAP_LLM_DEV_API_KEY: "sk-test-key", LAP_LLM_DEV_MODEL: "test-model-v1" };
}

function emptyEnv() { return {}; }

function fakeFetch() {
  return async function () {
    return { ok: true, status: 200, text: async function () { return JSON.stringify({ choices: [{ message: { content: "fake answer" } }] }); } };
  };
}

async function doTests() {

try {
  var r1 = await sa.webAiServerAction({ question: "", pageContext: { currentPath: "/", pageTitle: "Home", pageType: "home" } });
  assertEqual(r1.success, false, "empty q success=false");
  assertEqual(r1.providerMode, "blocked", "empty q blocked");
} catch (e) { failed++; console.log(RED + "  FAIL empty q: " + e.message + RESET); }

try {
  var r2 = await sa.webAiServerAction({ question: "x".repeat(2000), pageContext: { currentPath: "/", pageTitle: "Home", pageType: "home" } });
  assertEqual(r2.success, false, "long q success=false");
} catch (e) { failed++; console.log(RED + "  FAIL long q: " + e.message + RESET); }

try {
  var r3 = await sa.webAiServerAction({ question: "what is JS?", pageContext: { currentPath: "/", pageTitle: "Home", pageType: "home" } }, emptyEnv());
  assertEqual(r3.success, false, "empty env success=false");
  assertEqual(r3.providerMode, "blocked", "empty env blocked");
  assertEqual(r3.realProviderCalled, false, "empty env realProviderCalled=false");
} catch (e) { failed++; console.log(RED + "  FAIL test3: " + e.message + RESET); }

try {
  var r4 = await sa.webAiServerAction({ question: "what is JS?", pageContext: { currentPath: "/books", pageTitle: "books", pageType: "books" } }, allEnv(), fakeFetch());
  assertEqual(r4.success, true, "fake success=true");
  assertEqual(r4.providerMode, "external-dev-preview", "fake ext-dev-preview");
  assertEqual(r4.realProviderCalled, true, "fake realProviderCalled=true");
} catch (e) { failed++; console.log(RED + "  FAIL test4: " + e.message + RESET); }

try {
  var r5 = await sa.webAiServerAction({ question: "test", pageContext: { currentPath: "/", pageTitle: "Home", pageType: "home" } }, allEnv(), fakeFetch());
  assertEqual(r5.devOnly, true, "devOnly=true");
  assertEqual(r5.productionReady, false, "productionReady=false");
} catch (e) { failed++; console.log(RED + "  FAIL test5: " + e.message + RESET); }

try {
  var r6 = await sa.webAiServerAction({ question: "总结本章", pageContext: { currentPath: "/reader", pageTitle: "reader", pageType: "reader", bookTitle: "T", chapterTitle: "C" } }, allEnv(), fakeFetch());
  assertEqual(r6.detectedIntent, "summarizeCurrentBook", "reader intent");
} catch (e) { failed++; console.log(RED + "  FAIL test6: " + e.message + RESET); }

try {
  var r7 = await sa.webAiServerAction({ question: "test", pageContext: { currentPath: "/", pageTitle: "Home", pageType: "home" } }, emptyEnv());
  var out = r7.answerPreview + r7.warnings.join(" ");
  assert(!out.includes("sk-test"), "no sk-test");
} catch (e) { failed++; console.log(RED + "  FAIL test7: " + e.message + RESET); }

try {
  var r8 = await sa.webAiServerAction({ question: "test", pageContext: { currentPath: "/user", pageTitle: "user", pageType: "user" } }, allEnv(), fakeFetch());
  assert(typeof r8.safeToExposeToClient.guardMode === "string", "guardMode string");
  assert(typeof r8.safeToExposeToClient.pageType === "string", "pageType string");
  assert(Array.isArray(r8.safeToExposeToClient.missingEnvKeys), "missingEnvKeys array");
} catch (e) { failed++; console.log(RED + "  FAIL test8: " + e.message + RESET); }

try {
  var r9 = await sa.webAiServerAction({ question: "test", pageContext: { currentPath: "/", pageTitle: "Home", pageType: "home" } }, emptyEnv());
  var keys = r9.safeToExposeToClient.missingEnvKeys;
  assert(keys.length > 0, "blocked has missing keys");
  for (var i = 0; i < keys.length; i++) {
    assert(keys[i].includes("LAP_"), "key is env name: " + keys[i]);
  }
} catch (e) { failed++; console.log(RED + "  FAIL test9: " + e.message + RESET); }

var total = passed + failed + skipped;
console.log("\n" + total + " tests: " + GREEN + passed + " passed" + RESET + (failed ? ", " + RED + failed + " failed" + RESET : "") + (skipped ? ", " + YELLOW + skipped + " skipped" + RESET : ""));
if (failures.length > 0) {
  console.log("\nFailures:");
  failures.forEach(function (f) { console.log("  " + RED + f + RESET); });
  process.exitCode = 1;
}
}

doTests().catch(function (e) { console.error(RED + "TOP ERROR: " + e.message + RESET); process.exitCode = 1; });
