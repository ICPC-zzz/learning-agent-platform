import { getJudgeStarterCode, type JudgeLanguageId } from "../../../lib/judge/language-runners";

export interface CodeCompletionSuggestion {
  id: string;
  label: string;
  detail: string;
  insertText: string;
  keywords: readonly string[];
  priority: number;
}

export interface ProblemCodeCompletionContext {
  prefix: string;
  replaceStart: number;
  replaceEnd: number;
  suggestions: CodeCompletionSuggestion[];
}

interface CompletionInput {
  language: JudgeLanguageId;
  code: string;
  selectionStart: number;
  selectionEnd: number;
  manualOpen?: boolean;
}

interface ApplyCompletionInput {
  code: string;
  replaceStart: number;
  replaceEnd: number;
  suggestion: CodeCompletionSuggestion;
}

const MAX_SUGGESTIONS = 6;
const COMPLETION_CHAR_PATTERN = /[A-Za-z0-9_#.:<>/+-]/;

export function buildProblemCodeCompletionContext(input: CompletionInput): ProblemCodeCompletionContext {
  const selection = normalizeSelectionRange(input.code, input.selectionStart, input.selectionEnd);
  const prefix = input.code.slice(selection.replaceStart, selection.replaceEnd);
  const catalog = getCompletionCatalog(input.language);
  const suggestions = getMatchingSuggestions(catalog, prefix, Boolean(input.manualOpen));

  return {
    prefix,
    replaceStart: selection.replaceStart,
    replaceEnd: selection.replaceEnd,
    suggestions,
  };
}

export function applyProblemCodeCompletion(input: ApplyCompletionInput): {
  code: string;
  selectionStart: number;
  selectionEnd: number;
} {
  const before = input.code.slice(0, input.replaceStart);
  const after = input.code.slice(input.replaceEnd);
  const nextCode = `${before}${input.suggestion.insertText}${after}`;
  const cursor = before.length + input.suggestion.insertText.length;

  return {
    code: nextCode,
    selectionStart: cursor,
    selectionEnd: cursor,
  };
}

function getCompletionCatalog(language: JudgeLanguageId): CodeCompletionSuggestion[] {
  const starterCode = getJudgeStarterCode(language);

  const starter: CodeCompletionSuggestion = {
    id: `${language}:starter`,
    label: "插入语言模板",
    detail: "插入当前语言的 starter code",
    insertText: starterCode,
    keywords: ["starter", "template", "boilerplate"],
    priority: 0,
  };

  switch (language) {
    case "python":
      return [
        starter,
        suggestion("python:main", "if __name__ == \"__main__\":", "Python main 入口", 'if __name__ == "__main__":\n    main()', ["main", "__name__", "entry"], 10),
        suggestion("python:import-sys", "import sys", "快速读入和输出", "import sys", ["import", "sys", "stdin"], 12),
        suggestion("python:print", "print(value)", "打印结果到标准输出", "print()", ["print", "stdout"], 14),
        suggestion("python:readline", "sys.stdin.readline()", "单行输入", "sys.stdin.readline()", ["readline", "stdin", "input"], 16),
        suggestion("python:for", "for item in items:", "循环模板", "for item in items:\n    pass", ["for", "loop"], 18),
        suggestion("python:def", "def main():", "函数模板", "def main():\n    pass", ["def", "function", "main"], 20),
      ];
    case "c":
      return [
        starter,
        suggestion("c:stdio", "#include <stdio.h>", "C 标准输入输出", "#include <stdio.h>\n", ["#include", "stdio"], 10),
        suggestion("c:main", "int main(void)", "main 入口", "int main(void) {\n    return 0;\n}", ["main", "entry"], 12),
        suggestion("c:scanf", "scanf(\"%d\", &x);", "格式化输入", "scanf(\"%d\", &x);", ["scanf", "input"], 14),
        suggestion("c:printf", "printf(\"%d\\n\", x);", "格式化输出", "printf(\"%d\\n\", x);", ["printf", "print"], 16),
      ];
    case "cpp":
      return [
        starter,
        suggestion("cpp:bits", "#include <bits/stdc++.h>", "C++ 常用头文件", "#include <bits/stdc++.h>\n", ["#include", "bits"], 10),
        suggestion("cpp:using", "using namespace std;", "简化标准库访问", "using namespace std;", ["using", "namespace", "std"], 12),
        suggestion("cpp:main", "int main()", "main 入口", "int main() {\n    return 0;\n}", ["main", "entry"], 14),
        suggestion("cpp:cin", "cin >> x;", "标准输入", "cin >> x;", ["cin", "input"], 16),
        suggestion("cpp:cout", "cout << x << '\\n';", "标准输出", "cout << x << '\\n';", ["cout", "print"], 18),
        suggestion("cpp:sort", "sort(v.begin(), v.end());", "快速排序常用写法", "sort(v.begin(), v.end());", ["sort", "algorithm"], 20),
      ];
    case "java":
      return [
        starter,
        suggestion("java:class", "public class Main", "Java 入口类", "public class Main {\n    public static void main(String[] args) {\n        \n    }\n}", ["class", "main", "public"], 10),
        suggestion("java:reader", "BufferedReader", "高性能输入", "BufferedReader br = new BufferedReader(new InputStreamReader(System.in));", ["bufferedreader", "reader", "input"], 12),
        suggestion("java:tokenizer", "StringTokenizer", "拆分输入", "StringTokenizer st = new StringTokenizer(line);", ["tokenizer", "split"], 14),
        suggestion("java:println", "System.out.println()", "标准输出", "System.out.println();", ["println", "print", "system.out.println"], 16),
      ];
    case "go":
      return [
        starter,
        suggestion("go:package", "package main", "Go 入口包", "package main\n", ["package", "main"], 10),
        suggestion("go:main", "func main()", "main 入口", "func main() {\n\n}", ["func", "main"], 12),
        suggestion("go:reader", "bufio.NewReader(os.Stdin)", "高性能输入", "bufio.NewReader(os.Stdin)", ["bufio", "reader", "stdin"], 14),
        suggestion("go:fscan", "fmt.Fscan", "格式化读取", "fmt.Fscan(in, &x)", ["fscan", "scan", "input"], 16),
        suggestion("go:println", "fmt.Fprintln", "输出结果", "fmt.Fprintln(out, x)", ["fprintln", "println", "print"], 18),
      ];
    case "javascript":
      return [
        starter,
        suggestion("js:fs", "const fs = require(\"fs\");", "Node.js 读取标准输入", 'const fs = require("fs");', ["fs", "require", "stdin"], 10),
        suggestion("js:read", "fs.readFileSync(0, \"utf8\")", "一次性读取标准输入", 'const input = fs.readFileSync(0, "utf8").trim().split(/\\s+/);', ["readfilesync", "input", "stdin"], 12),
        suggestion("js:main", "function main()", "函数模板", "function main() {\n\n}", ["function", "main"], 14),
        suggestion("js:log", "console.log()", "标准输出", "console.log();", ["console.log", "log", "print"], 16),
      ];
    default:
      return [starter];
  }
}

function suggestion(
  id: string,
  label: string,
  detail: string,
  insertText: string,
  keywords: readonly string[],
  priority: number,
): CodeCompletionSuggestion {
  return { id, label, detail, insertText, keywords, priority };
}

function getMatchingSuggestions(
  catalog: readonly CodeCompletionSuggestion[],
  prefix: string,
  manualOpen: boolean,
): CodeCompletionSuggestion[] {
  const normalizedPrefix = normalizeCompletionKey(prefix);
  const scored = catalog
    .map((item) => ({
      item,
      score: scoreSuggestion(item, normalizedPrefix, manualOpen),
    }))
    .filter((entry) => entry.score !== Number.POSITIVE_INFINITY)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      if (left.item.priority !== right.item.priority) {
        return left.item.priority - right.item.priority;
      }
      return left.item.label.localeCompare(right.item.label);
    });

  return scored.slice(0, MAX_SUGGESTIONS).map((entry) => entry.item);
}

