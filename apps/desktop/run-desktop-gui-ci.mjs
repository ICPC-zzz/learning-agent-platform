import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OPT_IN_ENV = "RUN_DESKTOP_GUI_TESTS";
const enabled = process.env[OPT_IN_ENV] === "1";

if (!enabled) {
  // Preview-only safety boundary: GUI regression is opt-in in CI/local pipelines.
  // Default skip avoids blocking non-GUI agents while keeping regular lint/typecheck/unit lanes green.
  // On Windows, set $env:RUN_DESKTOP_GUI_TESTS="1" before running.
  // On Linux/macOS, set RUN_DESKTOP_GUI_TESTS=1 before running.
  console.log(
    `[desktop:test:gui:ci] Desktop GUI regression skipped (set ${OPT_IN_ENV}=1 to enable full run).`
  );
  process.exit(0);
}

// Explicit opt-in path: run the real GUI regression and preserve its exit status.
const currentFile = fileURLToPath(import.meta.url);
const desktopDir = path.dirname(currentFile);
const repoRoot = path.resolve(desktopDir, "..", "..");
const guiTestPath = path.join(repoRoot, "apps", "desktop", "desktop-gui-regression.test.mjs");
const result = spawnSync(process.execPath, ["--test", guiTestPath], {
  stdio: "inherit",
  cwd: repoRoot,
  shell: false,
});

if (typeof result.status === "number") {
  process.exit(result.status);
}

if (result.error) {
  console.error(
    `[desktop:test:gui:ci] Failed to start desktop GUI regression: ${result.error.message}`
  );
}
process.exit(1);
