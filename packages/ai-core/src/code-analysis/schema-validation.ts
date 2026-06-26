/**
 * Code Analysis Report Schema Validation.
 *
 * Validates the structured report returned by the model.
 * Used after JSON parsing to ensure the report conforms to the expected schema.
 * Returns detailed validation errors for incomplete/malformed reports.
 */

import type {
  CodeAnalysisReport,
  CodeFinding,
  ConstraintFitStatus,
  FindingSeverity,
  PatchSuggestion,
  VerificationStatus,
} from "./types.ts";

export interface SchemaValidationError {
  path: string;
  message: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
  report: CodeAnalysisReport | null;
}

const VALID_SEVERITIES: Set<string> = new Set(["critical", "high", "medium", "low", "info"]);
const VALID_VERIFICATIONS: Set<string> = new Set([
  "static_confirmed",
  "model_inference",
  "needs_runtime_verification",
  "insufficient_information",
]);
const VALID_CONSTRAINT_STATUSES: Set<string> = new Set(["fits", "risky", "does_not_fit", "unknown"]);

/**
 * Validate a parsed JSON object against the CodeAnalysisReport schema.
 * Returns a sanitized report and any validation errors.
 */
export function validateReportSchema(parsed: unknown): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push({ path: "$", message: "报告必须是 JSON 对象" });
    return { valid: false, errors, warnings, report: null };
  }

  const obj = parsed as Record<string, unknown>;

  // reportVersion
  if (obj.reportVersion !== "1") {
    errors.push({ path: "reportVersion", message: "reportVersion 必须为 '1'" });
  }

  // taskOverview
  const taskOverview = validateTaskOverview(obj.taskOverview);
  errors.push(...taskOverview.errors);

  // problemUnderstanding
  const problemUnderstanding = validateProblemUnderstanding(obj.problemUnderstanding);
  errors.push(...problemUnderstanding.errors);
  warnings.push(...problemUnderstanding.warnings);

  // codeBehavior
  const codeBehavior = validateCodeBehavior(obj.codeBehavior);
  errors.push(...codeBehavior.errors);

  // complexity
  const complexity = validateComplexity(obj.complexity);
  errors.push(...complexity.errors);

  // findings
  const findingsResult = validateFindings(obj.findings);
  errors.push(...findingsResult.errors);
  warnings.push(...findingsResult.warnings);

  // patchSuggestions
  const patchesResult = validatePatchSuggestions(obj.patchSuggestions, findingsResult.ids);
  errors.push(...patchesResult.errors);
  warnings.push(...patchesResult.warnings);

  // unconfirmedIssues
  const unconfirmedIssues = validateStringArray(obj.unconfirmedIssues, "unconfirmedIssues");
  if (unconfirmedIssues.errors.length) errors.push(...unconfirmedIssues.errors);

  // finalAssessment
  const finalAssessment = validateFinalAssessment(obj.finalAssessment);
  errors.push(...finalAssessment.errors);

  const valid = errors.length === 0;

  // Build sanitized report (even with errors, return what we can)
  const report: CodeAnalysisReport = {
    reportVersion: "1",
    taskOverview: taskOverview.value,
    problemUnderstanding: problemUnderstanding.value,
    codeBehavior: codeBehavior.value,
    complexity: complexity.value,
    findings: findingsResult.value,
    patchSuggestions: patchesResult.value,
    unconfirmedIssues: unconfirmedIssues.value,
    finalAssessment: finalAssessment.value,
  };

  return { valid, errors, warnings, report };
}

// ---------------------------------------------------------------------------
// Individual section validators
// ---------------------------------------------------------------------------

