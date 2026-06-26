/**
 * Third-Party API Unified Configuration
 *
 * Defines canonical env variable names, capability types, and env contracts
 * for all four third-party API categories:
 * 1. Book API (external book search/import)
 * 2. Problem API (external problem search/import)
 * 3. Phone Auth / SMS OTP (phone verification code login)
 * 4. Email Auth (email login)
 *
 * This module ONLY defines variable names and contracts — it never reads
 * .env.local files, never outputs env values, and never hard-codes secrets.
 *
 * @module third-party-api-config
 * @safeToExposeToClient — only variable names, no values
 */

// ---------------------------------------------------------------------------
// Capability type
// ---------------------------------------------------------------------------

export type ThirdPartyApiCapability =
  | "book-api"
  | "problem-api"
  | "phone-auth"
  | "email-auth";

// ---------------------------------------------------------------------------
// Env contract interface
// ---------------------------------------------------------------------------

export interface ThirdPartyApiEnvContract {
  /** The capability this contract describes. */
  capability: ThirdPartyApiCapability;
  /** Human-readable provider label (Chinese). */
  label: string;
  /** The allow/feature-flag env name. */
  allowEnvName: string;
  /** The provider identifier env name (e.g., "douban", "openlibrary"). */
  providerEnvName: string;
  /** All required env names (including allow flag). The guard checks these. */
  requiredEnvNames: readonly string[];
  /** Optional env names — nice to have but not blocking. */
  optionalEnvNames: readonly string[];
  /** The env name that identifies the provider (for display purposes). */
  capabilityId: ThirdPartyApiCapability;
  /** Always true — dev-only. */
  devOnly: true;
  /** Always false — not production-ready. */
  productionReady: false;
}

// ---------------------------------------------------------------------------
// Book API contract
// ---------------------------------------------------------------------------

export const BOOK_API_CONTRACT: ThirdPartyApiEnvContract = {
  capability: "book-api",
  label: "Book API（书籍搜索/导入）",
  allowEnvName: "LAP_ALLOW_EXTERNAL_BOOK_API",
  providerEnvName: "LAP_BOOK_API_PROVIDER",
  requiredEnvNames: [
    "LAP_ALLOW_EXTERNAL_BOOK_API",
    "LAP_BOOK_API_KEY",
    "LAP_BOOK_API_BASE_URL",
    "LAP_BOOK_API_PROVIDER",
  ],
  optionalEnvNames: [],
  capabilityId: "book-api",
  devOnly: true,
  productionReady: false,
};

// ---------------------------------------------------------------------------
// Problem API contract
// ---------------------------------------------------------------------------

export const PROBLEM_API_CONTRACT: ThirdPartyApiEnvContract = {
  capability: "problem-api",
  label: "Problem API（题目搜索/导入）",
  allowEnvName: "LAP_ALLOW_EXTERNAL_PROBLEM_API",
  providerEnvName: "LAP_PROBLEM_API_PROVIDER",
  requiredEnvNames: [
    "LAP_ALLOW_EXTERNAL_PROBLEM_API",
    "LAP_PROBLEM_API_KEY",
    "LAP_PROBLEM_API_BASE_URL",
    "LAP_PROBLEM_API_PROVIDER",
  ],
  optionalEnvNames: [],
  capabilityId: "problem-api",
  devOnly: true,
  productionReady: false,
};

// ---------------------------------------------------------------------------
// Phone Auth / SMS OTP contract
// ---------------------------------------------------------------------------

export const PHONE_AUTH_CONTRACT: ThirdPartyApiEnvContract = {
  capability: "phone-auth",
  label: "手机号验证码登录（SMS OTP）",
  allowEnvName: "LAP_ALLOW_PHONE_AUTH",
  providerEnvName: "LAP_SMS_PROVIDER",
  requiredEnvNames: [
    "LAP_ALLOW_PHONE_AUTH",
    "LAP_SMS_PROVIDER",
    "LAP_SMS_API_BASE_URL",
    "LAP_SMS_API_KEY",
    "LAP_SMS_API_SECRET",
    "LAP_SMS_SIGN_NAME",
    "LAP_SMS_TEMPLATE_ID",
  ],
  optionalEnvNames: [],
  capabilityId: "phone-auth",
  devOnly: true,
  productionReady: false,
};

// ---------------------------------------------------------------------------
// Email Auth contract
// ---------------------------------------------------------------------------

export const EMAIL_AUTH_CONTRACT: ThirdPartyApiEnvContract = {
  capability: "email-auth",
  label: "邮箱登录（Email Auth）",
  allowEnvName: "LAP_ALLOW_EMAIL_AUTH",
  providerEnvName: "LAP_EMAIL_PROVIDER",
  requiredEnvNames: [
    "LAP_ALLOW_EMAIL_AUTH",
    "LAP_EMAIL_PROVIDER",
    "LAP_EMAIL_API_BASE_URL",
    "LAP_EMAIL_API_KEY",
    "LAP_EMAIL_FROM",
  ],
  optionalEnvNames: [
    "LAP_SMTP_HOST",
    "LAP_SMTP_PORT",
    "LAP_SMTP_USER",
    "LAP_SMTP_PASS",
  ],
  capabilityId: "email-auth",
  devOnly: true,
  productionReady: false,
};

// ---------------------------------------------------------------------------
// Registry of all contracts
// ---------------------------------------------------------------------------

export const ALL_THIRD_PARTY_API_CONTRACTS: readonly ThirdPartyApiEnvContract[] = [
  BOOK_API_CONTRACT,
  PROBLEM_API_CONTRACT,
  PHONE_AUTH_CONTRACT,
  EMAIL_AUTH_CONTRACT,
];

export const THIRD_PARTY_API_CONTRACT_MAP: Record<ThirdPartyApiCapability, ThirdPartyApiEnvContract> = {
  "book-api": BOOK_API_CONTRACT,
  "problem-api": PROBLEM_API_CONTRACT,
  "phone-auth": PHONE_AUTH_CONTRACT,
  "email-auth": EMAIL_AUTH_CONTRACT,
};

// ---------------------------------------------------------------------------
// Helper: get all env names that a user needs to configure
// ---------------------------------------------------------------------------

export function getAllThirdPartyEnvNames(): string[] {
  const names = new Set<string>();
  for (const contract of ALL_THIRD_PARTY_API_CONTRACTS) {
    for (const name of contract.requiredEnvNames) {
      names.add(name);
    }
    for (const name of contract.optionalEnvNames) {
      names.add(name);
    }
  }
  return Array.from(names).sort();
}
