import { compareRiskLevel, isRiskAtLeast, maxRiskLevel } from "./risk";
import {
  AutonomyActionKind,
  AutonomyDecisionKind,
  AutonomyLevel,
  AutonomyRiskLevel,
  type AutonomyActionKind as ActionKind,
  type AutonomyContext,
  type AutonomyDecision,
  type AutonomyDecisionKind as DecisionKind,
  type AutonomyMetadata,
  type AutonomyRiskLevel as RiskLevel,
} from "./types";

const actionKindValues = new Set<string>(Object.values(AutonomyActionKind));

const defaultRiskByActionKind: Record<ActionKind, RiskLevel> = {
  [AutonomyActionKind.Answer]: AutonomyRiskLevel.Low,
  [AutonomyActionKind.ToolCall]: AutonomyRiskLevel.Medium,
  [AutonomyActionKind.SkillRun]: AutonomyRiskLevel.High,
  [AutonomyActionKind.MemoryWrite]: AutonomyRiskLevel.Medium,
  [AutonomyActionKind.BackgroundTask]: AutonomyRiskLevel.High,
};

export interface AutonomyRuleInput {
  autonomyLevel: AutonomyLevel;
  actionKind: ActionKind;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  maxAutoRiskLevel: RiskLevel;
  requireConfirmationAtRiskLevel: RiskLevel;
  denyAtRiskLevel: RiskLevel;
  deniedActionKinds: readonly ActionKind[];
  confirmationRequiredActionKinds: readonly ActionKind[];
}

export interface AutonomyDecisionOptions {
  riskLevel?: RiskLevel | undefined;
  requiredConfirmationMessage?: string | undefined;
  metadata?: AutonomyMetadata | undefined;
}

export function createAutonomyDecision(
  kind: DecisionKind,
  reason: string,
  options: AutonomyDecisionOptions = {},
): AutonomyDecision {
  const decision: AutonomyDecision = {
    kind,
    reason,
  };

  if (options.riskLevel !== undefined) {
    decision.riskLevel = options.riskLevel;
  }

  if (options.requiredConfirmationMessage !== undefined) {
    decision.requiredConfirmationMessage = options.requiredConfirmationMessage;
  }

  if (options.metadata !== undefined) {
    decision.metadata = options.metadata;
  }

  return decision;
}

export function createAllowDecision(
  reason: string,
  options: AutonomyDecisionOptions = {},
): AutonomyDecision {
  return createAutonomyDecision(AutonomyDecisionKind.Allow, reason, options);
}

export function createRequireConfirmationDecision(
  reason: string,
  options: AutonomyDecisionOptions = {},
): AutonomyDecision {
  return createAutonomyDecision(
    AutonomyDecisionKind.RequireConfirmation,
    reason,
    options,
  );
}

export function createDenyDecision(
  reason: string,
  options: AutonomyDecisionOptions = {},
): AutonomyDecision {
  return createAutonomyDecision(AutonomyDecisionKind.Deny, reason, options);
}

export function normalizeActionKind(context: AutonomyContext): ActionKind {
  if (context.actionKind !== undefined) {
    return context.actionKind;
  }

  if (actionKindValues.has(context.requestedAction)) {
    return context.requestedAction as ActionKind;
  }

  if (context.toolRiskLevel !== undefined) {
    return AutonomyActionKind.ToolCall;
  }

  if (context.skillRiskLevel !== undefined) {
    return AutonomyActionKind.SkillRun;
  }

  return AutonomyActionKind.Answer;
}

export function resolveContextRiskLevel(context: AutonomyContext): RiskLevel {
  const actionKind = normalizeActionKind(context);
  const defaultRiskLevel = defaultRiskByActionKind[actionKind];
  const toolRiskLevel =
    actionKind === AutonomyActionKind.ToolCall
      ? (context.toolRiskLevel ?? defaultRiskLevel)
      : context.toolRiskLevel;
  const skillRiskLevel =
    actionKind === AutonomyActionKind.SkillRun
      ? (context.skillRiskLevel ?? defaultRiskLevel)
      : context.skillRiskLevel;

  return (
    maxRiskLevel(
      context.requestedActionRiskLevel,
      toolRiskLevel,
      skillRiskLevel,
      defaultRiskLevel,
    ) ?? defaultRiskLevel
  );
}

export function shouldDenyAction(input: AutonomyRuleInput): boolean {
  if (input.deniedActionKinds.includes(input.actionKind)) {
    return true;
  }

  return isRiskAtLeast(input.riskLevel, input.denyAtRiskLevel);
}

export function shouldRequireConfirmation(input: AutonomyRuleInput): boolean {
  if (input.requiresConfirmation === true) {
    return true;
  }

  if (input.confirmationRequiredActionKinds.includes(input.actionKind)) {
    return true;
  }

  if (
    input.autonomyLevel === AutonomyLevel.Manual &&
    (input.actionKind !== AutonomyActionKind.Answer ||
      compareRiskLevel(input.riskLevel, AutonomyRiskLevel.Low) > 0)
  ) {
    return true;
  }

  if (
    input.autonomyLevel === AutonomyLevel.ConfirmTools &&
    (input.actionKind === AutonomyActionKind.ToolCall ||
      input.actionKind === AutonomyActionKind.SkillRun ||
      input.actionKind === AutonomyActionKind.BackgroundTask ||
      isRiskAtLeast(input.riskLevel, AutonomyRiskLevel.Medium))
  ) {
    return true;
  }

  if (isRiskAtLeast(input.riskLevel, input.requireConfirmationAtRiskLevel)) {
    return true;
  }

  return compareRiskLevel(input.riskLevel, input.maxAutoRiskLevel) > 0;
}
