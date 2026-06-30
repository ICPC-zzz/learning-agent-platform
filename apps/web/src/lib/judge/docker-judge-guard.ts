import type { JudgeGuardStatusForUi } from "./judge-types";

export interface DockerJudgeGuardResult extends JudgeGuardStatusForUi {
  blockedReasons: string[];
  allowedByOptIn: boolean;
  isProduction: boolean;
}

const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_MEMORY_MB = 256;
const DEFAULT_MAX_OUTPUT_BYTES = 65536;

const MIN_TIMEOUT_MS = 250;
const MAX_TIMEOUT_MS = 30000;
const MIN_MEMORY_MB = 64;
const MAX_MEMORY_MB = 2048;
const MIN_MAX_OUTPUT_BYTES = 1024;
const MAX_MAX_OUTPUT_BYTES = 1048576;

export function evaluateDockerJudgeGuard(): DockerJudgeGuardResult {
  const isProduction = readNodeEnv("NODE_ENV") === "production";
  const allowedByOptIn = readNodeEnv("LAP_ALLOW_DOCKER_JUDGE") === "true";
  const timeoutMs = readPositiveIntegerEnv(
    "LAP_JUDGE_TIMEOUT_MS",
    DEFAULT_TIMEOUT_MS,
    MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS,
  );
  const memoryMb = readPositiveIntegerEnv(
    "LAP_JUDGE_MEMORY_MB",
    DEFAULT_MEMORY_MB,
    MIN_MEMORY_MB,
    MAX_MEMORY_MB,
  );
  const maxOutputBytes = readPositiveIntegerEnv(
    "LAP_JUDGE_MAX_OUTPUT_BYTES",
    DEFAULT_MAX_OUTPUT_BYTES,
    MIN_MAX_OUTPUT_BYTES,
    MAX_MAX_OUTPUT_BYTES,
  );

  const blockedReasons: string[] = [];

  if (isProduction) {
    blockedReasons.push("PRODUCTION_BLOCKED");
  }

  if (!allowedByOptIn) {
    blockedReasons.push("DOCKER_JUDGE_DISABLED_BY_DEFAULT");
  }

  const enabled = !isProduction && allowedByOptIn;

  return {
    enabled,
    mode: "dev-only",
    productionReady: false,
    safeToExposeToClient: true,
    notice: enabled
      ? "Docker 沙箱判题已启用。"
      : "当前环境未开启本地判题。",
    networkNone: true,
    timeoutMs,
    memoryMb,
    maxOutputBytes,
    blockedReasons,
    allowedByOptIn,
    isProduction,
  };
}

export function getDockerJudgeGuardStatusForUi(): JudgeGuardStatusForUi {
  const guard = evaluateDockerJudgeGuard();
  return {
    enabled: guard.enabled,
    mode: "dev-only",
    productionReady: false,
    safeToExposeToClient: true,
    notice: guard.notice,
    networkNone: true,
    timeoutMs: guard.timeoutMs,
    memoryMb: guard.memoryMb,
    maxOutputBytes: guard.maxOutputBytes,
  };
}

function readNodeEnv(name: string): string | null {
  try {
    const value = process.env[name];
    return typeof value === "string" ? value.trim() : null;
  } catch {
    return null;
  }
}

function readPositiveIntegerEnv(
  name: string,
  defaultValue: number,
  minValue: number,
  maxValue: number,
): number {
  const raw = readNodeEnv(name);
  if (!raw) {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  const normalized = Math.trunc(parsed);
  if (normalized < minValue) {
    return minValue;
  }

  if (normalized > maxValue) {
    return maxValue;
  }

  return normalized;
}
