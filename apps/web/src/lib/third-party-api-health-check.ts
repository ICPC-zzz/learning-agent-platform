/**
 * Third-Party API Health Check
 *
 * Safe health check for all four third-party API capabilities.
 * Each check:
 * 1. First runs through the guard — blocked capabilities never make requests.
 * 2. If allowed AND base URL is configured, attempts a minimal safe request.
 * 3. All errors are sanitized — no raw bodies, headers, API keys, or secrets.
 *
 * Never: sends real SMS, sends real email, performs business search/import,
 *        returns raw body, returns raw headers, returns API key/secret/token.
 *
 * @module third-party-api-health-check
 * @safeToExposeToClient — sanitized output only
 */

import {
  evaluateExternalApiDevGuard,
  type ExternalApiDevGuardResult,
} from "@learning-agent-platform/shared";

import {
  BOOK_API_CONTRACT,
  PROBLEM_API_CONTRACT,
  PHONE_AUTH_CONTRACT,
  EMAIL_AUTH_CONTRACT,
  type ThirdPartyApiCapability,
  type ThirdPartyApiEnvContract,
} from "@learning-agent-platform/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThirdPartyApiHealthCheckResult {
  /** Whether the health check succeeded (guard passed + request succeeded). */
  success: boolean;
  /** The capability being checked. */
  capability: ThirdPartyApiCapability;
  /** Provider label (from contract). */
  provider: string;
  /** Provider name from env (if configured), safe to expose. */
  providerName?: string;
  /** HTTP status code if a request was made. */
  statusCode?: number;
  /** Safe, sanitized message — no raw bodies, headers, or secrets. */
  message: string;
  /** ISO timestamp when check was performed. */
  checkedAt: string;
  /** Whether a real network request was attempted. */
  requestAttempted: boolean;
  /** Whether the guard blocked the check before any request. */
  guardBlocked: boolean;
  /** Guard result used for the check. */
  guard: ExternalApiDevGuardResult;
}

// ---------------------------------------------------------------------------
// Contract map
// ---------------------------------------------------------------------------

const CONTRACT_MAP: Record<ThirdPartyApiCapability, ThirdPartyApiEnvContract> = {
  "book-api": BOOK_API_CONTRACT,
  "problem-api": PROBLEM_API_CONTRACT,
  "phone-auth": PHONE_AUTH_CONTRACT,
  "email-auth": EMAIL_AUTH_CONTRACT,
};

// ---------------------------------------------------------------------------
// Safe env reader
// ---------------------------------------------------------------------------

function safeGetEnv(name: string): string | undefined {
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}

function resolveBaseUrlFromContract(
  contract: ThirdPartyApiEnvContract,
): string | undefined {
  // Each contract has a known base URL env — extract by convention
  const baseUrlEnvName = contract.requiredEnvNames.find((n) =>
    n.includes("BASE_URL"),
  );
  if (!baseUrlEnvName) return undefined;
  const val = safeGetEnv(baseUrlEnvName);
  return typeof val === "string" && val.trim().length > 0 ? val.trim() : undefined;
}

// ---------------------------------------------------------------------------
// Safe fetch — only fetches the base URL root or /health endpoint.
// Errors are sanitized: no URL query params, no response body, no headers.
// ---------------------------------------------------------------------------

