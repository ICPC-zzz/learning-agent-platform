import assert from "node:assert/strict";
import test from "node:test";
import { tsImport } from "tsx/esm/api";

const {
  applyProblemCodeCompletion,
  buildProblemCodeCompletionContext,
} = await tsImport("./problems/[problemId]/code-completion.ts", import.meta.url);

test("A475 completion: prefix matching returns language snippets", () => {
  const context = buildProblemCodeCompletionContext({
    language: "python",
    code: "pri",
    selectionStart: 3,
    selectionEnd: 3,
  });

  assert.equal(context.prefix, "pri");
  assert.ok(context.suggestions.some((item) => item.id === "python:print"));
});

test("A475 completion: manual open exposes the starter template first", () => {
  const context = buildProblemCodeCompletionContext({
    language: "go",
    code: "",
    selectionStart: 0,
    selectionEnd: 0,
    manualOpen: true,
  });

  assert.ok(context.suggestions.length > 0);
  assert.equal(context.suggestions[0].id, "go:starter");
});

test("A475 completion: applying a suggestion replaces the prefix", () => {
  const context = buildProblemCodeCompletionContext({
    language: "javascript",
    code: "con",
    selectionStart: 3,
    selectionEnd: 3,
  });
  const suggestion = context.suggestions.find((item) => item.id === "js:log");

  assert.ok(suggestion);

  const applied = applyProblemCodeCompletion({
    code: "con",
    replaceStart: context.replaceStart,
    replaceEnd: context.replaceEnd,
    suggestion: suggestion,
  });

  assert.ok(applied.code.includes("console.log"));
  assert.equal(applied.selectionStart, applied.selectionEnd);
});
