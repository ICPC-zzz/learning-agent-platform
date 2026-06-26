import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProblemCodeText,
  normalizeProblemProseText,
} from "./problem-text-normalizer.ts";

test("normalizeProblemProseText removes markdown headings and latex markers", function () {
  const input = [
    "### 样例解释 1",
    "AI 可以选择前三次出动，后两次出石头，这样你一次都赢不了。",
    "",
    "### 数据范围",
    "$10\\%$ 的数据， $n=2$。",
    "",
    "$40\\%$ 的数据， $n \\le 4000$。",
    "",
    "$100\\%$ 的数据， $n \\le 10^6$。",
  ].join("\n");

  const normalized = normalizeProblemProseText(input);

  assert.equal(
    normalized,
    [
      "样例解释 1",
      "AI 可以选择前三次出动，后两次出石头，这样你一次都赢不了。",
      "",
      "数据范围",
      "10% 的数据，n=2。",
      "",
      "40% 的数据，n <= 4000。",
      "",
      "100% 的数据，n <= 10^6。",
    ].join("\n"),
  );
});

test("normalizeProblemProseText removes fenced markdown but keeps content", function () {
  const input = [
    "```",
    "### 数据范围",
    "$n \\le 4000$",
    "```",
  ].join("\n");

  const normalized = normalizeProblemProseText(input);

  assert.equal(normalized, "数据范围\nn <= 4000");
});

test("normalizeProblemCodeText keeps code-like formatting", function () {
  const input = [
    "  1 2 3  ",
    "    4 5 6",
  ].join("\n");

  const normalized = normalizeProblemCodeText(input);

  assert.equal(normalized, "  1 2 3\n    4 5 6");
});
