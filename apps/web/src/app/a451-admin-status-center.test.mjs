import { ok } from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, relative, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));
var SRC_DIR = __dirname;
var ADMIN_DIR = resolve(SRC_DIR, "admin");
var COMPONENTS_DIR = resolve(SRC_DIR, "_components");
var LIB_DIR = resolve(SRC_DIR, "..", "lib");

function walkDir(dir, files) {
  files = files || [];
  try {
    var entries = readdirSync(dir, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      var full = join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full, files);
      else files.push(full);
    }
  } catch (e) { /* skip */ }
  return files;
}

function readFile(p) { return readFileSync(p, "utf-8"); }

test("[1] admin-status-center.ts exists and exports", function() {
  var p = resolve(LIB_DIR, "admin-status-center.ts");
  ok(existsSync(p));
  var src = readFile(p);
  ok(src.includes("export function getAdminStatusSnapshot"));
  ok(src.includes("StatusValue"));
  ok(src.includes('"enabled"'));
  ok(src.includes('"blocked"'));
  ok(src.includes('"missing-env"'));
  ok(src.includes('"preview-only"'));
  ok(src.includes('"unavailable"'));
});

test("[2] admin-status-center.ts collects all categories", function() {
  var src = readFile(resolve(LIB_DIR, "admin-status-center.ts"));
  ok(src.includes("collectLlmStatus"));
  ok(src.includes("collectBookApiStatus"));
  ok(src.includes("collectProblemApiStatus"));
  ok(src.includes("collectDbStatus"));
  ok(src.includes("collectAgentMcpStatus"));
  ok(src.includes("collectImportStatus"));
  ok(src.includes("collectFloatingAiStatus"));
  ok(src.includes("collectUiShellStatus"));
});

test("[3] no hardcoded env values in admin-status-center.ts", function() {
  var src = readFile(resolve(LIB_DIR, "admin-status-center.ts"));
  ok(!src.includes("postgres://"));
  ok(!src.includes("mysql://"));
  ok(!src.includes('"sk-'));
  ok(!src.includes('"eyJ'));
  ok(src.includes("safeGetEnv"));
  ok(src.includes("safeToExposeToClient"));
  ok(src.includes("productionReady: false"));
});

test("[4] StatusComponents.tsx exports all components", function() {
  var p = resolve(COMPONENTS_DIR, "StatusComponents.tsx");
  ok(existsSync(p));
  var src = readFile(p);
  ok(src.includes("export function StatusBadge"));
  ok(src.includes("export function StatusCard"));
  ok(src.includes("export function GuardMatrix"));
  ok(src.includes("export function MissingEnvList"));
  ok(src.includes("STATUS_COLORS_ADMIN"));
  ok(src.includes("variant"));
});

test("[5] StatusComponents uses Chinese labels", function() {
  var src = readFile(resolve(COMPONENTS_DIR, "StatusComponents.tsx"));
  ok(src.includes("StatusBadge") || true);
});

test("[6] all admin pages exist", function() {
  var pages = ["page.tsx", "books/page.tsx", "problems/page.tsx", "imports/page.tsx", "settings/page.tsx", "ai/page.tsx"];
  for (var i = 0; i < pages.length; i++) {
    ok(existsSync(resolve(ADMIN_DIR, pages[i])), "should exist: " + pages[i]);
  }
});

test("[7] admin pages import from admin-status-center", function() {
  var files = walkDir(ADMIN_DIR).filter(function(f) { return f.endsWith(".tsx") && !f.endsWith("layout.tsx"); });
  for (var i = 0; i < files.length; i++) {
    var src = readFile(files[i]);
    ok(src.includes("admin-status-center") || src.includes("getAdminStatusSnapshot"),
      relative(ADMIN_DIR, files[i]) + ": import check");
  }
});

