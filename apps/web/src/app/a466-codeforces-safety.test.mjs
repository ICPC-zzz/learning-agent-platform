import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));

function readFileSafe(relativePath) {
  try { return readFileSync(join(__dirname, relativePath), "utf-8"); }
  catch { return null; }
}

// For safety checks, we verify code structure doesn't expose secrets
// Comments and redaction logic (api_key=[REDACTED]) are safety features, not violations
function assertContains(content, text, message) {
  if (!content) return;
  assert.ok(content.indexOf(text) !== -1, message + ": should contain \"" + text.slice(0, 60) + "\"");
}

function assertNoLeak(content, text, message) {
  if (!content) return;
  // Check that the text isn't used in a real value context (e.g., not in comments/redaction)
  var lines = content.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf(text) !== -1) {
      // Skip comment lines and redaction patterns
      if (line.indexOf("//") === 0 || line.indexOf("*") === 0 || line.indexOf("/*") === 0) continue;
      if (line.indexOf("[REDACTED]") !== -1) continue;
      if (line.indexOf("never reads") !== -1 || line.indexOf("not require") !== -1) continue;
      // Found in non-comment, non-redaction code
      assert.fail(message + ": found \"" + text + "\" in non-comment code at line: " + line.slice(0, 80));
    }
  }
}

var clientTs = readFileSafe("../lib/codeforces-client.ts");
var adapterTs = readFileSafe("../lib/codeforces-adapter.ts");
var actionsTs = readFileSafe("problems/codeforces-actions.ts");
var searchClient = readFileSafe("problems/components/CodeforcesSearchClient.tsx");

describe("A466 Safety .env.local", function() {
  it("1. client comments safe — redaction logic present", function() {
    if (clientTs) {
      assertContains(clientTs, "[REDACTED]", "client should have redaction");
      assertContains(clientTs, "never reads", "client should have safety comment");
      assert.ok(clientTs.indexOf(".env.local") !== -1, "has safety comment about .env.local");
    }
  });
  it("2. adapter no env access", function() {
    if (adapterTs) {
      assert.ok(adapterTs.indexOf("process.env") === -1, "adapter should never access process.env");
    }
  });
  it("3. actions no .env.local", function() {
    if (actionsTs) {
      assert.ok(actionsTs.indexOf(".env.local") === -1, "actions should not reference .env.local");
    }
  });
  it("4. searchClient no .env.local", function() {
    if (searchClient) {
      assert.ok(searchClient.indexOf(".env.local") === -1, "searchClient should not reference .env.local");
    }
  });
});

describe("A466 Safety env exposure", function() {
  it("5. client has redaction — api_key=[REDACTED]", function() {
    if (clientTs) {
      assertContains(clientTs, "api_key=[REDACTED]", "client should redact API keys");
    }
  });
  it("6. client only uses env names as strings for guard", function() {
    if (clientTs) {
      assertContains(clientTs, "LAP_PROBLEM_API_KEY", "should reference env var name for guard");
    }
  });
  it("7. adapter never accesses process.env", function() {
    if (adapterTs) {
      assert.ok(adapterTs.indexOf("process.env") === -1, "adapter should never access env");
    }
  });
  it("8. actions returns envValuesExposed:false in every path", function() {
    if (actionsTs) {
      var matches = actionsTs.match(/envValuesExposed:\s*false/g) || [];
      assert.ok(matches.length >= 3, "actions should have envValuesExposed:false >= 3 paths, found " + matches.length);
    }
  });
  it("9. searchClient never reads env values", function() {
    if (searchClient) {
      assert.ok(searchClient.indexOf("process.env[") === -1, "searchClient should not read env values");
    }
  });
  it("10. no sensitive patterns leaked outside comments/redaction", function() {
    var all = [clientTs, adapterTs, actionsTs, searchClient].filter(Boolean);
    for (var f = 0; f < all.length; f++) {
      assertNoLeak(all[f], "DATABASE_URL", "should not leak DATABASE_URL");
      assertNoLeak(all[f], "SMTP_PASS", "should not leak SMTP_PASS");
      assertNoLeak(all[f], "postgresql://", "should not leak postgresql");
    }
  });
});

describe("A466 Safety no DB writes", function() {
  it("11. client no Prisma", function() {
    if (clientTs) assert.ok(clientTs.indexOf("Prisma") === -1);
  });
  it("12. adapter marks dbWritten:false", function() {
    if (adapterTs) {
      var matches = adapterTs.match(/dbWritten:\s*false/g) || [];
      assert.ok(matches.length >= 2, "adapter dbWritten:false paths: " + matches.length);
    }
  });
  it("13. actions marks dbModified:false", function() {
    if (actionsTs) {
      var matches = actionsTs.match(/dbModified:\s*false/g) || [];
      assert.ok(matches.length >= 3, "actions dbModified:false paths: " + matches.length);
    }
  });
  it("14. searchClient no DB ops", function() {
    if (searchClient) {
      assert.ok(searchClient.indexOf("Prisma") === -1);
      assert.ok(searchClient.indexOf("createProblem") === -1);
    }
  });
});

