import { AutonomyLevel } from "../autonomy/types";
import { SkillRiskLevel } from "./types";
import { assertValidSkillManifest } from "./validation";
import {
  cloneSkillManifest,
  compareSkillRiskToAutonomy,
  getSkillToolName,
  hasRequiredAutonomyLevel,
  isRequiredTool,
} from "./utils";
import type { ToolDefinition, ToolRiskLevel } from "../tools/types";
import type {
  SkillInstallReview,
  SkillInstallReviewOptions,
  SkillManifest,
  SkillToolRequirement,
} from "./types";

export function createSkillInstallReview(
  manifest: SkillManifest,
  options: SkillInstallReviewOptions = {},
): SkillInstallReview {
  assertValidSkillManifest(manifest);

  const warnings = getSkillReviewWarnings(manifest, options);
  const blockers = getSkillReviewBlockers(manifest, options);
  const recommended = isSkillRecommendedForInstall(manifest, options);
  const requiredConfirmations = getRequiredConfirmations(manifest);
  const clonedManifest = cloneSkillManifest(manifest);
  const review: SkillInstallReview = {
    manifest: clonedManifest,
    skillName: manifest.name,
    riskLevel: manifest.riskLevel,
    requiredAutonomyLevel: manifest.requiredAutonomyLevel,
    requiredTools: manifest.requiredTools.map((tool) => ({ ...tool })),
    safetyNotes: manifest.safetyNotes === undefined ? [] : [...manifest.safetyNotes],
    warnings,
    blockers,
    recommended,
    approved: recommended,
    requiredConfirmations,
  };

  if (manifest.id !== undefined) {
    review.skillId = manifest.id;
  }

  if (options.metadata !== undefined) {
    review.metadata = options.metadata;
  }

  return review;
}

export function getSkillReviewWarnings(
  manifest: SkillManifest,
  options: SkillInstallReviewOptions = {},
): string[] {
  assertValidSkillManifest(manifest);

  const warnings: string[] = [];
  const currentAutonomyLevel =
    options.currentAutonomyLevel ?? AutonomyLevel.Manual;
  const toolDefinitionsByName = createToolDefinitionsByName(
    options.toolDefinitions,
  );
  const availability = createToolAvailability(options);

  if (manifest.riskLevel === SkillRiskLevel.Medium) {
    warnings.push(
      `Skill "${manifest.name}" has medium risk and should be reviewed before installation.`,
    );
  }

  if (manifest.riskLevel === SkillRiskLevel.High) {
    warnings.push(
      `Skill "${manifest.name}" has high risk and is not recommended by default.`,
    );
  }

  if (compareSkillRiskToAutonomy(manifest.riskLevel, currentAutonomyLevel) < 0) {
    warnings.push(
      `Current autonomy level "${currentAutonomyLevel}" is below the conservative default for ${manifest.riskLevel} risk skills.`,
    );
  }

  for (const requirement of manifest.requiredTools) {
    const toolName = getSkillToolName(requirement);

    if (toolName === undefined) {
      continue;
    }

    const toolRiskLevel = getToolRiskLevel(requirement, toolDefinitionsByName);

    if (toolRiskLevel === SkillRiskLevel.High) {
      warnings.push(`Required tool "${toolName}" has high risk.`);
    }

    if (toolRiskLevel === SkillRiskLevel.Critical) {
      warnings.push(`Required tool "${toolName}" has critical risk.`);
    }

    if (
      availability !== undefined &&
      !availability.has(normalizeToolName(toolName)) &&
      !isRequiredTool(requirement)
    ) {
      warnings.push(`Optional tool "${toolName}" is not currently available.`);
    }

    if (requirement.riskNote !== undefined && requirement.riskNote.length > 0) {
      warnings.push(`Tool "${toolName}" risk note: ${requirement.riskNote}`);
    }
  }

  return warnings;
}

