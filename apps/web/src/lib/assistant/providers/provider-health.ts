import type { AssistantProviderStatus } from "./provider-types.ts";

export type AssistantProviderHealthLabel =
  | "ready"
  | "configured"
  | "blocked"
  | "unavailable";

export interface AssistantProviderHealthSummary {
  label: AssistantProviderHealthLabel;
  healthy: boolean | null;
  safeNote: string;
}

export function createAssistantProviderHealthSummary(
  status: Pick<AssistantProviderStatus, "configured" | "enabled" | "healthy" | "safeDescription">,
): AssistantProviderHealthSummary {
  if (!status.configured) {
    return {
      label: "blocked",
      healthy: false,
      safeNote: status.safeDescription,
    };
  }

  if (!status.enabled) {
    return {
      label: "configured",
      healthy: false,
      safeNote: status.safeDescription,
    };
  }

  return {
    label: status.healthy === true ? "ready" : "configured",
    healthy: status.healthy,
    safeNote: status.safeDescription,
  };
}

export function filterVisibleAssistantProviders(
  providers: readonly AssistantProviderStatus[],
): AssistantProviderStatus[] {
  return providers.filter((provider) => provider.configured && provider.enabled);
}

