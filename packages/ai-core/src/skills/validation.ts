import { AutonomyLevel } from "../autonomy/types";
import { SkillRiskLevel, type SkillValidationIssue } from "./types";
import { getSkillToolName } from "./utils";
import type {
  SkillManifest,
  SkillToolRequirement,
  SkillValidationResult,
} from "./types";

export class SkillValidationError extends Error {
  readonly issues: readonly SkillValidationIssue[];

  constructor(issues: readonly SkillValidationIssue[]) {
    super(formatSkillValidationMessage(issues));
    this.name = "SkillValidationError";
    this.issues = issues;
  }
}

export function validateSkillManifest(
  manifest: unknown,
): SkillValidationResult {
  const issues: SkillValidationIssue[] = [];

  if (!isRecord(manifest)) {
    return {
      valid: false,
      issues: [
        {
          field: "manifest",
          message: "Skill manifest must be an object.",
        },
      ],
    };
  }

  if (
    manifest.id !== undefined &&
    (!isNonEmptyString(manifest.id) || manifest.id.trim().length === 0)
  ) {
    issues.push({
      field: "id",
      message: "Skill id must be a non-empty string when provided.",
    });
  }

  if (!isNonEmptyString(manifest.name)) {
    issues.push({
      field: "name",
      message: "Skill name is required.",
    });
  }

  if (!isNonEmptyString(manifest.description)) {
    issues.push({
      field: "description",
      message: "Skill description is required.",
    });
  }

  if (
    manifest.version !== undefined &&
    !isNonEmptyString(manifest.version)
  ) {
    issues.push({
      field: "version",
      message: "Skill version must be a non-empty string when provided.",
    });
  }

  if (!isValidRiskLevel(manifest.riskLevel)) {
    issues.push({
      field: "riskLevel",
      message: "Skill riskLevel must be low, medium, high, or critical.",
    });
  }

  if (!isValidAutonomyLevel(manifest.requiredAutonomyLevel)) {
    issues.push({
      field: "requiredAutonomyLevel",
      message:
        "Skill requiredAutonomyLevel must be manual, confirm_tools, supervised, or autonomous.",
    });
  }

  if (!Array.isArray(manifest.requiredTools)) {
    issues.push({
      field: "requiredTools",
      message: "Skill requiredTools must be an array.",
    });
  } else {
    manifest.requiredTools.forEach((tool, index) => {
      issues.push(...validateSkillToolRequirement(tool, index));
    });
  }

  if (
    manifest.safetyNotes !== undefined &&
    (!Array.isArray(manifest.safetyNotes) ||
      manifest.safetyNotes.some((note) => typeof note !== "string"))
  ) {
    issues.push({
      field: "safetyNotes",
      message: "Skill safetyNotes must be an array of strings when provided.",
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateSkillToolRequirement(
  requirement: unknown,
  index = 0,
): readonly SkillValidationIssue[] {
  const issues: SkillValidationIssue[] = [];
  const fieldPrefix = `requiredTools[${index}]`;

  if (!isRecord(requirement)) {
    return [
      {
        field: fieldPrefix,
        message: "Skill tool requirement must be an object.",
      },
    ];
  }

  const toolName = getSkillToolName(requirement as SkillToolRequirement);

  if (toolName === undefined) {
    issues.push({
      field: `${fieldPrefix}.toolName`,
      message: "Skill tool requirement must include a non-empty toolName.",
    });
  }

  if (
    requirement.isRequired !== undefined &&
    typeof requirement.isRequired !== "boolean"
  ) {
    issues.push({
      field: `${fieldPrefix}.isRequired`,
      message: "Skill tool requirement isRequired must be a boolean.",
    });
  }

  if (
    requirement.required !== undefined &&
    typeof requirement.required !== "boolean"
  ) {
    issues.push({
      field: `${fieldPrefix}.required`,
      message: "Skill tool requirement required must be a boolean.",
    });
  }

  if (
    requirement.reason !== undefined &&
    typeof requirement.reason !== "string"
  ) {
    issues.push({
      field: `${fieldPrefix}.reason`,
      message: "Skill tool requirement reason must be a string when provided.",
    });
  }

  if (
    requirement.riskNote !== undefined &&
    typeof requirement.riskNote !== "string"
  ) {
    issues.push({
      field: `${fieldPrefix}.riskNote`,
      message: "Skill tool requirement riskNote must be a string when provided.",
    });
  }

  if (
    requirement.riskLevel !== undefined &&
    !isValidRiskLevel(requirement.riskLevel)
  ) {
    issues.push({
      field: `${fieldPrefix}.riskLevel`,
      message:
        "Skill tool requirement riskLevel must be low, medium, high, or critical.",
    });
  }

  return issues;
}

export function assertValidSkillManifest(
  manifest: unknown,
): asserts manifest is SkillManifest {
  const validation = validateSkillManifest(manifest);

  if (!validation.valid) {
    throw createSkillValidationError(validation.issues);
  }
}

export function createSkillValidationError(
  issues: readonly SkillValidationIssue[],
): SkillValidationError {
  return new SkillValidationError(issues);
}

function isValidRiskLevel(value: unknown): value is SkillRiskLevel {
  return (
    value === SkillRiskLevel.Low ||
    value === SkillRiskLevel.Medium ||
    value === SkillRiskLevel.High ||
    value === SkillRiskLevel.Critical
  );
}

function isValidAutonomyLevel(value: unknown): value is AutonomyLevel {
  return (
    value === AutonomyLevel.Manual ||
    value === AutonomyLevel.ConfirmTools ||
    value === AutonomyLevel.Supervised ||
    value === AutonomyLevel.Autonomous
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatSkillValidationMessage(
  issues: readonly SkillValidationIssue[],
): string {
  if (issues.length === 0) {
    return "Skill manifest validation failed.";
  }

  return `Skill manifest validation failed: ${issues
    .map((issue) => `${issue.field}: ${issue.message}`)
    .join("; ")}`;
}
