const DEPLOYMENT_MISMATCH_PATTERNS = [
  "an unexpected response was received from the server",
  "failed to find server action",
  "older or newer deployment",
];

const RECOVERY_MESSAGE = "系统刚完成更新，正在刷新页面，请稍后重新执行当前 AI 操作。";

/**
 * Next.js server actions carry a build-specific identifier. A page that was
 * open during a deployment can send an identifier from the previous build,
 * which is not a code-analysis failure and is resolved by loading the current
 * page bundle.
 */
export function getServerActionRecoveryMessage(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  return DEPLOYMENT_MISMATCH_PATTERNS.some((pattern) => normalized.includes(pattern))
    ? RECOVERY_MESSAGE
    : null;
}
