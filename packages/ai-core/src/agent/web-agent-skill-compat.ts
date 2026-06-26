import type { WebAgentPermissionState } from "./web-agent-permission-policy.ts";
import type { WebAgentToolType } from "./web-agent-capability-registry.ts";
import type { WebAgentModelProfileId } from "./web-agent-model-profile.ts";

export interface WebAgentSkillCompatMetadataField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  description: string;
  example?: string;
}

export interface WebAgentSkillCompatDefinition {
  skillId: string;
  title: string;
  description: string;
  claudeCodeCompatible: true;
  manifestFormat: "claude-code-compatible-metadata-v1";
  modelProfileId: WebAgentModelProfileId;
  allowedTools: readonly WebAgentToolType[];
  requiredPermissions: readonly WebAgentPermissionState[];
  metadataSchema: readonly WebAgentSkillCompatMetadataField[];
  installMode: "metadata-only";
  executionMode: "preview-only";
  devOnly: true;
  previewOnly: true;
  safetyNotes: readonly string[];
}

const skillCompatRegistry: readonly WebAgentSkillCompatDefinition[] = [
  {
    skillId: "planner-review",
    title: "Planner review draft",
    description:
      "Claude Code compatible metadata for a planner-style skill draft.",
    claudeCodeCompatible: true,
    manifestFormat: "claude-code-compatible-metadata-v1",
    modelProfileId: "fast-cheap",
    allowedTools: ["internalRead", "code"],
    requiredPermissions: ["previewOnly", "readOnly"],
    metadataSchema: [
      {
        name: "name",
        type: "string",
        required: true,
        description: "Skill name.",
        example: "Planner review draft",
      },
      {
        name: "description",
        type: "string",
        required: true,
        description: "Short preview-safe summary.",
        example: "Preview-only planning metadata.",
      },
      {
        name: "tools",
        type: "array",
        required: true,
        description: "Allowed tools list.",
        example: "[\"internalRead\",\"code\"]",
      },
    ],
    installMode: "metadata-only",
    executionMode: "preview-only",
    devOnly: true,
    previewOnly: true,
    safetyNotes: [
      "No installation is performed.",
      "No execution is started.",
      "Only metadata is surfaced.",
    ],
  },
  {
    skillId: "critic-review",
    title: "Critic review draft",
    description:
      "Claude Code compatible metadata for a critic-style review skill draft.",
    claudeCodeCompatible: true,
    manifestFormat: "claude-code-compatible-metadata-v1",
    modelProfileId: "deep-expensive",
    allowedTools: ["internalRead", "code", "browser"],
    requiredPermissions: ["previewOnly", "readOnly", "requiresUserApproval"],
    metadataSchema: [
      {
        name: "name",
        type: "string",
        required: true,
        description: "Skill name.",
        example: "Critic review draft",
      },
      {
        name: "instructions",
        type: "string",
        required: true,
        description: "High-level critic guidance.",
        example: "Review the plan and list risks only.",
      },
      {
        name: "safetyNotes",
        type: "array",
        required: false,
        description: "Preview-only safety notes.",
        example: "[\"preview-only\"]",
      },
    ],
    installMode: "metadata-only",
    executionMode: "preview-only",
    devOnly: true,
    previewOnly: true,
    safetyNotes: [
      "Critic metadata only.",
      "No live browser access is used.",
      "No skill installation is performed.",
    ],
  },
  {
    skillId: "research-workflow",
    title: "Research workflow draft",
    description:
      "Claude Code compatible metadata for a research-oriented skill draft.",
    claudeCodeCompatible: true,
    manifestFormat: "claude-code-compatible-metadata-v1",
    modelProfileId: "fast-cheap",
    allowedTools: ["network", "browser", "internalRead"],
    requiredPermissions: ["previewOnly", "requiresUserApproval", "forbidden"],
    metadataSchema: [
      {
        name: "sources",
        type: "array",
        required: true,
        description: "Source hints for preview only.",
        example: "[\"docs\", \"references\"]",
      },
      {
        name: "focus",
        type: "string",
        required: true,
        description: "Research focus label.",
        example: "tool permissions",
      },
    ],
    installMode: "metadata-only",
    executionMode: "preview-only",
    devOnly: true,
    previewOnly: true,
    safetyNotes: [
      "No network request is executed.",
      "No skill runtime is launched.",
      "Only metadata and guidance are previewed.",
    ],
  },
  {
    skillId: "tool-specialist-playbook",
    title: "Tool specialist playbook draft",
    description:
      "Claude Code compatible metadata for a tool-specialist playbook draft.",
    claudeCodeCompatible: true,
    manifestFormat: "claude-code-compatible-metadata-v1",
    modelProfileId: "current-dev",
    allowedTools: ["file", "shell", "mcp", "code", "internalRead"],
    requiredPermissions: [
      "disabled",
      "previewOnly",
      "readOnly",
      "forbidden",
    ],
    metadataSchema: [
      {
        name: "steps",
        type: "array",
        required: true,
        description: "Preview-only execution steps.",
        example: "[\"analyze\", \"validate\", \"report\"]",
      },
      {
        name: "toolset",
        type: "array",
        required: false,
        description: "Tool list in metadata form only.",
        example: "[\"file\", \"shell\", \"mcp\"]",
      },
      {
        name: "guardrails",
        type: "array",
        required: false,
        description: "Safety notes for the scaffold.",
        example: "[\"preview-only\"]",
      },
    ],
    installMode: "metadata-only",
    executionMode: "preview-only",
    devOnly: true,
    previewOnly: true,
    safetyNotes: [
      "File, shell, and MCP stay metadata-only.",
      "No live tool execution is available.",
      "No community skill install is performed.",
    ],
  },
] as const;

export function getWebAgentSkillCompatRegistry(): readonly WebAgentSkillCompatDefinition[] {
  return skillCompatRegistry.map((skill) => cloneWebAgentSkillCompatDefinition(skill));
}

export function createWebAgentSkillCompatRegistryPreview(): readonly WebAgentSkillCompatDefinition[] {
  return getWebAgentSkillCompatRegistry();
}

function cloneWebAgentSkillCompatDefinition(
  skill: WebAgentSkillCompatDefinition,
): WebAgentSkillCompatDefinition {
  return {
    ...skill,
    allowedTools: [...skill.allowedTools],
    requiredPermissions: [...skill.requiredPermissions],
    metadataSchema: skill.metadataSchema.map((field) => ({ ...field })),
    safetyNotes: [...skill.safetyNotes],
  };
}
