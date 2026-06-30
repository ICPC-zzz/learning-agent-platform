import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));
var projectRoot = resolve(__dirname, "..", "..", "..", "..");

// Files that must NOT read env files or contain secrets
var securityFiles = [
  "apps/web/src/app/books/page.tsx",
  "apps/web/src/app/books/book-library-filter.ts",
  "apps/web/src/app/books/book-library-loader.ts",
  "apps/web/src/app/books/open-library-bulk-import-actions.ts",
  "apps/web/src/app/books/delete-book-actions.ts",
  "apps/web/src/app/books/components/BookLibraryClient.tsx",
  "apps/web/src/app/books/components/OpenLibraryBulkImportClient.tsx",
  "packages/db/src/repositories/book-repository.ts",
];

function readSrc(rel) { return readFileSync(resolve(projectRoot, rel), "utf-8"); }

describe("A472 Safety", function() {
  it("no env file read (dotenv, readFileSync .env)", function() {
    for (var i = 0; i < securityFiles.length; i++) {
      var s = readSrc(securityFiles[i]);
      assert.ok(!s.includes("dotenv"), securityFiles[i] + " uses dotenv");
      assert.ok(!s.match(/readFileSync.*\.env/), securityFiles[i] + " reads .env");
    }
  });
  it("no hardcoded API keys or tokens", function() {
    for (var i = 0; i < securityFiles.length; i++) {
      var s = readSrc(securityFiles[i]);
      assert.ok(!s.includes("re_"), securityFiles[i] + " has Resend key");
      assert.ok(!s.match(/[Bb]earer\s+[A-Za-z0-9_-]{20,}/), securityFiles[i] + " has Bearer token");
    }
  });
  it("book action/client files do not call LLM providers", function() {
    for (var i = 0; i < securityFiles.length; i++) {
      var s = readSrc(securityFiles[i]);
      var hasLLM = s.includes("openai") || s.includes("anthropic") || s.includes("claude");
      assert.ok(!hasLLM, securityFiles[i] + " addresses LLM provider");
    }
  });
  it("no agent/tool execution", function() {
    for (var i = 0; i < securityFiles.length; i++) {
      assert.ok(!readSrc(securityFiles[i]).includes("mcp__"), securityFiles[i]);
    }
  });
  it("A465 single import still exists", function() {
    assert.ok(existsSync(resolve(__dirname, "books", "open-library-import-actions.ts")));
    assert.ok(readFileSync(resolve(__dirname, "books", "open-library-import-actions.ts"), "utf-8").includes("export async function importOpenLibraryBookAction"));
  });
  it("books page does not touch email OTP logic", function() {
    var s = readSrc("apps/web/src/app/books/page.tsx");
    assert.ok(!s.includes("email-otp") && !s.includes("Resend"));
  });
});

console.log("A472 safety tests completed");
