import type { AutonomyLevel } from "../autonomy/types";
import type { ToolDefinition, ToolRiskLevel } from "../tools/types";

type JsonPrimitive = string | number | boolean | null;
export type SkillJsonValue =
  | JsonPrimitive
  | { readonly [key: string]: SkillJsonValue }
  | readonly SkillJsonValue[];

export type SkillMetadata = { readonly [key: string]: SkillJsonValue };

export const SkillRiskLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
} as const;

export type SkillRiskLevel =
  (typeof SkillRiskLevel)[keyof typeof SkillRiskLevel];

export const SkillStatus = {
  Draft: "draft",
  Installed: "installed",
  Disabled: "disabled",
  Archived: "archived",
} as const;

export type SkillStatus = (typeof SkillStatus)[keyof typeof SkillStatus];

export interface SkillToolRequirement {
  toolName?: string;
  name?: string;
  isRequired?: boolean;
  reason?: string;
  required?: boolean;
  riskLevel?: SkillRiskLevel | ToolRiskLevel;
  riskNote?: string;
}

export interface SkillManifest {
  id?: string;
  name: string;
  description: string;
  version?: string;
  status?: SkillStatus;
  riskLevel: SkillRiskLevel;
  requiredAutonomyLevel: AutonomyLevel;
  requiredTools: readonly SkillToolRequirement[];
  safetyNotes?: readonly string[];
  metadata?: SkillMetadata;
}

export interface SkillManifestRequest {
  id?: string;
  skillId?: string;
  name?: string;
  skillName?: string;
  source?: string;
  metadata?: SkillMetadata;
}

export interface SkillInstallReviewRequest {
  manifest?: SkillManifest;
  id?: string;
  skillId?: string;
  name?: string;
  skillName?: string;
  currentAutonomyLevel?: AutonomyLevel;
  availableTools?: readonly string[];
  toolDefinitions?: readonly ToolDefinition[];
  requestedByUserId?: string;
  metadata?: SkillMetadata;
}

export interface SkillInstallReview {
  manifest: SkillManifest;
  skillName: string;
  skillId?: string;
  riskLevel: SkillRiskLevel;
  requiredAutonomyLevel: AutonomyLevel;
  requiredTools: readonly SkillToolRequirement[];
  safetyNotes: readonly string[];
  blockers: readonly string[];
  recommended: boolean;
  approved: boolean;
  warnings: readonly string[];
  requiredConfirmations?: readonly string[];
  metadata?: SkillMetadata;
}

export interface SkillInstallReviewOptions {
  currentAutonomyLevel?: AutonomyLevel;
  availableTools?: readonly string[];
  toolDefinitions?: readonly ToolDefinition[];
  metadata?: SkillMetadata;
}

export interface SkillValidationIssue {
  field: string;
  message: string;
}

export interface SkillValidationResult {
  valid: boolean;
  issues: readonly SkillValidationIssue[];
}

export interface SkillRegistry {
  register(manifest: SkillManifest): SkillManifest;
  getById(id: string): SkillManifest | undefined;
  getByName(name: string): SkillManifest | undefined;
  list(): SkillManifest[];
  has(idOrName: string): boolean;
}

export interface SkillRuntime {
  getManifest(request: SkillManifestRequest): Promise<SkillManifest>;
  reviewInstall(
    request: SkillInstallReviewRequest,
  ): Promise<SkillInstallReview>;
}
