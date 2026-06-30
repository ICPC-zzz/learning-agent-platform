import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

const { ProblemCodeSubmissionControl } = await tsImport(
  "./problems/[problemId]/ProblemCodeSubmissionControl.tsx",
  import.meta.url,
);

const judgeGuardStatus = {
  enabled: true,
  mode: "dev-only",
  productionReady: false,
  safeToExposeToClient: true,
  notice: "docker judge enabled",
  networkNone: true,
  timeoutMs: 3000,
  memoryMb: 256,
  maxOutputBytes: 65536,
};

test("A475 UI: submission control exposes code completion hints", () => {
  const markup = renderToStaticMarkup(
    createElement(ProblemCodeSubmissionControl, {
      problemId: "lap-builtin-001",
      problemTitle: "Two Sum",
      sourceKind: "builtin",
      initialTestCases: [{ input: "1\n", output: "1\n" }],
      judgeGuardStatus,
    }),
  );

  assert.ok(markup.includes("Ctrl+Space"));
  assert.ok(markup.includes("输入"));
});
