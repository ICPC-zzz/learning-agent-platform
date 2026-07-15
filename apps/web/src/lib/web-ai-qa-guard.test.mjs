import * as guard from "./web-ai-qa-guard.ts";

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

function allEnv() {
  return {
    NODE_ENV: "development",
    LAP_WEB_LLM_QA_DEV_ENABLED: "true",
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true",
    LAP_LLM_DEV_ENDPOINT: "https://dev-llm.example.com/v1",
    LAP_LLM_DEV_API_KEY: "sk-test-key",
    LAP_LLM_DEV_MODEL: "test-model-v1",
  };
}

// Test 1: empty env -> blocked
var r1 = guard.evaluateWebAiQaGuard({});
assertEqual(r1.mode, "blocked", "empty env: mode=blocked");
assertEqual(r1.allowed, false, "empty env: allowed=false");
assertEqual(r1.devOnly, true, "empty env: devOnly=true");
assertEqual(r1.productionReady, false, "empty env: productionReady=false");
assert(r1.blockedReasons.length > 0, "empty env: has blockedReasons");
assert(r1.missingEnvKeys.length > 0, "empty env: has missingEnvKeys");

// Test 2: full env -> external_dev
var r2 = guard.evaluateWebAiQaGuard(allEnv());
assertEqual(r2.mode, "external_dev", "full env: mode=external_dev");
assertEqual(r2.allowed, true, "full env: allowed=true");
assertEqual(r2.allowExternalDev, true, "full env: allowExternalDev=true");
assertEqual(r2.blockedReasons.length, 0, "full env: no blockedReasons");

// Test 3: WEB_QA disabled
var r3 = guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "false", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "m" });
assertEqual(r3.mode, "blocked", "WEB_QA=false: blocked");
assert(r3.blockedReasons.includes("web_llm_qa_dev_disabled"), "includes web_llm_qa_dev_disabled");

// Test 4: external provider disabled
var r4 = guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "true", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "false", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "m" });
assertEqual(r4.mode, "blocked", "ALLOW_EXTERNAL=false: blocked");

// Test 5: no endpoint
var r5 = guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "true", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "m" });
assertEqual(r5.mode, "blocked", "empty endpoint: blocked");

// Test 6: no auth
var r6 = guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "true", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "", LAP_LLM_DEV_APIPassword: "", LAP_LLM_DEV_MODEL: "m" });
assertEqual(r6.mode, "blocked", "no auth: blocked");

// Test 7: no model
var r7 = guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "true", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "" });
assertEqual(r7.mode, "blocked", "empty model: blocked");

// Test 8: production
var r8 = guard.evaluateWebAiQaGuard({ NODE_ENV: "production", LAP_WEB_LLM_QA_DEV_ENABLED: "true", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "m" });
assertEqual(r8.mode, "blocked", "production: blocked");
assert(r8.blockedReasons.includes("production_only"), "includes production_only");

// Test 8b: production requires both explicit production opt-ins
var productionEnv = {
  NODE_ENV: "production",
  LAP_ASSISTANT_ENABLED: "true",
  LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED: "true",
  LAP_LLM_ENABLED: "true",
  LAP_LLM_PROVIDER: "openai-compatible",
  LAP_LLM_BASE_URL: "https://provider.example.com/v1",
  LAP_LLM_API_KEY: "k",
  LAP_LLM_MODEL: "m",
};
var r8b = guard.evaluateWebAiQaGuard({
  ...productionEnv,
  LAP_ALLOW_REAL_LLM: "true",
});
assertEqual(r8b.mode, "blocked", "production missing web opt-in: blocked");
assert(r8b.blockedReasons.includes("production_only"), "production missing web opt-in: reason");

var r8c = guard.evaluateWebAiQaGuard({
  ...productionEnv,
  LAP_ALLOW_PRODUCTION_WEB_AI: "true",
});
assertEqual(r8c.mode, "blocked", "production missing real-LLM opt-in: blocked");
assert(r8c.blockedReasons.includes("production_only"), "production missing real-LLM opt-in: reason");

var r8d = guard.evaluateWebAiQaGuard({
  ...productionEnv,
  LAP_ALLOW_PRODUCTION_WEB_AI: "true",
  LAP_ALLOW_REAL_LLM: "true",
});
assertEqual(r8d.mode, "external_production", "production double opt-in: external_production");
assertEqual(r8d.allowed, true, "production double opt-in: allowed");
assertEqual(r8d.devOnly, false, "production double opt-in: devOnly=false");
assertEqual(r8d.productionReady, true, "production double opt-in: productionReady=true");

var r8e = guard.evaluateWebAiQaGuard({
  ...productionEnv,
  LAP_LLM_ENABLED: "false",
  LAP_ALLOW_PRODUCTION_WEB_AI: "true",
  LAP_ALLOW_REAL_LLM: "true",
});
assertEqual(r8e.mode, "blocked", "production global LLM switch off: blocked");
assert(r8e.blockedReasons.includes("llm_disabled"), "production global LLM switch off: reason");

assert(/[\u3400-\u9fff]/u.test(r8b.notice), "production blocked notice is Chinese");
assert(!/NODE_ENV|dev guard|LAP_/iu.test(r8b.notice), "production blocked notice hides internals");

// Test 9: APIPassword as auth
var r9 = guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "true", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "", LAP_LLM_DEV_APIPassword: "pw", LAP_LLM_DEV_MODEL: "m" });
assertEqual(r9.mode, "external_dev", "APIPassword: external_dev");

// Test 10: READER fallback
var r10 = guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: undefined, LAP_READER_AI_QA_DEV_ENABLED: "true", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "m" });
assertEqual(r10.mode, "external_dev", "READER fallback: external_dev");

// Test 11: boolean-like env
assertEqual(guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "1", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "m" }).allowed, true, "1: allowed");
assertEqual(guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "yes", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "m" }).allowed, true, "yes: allowed");
assertEqual(guard.evaluateWebAiQaGuard({ NODE_ENV: "development", LAP_WEB_LLM_QA_DEV_ENABLED: "0", LAP_ALLOW_EXTERNAL_LLM_PROVIDER: "true", LAP_LLM_DEV_ENDPOINT: "https://ep", LAP_LLM_DEV_API_KEY: "k", LAP_LLM_DEV_MODEL: "m" }).mode, "blocked", "0: blocked");

// Test 12: devOnly / productionReady
var blocked = guard.evaluateWebAiQaGuard({});
assertEqual(blocked.devOnly, true, "blocked: devOnly=true");
assertEqual(blocked.productionReady, false, "blocked: productionReady=false");
var allowed = guard.evaluateWebAiQaGuard(allEnv());
assertEqual(allowed.devOnly, true, "allowed: devOnly=true");
assertEqual(allowed.productionReady, false, "allowed: productionReady=false");

// Test 13: notice is safe
var rn = guard.evaluateWebAiQaGuard({});
assert(rn.notice.length > 0, "notice has text");
assert(!rn.notice.includes("sk-test"), "notice no key value");

console.log("\n" + (passed + failed) + " tests: " + GREEN + passed + " passed" + RESET + (failed ? ", " + RED + failed + " failed" + RESET : ""));
if (failures.length > 0) {
  console.log("\nFailures:");
  failures.forEach(function (f) { console.log("  " + RED + f + RESET); });
  process.exit(1);
}
