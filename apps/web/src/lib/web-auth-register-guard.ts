/**
 * Dev Auth Register Guard — controls whether dev-only registration is allowed.
 *
 * Registration is ONLY permitted when ALL of the following are true:
 * 1. NODE_ENV is NOT "production"
 * 2. LAP_ALLOW_DEV_AUTH_REGISTER env var is "true"
 *
 * DEFAULT: BLOCKED. Registration is disabled by default in all environments.
 *
 * This guard is intentionally separate from the dev login guard
 * (LAP_WEB_AUTH_DEV_ENABLED) to allow independent control.
 *
 * @module web-auth-register-guard
 * @previewOnly — dev/test-only, must not be enabled in production
 */

// Node.js process global — declared to avoid @types/node dependency.
declare const process: { env: Record<string, string | undefined> };

export type DevRegisterGuardStatus = {
  allowed: boolean;
  productionReady: false;
  safeToExposeToClient: true;
  blockedReasons: string[];
};

const ENV_KEY = "LAP_ALLOW_DEV_AUTH_REGISTER";

function isProduction(): boolean {
  try {
    return process.env?.NODE_ENV === "production";
  } catch {
    return false;
  }
}

function isRegisterEnvSet(): boolean {
  try {
    const raw: string | undefined = process.env?.[ENV_KEY];
    return raw === "true" || raw === "1";
  } catch {
    return false;
  }
}

/**
 * Get the current registration guard status.
 * Safe to expose to client — contains no env values, only boolean flags.
 */
export function getDevRegisterGuardStatus(): DevRegisterGuardStatus {
  const blockedReasons: string[] = [];

  if (isProduction()) {
    blockedReasons.push(
      "PRODUCTION_BLOCKED: NODE_ENV is production. Dev-only registration is never allowed in production.",
    );
  }

  if (!isRegisterEnvSet()) {
    blockedReasons.push(
      "REGISTER_DISABLED: Env var " + ENV_KEY + " is not true. Dev registration is disabled by default.",
    );
  }

  const allowed = blockedReasons.length === 0;

  return {
    allowed,
    productionReady: false,
    safeToExposeToClient: true,
    blockedReasons,
  };
}

/**
 * Quick check: is registration currently allowed?
 */
export function isDevRegisterAllowed(): boolean {
  return getDevRegisterGuardStatus().allowed;
}

/**
 * Get a human-readable blocked message for UI display.
 */
export function getDevRegisterBlockedMessage(): string {
  const status = getDevRegisterGuardStatus();
  if (status.allowed) return "";
  return status.blockedReasons.join(" ");
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
];

export function registerGuardStatusIsSafe(status: DevRegisterGuardStatus): boolean {
  const json = JSON.stringify(status);
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(json)) return false;
  }
  for (const reason of status.blockedReasons) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(reason)) return false;
    }
  }
  return true;
}
