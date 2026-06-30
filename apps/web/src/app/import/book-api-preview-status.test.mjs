import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS5097: direct .ts import is used in existing node:test coverage.
import { getBookApiPreviewStatus } from "./book-api-preview-status.ts";

test("book API status is blocked when env is missing", () => {
  const status = getBookApiPreviewStatus({
    NODE_ENV: "development",
  });

  assert.equal(status.providerMode, "blocked");
  assert.equal(status.safeToExposeToClient, true);
  assert.equal(status.productionReady, false);
  assert.ok(status.missingEnvNames.includes("LAP_ALLOW_EXTERNAL_BOOK_API"));
  assert.ok(status.missingEnvNames.includes("LAP_BOOK_API_BASE_URL"));
  assert.ok(status.missingEnvNames.includes("LAP_BOOK_API_PROVIDER"));
});

test("book API status becomes external-dev when env is complete", () => {
  const status = getBookApiPreviewStatus({
    NODE_ENV: "development",
    LAP_ALLOW_EXTERNAL_BOOK_API: "1",
    LAP_BOOK_API_BASE_URL: "https://openlibrary.org",
    LAP_BOOK_API_PROVIDER: "open-library",
  });

  assert.equal(status.providerMode, "external-dev");
  assert.equal(status.blockedReason, null);
  assert.equal(status.missingEnvNames.length, 0);
});
