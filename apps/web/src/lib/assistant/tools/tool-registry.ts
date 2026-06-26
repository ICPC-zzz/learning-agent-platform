import {
  createHotTechnicalArticlesDefinition,
  createSearchTechnicalArticlesDefinition,
} from "./article-tools.ts";
import {
  createRecommendCodeforcesProblemsDefinition,
  createSearchCodeforcesProblemsDefinition,
} from "./codeforces-tools.ts";
import {
  eraseAssistantToolDefinition,
  type AnyAssistantToolDefinition,
  type AssistantToolName,
} from "./tool-types.ts";

export function getAssistantToolRegistry(): readonly AnyAssistantToolDefinition[] {
  return [
    eraseAssistantToolDefinition(createSearchTechnicalArticlesDefinition()),
    eraseAssistantToolDefinition(createHotTechnicalArticlesDefinition()),
    eraseAssistantToolDefinition(createSearchCodeforcesProblemsDefinition()),
    eraseAssistantToolDefinition(createRecommendCodeforcesProblemsDefinition()),
  ];
}

export function getAssistantToolDefinition(
  name: AssistantToolName,
): AnyAssistantToolDefinition | null {
  return getAssistantToolRegistry().find((definition) => definition.name === name) ?? null;
}

