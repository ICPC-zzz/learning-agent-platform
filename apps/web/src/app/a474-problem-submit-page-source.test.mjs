import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const problemPagePath = resolve(__dirname, "problems", "[problemId]", "page.tsx");
const actionPath = resolve(__dirname, "problems", "[problemId]", "submit-code-actions.ts");
const componentPath = resolve(
  __dirname,
  "problems",
  "[problemId]",
  "ProblemCodeSubmissionControl.tsx",
);

const pageSource = fs.readFileSync(problemPagePath, "utf8");
const actionSource = fs.readFileSync(actionPath, "utf8");
const componentSource = fs.readFileSync(componentPath, "utf8");

test("A474 page source: problem detail page uses original source links instead of local submit UI", () => {
  assert.ok(pageSource.includes("FavoriteProblemButton"));
  assert.ok(pageSource.includes("ProblemPracticeStatusControl"));
  assert.ok(pageSource.includes("originalUrl") || pageSource.includes("原题链接"));
  assert.ok(pageSource.includes("originalUrl"));
  assert.ok(!pageSource.includes("ProblemCodeSubmissionControl"));
  assert.ok(!pageSource.includes("getDockerJudgeGuardStatusForUi"));
  assert.ok(actionSource.includes("judgeProblemCodeSubmission"));
  assert.ok(actionSource.includes('"use server"'));
});

test("A474 page source: control component keeps the local judge UI and localStorage hook", () => {
  assert.ok(componentSource.includes("getImportedProblemById"));
  assert.ok(componentSource.includes("submitProblemCodeAction"));
  assert.ok(componentSource.includes("运行样例"));
  assert.ok(componentSource.includes("本地用例"));
  assert.ok(componentSource.includes("Java 主类"));
  assert.ok(componentSource.includes("outputBlockStyle"));
});

test("A474 page source: problem detail page keeps only favorite and needs-review controls", () => {
  assert.ok(pageSource.includes("FavoriteProblemButton"));
  assert.ok(pageSource.includes("ProblemPracticeStatusControl"));
  assert.ok(!pageSource.includes("ProblemPracticeActivityControl"));
  assert.ok(!pageSource.includes("ProblemWrongBookControl"));
  assert.ok(!pageSource.includes("getLearningActivityDbStatusForUi"));
  assert.ok(!pageSource.includes("getProblemWrongBookDbStatusForUi"));
  assert.ok(!pageSource.includes("ProblemCodeSubmissionControl"));
  assert.ok(!pageSource.includes("getDockerJudgeGuardStatusForUi"));
});
