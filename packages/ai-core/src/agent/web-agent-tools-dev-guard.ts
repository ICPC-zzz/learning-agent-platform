/**
 * Web Agent dev-only read-only tool guard.
 *
 * The Web Agent can expose read-only tool previews only when the dev guard is
 * explicitly enabled in a non-production environment. This guard never exposes
 * secrets.
 */

export const LAP_WEB_AGENT_TOOLS_DEV_ENABLED_KEY =
  "LAP_WEB_AGENT_TOOLS_DEV_ENABLED";

export interface WebAgentToolsDevEnv {
  LAP_WEB_AGENT_TOOLS_DEV_ENABLED?: string;
  NODE_ENV?: string;
}

export interface WebAgentToolsDevGuardResult {
  enabled: boolean;
  nonProduction: boolean;
  envEnabled: boolean;
  allowed: boolean;
  blockedReasons: readonly string[];
  notice: string;
  sourceLabel: string;
  devOnly: true;
  productionReady: false;
}

export function evaluateWebAgentToolsDevGuard(
  env: WebAgentToolsDevEnv,
): WebAgentToolsDevGuardResult {
  const nonProduction = isNonProductionEnv(env.NODE_ENV);
  const envEnabled = parseBooleanEnv(env.LAP_WEB_AGENT_TOOLS_DEV_ENABLED);
  const blockedReasons: string[] = [];

  if (!nonProduction) {
    blockedReasons.push("non_production_required");
  }

  if (!envEnabled) {
    blockedReasons.push(
      `${LAP_WEB_AGENT_TOOLS_DEV_ENABLED_KEY} is not enabled`,
    );
  }

  if (blockedReasons.length > 0) {
    return createGuardResult({
      enabled: false,
      nonProduction,
      envEnabled,
      allowed: false,
      blockedReasons,
      notice:
        "Web Agent read-only tool previews are disabled. The dev-only guard must be enabled in a non-production environment.",
      sourceLabel: "tool-guard-blocked (preview disabled)",
    });
  }

  return createGuardResult({
    enabled: true,
    nonProduction,
    envEnabled,
    allowed: true,
    blockedReasons: [],
    notice:
      "Web Agent read-only tool previews are enabled in this dev-only preview environment.",
    sourceLabel: "tool-guard-enabled (dev-only preview)",
  });
}

function createGuardResult(input: {
  enabled: boolean;
  nonProduction: boolean;
  envEnabled: boolean;
  allowed: boolean;
  blockedReasons: readonly string[];
  notice: string;
  sourceLabel: string;
}): WebAgentToolsDevGuardResult {
  return {
    enabled: input.enabled,
    nonProduction: input.nonProduction,
    envEnabled: input.envEnabled,
    allowed: input.allowed,
    blockedReasons: input.blockedReasons,
    notice: input.notice,
    sourceLabel: input.sourceLabel,
    devOnly: true,
    productionReady: false,
  };
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (value === undefined) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isNonProductionEnv(nodeEnv: string | undefined): boolean {
  if (nodeEnv === undefined) {
    return true;
  }

  return nodeEnv.trim().toLowerCase() !== "production";
}
