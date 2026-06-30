import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const EMAIL_ENV_NAMES = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "LAP_EMAIL_API_KEY",
  "LAP_EMAIL_FROM",
  "EMAIL_FROM",
  "APP_BASE_URL",
  "LAP_EMAIL_AUTH_ENABLED",
] as const;

export const EMAIL_ENV_FILES = [
  ".env.local",
  "apps/web/.env.local",
  ".env.production",
  "apps/web/.env.production",
] as const;

export interface EnvFilePresence {
  file: string;
  exists: boolean;
  variables: Record<string, boolean>;
}

export function loadEmailEnvFilesForCli(cwd = process.cwd()): void {
  const root = resolveEmailEnvRoot(cwd);
  for (const relativePath of [
    ".env.production",
    ".env.local",
    "apps/web/.env.production",
    "apps/web/.env.local",
  ]) {
    const fullPath = resolve(root, relativePath);
    if (!existsSync(fullPath)) continue;
    const parsed = parseEnvFile(readFileSync(fullPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

export function inspectEmailEnvFiles(cwd = process.cwd()): EnvFilePresence[] {
  const root = resolveEmailEnvRoot(cwd);
  return EMAIL_ENV_FILES.map((file) => {
    const fullPath = resolve(root, file);
    if (!existsSync(fullPath)) {
      return {
        file,
        exists: false,
        variables: Object.fromEntries(EMAIL_ENV_NAMES.map((name) => [name, false])),
      };
    }
    const text = readFileSync(fullPath, "utf8");
    return {
      file,
      exists: true,
      variables: Object.fromEntries(
        EMAIL_ENV_NAMES.map((name) => [
          name,
          new RegExp(`^\\s*${escapeRegExp(name)}\\s*=`, "m").test(text),
        ]),
      ),
    };
  });
}

function resolveEmailEnvRoot(cwd: string): string {
  const normalized = cwd.replace(/\\/g, "/");
  return normalized.endsWith("/apps/web") ? resolve(cwd, "../..") : cwd;
}

export function inspectSystemEmailEnv(): Record<string, boolean> {
  return Object.fromEntries(
    EMAIL_ENV_NAMES.map((name) => [name, typeof process.env[name] === "string" && process.env[name]!.trim().length > 0]),
  );
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