function scoreSuggestion(
  suggestion: CodeCompletionSuggestion,
  normalizedPrefix: string,
  manualOpen: boolean,
): number {
  if (normalizedPrefix.length === 0) {
    return manualOpen ? suggestion.priority : Number.POSITIVE_INFINITY;
  }

  const haystacks = [
    suggestion.label,
    suggestion.detail,
    ...suggestion.keywords,
  ].map((value) => normalizeCompletionKey(value));

  if (haystacks.some((value) => value === normalizedPrefix)) {
    return suggestion.priority - 10;
  }

  if (haystacks.some((value) => value.startsWith(normalizedPrefix))) {
    return suggestion.priority;
  }

  if (haystacks.some((value) => value.includes(normalizedPrefix))) {
    return suggestion.priority + 10;
  }

  return Number.POSITIVE_INFINITY;
}

function normalizeSelectionRange(code: string, selectionStart: number, selectionEnd: number): {
  replaceStart: number;
  replaceEnd: number;
} {
  const length = code.length;
  const start = clamp(selectionStart, 0, length);
  const end = clamp(selectionEnd, 0, length);
  const replaceStart = Math.min(start, end);
  const replaceEnd = Math.max(start, end);

  if (replaceStart !== replaceEnd) {
    return { replaceStart, replaceEnd };
  }

  const tokenStart = findTokenStart(code, replaceStart);
  return { replaceStart: tokenStart, replaceEnd };
}

function findTokenStart(code: string, cursor: number): number {
  let index = cursor;
  while (index > 0 && COMPLETION_CHAR_PATTERN.test(code[index - 1] ?? "")) {
    index -= 1;
  }
  return index;
}

function normalizeCompletionKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(Math.trunc(value), min), max);
}
