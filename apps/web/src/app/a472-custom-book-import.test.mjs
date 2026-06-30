import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));
var pageSource = readFileSync(resolve(__dirname,"books","page.tsx"),"utf-8");

describe("A472 Custom Book Import",function(){
  it("has custom import section",function(){
    assert.ok(pageSource.includes("import"),"should reference import");
  });
  it("shows text/markdown import card",function(){
    assert.ok(pageSource.includes("Markdown")||pageSource.includes("markdown")||pageSource.includes("文本"),"should have text/markdown import");
  });
  it("does NOT have PDF import as user-facing card",function(){
    var hasPdfCard = pageSource.match(/PDF .*import/gi);
    assert.ok(!hasPdfCard||hasPdfCard.length===0,"should not show PDF import card");
  });
  it("does NOT have DOCX import as user-facing card",function(){
    var hasDocxCard = pageSource.match(/DOCX .*import/gi);
    assert.ok(!hasDocxCard||hasDocxCard.length===0,"should not show DOCX import card");
  });
  it("does not show disabled import features",function(){
    var hasDisabledBadge = pageSource.match(/disabled.*import|import.*disabled/gi);
    assert.ok(!hasDisabledBadge||hasDisabledBadge.length===0,"should not show disabled import");
  });
});

console.log("A472 custom book import tests completed");