async function safeHealthFetch(
  baseUrl: string,
  contract: ThirdPartyApiEnvContract,
): Promise<{ success: boolean; statusCode?: number; message: string }> {
  // Normalize base URL — strip trailing slash
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  // Try a minimal health endpoint first; fall back to base URL root
  const endpoints = [`${normalizedBase}/health`, `${normalizedBase}/status`, normalizedBase];

  let lastError: string | null = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json, text/plain" },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Success: response received
      return {
        success: response.ok || response.status < 500,
        statusCode: response.status,
        message: `Health check responded with status ${response.status}${response.ok ? "" : " (non-OK but reachable)"}.`,
      };
    } catch (err) {
      // Sanitize error — never expose full URL with potential query params
      const errMsg =
        err instanceof Error ? err.message : String(err);
      // Redact any URL that might contain secrets
      const sanitized = errMsg
        .replace(/https?:\/\/[^\s]+/g, "[REDACTED_URL]")
        .replace(/api[_-]?key[=:]\s*\S+/gi, "api_key=[REDACTED]")
        .replace(/secret[=:]\s*\S+/gi, "secret=[REDACTED]")
        .replace(/token[=:]\s*\S+/gi, "token=[REDACTED]");
      lastError = sanitized;
      // Try next endpoint
      continue;
    }
  }

  // All endpoints failed
  return {
    success: false,
    message: `Health check failed: could not reach any endpoint. Last error: ${lastError ?? "unknown"}`,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Perform a safe health check for a third-party API capability.
 *
 * 1. Runs the guard first — if blocked, no request is made.
 * 2. If allowed and base URL is configured, attempts a minimal safe request.
 * 3. All output is sanitized — no raw bodies, headers, API keys, or secrets.
 */
export async function checkThirdPartyApiHealth(
  capability: ThirdPartyApiCapability,
  env?: Record<string, string | undefined>,
): Promise<ThirdPartyApiHealthCheckResult> {
  const contract = CONTRACT_MAP[capability];
  if (!contract) {
    return {
      success: false,
      capability,
      provider: "unknown",
      message: `Unknown capability: ${capability}`,
      checkedAt: new Date().toISOString(),
      requestAttempted: false,
      guardBlocked: true,
      guard: {
        providerMode: "blocked",
        safeToExposeToClient: true,
        productionReady: false,
        allowed: false,
        blockedReason: `Unknown capability: ${capability}`,
        requiredEnvNames: [],
        configuredEnvNames: [],
        missingEnvNames: [],
      },
    };
  }

  // Step 1: Evaluate the guard
  const guard = evaluateExternalApiDevGuard({
    providerLabel: contract.label,
    allowExternalEnvName: contract.allowEnvName,
    requiredEnvNames: contract.requiredEnvNames,
    env,
  });

  // Step 2: If blocked, return immediately — no request
  if (!guard.allowed) {
    return {
      success: false,
      capability,
      provider: contract.label,
      providerName: contract.providerEnvName
        ? safeGetEnv(contract.providerEnvName)
        : undefined,
      message: `Health check blocked by guard: ${guard.blockedReason ?? "missing env"}`,
      checkedAt: new Date().toISOString(),
      requestAttempted: false,
      guardBlocked: true,
      guard,
    };
  }

  // Step 3: Resolve base URL
  const baseUrl = resolveBaseUrlFromContract(contract);
  if (!baseUrl) {
    return {
      success: false,
      capability,
      provider: contract.label,
      providerName: contract.providerEnvName
        ? safeGetEnv(contract.providerEnvName)
        : undefined,
      message: "Health check skipped: guard passed but no BASE_URL configured. Cannot make request.",
      checkedAt: new Date().toISOString(),
      requestAttempted: false,
      guardBlocked: false,
      guard,
    };
  }

  // Step 4: Attempt safe health request
  const fetchResult = await safeHealthFetch(baseUrl, contract);

  return {
    success: fetchResult.success,
    capability,
    provider: contract.label,
    providerName: contract.providerEnvName
      ? safeGetEnv(contract.providerEnvName)
      : undefined,
    statusCode: fetchResult.statusCode,
    message: fetchResult.message,
    checkedAt: new Date().toISOString(),
    requestAttempted: true,
    guardBlocked: false,
    guard,
  };
}

/**
 * Synchronous status check — does NOT make network requests.
 * Returns guard status only, suitable for UI rendering on every page load.
 */
export function getThirdPartyApiSyncStatus(
  capability: ThirdPartyApiCapability,
  env?: Record<string, string | undefined>,
): {
  capability: ThirdPartyApiCapability;
  enabled: boolean;
  blocked: boolean;
  reason: string | null;
  requiredEnvNames: readonly string[];
  configuredEnvNames: readonly string[];
  missingEnvNames: readonly string[];
  devOnly: true;
  productionBlocked: boolean;
  canHealthCheck: boolean;
  provider?: string;
  providerLabel: string;
} {
  const contract = CONTRACT_MAP[capability];
  if (!contract) {
    return {
      capability,
      enabled: false,
      blocked: true,
      reason: `Unknown capability: ${capability}`,
      requiredEnvNames: [],
      configuredEnvNames: [],
      missingEnvNames: [],
      devOnly: true,
      productionBlocked: false,
      canHealthCheck: false,
      providerLabel: "unknown",
    };
  }

  const guard = evaluateExternalApiDevGuard({
    providerLabel: contract.label,
    allowExternalEnvName: contract.allowEnvName,
    requiredEnvNames: contract.requiredEnvNames,
    env,
  });

  const providerName = contract.providerEnvName
    ? safeGetEnv(contract.providerEnvName)
    : undefined;

  const productionBlocked =
    guard.blockedReason !== null &&
    guard.blockedReason.includes("PRODUCTION_BLOCKED");

  return {
    capability,
    enabled: guard.allowed,
    blocked: !guard.allowed,
    reason: guard.blockedReason,
    requiredEnvNames: guard.requiredEnvNames,
    configuredEnvNames: guard.configuredEnvNames,
    missingEnvNames: guard.missingEnvNames,
    devOnly: true,
    productionBlocked,
    canHealthCheck: guard.allowed && resolveBaseUrlFromContract(contract) !== undefined,
    provider: providerName,
    providerLabel: contract.label,
  };
}

/**
 * Get synchronous status for all four capabilities.
 */
export function getAllThirdPartyApiSyncStatuses(
  env?: Record<string, string | undefined>,
): ReturnType<typeof getThirdPartyApiSyncStatus>[] {
  return (["book-api", "problem-api", "phone-auth", "email-auth"] as const).map(
    (cap) => getThirdPartyApiSyncStatus(cap, env),
  );
}
