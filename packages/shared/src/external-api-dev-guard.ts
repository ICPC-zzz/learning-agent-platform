export type ExternalApiProviderMode = "mock" | "blocked" | "external-dev";

export interface ExternalApiDevEnvMap {
  NODE_ENV?: string;
  [key: string]: string | undefined;
}

export interface ExternalApiDevGuardInput {
  providerLabel: string;
  allowExternalEnvName: string;
  requiredEnvNames: readonly string[];
  env?: ExternalApiDevEnvMap;
}

export interface ExternalApiDevGuardResult {
  providerMode: ExternalApiProviderMode;
  safeToExposeToClient: true;
  productionReady: false;
  allowed: boolean;
  blockedReason: string | null;
  requiredEnvNames: readonly string[];
  configuredEnvNames: readonly string[];
  missingEnvNames: readonly string[];
}

/** Unified API status that can be consumed by admin status center, user badges, and tests. */
export interface UnifiedApiStatus {
  enabled: boolean;
  blocked: boolean;
  reason: string | null;
  requiredEnvNames: readonly string[];
  configuredEnvNames: readonly string[];
  missingEnvNames: readonly string[];
  devOnly: true;
  productionBlocked: boolean;
}

export interface ExternalApiPreviewEnvelope<TItem> {
  providerMode: ExternalApiProviderMode;
  safeToExposeToClient: true;
  productionReady: false;
  blockedReason: string | null;
  missingEnvNames: readonly string[];
  itemsPreview: readonly TItem[];
}

export function evaluateExternalApiDevGuard(
  input: ExternalApiDevGuardInput,
): ExternalApiDevGuardResult {
  const env = input.env ?? safeProcessEnv();
  const missingEnvNames = new Set<string>();
  const configuredEnvNames = new Set<string>();
  const blockedReasons: string[] = [];
  const allowExternalEnabled = parseBooleanEnv(env[input.allowExternalEnvName]);

  if (!isNonProductionEnv(env.NODE_ENV)) {
    blockedReasons.push(
      input.providerLabel.toUpperCase().replace(/\s+/g, "_") + "_PRODUCTION_BLOCKED: NODE_ENV is production; external preview remains disabled.",
    );
  }

  if (!allowExternalEnabled) {
    missingEnvNames.add(input.allowExternalEnvName);
    blockedReasons.push(
      input.allowExternalEnvName + " is not enabled; external preview remains disabled.",
    );
  } else {
    configuredEnvNames.add(input.allowExternalEnvName);
  }

  for (const name of input.requiredEnvNames) {
    if (!isConfigured(env[name])) {
      missingEnvNames.add(name);
    } else {
      configuredEnvNames.add(name);
    }
  }

  if (missingEnvNames.size > 0) {
    blockedReasons.push(
      "Missing env: " + Array.from(missingEnvNames).join(", "),
    );
  }

  const allowed = blockedReasons.length === 0;
  const requiredEnvNames = [
    input.allowExternalEnvName,
    ...input.requiredEnvNames,
  ];

  return {
    providerMode: allowed ? "external-dev" : "blocked",
    safeToExposeToClient: true,
    productionReady: false,
    allowed,
    blockedReason: blockedReasons[0] ?? null,
    requiredEnvNames,
    configuredEnvNames: Array.from(configuredEnvNames),
    missingEnvNames: Array.from(missingEnvNames),
  };
}

export function createExternalApiPreviewEnvelope<TItem>(
  input: {
    providerMode: ExternalApiProviderMode;
    itemsPreview: readonly TItem[];
    blockedReason?: string | null;
    missingEnvNames?: readonly string[];
  },
): ExternalApiPreviewEnvelope<TItem> {
  return {
    providerMode: input.providerMode,
    safeToExposeToClient: true,
    productionReady: false,
    blockedReason: input.blockedReason ?? null,
    missingEnvNames: input.missingEnvNames ?? [],
    itemsPreview: input.itemsPreview,
  };
}

export function createMockExternalApiPreviewEnvelope<TItem>(
  itemsPreview: readonly TItem[],
): ExternalApiPreviewEnvelope<TItem> {
  return createExternalApiPreviewEnvelope({
    providerMode: "mock",
    itemsPreview,
    blockedReason: null,
    missingEnvNames: [],
  });
}

/**
 * Build a UnifiedApiStatus from an ExternalApiDevGuardResult.
 * This is the canonical shape consumed by admin status centers, user badges,
 * import pages, and tests.
 */
export function getUnifiedApiStatus(
  guard: ExternalApiDevGuardResult,
): UnifiedApiStatus {
  const productionBlocked =
    guard.blockedReason !== null &&
    guard.blockedReason.includes("PRODUCTION_BLOCKED");

  return {
    enabled: guard.allowed,
    blocked: !guard.allowed,
    reason: guard.blockedReason,
    requiredEnvNames: guard.requiredEnvNames,
    configuredEnvNames: guard.configuredEnvNames,
    missingEnvNames: guard.missingEnvNames,
    devOnly: true,
    productionBlocked,
  };
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonProductionEnv(nodeEnv: string | undefined): boolean {
  const normalized = nodeEnv?.trim().toLowerCase();
  if (!isConfigured(normalized)) {
    return true;
  }

  return normalized !== "production";
}

function safeProcessEnv(): ExternalApiDevEnvMap {
  try {
    return process.env;
  } catch {
    return {};
  }
}
