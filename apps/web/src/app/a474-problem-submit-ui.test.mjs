import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

const { ProblemCodeSubmissionControl } = await tsImport(
  "./problems/[problemId]/ProblemCodeSubmissionControl.tsx",
  import.meta.url,
);

const pagePath = path.join(
  process.cwd(),
  "apps",
  "web",
  "src",
  "app",
  "problems",
  "[problemId]",
  "page.tsx",
);
const pageSource = fs.readFileSync(pagePath, "utf8");

const enabledJudgeGuardStatus = {
  enabled: true,
  mode: "dev-only",
  productionReady: false,
  safeToExposeToClient: true,
  notice: "Docker 沙箱判题已启用。",
  networkNone: true,
  timeoutMs: 3000,
  memoryMb: 256,
  maxOutputBytes: 65536,
};

const disabledJudgeGuardStatus = {
  ...enabledJudgeGuardStatus,
  enabled: false,
  notice: "当前环境未开启本地判题。",
};

test("A474 UI: problem submission control renders builtin source with language and run controls", () => {
  const markup = renderToStaticMarkup(
    createElement(ProblemCodeSubmissionControl, {
      problemId: "lap-builtin-001",
      problemTitle: "Two Sum",
      sourceKind: "builtin",
      initialTestCases: [{ input: "1\n", output: "1\n" }],
      judgeGuardStatus: enabledJudgeGuardStatus,
    }),
  );

  assert.ok(markup.includes("代码提交"));
  assert.ok(markup.includes("语言"));
  assert.ok(markup.includes("代码"));
  assert.ok(markup.includes("运行样例"));
  assert.ok(markup.includes("判题说明"));
  assert.ok(markup.includes("本地用例"));
  assert.ok(markup.includes("Docker 沙箱判题已启用。"));
  assert.ok(markup.includes("Python"));
});

test("A474 UI: problem submission control renders localStorage loading state safely", () => {
  const markup = renderToStaticMarkup(
    createElement(ProblemCodeSubmissionControl, {
      problemId: "imp-local-001",
      problemTitle: "Imported Problem",
      sourceKind: "localStorage",
      initialTestCases: [],
      judgeGuardStatus: enabledJudgeGuardStatus,
    }),
  );

  assert.ok(markup.includes("正在读取本地导入题目的样例。"));
  assert.ok(markup.includes("本地导入题目未找到") || markup.includes("该题暂无本地测试用例"));
  assert.ok(markup.includes("暂无本地样例"));
});

test("A474 UI: problem submission control keeps the judge button visible when Docker is unavailable", () => {
  const markup = renderToStaticMarkup(
    createElement(ProblemCodeSubmissionControl, {
      problemId: "lap-builtin-002",
      problemTitle: "Two Sum",
      sourceKind: "builtin",
      initialTestCases: [{ input: "1\n", output: "1\n" }],
      judgeGuardStatus: disabledJudgeGuardStatus,
    }),
  );

  assert.ok(markup.includes("需要 Docker 沙箱"));
  assert.ok(markup.includes("当前环境未开启本地判题"));
});

test("A474 UI: page source routes through original links and local review controls", () => {
  assert.ok(pageSource.includes("FavoriteProblemButton"));
  assert.ok(pageSource.includes("ProblemPracticeStatusControl"));
  assert.ok(pageSource.includes("sourceUrl") || pageSource.includes("原题链接"));
  assert.ok(!pageSource.includes("ProblemCodeSubmissionControl"));
  assert.ok(!pageSource.includes("getDockerJudgeGuardStatusForUi"));
});

test("A474 UI: problem detail page keeps only favorite and needs-review controls", () => {
  assert.ok(pageSource.includes("FavoriteProblemButton"));
  assert.ok(pageSource.includes("ProblemPracticeStatusControl"));
  assert.ok(!pageSource.includes("ProblemPracticeActivityControl"));
  assert.ok(!pageSource.includes("ProblemWrongBookControl"));
  assert.ok(!pageSource.includes("getLearningActivityDbStatusForUi"));
  assert.ok(!pageSource.includes("getProblemWrongBookDbStatusForUi"));
});
