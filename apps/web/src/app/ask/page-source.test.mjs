import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("/ask page wires the dev guard and Reader AI panel", function () {
  const filePath = fileURLToPath(new URL("./page.tsx", import.meta.url));
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(source.includes("evaluateReaderAiQaGuard"), true);
  assert.equal(source.includes("ReaderAiQuestionPanel"), true);
  assert.equal(source.includes("READER_AI_QA_REQUIRED_ENV_KEYS"), true);
  assert.equal(source.includes("READER_AI_QA_AUTH_ENV_KEYS"), true);
  assert.equal(source.includes("LAP_WEB_LLM_QA_DEV_ENABLED"), true);
  assert.equal(source.includes("LAP_ALLOW_EXTERNAL_LLM_PROVIDER"), true);
  assert.equal(source.includes("LAP_LLM_DEV_APIPassword"), true);
  assert.equal(source.includes("NODE_ENV"), true);
});