export function getSkillReviewBlockers(
  manifest: SkillManifest,
  options: SkillInstallReviewOptions = {},
): string[] {
  assertValidSkillManifest(manifest);

  const blockers: string[] = [];
  const currentAutonomyLevel =
    options.currentAutonomyLevel ?? AutonomyLevel.Manual;
  const toolDefinitionsByName = createToolDefinitionsByName(
    options.toolDefinitions,
  );
  const availability = createToolAvailability(options);

  if (manifest.riskLevel === SkillRiskLevel.Critical) {
    blockers.push(
      `Skill "${manifest.name}" has critical risk and is not recommended for installation by default.`,
    );
  }

  if (
    !hasRequiredAutonomyLevel(
      currentAutonomyLevel,
      manifest.requiredAutonomyLevel,
    )
  ) {
    blockers.push(
      `Skill "${manifest.name}" requires autonomy level "${manifest.requiredAutonomyLevel}", but current level is "${currentAutonomyLevel}".`,
    );
  }

  for (const requirement of manifest.requiredTools) {
    const toolName = getSkillToolName(requirement);

    if (toolName === undefined) {
      continue;
    }

    if (
      availability !== undefined &&
      !availability.has(normalizeToolName(toolName)) &&
      isRequiredTool(requirement)
    ) {
      blockers.push(`Required tool "${toolName}" is not currently available.`);
    }

    if (
      isRequiredTool(requirement) &&
      getToolRiskLevel(requirement, toolDefinitionsByName) ===
        SkillRiskLevel.Critical
    ) {
      blockers.push(`Required tool "${toolName}" has critical risk.`);
    }
  }

  return blockers;
}

export function isSkillRecommendedForInstall(
  manifest: SkillManifest,
  options: SkillInstallReviewOptions = {},
): boolean {
  assertValidSkillManifest(manifest);

  if (
    manifest.riskLevel === SkillRiskLevel.High ||
    manifest.riskLevel === SkillRiskLevel.Critical
  ) {
    return false;
  }

  return getSkillReviewBlockers(manifest, options).length === 0;
}

function getRequiredConfirmations(manifest: SkillManifest): string[] {
  const confirmations: string[] = [];

  if (
    manifest.riskLevel === SkillRiskLevel.Medium ||
    manifest.riskLevel === SkillRiskLevel.High ||
    manifest.riskLevel === SkillRiskLevel.Critical
  ) {
    confirmations.push(
      `Review and accept ${manifest.riskLevel} risk before installing "${manifest.name}".`,
    );
  }

  if (manifest.requiredTools.length > 0) {
    confirmations.push(
      `Review required tools for "${manifest.name}" before installation.`,
    );
  }

  return confirmations;
}

function createToolAvailability(
  options: SkillInstallReviewOptions,
): Set<string> | undefined {
  if (
    options.availableTools === undefined &&
    options.toolDefinitions === undefined
  ) {
    return undefined;
  }

  const availableToolNames = [
    ...(options.availableTools ?? []),
    ...(options.toolDefinitions ?? []).map((tool) => tool.name),
  ];

  return new Set(availableToolNames.map((toolName) => normalizeToolName(toolName)));
}

function createToolDefinitionsByName(
  toolDefinitions: readonly ToolDefinition[] | undefined,
): Map<string, ToolDefinition> {
  const toolDefinitionsByName = new Map<string, ToolDefinition>();

  for (const toolDefinition of toolDefinitions ?? []) {
    toolDefinitionsByName.set(normalizeToolName(toolDefinition.name), toolDefinition);
  }

  return toolDefinitionsByName;
}

function getToolRiskLevel(
  requirement: SkillToolRequirement,
  toolDefinitionsByName: ReadonlyMap<string, ToolDefinition>,
): SkillRiskLevel | ToolRiskLevel | undefined {
  const toolName = getSkillToolName(requirement);

  if (toolName === undefined) {
    return requirement.riskLevel;
  }

  return (
    requirement.riskLevel ??
    toolDefinitionsByName.get(normalizeToolName(toolName))?.riskLevel
  );
}

function normalizeToolName(toolName: string): string {
  return toolName.trim().toLowerCase();
}
