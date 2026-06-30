import type { JudgeLanguageConfig, JudgeLanguageId } from "./judge-types";
export type { JudgeLanguageId } from "./judge-types";

const PYTHON_STARTER = `import sys


def main() -> None:
    data = sys.stdin.buffer.read()
    if not data:
        return
    # TODO: parse stdin and print stdout


if __name__ == "__main__":
    main()
`;

const C_STARTER = `#include <stdio.h>

int main(void) {
    // TODO: read stdin and write stdout
    return 0;
}
`;

const CPP_STARTER = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    // TODO: read stdin and write stdout
    return 0;
}
`;

const JAVA_STARTER = `import java.io.BufferedInputStream;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedInputStream in = new BufferedInputStream(System.in);
        byte[] data = in.readAllBytes();
        if (data.length == 0) {
            return;
        }
        // TODO: parse stdin and write stdout
    }
}
`;

const GO_STARTER = `package main

import (
    "io"
    "os"
)

func main() {
    _, _ = io.ReadAll(os.Stdin)
    // TODO: parse stdin and write stdout
}
`;

const JAVASCRIPT_STARTER = `const fs = require("fs");

const input = fs.readFileSync(0, "utf8");
if (!input) {
  process.exit(0);
}
// TODO: parse stdin and write stdout
`;

export const JUDGE_LANGUAGE_CONFIGS: Record<JudgeLanguageId, JudgeLanguageConfig> = {
  python: {
    id: "python",
    label: "Python",
    fileName: "main.py",
    image: "python:latest",
    compileCommand: null,
    runCommand: ["python", "main.py"],
    starterCode: PYTHON_STARTER,
  },
  c: {
    id: "c",
    label: "C",
    fileName: "main.c",
    image: "gcc:latest",
    compileCommand: ["gcc", "main.c", "-O2", "-std=c11", "-o", "main"],
    runCommand: ["./main"],
    starterCode: C_STARTER,
  },
  cpp: {
    id: "cpp",
    label: "C++",
    fileName: "main.cpp",
    image: "gcc:latest",
    compileCommand: ["g++", "main.cpp", "-O2", "-std=c++17", "-o", "main"],
    runCommand: ["./main"],
    starterCode: CPP_STARTER,
  },
  java: {
    id: "java",
    label: "Java",
    fileName: "Main.java",
    image: "eclipse-temurin:latest",
    compileCommand: ["javac", "Main.java"],
    runCommand: ["java", "Main"],
    starterCode: JAVA_STARTER,
  },
  go: {
    id: "go",
    label: "Go",
    fileName: "main.go",
    image: "golang:latest",
    compileCommand: ["go", "build", "-o", "main", "main.go"],
    runCommand: ["./main"],
    starterCode: GO_STARTER,
  },
  javascript: {
    id: "javascript",
    label: "JavaScript",
    fileName: "main.js",
    image: "node:latest",
    compileCommand: null,
    runCommand: ["node", "main.js"],
    starterCode: JAVASCRIPT_STARTER,
  },
};

export const JUDGE_LANGUAGE_OPTIONS = Object.values(JUDGE_LANGUAGE_CONFIGS).map((config) => ({
  id: config.id,
  label: config.label,
}));

export function normalizeJudgeLanguage(language: string | null | undefined): JudgeLanguageId | null {
  if (typeof language !== "string") {
    return null;
  }

  const normalized = language.trim().toLowerCase();

  switch (normalized) {
    case "python":
      return "python";
    case "c":
      return "c";
    case "c++":
    case "cpp":
      return "cpp";
    case "java":
      return "java";
    case "go":
      return "go";
    case "javascript":
    case "js":
      return "javascript";
    default:
      return null;
  }
}

export function getJudgeLanguageConfig(language: JudgeLanguageId): JudgeLanguageConfig {
  return JUDGE_LANGUAGE_CONFIGS[language];
}

export function getJudgeStarterCode(language: JudgeLanguageId): string {
  return JUDGE_LANGUAGE_CONFIGS[language].starterCode;
}
