export type JudgeLanguageId =
  | "python"
  | "c"
  | "cpp"
  | "java"
  | "go"
  | "javascript";

export const JUDGE_LANGUAGE_IDS = [
  "python",
  "c",
  "cpp",
  "java",
  "go",
  "javascript",
] as const satisfies readonly JudgeLanguageId[];

export type JudgeSubmissionStatus =
  | "accepted"
  | "wrong_answer"
  | "compile_error"
  | "runtime_error"
  | "time_limit_exceeded"
  | "system_error"
  | "no_test_cases";

export type JudgeCaseStatus =
  | "accepted"
  | "wrong_answer"
  | "runtime_error"
  | "time_limit_exceeded"
  | "system_error";

export interface JudgeLanguageOption {
  id: JudgeLanguageId;
  label: string;
}

export interface JudgeLanguageConfig {
  id: JudgeLanguageId;
  label: string;
  fileName: string;
  image: string;
  compileCommand: readonly string[] | null;
  runCommand: readonly string[];
  starterCode: string;
}

export interface JudgeTestCase {
  input: string;
  expectedOutput: string;
  explanation?: string;
  label?: string;
}

export interface JudgeTestCaseResult {
  index: number;
  label: string;
  status: JudgeCaseStatus;
  durationMs: number;
  inputPreview: string;
  expectedOutputPreview: string;
  actualOutputPreview: string | null;
  stderrPreview: string | null;
}

export interface JudgeSubmissionRequest {
  problemId: string;
  problemTitle: string;
  language: JudgeLanguageId;
  code: string;
  testCases: readonly JudgeTestCase[];
}

export interface JudgeGuardStatusForUi {
  enabled: boolean;
  mode: "dev-only";
  productionReady: false;
  safeToExposeToClient: true;
  notice: string;
  networkNone: true;
  timeoutMs: number;
  memoryMb: number;
  maxOutputBytes: number;
}

export interface JudgeSubmissionResult {
  success: boolean;
  status: JudgeSubmissionStatus;
  statusLabel: string;
  problemId: string;
  problemTitle: string;
  language: JudgeLanguageId;
  languageLabel: string;
  guard: JudgeGuardStatusForUi;
  noTestCases: boolean;
  passedCount: number;
  totalCount: number;
  durationMs: number;
  message: string;
  compileErrorPreview: string | null;
  runtimeErrorPreview: string | null;
  systemErrorPreview: string | null;
  failedCaseIndex: number | null;
  testCaseResults: JudgeTestCaseResult[];
  safeToExposeToClient: true;
  productionReady: false;
}

export function formatJudgeSubmissionStatus(status: JudgeSubmissionStatus): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "wrong_answer":
      return "Wrong Answer";
    case "compile_error":
      return "Compile Error";
    case "runtime_error":
      return "Runtime Error";
    case "time_limit_exceeded":
      return "Time Limit Exceeded";
    case "system_error":
      return "System Error";
    case "no_test_cases":
      return "No Test Cases";
  }
}

export function formatJudgeCaseStatus(status: JudgeCaseStatus): string {
  switch (status) {
    case "accepted":
      return "AC";
    case "wrong_answer":
      return "WA";
    case "runtime_error":
      return "RE";
    case "time_limit_exceeded":
      return "TLE";
    case "system_error":
      return "SE";
  }
}

export function getJudgeLanguageOptions(): readonly JudgeLanguageOption[] {
  return [
    { id: "python", label: "Python" },
    { id: "c", label: "C" },
    { id: "cpp", label: "C++" },
    { id: "java", label: "Java" },
    { id: "go", label: "Go" },
    { id: "javascript", label: "JavaScript" },
  ] as const;
}
