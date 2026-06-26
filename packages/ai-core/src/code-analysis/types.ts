/**
 * Code Analysis — core types and report schema.
 *
 * Defines the stable types for code analysis input, output,
 * and the structured report schema used by the model gateway.
 *
 * Designation: dev-only · single-turn · no persistence of code data
 */

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export const VALID_LANGUAGES = [
  "auto",
  "cpp",
  "python",
  "java",
  "javascript",
  "typescript",
  "other",
] as const;

export type CodeLanguage = (typeof VALID_LANGUAGES)[number];

export interface CodeAnalysisInput {
  /** Problem statement (optional, but flagged in report if empty) */
  problemStatement: string;

  /** Source code (required) */
  sourceCode: string;

  /** User-selected language, defaults to "auto" */
  selectedLanguage: CodeLanguage;

  /** Optional error information */
  errorInfo?: string;

  /** Optional test information: input data */
  testInput?: string;

  /** Optional test information: actual output */
  actualOutput?: string;

  /** Optional test information: expected output */
  expectedOutput?: string;

  /** Optional test information: failed test cases */
  failedCases?: string;
}

// ---------------------------------------------------------------------------
// Input limits (enforced server-side AND client-side)
// ---------------------------------------------------------------------------

export const CODE_ANALYSIS_LIMITS = {
  maxProblemStatementChars: 30_000,
  maxSourceCodeChars: 50_000,
  maxErrorInfoChars: 10_000,
  maxTestInfoChars: 10_000,
  totalInputHardLimit: 80_000,
  minSourceCodeChars: 1,
} as const;

// ---------------------------------------------------------------------------
// Report schema (as specified in A491)
// ---------------------------------------------------------------------------

export type VerificationStatus =
  | "static_confirmed"
  | "model_inference"
  | "needs_runtime_verification"
  | "insufficient_information";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ConstraintFitStatus = "fits" | "risky" | "does_not_fit" | "unknown";

export interface TaskOverview {
  language: string;
  languageConfidence: number; // 0–1
  hasProblemStatement: boolean;
  hasErrorInformation: boolean;
  hasTestCase: boolean;
}

export interface ProblemUnderstanding {
  summary: string;
  inputOutputUnderstanding: string[];
  constraints: string[];
  assumptions: string[];
  missingInformation: string[];
}

export interface CodeBehavior {
  summary: string;
  mainSteps: string[];
  importantDataStructures: string[];
}

export interface ComplexityEstimate {
  time: {
    best: string | null;
    average: string | null;
    worst: string;
    derivation: string[];
    confidence: number; // 0–1
  };
  space: {
    auxiliary: string;
    total: string | null;
    derivation: string[];
    confidence: number; // 0–1
  };
  constraintFit: {
    status: ConstraintFitStatus;
    reasoning: string;
  };
}

export interface CodeFinding {
  id: string;
  severity: FindingSeverity;
  category: string;

  startLine: number | null;
  endLine: number | null;

  title: string;
  evidence: string;
  trigger: string | null;
  rootCause: string;
  suggestedFix: string;

  confidence: number; // 0–1
  verification: VerificationStatus;
}

export interface PatchSuggestion {
  findingId: string;
  description: string;
  diff: string;
  isMinimalPatch: boolean;
  verification: "not_executed" | "static_only";
}

export interface FinalAssessment {
  summary: string;
  overallConfidence: number; // 0–1
  requiresRuntimeVerification: boolean;
}

export interface CodeAnalysisReport {
  reportVersion: "1";

  taskOverview: TaskOverview;

  problemUnderstanding: ProblemUnderstanding;

  codeBehavior: CodeBehavior;

  complexity: ComplexityEstimate;

  findings: CodeFinding[];

  patchSuggestions: PatchSuggestion[];

  unconfirmedIssues: string[];

  finalAssessment: FinalAssessment;
}

// ---------------------------------------------------------------------------
// Pre-analysis deterministic output
// ---------------------------------------------------------------------------

export interface PreAnalysisResult {
  /** Detected or user-selected language */
  language: string;
  languageConfidence: number;
  /** Whether language was auto-detected or user-selected */
  languageSource: "auto" | "manual";

  /** Source code metadata */
  lineCount: number;
  charCount: number;
  hasMainEntry: boolean;
  hasNestedLoops: boolean;
  hasRecursion: boolean;

  /** Whether user-provided error info references specific lines */
  errorLinesMentioned: number[];

  /** Whether data range/constraints were provided in problem statement */
  hasDataRange: boolean;
  hasFailedCases: boolean;
}

// ---------------------------------------------------------------------------
// Agent event types for code analysis
// ---------------------------------------------------------------------------

export type CodeAnalysisStep =
  | "validating_input"
  | "identifying_language"
  | "preparing_context"
  | "calling_model"
  | "validating_report"
  | "completed"
  | "failed";

export interface CodeAnalysisEvent {
  step: CodeAnalysisStep;
  status: "pending" | "running" | "completed" | "failed";
  timestamp: string;
  durationMs: number;
  summary: string;
  /** Safe metadata — no secrets, no raw prompts */
  metadata?: {
    modelName?: string;
    tokenCount?: number;
    hadFormatRepair?: boolean;
  };
}

export interface CodeAnalysisTimeline {
  events: CodeAnalysisEvent[];
  totalDurationMs: number;
  modelCallCount: number;
  hadFormatRepair: boolean;
}

// ---------------------------------------------------------------------------
// Safe error types
// ---------------------------------------------------------------------------

export type CodeAnalysisErrorCode =
  | "NOT_AUTHENTICATED"
  | "NO_MODEL_CONFIGURED"
  | "PROVIDER_DISABLED"
  | "CREDENTIAL_DECRYPT_FAILED"
  | "EMPTY_CODE"
  | "CODE_TOO_LONG"
  | "INPUT_TOO_LONG"
  | "MODEL_TIMEOUT"
  | "MODEL_UNAUTHORIZED"
  | "MODEL_FORBIDDEN"
  | "MODEL_RATE_LIMITED"
  | "MODEL_SERVER_ERROR"
  | "INVALID_JSON"
  | "SCHEMA_MISMATCH"
  | "OUTPUT_TRUNCATED"
  | "MODEL_REFUSED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export interface CodeAnalysisError {
  code: CodeAnalysisErrorCode;
  safeMessage: string; // Safe for UI display — Chinese
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface CodeAnalysisResult {
  success: boolean;
  report: CodeAnalysisReport | null;
  timeline: CodeAnalysisTimeline;
  error: CodeAnalysisError | null;
  /** Model info for display — no secrets */
  modelInfo: {
    providerName: string;
    modelDisplayName: string;
    usageType: string;
    isFallback: boolean;
  } | null;
}
