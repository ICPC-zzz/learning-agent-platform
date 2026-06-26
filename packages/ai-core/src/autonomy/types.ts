import type { SkillRiskLevel } from "../skills/types";
import type { ToolRiskLevel } from "../tools/types";

type JsonPrimitive = string | number | boolean | null;
type JsonValue =
  | JsonPrimitive
  | { readonly [key: string]: JsonValue }
  | readonly JsonValue[];

export type AutonomyMetadata = { readonly [key: string]: JsonValue };

export const AutonomyRiskLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
} as const;

export type AutonomyRiskLevel =
  | (typeof AutonomyRiskLevel)[keyof typeof AutonomyRiskLevel]
  | ToolRiskLevel
  | SkillRiskLevel;

export const AutonomyLevel = {
  Manual: "manual",
  ConfirmTools: "confirm_tools",
  Supervised: "supervised",
  Autonomous: "autonomous",
} as const;

export type AutonomyLevel =
  (typeof AutonomyLevel)[keyof typeof AutonomyLevel];

export const AutonomyDecisionKind = {
  Allow: "allow",
  RequireConfirmation: "require_confirmation",
  Deny: "deny",
} as const;

export type AutonomyDecisionKind =
  (typeof AutonomyDecisionKind)[keyof typeof AutonomyDecisionKind];

export const AutonomyActionKind = {
  Answer: "answer",
  ToolCall: "tool_call",
  SkillRun: "skill_run",
  MemoryWrite: "memory_write",
  BackgroundTask: "background_task",
} as const;

export type AutonomyActionKind =
  (typeof AutonomyActionKind)[keyof typeof AutonomyActionKind];

export interface AutonomyContext {
  requestedAction: string;
  actionKind?: AutonomyActionKind;
  userId?: string;
  autonomyLevel?: AutonomyLevel;
  toolRiskLevel?: ToolRiskLevel;
  skillRiskLevel?: SkillRiskLevel;
  requestedActionRiskLevel?: AutonomyRiskLevel;
  requiresConfirmation?: boolean;
  metadata?: AutonomyMetadata;
}

export interface AutonomyDecision {
  kind: AutonomyDecisionKind;
  reason: string;
  riskLevel?: AutonomyRiskLevel;
  requiredConfirmationMessage?: string;
  metadata?: AutonomyMetadata;
}

export interface AutonomyPolicy {
  decide(context: AutonomyContext): Promise<AutonomyDecision>;
}

export interface AutonomyPolicyConfig {
  defaultLevel?: AutonomyLevel;
  maxAutoRiskLevel?: AutonomyRiskLevel;
  requireConfirmationAtRiskLevel?: AutonomyRiskLevel;
  denyAtRiskLevel?: AutonomyRiskLevel;
  deniedActionKinds?: readonly AutonomyActionKind[];
  confirmationRequiredActionKinds?: readonly AutonomyActionKind[];
}
