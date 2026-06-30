import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const EXPECTED_RESEND_FROM_DOMAIN = "auth.cfagent.fun";

export interface EmailRuntimeConfig {
  provider: "resend";
  nodeEnv: string;
  cwd: string;
  apiKey: ConfiguredSecret;
  from: ConfiguredText;
  sender: SenderAddressCheck;
  authEnabled: boolean;
  realSendAllowed: boolean;
  blockedReasons: string[];
}

export interface ConfiguredSecret {
  present: boolean;
  source: "RESEND_API_KEY" | "LAP_EMAIL_API_KEY" | null;
  value: string | null;
  format: "valid" | "invalid" | "missing";
}

export interface ConfiguredText {
  present: boolean;
  source: "RESEND_FROM_EMAIL" | "LAP_EMAIL_FROM" | "EMAIL_FROM" | null;
  value: string | null;
}

export interface SenderAddressCheck {
  configured: boolean;
  valid: boolean;
  mailbox: string | null;
  domain: string | null;
  expectedDomain: string;
  hasUnsafeWhitespace: boolean;
  hasWrappingQuotes: boolean;
}

type EnvReader = Record<string, string | undefined>;

export function getEmailRuntimeConfig(env: EnvReader = process.env): EmailRuntimeConfig {
  const resolvedEnv = withLocalEmailEnvFallbacks(env);
  const apiKey = firstSecret(resolvedEnv, ["RESEND_API_KEY", "LAP_EMAIL_API_KEY"]);
  const from = firstText(resolvedEnv, ["RESEND_FROM_EMAIL", "LAP_EMAIL_FROM", "EMAIL_FROM"]);
  const sender = checkSenderAddress(from.value);
  const authEnabled = isTruthy(env.LAP_EMAIL_AUTH_ENABLED) || apiKey.present;
  const blockedReasons: string[] = [];

  if (!apiKey.present) blockedReasons.push("missing_api_key");
  if (apiKey.present && apiKey.format !== "valid") blockedReasons.push("invalid_api_key_format");
  if (!from.present) blockedReasons.push("missing_from_email");
  if (from.present && !sender.valid) blockedReasons.push("invalid_from_email");
  if (sender.domain !== null && sender.domain !== EXPECTED_RESEND_FROM_DOMAIN) {
    blockedReasons.push("unexpected_from_domain");
  }
  if (!authEnabled) blockedReasons.push("email_auth_disabled");

  return {
    provider: "resend",
    nodeEnv: resolvedEnv.NODE_ENV?.trim() || "development",
    cwd: process.cwd(),
    apiKey,
    from,
    sender,
    authEnabled,
    realSendAllowed: blockedReasons.length === 0,
    blockedReasons,
  };
}

export function getSafeEmailRuntimeSummary(config = getEmailRuntimeConfig()): Record<string, string | boolean | null> {
  return {
    provider: config.provider,
    nodeEnv: config.nodeEnv,
    cwd: config.cwd,
    apiKeyPresent: config.apiKey.present,
    apiKeySource: config.apiKey.source,
    apiKeyFormat: config.apiKey.format,
    fromPresent: config.from.present,
    fromSource: config.from.source,
    fromDomain: config.sender.domain,
    expectedFromDomain: config.sender.expectedDomain,
    fromValid: config.sender.valid,
    emailAuthEnabled: config.authEnabled,
    realSendAllowed: config.realSendAllowed,
    blockedReasons: config.blockedReasons.join(",") || null,
  };
}

function firstSecret<T extends string>(env: EnvReader, names: readonly T[]): ConfiguredSecret {
  for (const name of names) {
    const value = cleanEnvValue(env[name]);
    if (value !== null) {
      return {
        present: true,
        source: name as ConfiguredSecret["source"],
        value,
        format: /^re_[A-Za-z0-9_=-]{12,}$/.test(value) ? "valid" : "invalid",
      };
    }
  }
  return { present: false, source: null, value: null, format: "missing" };
}

function withLocalEmailEnvFallbacks(env: EnvReader): EnvReader {
  const merged: Record<string, string | undefined> = { ...env };
  const cwd = process.cwd();
  const repoRoot = cwd.endsWith(`${separator()}apps${separator()}web`) || cwd.endsWith("/apps/web")
    ? resolve(cwd, "../..")
    : cwd;
  const appRoot = resolve(repoRoot, "apps/web");

  for (const file of [
    resolve(repoRoot, ".env.local"),
    resolve(repoRoot, ".env.production"),
    resolve(appRoot, ".env.local"),
    resolve(appRoot, ".env.production"),
  ]) {
    if (!existsSync(file)) continue;
    const parsed = parseEnvFile(readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (merged[key] === undefined || merged[key]?.trim().length === 0) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

function parseEnvFile(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    result[match[1]] = unquoteEnvValue(match[2]);
  }
  return result;
}

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function separator(): string {
  return "\\";
}

function firstText<T extends string>(env: EnvReader, names: readonly T[]): ConfiguredText {
  for (const name of names) {
    const value = cleanEnvValue(env[name]);
    if (value !== null) {
      return {
        present: true,
        source: name as ConfiguredText["source"],
        value,
      };
    }
  }
  return { present: false, source: null, value: null };
}

function checkSenderAddress(value: string | null): SenderAddressCheck {
  if (value === null) {
    return {
      configured: false,
      valid: false,
      mailbox: null,
      domain: null,
      expectedDomain: EXPECTED_RESEND_FROM_DOMAIN,
      hasUnsafeWhitespace: false,
      hasWrappingQuotes: false,
    };
  }

  const hasUnsafeWhitespace = value !== value.trim() || /[\r\n]/.test(value);
  const hasWrappingQuotes = value.startsWith('"') || value.endsWith('"') || value.startsWith("'") || value.endsWith("'");
  const mailbox = extractMailbox(value);
  const domain = mailbox?.split("@")[1]?.toLowerCase() ?? null;
  const valid = mailbox !== null
    && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(mailbox)
    && !hasUnsafeWhitespace
    && !hasWrappingQuotes
    && domain === EXPECTED_RESEND_FROM_DOMAIN;

  return {
    configured: true,
    valid,
    mailbox,
    domain,
    expectedDomain: EXPECTED_RESEND_FROM_DOMAIN,
    hasUnsafeWhitespace,
    hasWrappingQuotes,
  };
}

function extractMailbox(value: string): string | null {
  const trimmed = value.trim();
  const displayMatch = trimmed.match(/<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>$/);
  if (displayMatch) return displayMatch[1].toLowerCase();
  if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

function cleanEnvValue(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isTruthy(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}