function validateTaskOverview(value: unknown): { errors: SchemaValidationError[]; value: CodeAnalysisReport["taskOverview"] } {
  const errors: SchemaValidationError[] = [];
  const obj = asObject(value, "taskOverview");

  const result = {
    language: asString(obj?.language, "taskOverview.language", "unknown"),
    languageConfidence: asNumber(obj?.languageConfidence, "taskOverview.languageConfidence", 0, 1, 0),
    hasProblemStatement: asBoolean(obj?.hasProblemStatement, "taskOverview.hasProblemStatement"),
    hasErrorInformation: asBoolean(obj?.hasErrorInformation, "taskOverview.hasErrorInformation"),
    hasTestCase: asBoolean(obj?.hasTestCase, "taskOverview.hasTestCase"),
  };

  if (typeof obj?.language !== "string") {
    errors.push({ path: "taskOverview.language", message: "language 必须为字符串" });
  }

  return { errors, value: result };
}

function validateProblemUnderstanding(value: unknown): {
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
  value: CodeAnalysisReport["problemUnderstanding"];
} {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const obj = asObject(value, "problemUnderstanding");

  const summary = asString(obj?.summary, "problemUnderstanding.summary", "");
  if (summary.length === 0) {
    warnings.push({ path: "problemUnderstanding.summary", message: "题目理解摘要为空" });
  }

  const iou = validateStringArray(obj?.inputOutputUnderstanding, "problemUnderstanding.inputOutputUnderstanding");
  const constraints = validateStringArray(obj?.constraints, "problemUnderstanding.constraints");
  const assumptions = validateStringArray(obj?.assumptions, "problemUnderstanding.assumptions");
  const missing = validateStringArray(obj?.missingInformation, "problemUnderstanding.missingInformation");

  return {
    errors,
    warnings,
    value: {
      summary,
      inputOutputUnderstanding: iou.value,
      constraints: constraints.value,
      assumptions: assumptions.value,
      missingInformation: missing.value,
    },
  };
}

function validateCodeBehavior(value: unknown): { errors: SchemaValidationError[]; value: CodeAnalysisReport["codeBehavior"] } {
  const errors: SchemaValidationError[] = [];
  const obj = asObject(value, "codeBehavior");

  const summary = asString(obj?.summary, "codeBehavior.summary", "");
  const mainSteps = validateStringArray(obj?.mainSteps, "codeBehavior.mainSteps");
  const dataStructures = validateStringArray(obj?.importantDataStructures, "codeBehavior.importantDataStructures");

  if (summary.length === 0) {
    errors.push({ path: "codeBehavior.summary", message: "代码行为摘要不能为空" });
  }

  return {
    errors,
    value: { summary, mainSteps: mainSteps.value, importantDataStructures: dataStructures.value },
  };
}

function validateComplexity(value: unknown): { errors: SchemaValidationError[]; value: CodeAnalysisReport["complexity"] } {
  const errors: SchemaValidationError[] = [];
  const obj = asObject(value, "complexity");

  const timeObj = asObject(obj?.time, "complexity.time");
  const spaceObj = asObject(obj?.space, "complexity.space");
  const constraintObj = asObject(obj?.constraintFit, "complexity.constraintFit");

  const time = {
    best: asStringOrNull(timeObj?.best, "complexity.time.best"),
    average: asStringOrNull(timeObj?.average, "complexity.time.average"),
    worst: asString(timeObj?.worst, "complexity.time.worst", ""),
    derivation: validateStringArray(timeObj?.derivation, "complexity.time.derivation").value,
    confidence: asNumber(timeObj?.confidence, "complexity.time.confidence", 0, 1, 0.5),
  };

  if (time.worst.length === 0) {
    errors.push({ path: "complexity.time.worst", message: "最坏时间复杂度不能为空" });
  }
  if (time.derivation.length === 0) {
    errors.push({ path: "complexity.time.derivation", message: "时间复杂度推导依据不能为空" });
  }

  const space = {
    auxiliary: asString(spaceObj?.auxiliary, "complexity.space.auxiliary", ""),
    total: asStringOrNull(spaceObj?.total, "complexity.space.total"),
    derivation: validateStringArray(spaceObj?.derivation, "complexity.space.derivation").value,
    confidence: asNumber(spaceObj?.confidence, "complexity.space.confidence", 0, 1, 0.5),
  };

  if (space.auxiliary.length === 0) {
    errors.push({ path: "complexity.space.auxiliary", message: "辅助空间复杂度不能为空" });
  }

  const constraintFitStatus = asString(constraintObj?.status, "complexity.constraintFit.status", "unknown");
  if (!VALID_CONSTRAINT_STATUSES.has(constraintFitStatus)) {
    errors.push({ path: "complexity.constraintFit.status", message: `无效的约束匹配状态: ${constraintFitStatus}` });
  }

  const constraintFit = {
    status: constraintFitStatus as ConstraintFitStatus,
    reasoning: asString(constraintObj?.reasoning, "complexity.constraintFit.reasoning", ""),
  };

  return { errors, value: { time, space, constraintFit } };
}

