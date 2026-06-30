import {
  evaluateExternalApiDevGuard,
  BOOK_API_CONTRACT,
  type ExternalApiProviderMode,
} from "@learning-agent-platform/shared";

export interface BookApiPreviewStatusSnapshot {
  providerMode: ExternalApiProviderMode;
  safeToExposeToClient: true;
  productionReady: false;
  blockedReason: string | null;
  missingEnvNames: string[];
}

export function getBookApiPreviewStatus(
  env?: Record<string, string | undefined>,
): BookApiPreviewStatusSnapshot {
  const guard = evaluateExternalApiDevGuard({
    providerLabel: BOOK_API_CONTRACT.label,
    allowExternalEnvName: BOOK_API_CONTRACT.allowEnvName,
    requiredEnvNames: BOOK_API_CONTRACT.requiredEnvNames,
    env,
  });

  return {
    providerMode: guard.allowed ? "external-dev" : "blocked",
    safeToExposeToClient: true,
    productionReady: false,
    blockedReason: guard.blockedReason,
    missingEnvNames: [...guard.missingEnvNames],
  };
}
