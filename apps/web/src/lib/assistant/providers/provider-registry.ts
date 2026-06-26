import { loadAssistantProviderConfig } from "../config/assistant-provider-config.ts";
import { filterVisibleAssistantProviders } from "./provider-health.ts";
import { createOpenAiCompatibleLlmProvider } from "./openai-compatible-llm-provider.ts";
import { createCodeforcesReadProviderStatus } from "./codeforces-read-provider.ts";
import { createCnblogsReadProviderStatus } from "./cnblogs-read-provider.ts";
import { createCsdnArticleProviderStatus } from "./csdn-article-provider.ts";
import type { AssistantProviderRegistrySnapshot, AssistantProviderStatus } from "./provider-types.ts";

export interface AssistantProviderRegistryOptions {
  adminView?: boolean;
  env?: Record<string, string | undefined>;
  customFetch?: typeof fetch;
}

export function getAssistantProviderRegistry(
  options: AssistantProviderRegistryOptions = {},
): AssistantProviderRegistrySnapshot {
  const config = loadAssistantProviderConfig(options.env);

  const llm = createOpenAiCompatibleLlmProvider({
    config,
    customFetch: options.customFetch,
  });

  const providers: AssistantProviderStatus[] = [
    llm.status,
    createCnblogsReadProviderStatus(),
    createCsdnArticleProviderStatus(),
    createCodeforcesReadProviderStatus({ config }),
  ];

  return {
    providers,
    visibleProviders: options.adminView ? [...providers] : filterVisibleAssistantProviders(providers),
  };
}
