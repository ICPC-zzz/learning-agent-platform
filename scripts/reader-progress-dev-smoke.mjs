/**
 * Reader progress dev smoke CLI.
 *
 * Default: dry-run only, no DB writes.
 * Live mode: requires explicit `--live` plus the smoke guards.
 *
 * Never prints DATABASE_URL, secrets, stack traces, or raw errors.
 */

import {
  formatReaderProgressDevSmokeResult,
  runReaderProgressDevSmoke,
} from "../apps/web/src/app/reader/reader-progress-dev-smoke-runner.ts";

const args = process.argv.slice(2);
const liveRequested = args.includes("--live");

try {
  const result = await runReaderProgressDevSmoke({
    liveRequested,
  });

  console.log(formatReaderProgressDevSmokeResult(result));

  if (result.mode === "live_error") {
    process.exitCode = 1;
  }
} catch {
  console.error("Reader progress dev smoke failed safely before producing output.");
  process.exitCode = 1;
}
