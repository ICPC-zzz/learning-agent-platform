import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const ROOT = process.cwd();

function read(path) {
  return readFileSync(`${ROOT}/${path}`, "utf8");
}

describe("A511 floating assistant removal", () => {
  it("removes the floating assistant component and root layout mount", () => {
    assert.equal(
      existsSync(`${ROOT}/apps/web/src/app/_components/FloatingAiAssistant.tsx`),
      false,
    );

    const layout = read("apps/web/src/app/layout.tsx");
    assert.equal(layout.includes("FloatingAiAssistant"), false);
    assert.equal(layout.includes("<FloatingAiAssistant"), false);
  });

  it("removes floating assistant category from admin status runtime", () => {
    const statusCenter = read("apps/web/src/lib/admin-status-center.ts");
    const adminAiPage = read("apps/web/src/app/admin/ai/page.tsx");

    assert.equal(statusCenter.includes('"floating-ai"'), false);
    assert.equal(statusCenter.includes("collectFloatingAiStatus"), false);
    assert.equal(adminAiPage.includes("Floating AI"), false);
    assert.equal(adminAiPage.includes("悬浮球"), false);
  });

  it("does not advertise the removed floating entry in current user-facing sources", () => {
    const sources = [
      "apps/web/src/app/ask/page.tsx",
      "apps/web/src/app/_components/AuthenticatedHome.tsx",
      "apps/web/src/app/admin/layout.tsx",
      "apps/web/src/lib/web-ai-user-data-summary.ts",
      "apps/web/src/lib/assistant/assistant-orchestrator.ts",
    ];

    for (const sourcePath of sources) {
      const source = read(sourcePath);
      assert.equal(source.includes("FloatingAiAssistant"), false, sourcePath);
      assert.equal(source.includes("Floating AI"), false, sourcePath);
      assert.equal(source.includes("悬浮球"), false, sourcePath);
      assert.equal(source.includes("浮窗"), false, sourcePath);
    }
  });
});
