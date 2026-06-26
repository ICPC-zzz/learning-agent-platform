import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const APP_DIR = path.resolve(import.meta.dirname || ".");
function rf(p) { return fs.readFileSync(path.join(APP_DIR, p), "utf-8"); }
function rc(n) { return rf("_components/" + n); }

describe("AppNav config", () => {
  it("USER_NAV_ITEMS correct", () => {
    const s = rc("AppNav.tsx");
    assert.ok(s.includes("首页") && s.includes("书库") && s.includes("导入"));
    assert.ok(s.includes("题目中心") && s.includes("学习中心") && s.includes("用户中心"));
    assert.ok(!s.includes("/agent"));
  });
  it("ADMIN_NAV_ITEMS correct", () => {
    const s = rc("AppNav.tsx");
    assert.ok(s.includes("管理概览") && s.includes("书籍管理"));
    assert.ok(s.includes("题目管理") && s.includes("系统设置"));
  });
  it("arrays are separate exports", () => {
    const s = rc("AppNav.tsx");
    assert.ok(s.includes("export const USER_NAV_ITEMS"));
    assert.ok(s.includes("export const ADMIN_NAV_ITEMS"));
  });
});

describe("Shell components", () => {
  const files = ["AppShell.tsx","AppHeader.tsx","AppSidebar.tsx","AppNav.tsx",
    "ShellRouter.tsx","AdminShell.tsx","AdminHeader.tsx","AdminSidebar.tsx"];
  for (const f of files) {
    it(f + " exists", () => { const c = rc(f); assert.ok(c.length > 100); });
  }
  it("AppShell exports", () => { const c = rc("AppShell.tsx"); assert.ok(c.includes("export function AppShell")); });
  it("AdminShell exports", () => { const c = rc("AdminShell.tsx"); assert.ok(c.includes("export function AdminShell")); });
  it("ShellRouter detects admin", () => { const c = rc("ShellRouter.tsx"); assert.ok(c.includes("startsWith(\"/admin\")")); });
});

describe("FloatingAiAssistant", () => {
  it("is client component", () => { const c = rc("FloatingAiAssistant.tsx"); assert.ok(c.includes("\"use client\"")); });
  it("hides on admin", () => { const c = rc("FloatingAiAssistant.tsx"); assert.ok(c.includes("startsWith(\"/admin\")") && c.includes("return null")); });
  it("uses z-index token", () => { const c = rc("FloatingAiAssistant.tsx"); assert.ok(c.includes("var(--lap-z-floating-ai)")); });
  it("has Esc handler", () => { const c = rc("FloatingAiAssistant.tsx"); assert.ok(c.includes("key === \"Escape\"")); });
  it("has click-outside", () => { const c = rc("FloatingAiAssistant.tsx"); assert.ok(c.includes("mousedown")); });
  it("has clamp for responsive", () => { const c = rc("FloatingAiAssistant.tsx"); assert.ok(c.includes("clamp")); });
});

describe("Admin pages", () => {
  it("layout uses AdminShell", () => { assert.ok(rf("admin/layout.tsx").includes("AdminShell")); });
  it("dashboard has status cards", () => {
    const c = rf("admin/page.tsx");
    assert.ok(c.includes("管理概览") && c.includes("StatusCard"));
  });
  ["books","problems","imports","settings"].forEach(s => {
    it("admin/" + s + " exists", () => { assert.ok(fs.existsSync(path.join(APP_DIR,"admin",s,"page.tsx"))); });
  });
});

describe("Isolation", () => {
  it("AdminShell only in admin layout", () => {
    assert.ok(rf("admin/layout.tsx").includes("AdminShell"));
    assert.ok(!rf("page.tsx").includes("AdminShell"));
  });
  it("nav arrays not mixed", () => {
    assert.ok(rc("AppHeader.tsx").includes("USER_NAV_ITEMS") && !rc("AppHeader.tsx").includes("ADMIN_NAV_ITEMS"));
    assert.ok(rc("AppSidebar.tsx").includes("USER_NAV_ITEMS") && !rc("AppSidebar.tsx").includes("ADMIN_NAV_ITEMS"));
    assert.ok(rc("AdminSidebar.tsx").includes("ADMIN_NAV_ITEMS") && !rc("AdminSidebar.tsx").includes("USER_NAV_ITEMS"));
  });
  it("admin pages no user shell imports", () => {
    for (const f of ["admin/page.tsx","admin/books/page.tsx","admin/problems/page.tsx","admin/imports/page.tsx","admin/settings/page.tsx"]) {
      const c = rf(f);
      assert.ok(!c.includes("AppShell") && !c.includes("AppHeader"));
    }
  });
});

describe("Design tokens", () => {
  it("has required tokens", () => {
    const c = rf("globals.css");
    for (const t of ["--lap-layout-width-narrow","--lap-space-1","--lap-radius-sm","--lap-border-light","--lap-bg-page","--lap-text-primary","--lap-z-floating-ai","--lap-card-bg","--lap-font-family"]) {
      assert.ok(c.includes(t), "missing: "+t);
    }
  });
  it("z-index scale logical", () => {
    const c = rf("globals.css");
    const re = /--lap-z-([\w-]+):\s*(\d+)/g;
    const zi = {}; let m;
    while ((m = re.exec(c))) zi[m[1]] = parseInt(m[2], 10);
    assert.ok(zi.base < zi.dropdown);
    assert.ok(zi.dropdown < zi.sticky);
    assert.ok(zi.sticky < zi.sidebar);
    assert.ok(zi.sidebar < zi.overlay);
    assert.ok(zi.overlay < zi.modal);
    assert.ok(zi.modal < zi["floating-ai"]);
  });
  it("has utility classes", () => {
    const c = rf("globals.css");
    for (const cl of [".lap-card",".lap-dev-badge",".lap-empty-state",".lap-sr-only"]) {
      assert.ok(c.includes(cl), "missing: "+cl);
    }
  });
});

describe("Safety", () => {
  it("admin no write ops", () => {
    for (const d of ["admin","admin/books","admin/problems","admin/imports","admin/settings"]) {
      const c = rf(d+"/page.tsx");
      assert.ok(!c.includes("prisma."));
      assert.ok(!c.includes("INSERT INTO"));
      assert.ok(!c.includes("DELETE FROM"));
    }
  });
  it("admin only shows var names", () => {
    const c = rf("admin/page.tsx");
    assert.ok(c.includes("WEB_LLM_QA_DEV_ENABLED"));
    assert.ok(c.includes("未设置"));
    assert.ok(!c.includes("postgres://"));
    assert.ok(!c.includes("\"sk-"));
  });
  it("admin pages dev-only", () => {
    for (const d of ["admin","admin/books","admin/problems","admin/imports","admin/settings"]) {
      const c = rf(d+"/page.tsx");
      assert.ok(c.includes("productionReady") || c.includes("admin-dev") || c.includes("只读"));
    }
  });
  it("home admin link in footer", () => {
    const c = rf("page.tsx");
    assert.ok(c.includes("后台管理"));
    const half = c.slice(Math.floor(c.length / 2));
    assert.ok(half.includes("/admin"));
  });
});
