import type { ReaderBook, ReaderChapterContext } from "./reader-types";

export const sampleBook: ReaderBook = {
  document: {
    id: "sample-programming-fundamentals",
    title: "编程基础示例",
    author: "Learning Agent Platform",
    sourceType: "builtin",
    sourceMetadata: {
      purpose: "静态阅读器 MVP 示例"
    },
    createdAt: "2026-05-01T00:00:00.000Z"
  },
  chapters: [
    {
      id: "sample-chapter-variables",
      bookId: "sample-programming-fundamentals",
      title: "第 1 章：变量",
      orderIndex: 0,
      level: 1,
      plainText:
        "变量让程序可以用名称保存值。一个变量可以保存数字、字符串，或程序稍后需要使用的其他数据。\n\n阅读代码时，先问自己每个名称代表什么，以及它的值会如何随时间变化。清晰的命名会让小程序更容易推理。"
    },
    {
      id: "sample-chapter-control-flow",
      bookId: "sample-programming-fundamentals",
      title: "第 2 章：控制流",
      orderIndex: 1,
      level: 1,
      plainText:
        "控制流决定哪些语句会运行，以及它们会运行多少次。条件语句会在不同路径之间做选择，循环会重复执行一段代码，直到条件发生变化。\n\n初学者应该逐行追踪控制流。这能培养在运行程序前预测计算机会做什么的习惯。"
    },
    {
      id: "sample-chapter-functions",
      bookId: "sample-programming-fundamentals",
      title: "第 3 章：函数",
      orderIndex: 2,
      level: 1,
      plainText:
        "函数把一小段行为封装到一个名称后面。它们让程序更容易复用、测试和解释。\n\n一个好用的函数应该有清晰的输入、清晰的输出，以及能说明它所执行动作的名称。"
    }
  ],
  chunks: [
    {
      id: "sample-chunk-variables-0",
      bookId: "sample-programming-fundamentals",
      chapterId: "sample-chapter-variables",
      orderIndex: 0,
      plainText:
        "变量让程序可以用名称保存值。一个变量可以保存数字、字符串，或程序稍后需要使用的其他数据。",
      charCount: 132,
      startOffset: 0,
      endOffset: 132
    },
    {
      id: "sample-chunk-variables-1",
      bookId: "sample-programming-fundamentals",
      chapterId: "sample-chapter-variables",
      orderIndex: 1,
      plainText:
        "阅读代码时，先问自己每个名称代表什么，以及它的值会如何随时间变化。清晰的命名会让小程序更容易推理。",
      charCount: 134,
      startOffset: 134,
      endOffset: 268
    },
    {
      id: "sample-chunk-control-flow-0",
      bookId: "sample-programming-fundamentals",
      chapterId: "sample-chapter-control-flow",
      orderIndex: 0,
      plainText:
        "控制流决定哪些语句会运行，以及它们会运行多少次。条件语句会在不同路径之间做选择，循环会重复执行一段代码，直到条件发生变化。",
      charCount: 146,
      startOffset: 0,
      endOffset: 146
    },
    {
      id: "sample-chunk-functions-0",
      bookId: "sample-programming-fundamentals",
      chapterId: "sample-chapter-functions",
      orderIndex: 0,
      plainText:
        "函数把一小段行为封装到一个名称后面。它们让程序更容易复用、测试和解释。",
      charCount: 112,
      startOffset: 0,
      endOffset: 112
    }
  ]
};

const currentChapter = sampleBook.chapters[0];

export const currentChapterContext: ReaderChapterContext = {
  book: sampleBook.document,
  chapter: currentChapter,
  chunks: sampleBook.chunks.filter((chunk) => chunk.chapterId === currentChapter.id)
};