function validateFindings(value: unknown): {
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
  value: CodeFinding[];
  ids: Set<string>;
} {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];
  const ids = new Set<string>();

  if (!Array.isArray(value)) {
    errors.push({ path: "findings", message: "findings 必须为数组" });
    return { errors, warnings, value: [], ids };
  }

  const arr = value as unknown[];
  const findings: CodeFinding[] = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== "object") {
      errors.push({ path: `findings[${i}]`, message: "每项 finding 必须为对象" });
      continue;
    }

    const obj = item as Record<string, unknown>;
    const finding: CodeFinding = {
      id: asString(obj.id, `findings[${i}].id`, `finding-${i + 1}`),
      severity: validateSeverity(obj.severity, `findings[${i}].severity`, errors),
      category: asString(obj.category, `findings[${i}].category`, "未分类"),

      startLine: asNumberOrNull(obj.startLine, `findings[${i}].startLine`, 1),
      endLine: asNumberOrNull(obj.endLine, `findings[${i}].endLine`, 1),

      title: asString(obj.title, `findings[${i}].title`, ""),
      evidence: asString(obj.evidence, `findings[${i}].evidence`, ""),
      trigger: asStringOrNull(obj.trigger, `findings[${i}].trigger`),
      rootCause: asString(obj.rootCause, `findings[${i}].rootCause`, ""),
      suggestedFix: asString(obj.suggestedFix, `findings[${i}].suggestedFix`, ""),

      confidence: asNumber(obj.confidence, `findings[${i}].confidence`, 0, 1, 0.5),
      verification: validateVerification(obj.verification, `findings[${i}].verification`, errors),
    };

    if (finding.title.length === 0) {
      errors.push({ path: `findings[${i}].title`, message: "问题标题不能为空" });
    }
    if (finding.evidence.length === 0) {
      errors.push({ path: `findings[${i}].evidence`, message: "问题证据不能为空" });
    }
    if (finding.rootCause.length === 0) {
      errors.push({ path: `findings[${i}].rootCause`, message: "根因分析不能为空" });
    }
    if (finding.startLine !== null && finding.startLine < 1) {
      errors.push({ path: `findings[${i}].startLine`, message: "行号必须 >= 1" });
    }

    ids.add(finding.id);
    findings.push(finding);
  }

  if (findings.length === 0) {
    warnings.push({ path: "findings", message: "未发现代码问题" });
  }

  return { errors, warnings, value: findings, ids };
}

