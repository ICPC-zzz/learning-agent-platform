/**
 * Web Agent dev-only network guard.
 *
 * The safe web fetch path is only enabled when the caller explicitly opts in,
 * the environment is non-production, and the additional agent-network guard is
 * enabled. This guard never returns secrets.
 */

export const LAP_WEB_AGENT_NETWORK_DEV_ENABLED_KEY =
  "LAP_WEB_AGENT_NETWORK_DEV_ENABLED";
export const LAP_ALLOW_AGENT_NETWORK_KEY = "LAP_ALLOW_AGENT_NETWORK";

export interface WebAgentNetworkDevEnv {
  LAP_WEB_AGENT_NETWORK_DEV_ENABLED?: string;
  LAP_ALLOW_AGENT_NETWORK?: string;
  NODE_ENV?: string;
}

export interface WebAgentNetworkDevGuardResult {
  enabled: boolean;
  nonProduction: boolean;
  networkDevEnabled: boolean;
  allowAgentNetwork: boolean;
  allowed: boolean;
  blockedReasons: readonly string[];
  notice: string;
  sourceLabel: string;
  devOnly: true;
  productionReady: false;
}

export function evaluateWebAgentNetworkDevGuard(
  env: WebAgentNetworkDevEnv,
): WebAgentNetworkDevGuardResult {
  const nonProduction = isNonProductionEnv(env.NODE_ENV);
  const networkDevEnabled = parseBooleanEnv(
    env.LAP_WEB_AGENT_NETWORK_DEV_ENABLED,
  );
  const allowAgentNetwork = parseBooleanEnv(env.LAP_ALLOW_AGENT_NETWORK);
  const blockedReasons: string[] = [];

  if (!nonProduction) {
    blockedReasons.push("non_production_required");
  }

  if (!networkDevEnabled) {
    blockedReasons.push(
      `${LAP_WEB_AGENT_NETWORK_DEV_ENABLED_KEY} is not enabled`,
    );
  }

  if (!allowAgentNetwork) {
    blockedReasons.push(`${LAP_ALLOW_AGENT_NETWORK_KEY} is not enabled`);
  }

  if (blockedReasons.length > 0) {
    return createGuardResult({
      enabled: false,
      nonProduction,
      networkDevEnabled,
      allowAgentNetwork,
      allowed: false,
      blockedReasons,
      notice:
        "Web Agent network fetch is disabled. The dev-only network guard must be enabled in a non-production environment.",
      sourceLabel: "network-guard-blocked (preview disabled)",
    });
  }

  return createGuardResult({
    enabled: true,
    nonProduction,
    networkDevEnabled,
    allowAgentNetwork,
    allowed: true,
    blockedReasons: [],
    notice:
      "Web Agent network fetch is enabled in this dev-only preview environment.",
    sourceLabel: "network-guard-enabled (dev-only preview)",
  });
}

function createGuardResult(input: {
  enabled: boolean;
  nonProduction: boolean;
  networkDevEnabled: boolean;
  allowAgentNetwork: boolean;
  allowed: boolean;
  blockedReasons: readonly string[];
  notice: string;
  sourceLabel: string;
}): WebAgentNetworkDevGuardResult {
  return {
    enabled: input.enabled,
    nonProduction: input.nonProduction,
    networkDevEnabled: input.networkDevEnabled,
    allowAgentNetwork: input.allowAgentNetwork,
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
