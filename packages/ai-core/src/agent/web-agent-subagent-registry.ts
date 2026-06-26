import type { WebAgentToolType } from "./web-agent-capability-registry.ts";
import type { WebAgentModelProfileId } from "./web-agent-model-profile.ts";

export const WebAgentSubagentRole = {
  Planner: "planner",
  Executor: "executor",
  Critic: "critic",
  Researcher: "researcher",
  ToolSpecialist: "tool-specialist",
} as const;

export type WebAgentSubagentRole =
  (typeof WebAgentSubagentRole)[keyof typeof WebAgentSubagentRole];

export type WebAgentSubagentRiskLevel = "low" | "medium" | "high";

export interface WebAgentSubagentDefinition {
  role: WebAgentSubagentRole;
  allowedTools: readonly WebAgentToolType[];
  modelProfileId: WebAgentModelProfileId;
  riskLevel: WebAgentSubagentRiskLevel;
}

const subagentRegistry: readonly WebAgentSubagentDefinition[] = [
  {
    role: WebAgentSubagentRole.Planner,
    allowedTools: ["internalRead", "code"],
    modelProfileId: "fast-cheap",
    riskLevel: "low",
  },
  {
    role: WebAgentSubagentRole.Executor,
    allowedTools: ["internalRead", "code", "browser"],
    modelProfileId: "current-dev",
    riskLevel: "medium",
  },
  {
    role: WebAgentSubagentRole.Critic,
    allowedTools: ["internalRead", "code"],
    modelProfileId: "fast-cheap",
    riskLevel: "low",
  },
  {
    role: WebAgentSubagentRole.Researcher,
    allowedTools: ["network", "browser", "internalRead"],
    modelProfileId: "fast-cheap",
    riskLevel: "medium",
  },
  {
    role: WebAgentSubagentRole.ToolSpecialist,
    allowedTools: [
      "file",
      "shell",
      "mcp",
      "code",
      "internalRead",
      "internalWrite",
    ],
    modelProfileId: "current-dev",
    riskLevel: "high",
  },
] as const;

export function getWebAgentSubagentRegistry(): readonly WebAgentSubagentDefinition[] {
  return subagentRegistry.map((subagent) => ({ ...subagent, allowedTools: [...subagent.allowedTools] }));
}

export function createWebAgentSubagentRegistryPreview(): readonly WebAgentSubagentDefinition[] {
  return getWebAgentSubagentRegistry();
}
