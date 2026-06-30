import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("./reader-progress-dev-smoke.mjs", import.meta.url));

function runScript(args, env = {}) {
  return spawnSync(process.execPath, ["--experimental-strip-types", scriptPath, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

test("cli defaults to dry-run and does not write db", function () {
  const result = runScript([]);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.includes("mode: dry-run"), true);
  assert.equal(result.stdout.includes("writesDatabase: no"), true);
  assert.equal(result.stdout.includes("preparationChecklist:"), true);
  assert.equal(result.stdout.includes("DATABASE_URL"), false);
});

test("cli live mode blocks safely when guards are missing", function () {
  const result = runScript(["--live"], {
    NODE_ENV: "development",
  });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.includes("mode: blocked"), true);
  assert.equal(result.stdout.includes("MISSING_DEV_DATABASE_CONNECTION"), true);
  assert.equal(result.stdout.includes("preparationChecklist:"), true);
  assert.equal(result.stdout.includes("DATABASE_URL"), false);
});