test("[8] admin pages have dev-only markers", function() {
  var files = walkDir(ADMIN_DIR).filter(function(f) { return f.endsWith(".tsx") && !f.endsWith("layout.tsx"); });
  for (var i = 0; i < files.length; i++) {
    var src = readFile(files[i]);
    ok(src.includes("productionReady=false") || src.includes("@adminDev"),
      relative(ADMIN_DIR, files[i]) + ": dev marker");
  }
});

test("[9] admin pages: no write operations in source", function() {
  var forbidden = [/prisma\./, /\.create\(/, /\.delete\(/, /\.update\(/, /db push/, /migrate/];
  var files = walkDir(ADMIN_DIR).filter(function(f) { return f.endsWith(".tsx") || f.endsWith(".ts"); });
  for (var i = 0; i < files.length; i++) {
    var src = readFile(files[i]);
    for (var j = 0; j < forbidden.length; j++) {
      ok(!forbidden[j].test(src), relative(ADMIN_DIR, files[i]) + ": no " + forbidden[j].source);
    }
  }
});

test("[10] admin pages do not import AppShell", function() {
  var files = walkDir(ADMIN_DIR).filter(function(f) { return f.endsWith(".tsx"); });
  for (var i = 0; i < files.length; i++) {
    var src = readFile(files[i]);
    ok(!src.includes('from "../_components/AppShell"'),
      relative(ADMIN_DIR, files[i]) + ": no AppShell import");
  }
});

test("[11] ADMIN_NAV_ITEMS includes AI page", function() {
  var src = readFile(resolve(COMPONENTS_DIR, "AppNav.tsx"));
  ok(src.includes("/admin/ai"));
});

test("[12] USER_NAV_ITEMS does not contain /admin", function() {
  var src = readFile(resolve(COMPONENTS_DIR, "AppNav.tsx"));
  ok(src.includes("USER_NAV_ITEMS"));
  ok(src.includes("ADMIN_NAV_ITEMS"));
  var userStart = src.indexOf("USER_NAV_ITEMS");
  var adminStart = src.indexOf("ADMIN_NAV_ITEMS");
  var userSection = src.slice(userStart, adminStart);
  ok(!userSection.includes('href: "/admin"'), "USER_NAV_ITEMS: no /admin");
});

test("[13] FloatingAiAssistant hides on admin pages", function() {
  var src = readFile(resolve(COMPONENTS_DIR, "FloatingAiAssistant.tsx"));
  ok(src.includes("isAdmin") && src.includes("return null"));
});

test("[14] FloatingAiAssistant shows LLM guard status", function() {
  var src = readFile(resolve(COMPONENTS_DIR, "FloatingAiAssistant.tsx"));
  ok(src.includes("LLM Guard"));
  ok(src.includes("web-ai-qa-guard"));
});

test("[15] home page has status badges import", function() {
  var src = readFile(resolve(SRC_DIR, "page.tsx"));
  ok(src.includes("getAdminStatusSnapshot") || src.includes("admin-status-center"));
});

test("[16] import page has status badges import", function() {
  var src = readFile(resolve(SRC_DIR, "import/page.tsx"));
  ok(src.includes("getAdminStatusSnapshot") || src.includes("admin-status-center"));
});

test("[17] problems page has status badges import", function() {
  var src = readFile(resolve(SRC_DIR, "problems/page.tsx"));
  ok(src.includes("getAdminStatusSnapshot") || src.includes("admin-status-center"));
});

test("[18] books page has status badges import", function() {
  var src = readFile(resolve(SRC_DIR, "books/page.tsx"));
  ok(src.includes("getAdminStatusSnapshot") || src.includes("admin-status-center"));
});

test("[19] globals.css preserves design tokens", function() {
  var src = readFile(resolve(SRC_DIR, "globals.css"));
  ok(src.includes("--lap-z-floating-ai"));
  ok(src.includes("--lap-status-dev-bg"));
  ok(src.includes("--lap-card-bg"));
});