function validatePatchSuggestions(value: unknown, findingIds: Set<string>): {
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
  value: PatchSuggestion[];
} {
  const errors: SchemaValidationError[] = [];
  const warnings: SchemaValidationError[] = [];

  if (!Array.isArray(value)) {
    // Patches are optional — empty array is fine
    return { errors, warnings, value: [] };
  }

  const arr = value as unknown[];
  const patches: PatchSuggestion[] = [];

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (!item || typeof item !== "object") {
      errors.push({ path: `patchSuggestions[${i}]`, message: "每项 patch 必须为对象" });
      continue;
    }

    const obj = item as Record<string, unknown>;
    const findingId = asString(obj.findingId, `patchSuggestions[${i}].findingId`, "");

    if (findingId.length > 0 && !findingIds.has(findingId)) {
      warnings.push({ path: `patchSuggestions[${i}].findingId`, message: `findingId "${findingId}" 不存在于 findings 中` });
    }

    const verification = obj.verification;
    let verifValue: "not_executed" | "static_only" = "static_only";
    if (verification === "not_executed" || verification === "static_only") {
      verifValue = verification;
    }

    patches.push({
      findingId,
      description: asString(obj.description, `patchSuggestions[${i}].description`, ""),
      diff: asString(obj.diff, `patchSuggestions[${i}].diff`, ""),
      isMinimalPatch: Boolean(obj.isMinimalPatch),
      verification: verifValue,
    });

    if (patches[i].diff.length === 0) {
      errors.push({ path: `patchSuggestions[${i}].diff`, message: "diff 不能为空" });
    }
  }

  return { errors, warnings, value: patches };
}

function validateFinalAssessment(value: unknown): { errors: SchemaValidationError[]; value: CodeAnalysisReport["finalAssessment"] } {
  const errors: SchemaValidationError[] = [];
  const obj = asObject(value, "finalAssessment");

  const summary = asString(obj?.summary, "finalAssessment.summary", "");
  const overallConfidence = asNumber(obj?.overallConfidence, "finalAssessment.overallConfidence", 0, 1, 0.5);
  const requiresRuntimeVerification = asBoolean(obj?.requiresRuntimeVerification, "finalAssessment.requiresRuntimeVerification");

  if (summary.length === 0) {
    errors.push({ path: "finalAssessment.summary", message: "最终评估摘要不能为空" });
  }

  return { errors, value: { summary, overallConfidence, requiresRuntimeVerification } };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateStringArray(value: unknown, path: string): { errors: SchemaValidationError[]; value: string[] } {
  const errors: SchemaValidationError[] = [];
  if (!Array.isArray(value)) {
    errors.push({ path, message: "必须为字符串数组" });
    return { errors, value: [] };
  }
  const arr = (value as unknown[]).map((item) => (typeof item === "string" ? item : String(item ?? "")));
  return { errors, value: arr };
}

function validateSeverity(value: unknown, path: string, errors: SchemaValidationError[]): FindingSeverity {
  if (typeof value !== "string" || !VALID_SEVERITIES.has(value)) {
    errors.push({ path, message: `无效的严重程度: ${String(value)}` });
    return "info";
  }
  return value as FindingSeverity;
}

function validateVerification(value: unknown, path: string, errors: SchemaValidationError[]): VerificationStatus {
  if (typeof value !== "string" || !VALID_VERIFICATIONS.has(value)) {
    errors.push({ path, message: `无效的验证状态: ${String(value)}` });
    return "model_inference";
  }
  return value as VerificationStatus;
}

// ---------------------------------------------------------------------------
// Type assertion helpers
// ---------------------------------------------------------------------------

function asObject(value: unknown, path: string): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, _path: string, defaultVal: string): string {
  if (typeof value !== "string") return defaultVal;
  return value;
}

function asStringOrNull(value: unknown, _path: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value;
}

function asBoolean(value: unknown, _path: string): boolean {
  return Boolean(value);
}

function asNumber(value: unknown, _path: string, min: number, max: number, defaultVal: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return defaultVal;
  return Math.max(min, Math.min(max, value));
}

function asNumberOrNull(value: unknown, _path: string, _defaultVal?: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1) return null;
  return Math.floor(value);
}

// ---------------------------------------------------------------------------
// JSON extraction from model output
// ---------------------------------------------------------------------------

/**
 * Try to extract JSON from a model response that might contain markdown fences
 * or extra text around the JSON object.
 */
export function extractJsonFromResponse(text: string): string | null {
  const trimmed = text.trim();

  // Try direct parse first
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }

  // Try extracting from markdown code fence (```json ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try {
      JSON.parse(inner);
      return inner;
    } catch {
      // continue
    }
  }

  // Try finding the outermost { ... } pair
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  return null;
}