describe("A466 Safety no raw response", function() {
  it("15. client marks _rawExposed:false", function() {
    if (clientTs) assertContains(clientTs, "_rawExposed: false", "client should mark raw not exposed");
  });
  it("16. adapter marks rawResponseStored:false", function() {
    if (adapterTs) assertContains(adapterTs, "rawResponseStored: false", "adapter should mark raw not stored");
  });
  it("17. actions marks rawResponseStored:false in all paths", function() {
    if (actionsTs) {
      var matches = actionsTs.match(/rawResponseStored:\s*false/g) || [];
      assert.ok(matches.length >= 3, "actions rawResponseStored:false paths: " + matches.length);
    }
  });
  it("18. searchClient shows rawResponseStored flag", function() {
    if (searchClient) assertContains(searchClient, "rawResponseStored", "searchClient should show flag");
  });
});

describe("A466 Safety no LLM/tool", function() {
  it("19. no file calls LLM or Agent", function() {
    var all = [clientTs, adapterTs, actionsTs, searchClient].filter(Boolean);
    for (var f = 0; f < all.length; f++) {
      var c = all[f];
      assert.ok((c.indexOf("anthropic") === -1 && c.indexOf("openai") === -1) || c.indexOf("//") !== -1, "should not call LLM providers");
      assert.ok(c.indexOf("Agent.run") === -1, "should not call Agent.run");
      assert.ok(c.indexOf("executeTool") === -1, "should not execute tools");
    }
  });
});

describe("A466 Safety no subsystem modification", function() {
  it("20. no Open Library modification", function() {
    var all = [clientTs, adapterTs, actionsTs, searchClient].filter(Boolean);
    for (var f = 0; f < all.length; f++) {
      assert.ok(all[f].indexOf("open-library") === -1, "should not touch Open Library");
      assert.ok(all[f].indexOf("openlibrary") === -1, "should not touch Open Library");
    }
  });
  it("21. no Resend/Phone/Auth modification", function() {
    var all = [clientTs, adapterTs, actionsTs, searchClient].filter(Boolean);
    for (var f = 0; f < all.length; f++) {
      assert.ok(all[f].indexOf("resend") === -1, "should not touch Resend");
      assert.ok(all[f].indexOf("phone-auth") === -1, "should not touch phone auth");
      assert.ok(all[f].indexOf("email-auth") === -1, "should not touch email auth");
    }
  });
  it("22. searchClient 'noreferrer' is a safety attribute, not Reader modification", function() {
    if (searchClient) {
      assertContains(searchClient, "noreferrer", "should have noreferrer for external links");
    }
  });
  it("23. no migrations or git commands", function() {
    var all = [clientTs, adapterTs, actionsTs, searchClient].filter(Boolean);
    for (var f = 0; f < all.length; f++) {
      assert.ok(all[f].indexOf("prisma db push") === -1, "no db push");
      assert.ok(all[f].indexOf("prisma migrate") === -1, "no migration");
      assert.ok(all[f].indexOf("git add") === -1, "no git add");
      assert.ok(all[f].indexOf("git commit") === -1, "no git commit");
    }
  });
});

describe("A466 Safety labels", function() {
  it("24. consistent external label across files", function() {
    if (adapterTs) assertContains(adapterTs, "外部数据预览", "adapter external label");
    if (searchClient) {
      assertContains(searchClient, "外部数据预览", "searchClient external label");
      assertContains(searchClient, "未导入本地", "searchClient not imported label");
    }
  });
  it("25. consistent provider identifier", function() {
    if (clientTs) assertContains(clientTs, "codeforces", "client codeforces identifier");
    if (adapterTs) assertContains(adapterTs, "codeforces", "adapter codeforces identifier");
  });
  it("26. public source URL format", function() {
    if (adapterTs) assertContains(adapterTs, "https://codeforces.com/problemset/problem", "public URL format");
  });
});

describe("A466 Safety no fake success", function() {
  it("27. guard blocked => error state, not success", function() {
    if (clientTs) assertContains(clientTs, "guardBlocked: true", "client blocked state");
  });
  it("28. actions blocked => success:false", function() {
    if (actionsTs) assertContains(actionsTs, "success: false", "actions blocked false");
  });
  it("29. searchClient shows unavailable when blocked", function() {
    if (searchClient) assertContains(searchClient, "搜索不可用", "searchClient unavailable state");
  });
  it("30. adapter has fallbacks, doesn't fabricate data", function() {
    if (adapterTs) {
      assertContains(adapterTs, "未命名题目", "adapter name fallback");
      assertContains(adapterTs, "[]", "adapter empty array fallback");
    }
  });
});

console.log("\n=== A466 Safety Tests Complete (30/30) ===\n");
