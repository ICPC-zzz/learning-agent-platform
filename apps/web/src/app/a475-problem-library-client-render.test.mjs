import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

const { ProblemLibraryClient } = await tsImport(
  "./problems/ProblemLibraryClient.tsx",
  import.meta.url,
);

test("A475 problems center: client list renders without runtime reference errors", () => {
  assert.doesNotThrow(() => {
    const markup = renderToStaticMarkup(
      createElement(ProblemLibraryClient, {
        dbProblems: [],
      }),
    );

    assert.ok(markup.length > 0);
  });
});
