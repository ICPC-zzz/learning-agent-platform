/**
 * Dev Auth Login Guard — controls whether dev-only password login is allowed.
 *
 * Login is ONLY permitted when ALL of the following are true:
 * 1. NODE_ENV is NOT "production"
 * 2. LAP_ALLOW_DEV_AUTH_LOGIN env var is "true" or "1"
 *
 * DEFAULT: BLOCKED. Login is disabled by default in all environments.
 *
 * This guard is intentionally separate from the register guard
 * (LAP_ALLOW_DEV_AUTH_REGISTER) and the dev auth guard
 * (LAP_WEB_AUTH_DEV_ENABLED) to allow independent control.
 *
 * @module web-auth-login-guard
 * @previewOnly — dev/test-only, must not be enabled in production
 */

// Node.js process global — declared to avoid @types/node dependency.
declare const process: { env: Record<string, string | undefined> };

export interface DevLoginGuardStatus {
  /** Whether dev login is currently allowed. */
  enabled: boolean;
  /** Always false — dev-only login is never production-blocked=false. */
  blocked: boolean;
  /** Human-readable reason when blocked, empty string when enabled. */
  reason: string;
  /** Env var names required for this guard to pass. */
  requiredEnvNames: string[];
  /** Env var names that are currently configured (set to any value). */
  configuredEnvNames: string[];
  /** Env var names that are required but not configured. */
  missingEnvNames: string[];
  /** Always true — this is dev-only auth. */
  devOnly: true;
  /** Whether the guard is currently production-blocked. */
  productionBlocked: boolean;
}

const ENV_KEY = "LAP_ALLOW_DEV_AUTH_LOGIN";
const REQUIRED_ENV_NAMES = [ENV_KEY] as const;

function isProduction(): boolean {
  try {
    return process.env?.NODE_ENV === "production";
  } catch {
    return false;
  }
}

function isLoginEnvSet(): boolean {
  try {
    const raw: string | undefined = process.env?.[ENV_KEY];
    return raw === "true" || raw === "1";
  } catch {
    return false;
  }
}

/**
 * Get the current dev login guard status.
 * Safe to expose to client — contains NO env values, only boolean flags
 * and env variable names (never their values).
 */
export function getDevLoginGuardStatus(): DevLoginGuardStatus {
  const requiredEnvNames: string[] = [...REQUIRED_ENV_NAMES];
  const configuredEnvNames: string[] = [];
  const missingEnvNames: string[] = [];
  const blockedReasons: string[] = [];
  let productionBlocked = false;

  // 1. Production check
  if (isProduction()) {
    productionBlocked = true;
    blockedReasons.push(
      "PRODUCTION_BLOCKED: NODE_ENV is production. Dev-only login is never allowed in production.",
    );
  }

  // 2. Env var check
  if (isLoginEnvSet()) {
    configuredEnvNames.push(ENV_KEY);
  } else {
    missingEnvNames.push(ENV_KEY);
    blockedReasons.push(
      "LOGIN_DISABLED: Env var " + ENV_KEY + " is not true. Dev login is disabled by default.",
    );
  }

  const enabled = blockedReasons.length === 0;
  const blocked = !enabled;

  return {
    enabled,
    blocked,
    reason: blockedReasons.join(" "),
    requiredEnvNames,
    configuredEnvNames,
    missingEnvNames,
    devOnly: true,
    productionBlocked,
  };
}

/**
 * Quick check: is dev login currently allowed?
 */
export function isDevLoginAllowed(): boolean {
  return getDevLoginGuardStatus().enabled;
}

/**
 * Validate that the guard status object is safe to expose to the client.
 * Ensures no env values, secrets, or connection strings are leaked.
 */
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bAUTH_SECRET\b/i,
  /\bJWT_SECRET\b/i,
  /\bAPI_KEY\b/i,
  /\bOPENAI_API_KEY\b/i,
  /\bANTHROPIC_API_KEY\b/i,
  /\bpassword\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpostgres:\/\//i,
  // Env values must not leak — only env variable NAMES are safe
];

export function loginGuardStatusIsSafe(status: DevLoginGuardStatus): boolean {
  const json = JSON.stringify(status);
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(json)) return false;
  }
  // Also check individual reason strings
  if (status.reason) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(status.reason)) return false;
    }
  }
  // configuredEnvNames must only contain safe env names, not values
  for (const name of status.configuredEnvNames) {
    if (name.includes("=")) return false;
    if (name.length > 100) return false;
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(name)) return false;
    }
  }
  return true;
}
