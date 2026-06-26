/**
 * Code Analysis Input Validation.
 *
 * Server-side validation of all code analysis inputs.
 * Both length limits and structural validation.
 * Must not only rely on client-side validation.
 */

import { CODE_ANALYSIS_LIMITS } from "./types.ts";
import type { CodeLanguage } from "./types.ts";
import { VALID_LANGUAGES } from "./types.ts";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate all code analysis input fields.
 */
export function validateCodeAnalysisInput(input: {
  problemStatement: string;
  sourceCode: string;
  selectedLanguage: string;
  errorInfo?: string;
  testInput?: string;
  actualOutput?: string;
  expectedOutput?: string;
  failedCases?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  // Source code — required
  if (!input.sourceCode || input.sourceCode.trim().length === 0) {
    errors.push({ field: "sourceCode", message: "源代码不能为空" });
  } else {
    const codeLen = input.sourceCode.length;
    if (codeLen < CODE_ANALYSIS_LIMITS.minSourceCodeChars) {
      errors.push({ field: "sourceCode", message: "源代码不能为空" });
    }
    if (codeLen > CODE_ANALYSIS_LIMITS.maxSourceCodeChars) {
      errors.push({
        field: "sourceCode",
        message: `源代码过长（最多 ${CODE_ANALYSIS_LIMITS.maxSourceCodeChars} 字符，当前 ${codeLen} 字符）`,
      });
    }
  }

  // Problem statement
  if (input.problemStatement && input.problemStatement.length > CODE_ANALYSIS_LIMITS.maxProblemStatementChars) {
    errors.push({
      field: "problemStatement",
      message: `题目描述过长（最多 ${CODE_ANALYSIS_LIMITS.maxProblemStatementChars} 字符）`,
    });
  }

  // Error info
  if (input.errorInfo && input.errorInfo.length > CODE_ANALYSIS_LIMITS.maxErrorInfoChars) {
    errors.push({
      field: "errorInfo",
      message: `错误信息过长（最多 ${CODE_ANALYSIS_LIMITS.maxErrorInfoChars} 字符）`,
    });
  }

  // Test info — check each field individually
  const testFields = [input.testInput, input.actualOutput, input.expectedOutput, input.failedCases];
  const testFieldNames = ["testInput", "actualOutput", "expectedOutput", "failedCases"];
  const testFieldLabels = ["测试输入", "实际输出", "预期输出", "失败样例"];

  for (let i = 0; i < testFields.length; i++) {
    const field = testFields[i];
    if (field && field.length > CODE_ANALYSIS_LIMITS.maxTestInfoChars) {
      errors.push({
        field: testFieldNames[i],
        message: `${testFieldLabels[i]}过长（最多 ${CODE_ANALYSIS_LIMITS.maxTestInfoChars} 字符）`,
      });
    }
  }

  // Total input size check
  const totalChars =
    (input.problemStatement?.length ?? 0) +
    (input.sourceCode?.length ?? 0) +
    (input.errorInfo?.length ?? 0) +
    [input.testInput, input.actualOutput, input.expectedOutput, input.failedCases]
      .reduce((sum, val) => sum + (val?.length ?? 0), 0);

  if (totalChars > CODE_ANALYSIS_LIMITS.totalInputHardLimit) {
    errors.push({
      field: "total",
      message: `总输入过长（最多 ${CODE_ANALYSIS_LIMITS.totalInputHardLimit} 字符，当前 ${totalChars} 字符）`,
    });
  }

  // Language validation
  if (input.selectedLanguage && !VALID_LANGUAGES.includes(input.selectedLanguage as CodeLanguage)) {
    errors.push({
      field: "selectedLanguage",
      message: "无效的编程语言选择",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create safe per-field character counts for display.
 */
export function getInputCharCounts(input: {
  problemStatement: string;
  sourceCode: string;
  errorInfo?: string;
  testInput?: string;
  actualOutput?: string;
  expectedOutput?: string;
  failedCases?: string;
}): Record<string, number> {
  return {
    problemStatement: input.problemStatement?.length ?? 0,
    sourceCode: input.sourceCode?.length ?? 0,
    errorInfo: input.errorInfo?.length ?? 0,
    testInput: input.testInput?.length ?? 0,
    actualOutput: input.actualOutput?.length ?? 0,
    expectedOutput: input.expectedOutput?.length ?? 0,
    failedCases: input.failedCases?.length ?? 0,
  };
}

/**
 * Build line number mapping for source code.
 * Returns an array where index = line number (0-based), value = line start char index.
 */
export function buildLineMap(sourceCode: string): Array<{ lineNumber: number; startChar: number; text: string }> {
  const lines = sourceCode.split("\n");
  const result: Array<{ lineNumber: number; startChar: number; text: string }> = [];
  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    result.push({
      lineNumber: i + 1, // 1-based
      startChar: charOffset,
      text: lines[i],
    });
    charOffset += lines[i].length + 1; // +1 for newline
  }

  return result;
}

/**
 * Perform deterministic pre-analysis on source code.
 * No AST parsing, no execution — just lightweight pattern matching.
 */
export function preAnalyzeSourceCode(sourceCode: string, errorInfo?: string) {
  const lines = sourceCode.split("\n");
  const lineCount = lines.length;
  const charCount = sourceCode.length;

  // Check for main entry points
  const hasMainEntry =
    /\bint\s+main\s*\(/.test(sourceCode) ||
    /\bpublic\s+static\s+void\s+main\s*\(/.test(sourceCode) ||
    /^if\s+__name__\s*==\s*['"]__main__['"]/m.test(sourceCode) ||
    /\bdef\s+main\s*\(/.test(sourceCode) ||
    /\bfunction\s+main\s*\(/.test(sourceCode);

  // Check for nested loops (simplistic — just looks for loop keywords inside other loops)
  const loopKeywords = ['for', 'while', 'do'];
  let nestedLoopDetected = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    for (const kw of loopKeywords) {
      if (new RegExp(`\\b${kw}\\b`).test(line)) {
        // Check if subsequent lines before a closing brace also contain a loop
        for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
          const innerLine = lines[j].trim();
          for (const innerKw of loopKeywords) {
            if (new RegExp(`\\b${innerKw}\\b`).test(innerLine)) {
              nestedLoopDetected = true;
              break;
            }
          }
          if (nestedLoopDetected) break;
          if (innerLine.includes("}")) break; // Simple heuristic for scope end
        }
      }
    }
    if (nestedLoopDetected) break;
  }

  // Check for recursion (function name appearing inside its own body — simplistic)
  const hasRecursion = /\b(\w+)\s*\([^)]*\)\s*\{[\s\S]*?\b\1\s*\(/m.test(sourceCode);

  // Extract line numbers from error info
  const errorLinesMentioned: number[] = [];
  if (errorInfo) {
    // Look for patterns like "line 5", "line 5:", ":5:", "at line 5"
    const lineMatches = errorInfo.matchAll(/(?:line|行|Line|LINE)\s*[:#]?\s*(\d+)/gi);
    for (const match of lineMatches) {
      const lineNum = parseInt(match[1], 10);
      if (lineNum > 0 && lineNum <= lineCount) {
        errorLinesMentioned.push(lineNum);
      }
    }
  }

  // Check for data range mentions in problem statement
  const hasDataRange = /\b\d+\s*(<=|<|>|>=)\s*\w+\s*(<=|<|>|>=)\s*\d+/.test(sourceCode) ||
    /\b\w+\s*(<=|<|>|>=)\s*\d+/.test(sourceCode);

  return {
    lineCount,
    charCount,
    hasMainEntry,
    hasNestedLoops: nestedLoopDetected,
    hasRecursion,
    errorLinesMentioned,
    hasDataRange,
  };
}
