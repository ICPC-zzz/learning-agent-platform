import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { tsImport } from "tsx/esm/api";

const {
  createEmptyReaderCodeElementPreview,
  extractReaderCodeElementsPreview,
  validateReaderCodeElementPreview,
} = await tsImport("./reader-code-element-extractor.ts", import.meta.url);
const { ReaderContent } = await tsImport(
  "../../components/reader/ReaderContent.tsx",
  import.meta.url,
);
const {
  handleReaderCodeElementLinkKeyDown,
  buildReaderCodeElementLanguageFilterOptions,
  filterReaderCodeElementOutlineElements,
  resolveReaderCodeElementCurrentId,
  resolveReaderCodeElementOutlineItemState,
  resolveReaderCodeElementHashTarget,
  shouldActivateReaderCodeElementLinkKey,
  updateReaderCodeElementHighlightState,
} = await tsImport(
  "../../components/reader/ReaderCodeElementOutline.tsx",
  import.meta.url,
);

function renderReaderContent(props) {
  return renderToStaticMarkup(createElement(ReaderContent, props));
}

function assertContains(markup, needle, label) {
  assert.equal(markup.includes(needle), true, `${label} must include ${needle}`);
}

function createKeyboardEventStub(key) {
  let prevented = false;

  return {
    event: {
      key,
      preventDefault() {
        prevented = true;
      },
    },
    wasPrevented() {
      return prevented;
    },
  };
}

function createHighlightDocumentStub() {
  const blocks = new Map();
  const calls = {
    added: [],
    removed: [],
    setAttributes: [],
    removedAttributes: [],
  };

  function createBlock(id) {
    const block = {
      id,
      classList: {
        add(className) {
          calls.added.push({ id, className });
        },
        remove(className) {
          calls.removed.push({ id, className });
        },
      },
      setAttribute(name, value) {
        calls.setAttributes.push({ id, name, value });
      },
      removeAttribute(name) {
        calls.removedAttributes.push({ id, name });
      },
    };

    return block;
  }

  function register(id) {
    const block = createBlock(id);
    blocks.set(id, block);
    return block;
  }

  return {
    calls,
    document: {
      getElementById(id) {
        const block = blocks.get(id);
        if (block === undefined) {
          return null;
        }

        return {
          closest(selector) {
            if (selector === ".readerContentBlock") {
              return block;
            }

            return null;
          },
        };
      },
    },
    register,
  };
}

test(
  "extractReaderCodeElementsPreview returns empty preview when the chapter has no code blocks",
  function () {
    const preview = extractReaderCodeElementsPreview({
      chapterText: "First paragraph.\n\nSecond paragraph.",
      scopeId: "chapter-empty",
    });

    assert.deepEqual(preview, createEmptyReaderCodeElementPreview());
    assert.equal(preview.elements.length, 0);
    assert.equal(validateReaderCodeElementPreview(preview), true);
  },
);

test(
  "extractReaderCodeElementsPreview finds multiple fenced code blocks and keeps stable ids",
  function () {
    const input = [
      "Prelude",
      "```ts",
      "const answer = 42;",
      "```",
      "Bridge",
      "```",
      "print('hello')",
      "```",
    ].join("\n");

    const firstPreview = extractReaderCodeElementsPreview({
      chapterText: input,
      scopeId: "chapter-fenced",
    });
    const secondPreview = extractReaderCodeElementsPreview({
      chapterText: input,
      scopeId: "chapter-fenced",
    });

    assert.equal(firstPreview.elements.length, 2);
    assert.equal(secondPreview.elements.length, 2);
    assert.deepEqual(
      firstPreview.elements.map((element) => element.elementId),
      secondPreview.elements.map((element) => element.elementId),
    );
    assert.equal(firstPreview.elements[0].language, "ts");
    assert.equal(firstPreview.elements[0].startLine, 2);
    assert.equal(firstPreview.elements[0].endLine, 4);
    assert.equal(firstPreview.elements[0].lineCount, 3);
    assert.equal(firstPreview.elements[1].language, "unknown");
    assert.equal(firstPreview.elements[1].startLine, 6);
    assert.equal(firstPreview.elements[1].endLine, 8);
    assert.equal(firstPreview.elements[1].lineCount, 3);
    assert.equal(validateReaderCodeElementPreview(firstPreview), true);
  },
);

