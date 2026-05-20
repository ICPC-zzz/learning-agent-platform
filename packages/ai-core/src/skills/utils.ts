import { AutonomyLevel } from "../autonomy/types";
import {
  SkillRiskLevel,
  type SkillManifest,
  type SkillJsonValue,
  type SkillMetadata,
} from "./types";

const autonomyRanks: Record<AutonomyLevel, number> = {
  [AutonomyLevel.Manual]: 1,
  [AutonomyLevel.ConfirmTools]: 2,
  [AutonomyLevel.Supervised]: 3,
  [AutonomyLevel.Autonomous]: 4,
};

const minimumAutonomyByRisk: Record<SkillRiskLevel, AutonomyLevel> = {
  [SkillRiskLevel.Low]: AutonomyLevel.Manual,
  [SkillRiskLevel.Medium]: AutonomyLevel.ConfirmTools,
  [SkillRiskLevel.High]: AutonomyLevel.Supervised,
  [SkillRiskLevel.Critical]: AutonomyLevel.Autonomous,
};

export function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createSkillId(name: string): string {
  const normalizedName = normalizeSkillName(name);
  const slug = normalizedName
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `skill:${slug.length > 0 ? slug : hashString(normalizedName)}`;
}

export function cloneSkillManifest(manifest: SkillManifest): SkillManifest {
  const cloned: SkillManifest = {
    name: manifest.name,
    description: manifest.description,
    riskLevel: manifest.riskLevel,
    requiredAutonomyLevel: manifest.requiredAutonomyLevel,
    requiredTools: manifest.requiredTools.map((tool) => ({ ...tool })),
  };

  if (manifest.id !== undefined) {
    cloned.id = manifest.id;
  }

  if (manifest.version !== undefined) {
    cloned.version = manifest.version;
  }

  if (manifest.status !== undefined) {
    cloned.status = manifest.status;
  }

  if (manifest.safetyNotes !== undefined) {
    cloned.safetyNotes = [...manifest.safetyNotes];
  }

  if (manifest.metadata !== undefined) {
    cloned.metadata = cloneJsonValue(manifest.metadata) as SkillMetadata;
  }

  return cloned;
}

export function getRequiredToolNames(manifest: SkillManifest): string[] {
  return manifest.requiredTools
    .filter((tool) => isRequiredTool(tool))
    .map((tool) => getSkillToolName(tool))
    .filter((toolName): toolName is string => toolName !== undefined);
}

export function hasRequiredAutonomyLevel(
  currentAutonomyLevel: AutonomyLevel = AutonomyLevel.Manual,
  requiredAutonomyLevel: AutonomyLevel,
): boolean {
  return (
    autonomyRanks[currentAutonomyLevel] >= autonomyRanks[requiredAutonomyLevel]
  );
}

export function compareSkillRiskToAutonomy(
  riskLevel: SkillRiskLevel,
  currentAutonomyLevel: AutonomyLevel = AutonomyLevel.Manual,
): -1 | 0 | 1 {
  const requiredAutonomyLevel = minimumAutonomyByRisk[riskLevel];

  return compareAutonomyLevels(currentAutonomyLevel, requiredAutonomyLevel);
}

export function getSkillToolName(
  tool: SkillManifest["requiredTools"][number],
): string | undefined {
  const name = tool.toolName ?? tool.name;

  if (name === undefined) {
    return undefined;
  }

  const trimmedName = name.trim();

  return trimmedName.length > 0 ? trimmedName : undefined;
}

export function isRequiredTool(
  tool: SkillManifest["requiredTools"][number],
): boolean {
  return tool.isRequired ?? tool.required ?? true;
}

function compareAutonomyLevels(
  currentAutonomyLevel: AutonomyLevel,
  requiredAutonomyLevel: AutonomyLevel,
): -1 | 0 | 1 {
  const difference =
    autonomyRanks[currentAutonomyLevel] - autonomyRanks[requiredAutonomyLevel];

  if (difference < 0) {
    return -1;
  }

  if (difference > 0) {
    return 1;
  }

  return 0;
}

function cloneJsonValue(value: SkillJsonValue): SkillJsonValue {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, cloneJsonValue(child)]),
  ) as SkillJsonValue;
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}
