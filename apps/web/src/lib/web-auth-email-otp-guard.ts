/**
 * Email OTP Guard — controls whether dev-only email OTP operations are allowed.
 *
 * This guard now covers two levels:
 * 1. OTP storage (LAP_ALLOW_DEV_EMAIL_OTP) — controls whether OTP records can be
 *    written to DB. Production: always blocked.
 * 2. Email sending (LAP_ALLOW_DEV_EMAIL_SEND) — controls whether real email
 *    sending via Resend API is allowed. Production: always blocked.
 *
 * DEFAULT: BLOCKED. Both operations disabled by default in all environments.
 * PRODUCTION: ALWAYS BLOCKED.
 *
 * @module web-auth-email-otp-guard
 * @devOnly — A471 v1 with optional email sending
 */

declare const process: { env: Record<string, string | undefined> };

export interface EmailOtpGuardStatus {
  enabled: boolean;
  blocked: boolean;
  reason: string;
  requiredEnvNames: string[];
  configuredEnvNames: string[];
  missingEnvNames: string[];
  devOnly: true;
  productionBlocked: boolean;
  provider: string;
  /** Whether real email sending via Resend is allowed. */
  sendsEmail: boolean;
  /** Whether OTP storage (DB writes) is allowed. */
  otpStorageAllowed: boolean;
}

const ENV_KEY_OTP = "LAP_ALLOW_DEV_EMAIL_OTP";
const ENV_KEY_EMAIL_AUTH = "LAP_ALLOW_EMAIL_AUTH";
const ENV_KEY_SEND = "LAP_ALLOW_DEV_EMAIL_SEND";
const ALL_REQUIRED_ENV_NAMES = [ENV_KEY_OTP, ENV_KEY_EMAIL_AUTH, ENV_KEY_SEND] as const;
const PROVIDER = "resend";

function isProduction(): boolean {
  try { return process.env?.NODE_ENV === "production"; } catch { return false; }
}

function isEnvTrue(key: string): boolean {
  try { const raw = process.env?.[key]; return raw === "true" || raw === "1"; } catch { return false; }
}

export function getEmailOtpGuardStatus(): EmailOtpGuardStatus {
  const requiredEnvNames: string[] = [...ALL_REQUIRED_ENV_NAMES];
  const configuredEnvNames: string[] = [];
  const missingEnvNames: string[] = [];
  const blockedReasons: string[] = [];
  let productionBlocked = false;

  if (isProduction()) {
    productionBlocked = true;
    blockedReasons.push("PRODUCTION_BLOCKED: NODE_ENV is production. Email OTP and sending are never allowed in production.");
  }

  // OTP storage check
  const otpStorageEnvCandidates = [ENV_KEY_OTP, ENV_KEY_EMAIL_AUTH];
  let otpStorageAllowed = false;
  for (const envName of otpStorageEnvCandidates) {
    if (isEnvTrue(envName)) {
      configuredEnvNames.push(envName);
      otpStorageAllowed = true;
      break;
    }
  }
  if (!otpStorageAllowed) {
    missingEnvNames.push(...otpStorageEnvCandidates);
    if (!productionBlocked) {
      blockedReasons.push(
        "OTP_DISABLED: Env var " +
          ENV_KEY_OTP +
          " or " +
          ENV_KEY_EMAIL_AUTH +
          " is not true. Email OTP storage is disabled by default.",
      );
    }
  }

  // Email send check
  let sendsEmail = false;
  if (isEnvTrue(ENV_KEY_SEND)) {
    configuredEnvNames.push(ENV_KEY_SEND);
    sendsEmail = true;
  } else {
    missingEnvNames.push(ENV_KEY_SEND);
    // NOTE: sendsEmail being false does NOT block the flow.
    // When sendsEmail is false, the OTP code is logged to the server console
    // instead of being sent via Resend. The full login/register flow still works.
  }

  const enabled = productionBlocked ? false : otpStorageAllowed;
  return {
    enabled,
    blocked: !enabled,
    reason: blockedReasons.join(" "),
    requiredEnvNames,
    configuredEnvNames,
    missingEnvNames,
    devOnly: true,
    productionBlocked,
    provider: PROVIDER,
    sendsEmail,
    otpStorageAllowed,
  };
}

export function isEmailOtpAllowed(): boolean {
  return getEmailOtpGuardStatus().enabled;
}

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i, /\bAUTH_SECRET\b/i, /\bJWT_SECRET\b/i,
  /\bAPI_KEY\b/i, /\bRESEND_API_KEY\b/i, /\bSMTP_PASS\b/i,
  /\bpassword\b/i, /\btoken\b/i, /\bsecret\b/i, /\bcodeHash\b/i,
  /\bpostgres:\/\//i,
];

export function emailOtpGuardStatusIsSafe(status: EmailOtpGuardStatus): boolean {
  const json = JSON.stringify(status);
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(json)) return false;
  }
  if (status.reason) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(status.reason)) return false;
    }
  }
  for (const name of status.configuredEnvNames) {
    if (name.includes("=")) return false;
    if (name.length > 100) return false;
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(name)) return false;
    }
  }
  return true;
}
