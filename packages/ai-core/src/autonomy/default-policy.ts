import {
  createAllowDecision,
  createDenyDecision,
  createRequireConfirmationDecision,
  normalizeActionKind,
  resolveContextRiskLevel,
  shouldDenyAction,
  shouldRequireConfirmation,
} from "./utils";
import {
  AutonomyActionKind,
  AutonomyLevel,
  AutonomyRiskLevel,
  type AutonomyActionKind as ActionKind,
  type AutonomyContext,
  type AutonomyDecision,
  type AutonomyPolicy,
  type AutonomyPolicyConfig,
  type AutonomyRiskLevel as RiskLevel,
} from "./types";

interface ResolvedAutonomyPolicyConfig {
  defaultLevel: AutonomyLevel;
  maxAutoRiskLevel: RiskLevel;
  requireConfirmationAtRiskLevel: RiskLevel;
  denyAtRiskLevel: RiskLevel;
  deniedActionKinds: readonly ActionKind[];
  confirmationRequiredActionKinds: readonly ActionKind[];
}

export const DEFAULT_AUTONOMY_POLICY_CONFIG: ResolvedAutonomyPolicyConfig = {
  defaultLevel: AutonomyLevel.Manual,
  maxAutoRiskLevel: AutonomyRiskLevel.Medium,
  requireConfirmationAtRiskLevel: AutonomyRiskLevel.High,
  denyAtRiskLevel: AutonomyRiskLevel.Critical,
  deniedActionKinds: [],
  confirmationRequiredActionKinds: [AutonomyActionKind.BackgroundTask],
};

export class DefaultAutonomyPolicy implements AutonomyPolicy {
  private readonly config: ResolvedAutonomyPolicyConfig;

  constructor(config: AutonomyPolicyConfig = {}) {
    this.config = {
      ...DEFAULT_AUTONOMY_POLICY_CONFIG,
      ...config,
      deniedActionKinds:
        config.deniedActionKinds ??
        DEFAULT_AUTONOMY_POLICY_CONFIG.deniedActionKinds,
      confirmationRequiredActionKinds:
        config.confirmationRequiredActionKinds ??
        DEFAULT_AUTONOMY_POLICY_CONFIG.confirmationRequiredActionKinds,
    };
  }

  async decide(context: AutonomyContext): Promise<AutonomyDecision> {
    const actionKind = normalizeActionKind(context);
    const autonomyLevel = context.autonomyLevel ?? this.config.defaultLevel;
    const riskLevel = resolveContextRiskLevel(context);
    const ruleInput = {
      autonomyLevel,
      actionKind,
      riskLevel,
      requiresConfirmation: context.requiresConfirmation === true,
      maxAutoRiskLevel: this.config.maxAutoRiskLevel,
      requireConfirmationAtRiskLevel:
        this.config.requireConfirmationAtRiskLevel,
      denyAtRiskLevel: this.config.denyAtRiskLevel,
      deniedActionKinds: this.config.deniedActionKinds,
      confirmationRequiredActionKinds:
        this.config.confirmationRequiredActionKinds,
    };

    if (shouldDenyAction(ruleInput)) {
      return createDenyDecision(this.getDenyReason(actionKind, riskLevel), {
        riskLevel,
        metadata: context.metadata,
      });
    }

    if (shouldRequireConfirmation(ruleInput)) {
      return createRequireConfirmationDecision(
        this.getConfirmationReason(actionKind, riskLevel, autonomyLevel),
        {
          riskLevel,
          requiredConfirmationMessage: `${context.requestedAction} requires user confirmation before execution.`,
          metadata: context.metadata,
        },
      );
    }

    return createAllowDecision(
      `${actionKind} is allowed at ${riskLevel} risk for ${autonomyLevel} autonomy.`,
      {
        riskLevel,
        metadata: context.metadata,
      },
    );
  }

  private getDenyReason(actionKind: ActionKind, riskLevel: RiskLevel): string {
    if (this.config.deniedActionKinds.includes(actionKind)) {
      return `${actionKind} is denied by autonomy policy configuration.`;
    }

    return `${riskLevel} risk meets the deny threshold.`;
  }

  private getConfirmationReason(
    actionKind: ActionKind,
    riskLevel: RiskLevel,
    autonomyLevel: AutonomyLevel,
  ): string {
    if (actionKind === AutonomyActionKind.BackgroundTask) {
      return "Background tasks require user confirmation.";
    }

    return `${actionKind} at ${riskLevel} risk requires confirmation for ${autonomyLevel} autonomy.`;
  }
}