test("extractReaderCodeElementsPreview extracts simple HTML pre/code blocks", function () {
  const preview = extractReaderCodeElementsPreview({
    chapterText: [
      "Paragraph",
      '<pre><code class="language-js">',
      "const value = 1;",
      "</code></pre>",
      "Ending",
    ].join("\n"),
    scopeId: "chapter-html",
  });

  assert.equal(preview.elements.length, 1);
  assert.equal(preview.elements[0].language, "js");
  assert.equal(preview.elements[0].startLine, 2);
  assert.equal(preview.elements[0].endLine, 4);
  assert.equal(preview.elements[0].lineCount, 3);
  assert.equal(preview.elements[0].previewText, "const value = 1;");
  assert.equal(validateReaderCodeElementPreview(preview), true);
});

test(
  "extractReaderCodeElementsPreview redacts dangerous fields and truncates preview text",
  function () {
    const preview = extractReaderCodeElementsPreview({
      chapterText: [
        "```js",
        "const DATABASE_URL = process.env.DATABASE_URL || secretToken || api key || cookie || token || password;",
        "const noisy = 'x'.repeat(400);",
        "```",
      ].join("\n"),
      scopeId: "chapter-redacted",
    });

    assert.equal(preview.elements.length, 1);
    assert.equal(preview.elements[0].previewText.length <= 120, true);
    assert.equal(preview.elements[0].previewText.includes("DATABASE_URL"), false);
    assert.equal(preview.elements[0].previewText.includes("token"), false);
    assert.equal(preview.elements[0].previewText.includes("cookie"), false);
    assert.equal(preview.elements[0].previewText.includes("password"), false);
    assert.equal(preview.elements[0].previewText.includes("secret"), false);
    assert.equal(validateReaderCodeElementPreview(preview), true);
  },
);

test(
  "ReaderCodeElementOutline keyboard activation helper accepts Enter and Space",
  function () {
    assert.equal(shouldActivateReaderCodeElementLinkKey("Enter"), true);
    assert.equal(shouldActivateReaderCodeElementLinkKey(" "), true);
    assert.equal(shouldActivateReaderCodeElementLinkKey("Spacebar"), true);
    assert.equal(shouldActivateReaderCodeElementLinkKey("Tab"), false);

    const activateCalls = [];
    const enterEvent = createKeyboardEventStub("Enter");
    handleReaderCodeElementLinkKeyDown(
      enterEvent.event,
      "reader-code-block-test",
      (elementId) => activateCalls.push(elementId),
    );
    assert.equal(enterEvent.wasPrevented(), true);

    const spaceEvent = createKeyboardEventStub(" ");
    handleReaderCodeElementLinkKeyDown(
      spaceEvent.event,
      "reader-code-block-test",
      (elementId) => activateCalls.push(elementId),
    );
    assert.equal(spaceEvent.wasPrevented(), true);

    const tabEvent = createKeyboardEventStub("Tab");
    handleReaderCodeElementLinkKeyDown(
      tabEvent.event,
      "reader-code-block-test",
      (elementId) => activateCalls.push(elementId),
    );
    assert.equal(tabEvent.wasPrevented(), false);
    assert.deepEqual(activateCalls, [
      "reader-code-block-test",
      "reader-code-block-test",
    ]);
  },
);

test("ReaderCodeElementOutline highlight helper sets and clears the block class", function () {
  const stub = createHighlightDocumentStub();
  const firstBlock = stub.register("reader-code-block-a");
  const secondBlock = stub.register("reader-code-block-b");

  updateReaderCodeElementHighlightState(stub.document, null, firstBlock.id);
  assert.deepEqual(stub.calls.added, [
    { id: "reader-code-block-a", className: "readerContentBlockHighlighted" },
  ]);
  assert.deepEqual(stub.calls.setAttributes, [
    {
      id: "reader-code-block-a",
      name: "data-reader-code-element-highlighted",
      value: "true",
    },
  ]);

  updateReaderCodeElementHighlightState(
    stub.document,
    firstBlock.id,
    secondBlock.id,
  );
  assert.equal(
    stub.calls.removed.some(
      (call) =>
        call.id === "reader-code-block-a" &&
        call.className === "readerContentBlockHighlighted",
    ),
    true,
  );
  assert.equal(
    stub.calls.setAttributes.some(
      (call) =>
        call.id === "reader-code-block-b" &&
        call.name === "data-reader-code-element-highlighted" &&
        call.value === "true",
    ),
    true,
  );

  updateReaderCodeElementHighlightState(stub.document, secondBlock.id, null);
  assert.equal(
    stub.calls.removedAttributes.some(
      (call) =>
        call.id === "reader-code-block-b" &&
        call.name === "data-reader-code-element-highlighted",
    ),
    true,
  );
});

