/**
 * DOCX Import Guard — controls whether DOCX file upload and text extraction are allowed.
 *
 * Guard design:
 * - DEFAULT: blocked. DOCX import is disabled unless explicitly enabled.
 * - production: ALWAYS blocked, regardless of env.
 * - dev: requires LAP_ALLOW_DOCX_IMPORT=true
 *
 * Safe to expose to client: no env values, only variable names and boolean states.
 *
 * @previewOnly — dev-only guard; never production
 * @module docx-import-guard
 */

// ---------------------------------------------------------------------------
// Environment variable keys
// ---------------------------------------------------------------------------

const ENV_ALLOW_DOCX_IMPORT = "LAP_ALLOW_DOCX_IMPORT";

// ---------------------------------------------------------------------------
// Guard result types
// ---------------------------------------------------------------------------

export interface DocxImportGuardResult {
  /** Whether DOCX import is currently allowed. */
  enabled: boolean;
  /** Whether DOCX import is blocked. */
  blocked: boolean;
  /** Human-readable reason for the current state — never includes env values. */
  reason: string;
  /** Names of required environment variables (names only, no values). */
  requiredEnvNames: string[];
  /** Names of configured environment variables (names only, no values). */
  configuredEnvNames: string[];
  /** Names of missing environment variables (names only, no values). */
  missingEnvNames: string[];
  /** Always true — dev-only capability. */
  devOnly: true;
  /** Whether production is explicitly blocked. */
  productionBlocked: boolean;
  /** Always true — no secrets or env values exposed. */
  safeToExposeToClient: true;
}

// ---------------------------------------------------------------------------
// Process-level cached reads (safe — Next.js does not reload env at runtime)
// ---------------------------------------------------------------------------

let cachedDocxImportEnabled: boolean | null = null;
let cachedNodeEnv: string | null = null;

function readDocxImportEnabled(): boolean {
  if (cachedDocxImportEnabled !== null) return cachedDocxImportEnabled;
  try {
    cachedDocxImportEnabled = process.env[ENV_ALLOW_DOCX_IMPORT] === "true";
  } catch {
    cachedDocxImportEnabled = false;
  }
  return cachedDocxImportEnabled;
}

function readNodeEnv(): string {
  if (cachedNodeEnv !== null) return cachedNodeEnv;
  try {
    cachedNodeEnv = (process.env["NODE_ENV"] ?? "").trim().toLowerCase();
  } catch {
    cachedNodeEnv = "";
  }
  return cachedNodeEnv;
}

// ---------------------------------------------------------------------------
// Guard evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate the DOCX import guard.
 *
 * Returns a result that can be safely serialized and sent to the client.
 * No env values, secrets, or connection strings are leaked.
 */
export function evaluateDocxImportGuard(
  overrideEnv?: Record<string, string | undefined>,
): DocxImportGuardResult {
  const isProduction = overrideEnv
    ? (overrideEnv["NODE_ENV"] ?? "").trim().toLowerCase() === "production"
    : readNodeEnv() === "production";

  const docxImportEnabled = overrideEnv
    ? overrideEnv[ENV_ALLOW_DOCX_IMPORT] === "true"
    : readDocxImportEnabled();

  const requiredEnvNames = [ENV_ALLOW_DOCX_IMPORT];
  const configuredEnvNames: string[] = [];
  const missingEnvNames: string[] = [];
  const blockedReasons: string[] = [];

  // Check 1: production is always blocked
  if (isProduction) {
    blockedReasons.push(
      "PRODUCTION_BLOCKED: DOCX 导入在生产环境中始终禁用（NODE_ENV=production）。",
    );
  }

  // Check 2: env must be explicitly enabled
  if (!docxImportEnabled) {
    missingEnvNames.push(ENV_ALLOW_DOCX_IMPORT);
    if (!isProduction) {
      blockedReasons.push(
        `${ENV_ALLOW_DOCX_IMPORT} 未设置为 true。DOCX 导入默认关闭。`,
      );
    }
  } else {
    configuredEnvNames.push(ENV_ALLOW_DOCX_IMPORT);
  }

  const blocked = blockedReasons.length > 0;

  let reason: string;
  if (blocked) {
    reason = blockedReasons.join(" ");
  } else {
    reason = "DOCX 导入已启用（dev-only preview）。仅纯文本提取，不保留样式/图片/批注，不调用 LLM。";
  }

  return {
    enabled: !blocked,
    blocked,
    reason,
    requiredEnvNames,
    configuredEnvNames,
    missingEnvNames,
    devOnly: true,
    productionBlocked: isProduction,
    safeToExposeToClient: true,
  };
}

// ---------------------------------------------------------------------------
// Convenience checks
// ---------------------------------------------------------------------------

/**
 * Returns true only when DOCX import is fully allowed.
 */
export function isDocxImportEnabled(
  overrideEnv?: Record<string, string | undefined>,
): boolean {
  return evaluateDocxImportGuard(overrideEnv).enabled;
}

/**
 * Throws if DOCX import is not allowed. Safe to call in server actions.
 */
export function assertDocxImportAllowed(
  overrideEnv?: Record<string, string | undefined>,
): void {
  const guard = evaluateDocxImportGuard(overrideEnv);
  if (!guard.enabled) {
    throw new Error(`DOCX import blocked: ${guard.reason}`);
  }
}
