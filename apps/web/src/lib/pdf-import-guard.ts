/**
 * PDF Import Guard — controls whether PDF file upload and text extraction are allowed.
 *
 * Guard design:
 * - DEFAULT: blocked. PDF import is disabled unless explicitly enabled.
 * - production: ALWAYS blocked, regardless of env.
 * - dev: requires LAP_ALLOW_PDF_IMPORT=true
 *
 * Safe to expose to client: no env values, only variable names and boolean states.
 *
 * @previewOnly — dev-only guard; never production
 * @module pdf-import-guard
 */

// ---------------------------------------------------------------------------
// Environment variable keys
// ---------------------------------------------------------------------------

const ENV_ALLOW_PDF_IMPORT = "LAP_ALLOW_PDF_IMPORT";

// ---------------------------------------------------------------------------
// Guard result types
// ---------------------------------------------------------------------------

export interface PdfImportGuardResult {
  /** Whether PDF import is currently allowed. */
  enabled: boolean;
  /** Whether PDF import is blocked. */
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

let cachedPdfImportEnabled: boolean | null = null;
let cachedNodeEnv: string | null = null;

function readPdfImportEnabled(): boolean {
  if (cachedPdfImportEnabled !== null) return cachedPdfImportEnabled;
  try {
    cachedPdfImportEnabled = process.env[ENV_ALLOW_PDF_IMPORT] === "true";
  } catch {
    cachedPdfImportEnabled = false;
  }
  return cachedPdfImportEnabled;
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
 * Evaluate the PDF import guard.
 *
 * Returns a result that can be safely serialized and sent to the client.
 * No env values, secrets, or connection strings are leaked.
 */
export function evaluatePdfImportGuard(
  overrideEnv?: Record<string, string | undefined>,
): PdfImportGuardResult {
  const isProduction = overrideEnv
    ? (overrideEnv["NODE_ENV"] ?? "").trim().toLowerCase() === "production"
    : readNodeEnv() === "production";

  const pdfImportEnabled = overrideEnv
    ? overrideEnv[ENV_ALLOW_PDF_IMPORT] === "true"
    : readPdfImportEnabled();

  const requiredEnvNames = [ENV_ALLOW_PDF_IMPORT];
  const configuredEnvNames: string[] = [];
  const missingEnvNames: string[] = [];
  const blockedReasons: string[] = [];

  // Check 1: production is always blocked
  if (isProduction) {
    blockedReasons.push(
      "PRODUCTION_BLOCKED: PDF 导入在生产环境中始终禁用（NODE_ENV=production）。",
    );
  }

  // Check 2: env must be explicitly enabled
  if (!pdfImportEnabled) {
    missingEnvNames.push(ENV_ALLOW_PDF_IMPORT);
    if (!isProduction) {
      blockedReasons.push(
        `${ENV_ALLOW_PDF_IMPORT} 未设置为 true。PDF 导入默认关闭。`,
      );
    }
  } else {
    configuredEnvNames.push(ENV_ALLOW_PDF_IMPORT);
  }

  const blocked = blockedReasons.length > 0;

  let reason: string;
  if (blocked) {
    reason = blockedReasons.join(" ");
  } else {
    reason = "PDF 导入已启用（dev-only preview）。仅纯文本提取，不调用 LLM，不支持扫描件 OCR。";
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
 * Returns true only when PDF import is fully allowed.
 */
export function isPdfImportEnabled(
  overrideEnv?: Record<string, string | undefined>,
): boolean {
  return evaluatePdfImportGuard(overrideEnv).enabled;
}

/**
 * Throws if PDF import is not allowed. Safe to call in server actions.
 */
export function assertPdfImportAllowed(
  overrideEnv?: Record<string, string | undefined>,
): void {
  const guard = evaluatePdfImportGuard(overrideEnv);
  if (!guard.enabled) {
    throw new Error(`PDF import blocked: ${guard.reason}`);
  }
}