test("ReaderCodeElementOutline resolves hash targets safely", function () {
  assert.equal(
    resolveReaderCodeElementHashTarget("#reader-code-block-123"),
    "reader-code-block-123",
  );
  assert.equal(resolveReaderCodeElementHashTarget(""), null);
  assert.equal(resolveReaderCodeElementHashTarget("#"), null);
});

test(
  "ReaderCodeElementOutline resolves the current visible code block and item state",
  function () {
    assert.equal(
      resolveReaderCodeElementCurrentId([
        {
          elementId: "reader-code-block-a",
          index: 0,
          intersectionRatio: 0.25,
          isIntersecting: true,
          top: 120,
        },
        {
          elementId: "reader-code-block-b",
          index: 1,
          intersectionRatio: 0.6,
          isIntersecting: true,
          top: 180,
        },
        {
          elementId: "reader-code-block-c",
          index: 2,
          intersectionRatio: 0.6,
          isIntersecting: true,
          top: 28,
        },
      ]),
      "reader-code-block-c",
    );

    assert.equal(
      resolveReaderCodeElementCurrentId([
        {
          elementId: "reader-code-block-a",
          index: 0,
          intersectionRatio: 0.62,
          isIntersecting: true,
          top: 24,
        },
        {
          elementId: "reader-code-block-b",
          index: 1,
          intersectionRatio: 0.62,
          isIntersecting: true,
          top: 220,
        },
      ]),
      "reader-code-block-a",
    );

    const currentState = resolveReaderCodeElementOutlineItemState(
      "reader-code-block-c",
      "reader-code-block-c",
    );
    const previousState = resolveReaderCodeElementOutlineItemState(
      "reader-code-block-a",
      "reader-code-block-c",
    );
    const switchedOffState = resolveReaderCodeElementOutlineItemState(
      "reader-code-block-a",
      "reader-code-block-b",
    );
    const switchedOnState = resolveReaderCodeElementOutlineItemState(
      "reader-code-block-b",
      "reader-code-block-b",
    );

    assert.equal(currentState.isCurrent, true);
    assert.equal(currentState.ariaCurrent, "location");
    assert.equal(currentState.dataCurrent, "true");
    assert.equal(
      currentState.itemClassName.includes("readerCodeElementItemCurrent"),
      true,
    );
    assert.equal(
      currentState.linkClassName.includes("readerCodeElementLinkCurrent"),
      true,
    );
    assert.equal(previousState.isCurrent, false);
    assert.equal(previousState.ariaCurrent, undefined);
    assert.equal(previousState.dataCurrent, undefined);
    assert.equal(
      previousState.itemClassName.includes("readerCodeElementItemCurrent"),
      false,
    );
    assert.equal(
      previousState.linkClassName.includes("readerCodeElementLinkCurrent"),
      false,
    );
    assert.equal(switchedOffState.isCurrent, false);
    assert.equal(switchedOnState.isCurrent, true);
  },
);

test(
  "ReaderCodeElementOutline builds language filters and filters items by language",
  function () {
    const elements = [
      {
        elementId: "reader-code-block-a",
        language: "ts",
      },
      {
        elementId: "reader-code-block-b",
        language: "python",
      },
      {
        elementId: "reader-code-block-c",
        language: "unknown",
      },
      {
        elementId: "reader-code-block-d",
        language: "ts",
      },
    ];

    const filterOptions = buildReaderCodeElementLanguageFilterOptions(elements);

    assert.deepEqual(filterOptions, [
      {
        language: "ts",
        count: 2,
      },
      {
        language: "python",
        count: 1,
      },
      {
        language: "unknown",
        count: 1,
      },
    ]);

    assert.deepEqual(filterReaderCodeElementOutlineElements(elements, "all"), elements);
    assert.deepEqual(filterReaderCodeElementOutlineElements(elements, "ts"), [
      elements[0],
      elements[3],
    ]);
    assert.deepEqual(filterReaderCodeElementOutlineElements(elements, "python"), [
      elements[1],
    ]);
  },
);

