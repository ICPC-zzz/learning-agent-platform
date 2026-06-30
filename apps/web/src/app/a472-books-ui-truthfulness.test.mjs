import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));
var pageSource = readFileSync(resolve(__dirname,"books","page.tsx"),"utf-8");
var clientSource = readFileSync(resolve(__dirname,"books","components","BookLibraryClient.tsx"),"utf-8");

describe("A472 Books UI Truthfulness", function() {
  it("does not show blocked as user-facing UI label (only in comments/props)", function() {
    var lines = pageSource.split("\n");
    var bad = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf("blocked") >= 0) {
        var isVar = line.indexOf("blockedReason") >= 0 || line.indexOf("guardBlocked") >= 0
          || line.indexOf("importBlocked") >= 0 || line.indexOf("{/*") >= 0 || line.indexOf("//") >= 0;
        if (!isVar) bad.push(line.trim().slice(0, 80));
      }
    }
    assert.equal(bad.length, 0, "no user-facing blocked text: " + bad.join(" | "));
  });
  it("does not show next round text", function() {
    assert.ok(!pageSource.includes("next round"));
  });
  it("does not show LLM ask entry", function() {
    assert.ok(!pageSource.match(/Ask\s*(LLM|AI)/));
  });
  it("does not have LLM ask in client", function() {
    assert.ok(!clientSource.match(/Ask\s*(LLM|AI)/));
  });
  it("FloatingAiAssistant is removed", function() {
    assert.equal(existsSync(resolve(__dirname,"_components","FloatingAiAssistant.tsx")), false);
  });
  it("no env var names exposed in UI text", function() {
    var m = pageSource.match(/LAP_[A-Z_]+/g);
    if (m) {
      var ui = m.filter(function(x) { return !pageSource.includes("safeGetEnv"); });
      assert.equal(ui.length, 0, "env names in UI: " + ui.join(", "));
    }
  });
});

console.log("A472 UI truthfulness tests completed");
