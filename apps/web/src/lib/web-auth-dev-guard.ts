/**
 * Web Auth Dev Guard — dev/test-only auth session guard.
 *
 * DEFAULT: DISABLED. LAP_WEB_AUTH_DEV_ENABLED=true to enable.
 *
 * @module web-auth-dev-guard
 * @previewOnly — dev/test-only, not production auth
 */

// Node.js process global — declared to avoid @types/node dependency.
declare const process: { env: Record<string, string | undefined> };

export type DevAuthGuardMode = 'dev-only';

export interface DevAuthGuardStatus {
  enabled: boolean;
  mode: DevAuthGuardMode;
  productionReady: false;
  safeToExposeToClient: true;
  blockedReasons: string[];
}

const ENV_KEY = 'LAP_WEB_AUTH_DEV_ENABLED';

function isDevAuthEnabled(): boolean {
  try {
    const raw: string | undefined = process.env?.[ENV_KEY];
    return raw === 'true' || raw === '1';
  } catch {
    return false;
  }
}

export function getDevAuthGuardStatus(): DevAuthGuardStatus {
  const enabled = isDevAuthEnabled();
  const blockedReasons: string[] = [];
  if (!enabled) {
    blockedReasons.push('DEV_AUTH_DISABLED: Env var ' + ENV_KEY + ' not true. Dev login disabled by default.');
  }
  return { enabled, mode: 'dev-only', productionReady: false, safeToExposeToClient: true, blockedReasons };
}

export function isDevAuthAllowed(): boolean {
  return getDevAuthGuardStatus().enabled;
}

export function getDevAuthBlockedMessage(): string {
  const status = getDevAuthGuardStatus();
  if (status.enabled) return '';
  return status.blockedReasons.join(' ');
}

const FORBIDDEN_ENV_KEYS = [
  'DATABASE_URL', 'AUTH_SECRET', 'JWT_SECRET',
  'API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
] as const;

export function guardStatusIsSafe(status: DevAuthGuardStatus): boolean {
  const json = JSON.stringify(status).toLowerCase();
  for (const key of FORBIDDEN_ENV_KEYS) {
    if (json.includes(key.toLowerCase())) return false;
  }
  for (const reason of status.blockedReasons) {
    const lower = reason.toLowerCase();
    for (const key of FORBIDDEN_ENV_KEYS) {
      if (lower.includes(key.toLowerCase())) return false;
    }
  }
  return true;
}