test(
  "ReaderContent renders a read-only code block summary when code blocks are present",
  function () {
    const markup = renderReaderContent({
      chapter: {
        id: "chapter-render",
        title: "Code Chapter",
        orderIndex: 1,
        plainText: [
          "Opening paragraph.",
          "```ts",
          "const renderSummary = true;",
          "```",
          "Closing paragraph.",
        ].join("\n"),
      },
    });

    assertContains(
      markup,
      'data-testid="reader-code-element-outline"',
      "reader content markup",
    );
    assertContains(markup, "只读识别结果", "reader content markup");
    assertContains(markup, "代码块目录", "reader content markup");
    assertContains(markup, "1 个代码块", "reader content markup");
    assertContains(markup, "全部", "reader content markup");
    assertContains(markup, "ts x 1", "reader content markup");
    assertContains(markup, "第 2-4 行", "reader content markup");
    assertContains(markup, "3 行", "reader content markup");
    assertContains(markup, "const renderSummary = true;", "reader content markup");
    assertContains(markup, "可按语言快速筛选", "reader content markup");
    assertContains(
      markup,
      'aria-keyshortcuts="Enter Space"',
      "reader content markup",
    );
    assertContains(
      markup,
      'data-reader-code-element-id="reader-code-block-',
      "reader content markup",
    );
  },
);

test(
  "ReaderContent renders multiple code block entries with stable anchors and safe previews",
  function () {
    const chapter = {
      id: "chapter-outline",
      title: "Outline Chapter",
      orderIndex: 1,
      plainText: [
        "Intro paragraph.",
        "",
        "```ts",
        "const alpha = 1;",
        "```",
        "",
        "Middle paragraph.",
        "",
        "```js",
        "const secret = process.env.DATABASE_URL;",
        "```",
        "",
        "Tail paragraph.",
        "",
        "```ts",
        "function wrap() {",
        "  return true;",
        "}",
        "```",
      ].join("\n"),
    };

    const preview = extractReaderCodeElementsPreview({
      chapterText: chapter.plainText,
      scopeId: chapter.id,
    });
    const markup = renderReaderContent({ chapter });

    assert.equal(preview.elements.length, 3);
    assertContains(markup, "3 个代码块", "reader content markup");
    assertContains(markup, "全部", "reader content markup");
    assertContains(markup, 'aria-pressed="true"', "reader content markup");
    assertContains(markup, "ts", "reader content markup");
    assertContains(markup, "js", "reader content markup");
    assertContains(markup, "ts x 2, js x 1", "reader content markup");
    assertContains(markup, "第 3-5 行", "reader content markup");
    assertContains(markup, "第 9-11 行", "reader content markup");
    assertContains(markup, "第 15-19 行", "reader content markup");
    assertContains(markup, "5 行", "reader content markup");
    assertContains(markup, "const alpha = 1;", "reader content markup");
    assertContains(markup, "[redacted]", "reader content markup");
    assert.equal(markup.includes("execute code"), false);
    assert.equal(markup.includes("upload code"), false);
    assert.equal(markup.includes("AI analyzed"), false);

    for (const element of preview.elements) {
      assertContains(
        markup,
        `href="#${element.elementId}"`,
        "reader content markup",
      );
      assertContains(markup, `id="${element.elementId}"`, "reader content markup");
      assertContains(
        markup,
        `data-reader-code-element-id="${element.elementId}"`,
        "reader content markup",
      );
    }
  },
);

test("ReaderContent hides the code block outline when no code blocks are present", function () {
  const markup = renderReaderContent({
    chapter: {
      id: "chapter-no-code",
      title: "Plain Chapter",
      orderIndex: 1,
      plainText: "First paragraph.\n\nSecond paragraph.",
    },
  });

  assert.equal(
    markup.includes('data-testid="reader-code-element-outline"'),
    false,
  );
  assert.equal(markup.includes("代码块目录"), false);
  assert.equal(markup.includes("只读识别结果"), false);
  assert.equal(markup.includes("全部"), false);
  assert.equal(markup.includes("execute code"), false);
  assert.equal(markup.includes("upload code"), false);
  assert.equal(markup.includes("AI analyzed"), false);
});
