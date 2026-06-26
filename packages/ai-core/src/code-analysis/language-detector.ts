/**
 * Deterministic Programming Language Detector.
 *
 * Uses simple keyword/syntax heuristics — no LLM, no AST parsing.
 * Returns the detected language with a confidence score.
 *
 * Rules:
 * - User-selected language always takes priority
 * - Auto-detection returns a guess with confidence
 * - Unknown signals return "unknown"
 */

import type { CodeLanguage } from "./types.ts";

export interface LanguageDetectionResult {
  language: string;
  confidence: number; // 0–1
  source: "manual" | "auto";
}

/**
 * Detect the programming language of a code snippet.
 * If the user explicitly selected a language (other than "auto"), that takes priority.
 */
export function detectProgrammingLanguage(
  code: string,
  selectedLanguage: CodeLanguage,
): LanguageDetectionResult {
  // Manual selection always wins
  if (selectedLanguage !== "auto") {
    return {
      language: mapLanguage(selectedLanguage),
      confidence: 1.0,
      source: "manual",
    };
  }

  // Auto-detect from code signals
  const normalized = normalizeForDetection(code);

  // C++ signals
  if (hasCppSignals(normalized)) {
    return { language: "C++", confidence: 0.95, source: "auto" };
  }

  // Java signals
  if (hasJavaSignals(normalized)) {
    return { language: "Java", confidence: 0.95, source: "auto" };
  }

  // TypeScript signals — check before JavaScript (subset)
  if (hasTypeScriptSignals(normalized)) {
    return { language: "TypeScript", confidence: 0.85, source: "auto" };
  }

  // Python signals
  if (hasPythonSignals(normalized)) {
    return { language: "Python", confidence: 0.90, source: "auto" };
  }

  // JavaScript signals
  if (hasJavaScriptSignals(normalized)) {
    return { language: "JavaScript", confidence: 0.75, source: "auto" };
  }

  // Couldn't determine
  return { language: "unknown", confidence: 0.0, source: "auto" };
}

// ---------------------------------------------------------------------------
// Signal detection helpers
// ---------------------------------------------------------------------------

function normalizeForDetection(code: string): string {
  // Trim and normalize whitespace for pattern matching
  return code.trim().replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function mapLanguage(lang: CodeLanguage): string {
  const map: Record<CodeLanguage, string> = {
    auto: "unknown",
    cpp: "C++",
    python: "Python",
    java: "Java",
    javascript: "JavaScript",
    typescript: "TypeScript",
    other: "unknown",
  };
  return map[lang];
}

// C++ signals: #include, std::, int main, vector, cin/cout, namespace
function hasCppSignals(code: string): boolean {
  const includePattern = /^\s*#include\s*[<"]/m;
  const stdPattern = /\bstd::/;
  const mainPattern = /\bint\s+main\s*\(/;
  const cppKeywords = /\b(vector|cout|cin|namespace|template<class|template<typename)\b/;
  const iostream = /<iostream>|<bits\/stdc\+\+\.h>/;

  let signals = 0;
  if (includePattern.test(code)) signals++;
  if (stdPattern.test(code)) signals++;
  if (mainPattern.test(code)) signals++;
  if (cppKeywords.test(code)) signals++;
  if (iostream.test(code)) signals++;

  return signals >= 2;
}

// Python signals: def, import, indentation-based, print(), class with :
function hasPythonSignals(code: string): boolean {
  const defPattern = /\bdef\s+\w+\s*\(/;
  const importPattern = /^\s*(import\s+\w+|from\s+\w+\s+import)/m;
  const printPattern = /\bprint\s*\(/;
  const classPattern = /\bclass\s+\w+\s*(\(.*\))?\s*:/;
  const pyKeywords = /\b(def|elif|None|True|False|self|__init__)\b/;

  // Exclude C++ signals first
  if (hasCppSignals(code)) return false;

  let signals = 0;
  if (defPattern.test(code)) signals++;
  if (importPattern.test(code)) signals++;
  if (printPattern.test(code)) signals++;
  if (classPattern.test(code)) signals++;
  if (pyKeywords.test(code)) signals++;

  return signals >= 2;
}

// Java signals: public class, static void main, System.out, import java
function hasJavaSignals(code: string): boolean {
  const publicClass = /\bpublic\s+class\s+\w+/;
  const staticMain = /\bpublic\s+static\s+void\s+main\s*\(/;
  const systemOut = /\bSystem\.(out|in|err)\b/;
  const importJava = /^\s*import\s+java\./m;
  const javaTypes = /\b(ArrayList|HashMap|Scanner|String\[\])\b/;

  let signals = 0;
  if (publicClass.test(code)) signals++;
  if (staticMain.test(code)) signals++;
  if (systemOut.test(code)) signals++;
  if (importJava.test(code)) signals++;
  if (javaTypes.test(code)) signals++;

  return signals >= 2;
}

// TypeScript signals: type annotations, interface, type keyword, as Type
function hasTypeScriptSignals(code: string): boolean {
  const typeAnnotation = /:\s*(string|number|boolean|void|never|any)\b/;
  const interfaceKeyword = /\binterface\s+\w+/;
  const typeKeyword = /\btype\s+\w+\s*=/;
  const asSyntax = /\bas\s+[A-Z]\w+/;
  const tsGenerics = /<[A-Z]\w*>/;

  let signals = 0;
  if (typeAnnotation.test(code)) signals++;
  if (interfaceKeyword.test(code)) signals++;
  if (typeKeyword.test(code)) signals++;
  if (asSyntax.test(code)) signals++;
  if (tsGenerics.test(code)) signals++;

  return signals >= 2;
}

// JavaScript signals: const/let, function, console.log, arrow functions
function hasJavaScriptSignals(code: string): boolean {
  // Exclude TypeScript and Java first
  if (hasTypeScriptSignals(code) || hasJavaSignals(code)) return false;

  const constLet = /\b(const|let)\s+\w+/;
  const functionKeyword = /\bfunction\s+\w+\s*\(/;
  const arrowFunc = /\(.*\)\s*=>\s*\{/;
  const consoleLog = /\bconsole\.(log|error|warn)\b/;
  const jsKeywords = /\b(var|document\.|window\.|addEventListener)\b/;

  let signals = 0;
  if (constLet.test(code)) signals++;
  if (functionKeyword.test(code)) signals++;
  if (arrowFunc.test(code)) signals++;
  if (consoleLog.test(code)) signals++;
  if (jsKeywords.test(code)) signals++;

  return signals >= 2;
}
