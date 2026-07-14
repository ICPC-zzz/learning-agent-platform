export const CODE_ANALYSIS_MIN_TIMEOUT_MS = 120_000;
export const CODE_ANALYSIS_MAX_TIMEOUT_MS = 150_000;
export const CODE_ANALYSIS_MAX_OUTPUT_TOKENS = 4_096;

export interface CodeAnalysisRuntimeLimits {
  timeoutMs: number;
  maxOutputTokens: number;
}

export function resolveCodeAnalysisRuntimeLimits(
  providerTimeoutMs: number,
  profileMaxOutputTokens: number,
): CodeAnalysisRuntimeLimits {
  const safeTimeout = Number.isFinite(providerTimeoutMs) && providerTimeoutMs > 0
    ? providerTimeoutMs
    : CODE_ANALYSIS_MIN_TIMEOUT_MS;
  const safeOutputTokens = Number.isFinite(profileMaxOutputTokens) && profileMaxOutputTokens > 0
    ? Math.floor(profileMaxOutputTokens)
    : CODE_ANALYSIS_MAX_OUTPUT_TOKENS;

  return {
    timeoutMs: Math.min(
      Math.max(safeTimeout, CODE_ANALYSIS_MIN_TIMEOUT_MS),
      CODE_ANALYSIS_MAX_TIMEOUT_MS,
    ),
    maxOutputTokens: Math.min(safeOutputTokens, CODE_ANALYSIS_MAX_OUTPUT_TOKENS),
  };
}
