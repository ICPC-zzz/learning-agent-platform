export type AssistantProviderCapability =
  | "llm_chat"
  | "article_search"
  | "article_hot"
  | "problem_search"
  | "problem_recommendation"
  | "article_publish"
  | "article_sync";

export type AssistantProviderId =
  | "openai-compatible-llm-provider"
  | "cnblogs-read-provider"
  | "csdn-article-provider"
  | "codeforces-read-provider";

export interface AssistantProviderStatus {
  id: AssistantProviderId;
  label: string;
  configured: boolean;
  enabled: boolean;
  healthy: boolean | null;
  capabilities: AssistantProviderCapability[];
  requiredEnvNames: string[];
  configuredEnvNames: string[];
  missingEnvNames: string[];
  sourceLabel: string;
  safeDescription: string;
  previewOnly: true;
  devOnly: true;
  productionReady: false;
}

export interface AssistantProviderRegistrySnapshot {
  providers: AssistantProviderStatus[];
  visibleProviders: AssistantProviderStatus[];
}

