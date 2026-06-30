import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var PASS = "PASS", FAIL = "FAIL";
var total = 0, passed = 0, failed = 0;
function t(name, fn) {
  total++;
  try { fn(); passed++; console.log(PASS + " [a465-safety] " + name); }
  catch (e) { failed++; console.log(FAIL + " [a465-safety] " + name + "\n       " + e.message); }
}

var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);

function readSourceFile(relativePath) {
  try { return readFileSync(resolve(__dirname, relativePath), "utf-8"); }
  catch { return ""; }
}

var adapterSrc = readSourceFile("../lib/open-library-import-adapter.ts");
var actionsSrc = readSourceFile("./books/open-library-import-actions.ts");
var clientSrc = readSourceFile("./books/components/OpenLibrarySearchClient.tsx");
var pageSrc = readSourceFile("./books/page.tsx");

// 1. No .env.local read
t("adapter has no .env.local read", function() {
  assert.ok(adapterSrc.length > 0, "adapter source should be readable");
  assert.ok(adapterSrc.indexOf(".env.local") === -1);
  assert.ok(adapterSrc.indexOf("dotenv") === -1);
});

// 2. No API key references
t("adapter has no API key refs", function() {
  assert.ok(adapterSrc.indexOf("API_KEY") === -1);
  assert.ok(adapterSrc.indexOf("DATABASE_URL") === -1);
  assert.ok(adapterSrc.indexOf("password") === -1);
});

// 3. Safe result markers
t("actions have safety markers", function() {
  assert.ok(actionsSrc.indexOf("envValuesExposed") !== -1);
  assert.ok(actionsSrc.indexOf("rawResponseStored") !== -1);
  assert.ok(actionsSrc.indexOf("safeToExposeToClient") !== -1);
});

// 4. No full text scrape
t("adapter has no fetch/axios", function() {
  assert.ok(adapterSrc.indexOf("fetch(") === -1);
  assert.ok(adapterSrc.indexOf("axios") === -1);
});

// 5. No LLM calls
t("adapter has no LLM calls", function() {
  assert.ok(adapterSrc.indexOf("openai") === -1);
  assert.ok(adapterSrc.indexOf("anthropic") === -1);
  assert.ok(adapterSrc.indexOf("llm") === -1);
});

// 6. No Prisma migration
t("actions have no migration", function() {
  assert.ok(actionsSrc.indexOf("prisma migrate") === -1);
  assert.ok(actionsSrc.indexOf("db push") === -1);
});

// 7. Uses PrismaBookRepository
t("actions use PrismaBookRepository", function() {
  assert.ok(actionsSrc.indexOf("PrismaBookRepository") !== -1);
});

// 8. No Codeforces/Resend/Phone
t("no Codeforces refs", function() {
  var lower = adapterSrc.toLowerCase() + actionsSrc.toLowerCase();
  assert.ok(lower.indexOf("codeforces") === -1);
  assert.ok(lower.indexOf("resend") === -1);
});

// 9. No git commands
t("no git commands", function() {
  assert.ok(actionsSrc.indexOf("git add") === -1);
  assert.ok(actionsSrc.indexOf("git commit") === -1);
});

// 10. Guard required
t("actions reference guards", function() {
  assert.ok(actionsSrc.indexOf("guard") !== -1);
  assert.ok(actionsSrc.indexOf("allowed") !== -1);
});

// 11. Pages have importEnabled prop
t("/books page has import props", function() {
  assert.ok(pageSrc.indexOf("importEnabled") !== -1);
  assert.ok(pageSrc.indexOf("importBlockedReason") !== -1);
});

// 12. Page has dev import flag check
t("/books page checks dev import flag", function() {
  assert.ok(pageSrc.indexOf("LAP_ALLOW_DEV_BOOK_IMPORT") !== -1);
});

// 13. Import action references import guard
t("actions reference dev import guard", function() {
  assert.ok(actionsSrc.indexOf("LAP_ALLOW_DEV_BOOK_IMPORT") !== -1);
});

// 14. Dev-only/preview markers in adapter
t("adapter has dev-only markers", function() {
  assert.ok(adapterSrc.indexOf("dev-only") !== -1 || adapterSrc.indexOf("previewOnly") !== -1);
});

// 15. No raw response retention
t("adapter has rawResponseStored: false", function() {
  assert.ok(adapterSrc.indexOf("rawResponseStored") !== -1);
  assert.ok(adapterSrc.indexOf("false") !== -1);
});

// 16. Import client has import function
t("client has importOpenLibraryBookAction", function() {
  assert.ok(clientSrc.indexOf("importOpenLibraryBookAction") !== -1);
});

// 17. No large embedded data
t("adapter has reasonable size", function() {
  assert.ok(adapterSrc.length < 20000);
});

console.log("\n[a465-safety] " + total + " tests, " + passed + " pass, " + failed + " fail");
process.exit(failed > 0 ? 1 : 0);
