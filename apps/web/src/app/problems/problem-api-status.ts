import {
  evaluateExternalApiDevGuard,
  PROBLEM_API_CONTRACT,
} from "@learning-agent-platform/shared";

import type { ProblemApiPreviewStatusSnapshot } from "./problem-api-preview-types";

export function getProblemApiPreviewStatus(
  env?: Record<string, string | undefined>,
): ProblemApiPreviewStatusSnapshot {
  const guard = evaluateExternalApiDevGuard({
    providerLabel: PROBLEM_API_CONTRACT.label,
    allowExternalEnvName: PROBLEM_API_CONTRACT.allowEnvName,
    requiredEnvNames: PROBLEM_API_CONTRACT.requiredEnvNames,
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
