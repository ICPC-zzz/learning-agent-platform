import {
  type WebAgentPermissionState,
  getWebAgentPermissionPolicy,
} from "./web-agent-permission-policy.ts";

export const WebAgentToolType = {
  Network: "network",
  File: "file",
  Shell: "shell",
  Mcp: "mcp",
  Browser: "browser",
  Code: "code",
  InternalRead: "internalRead",
  InternalWrite: "internalWrite",
} as const;

export type WebAgentToolType =
  (typeof WebAgentToolType)[keyof typeof WebAgentToolType];

export type WebAgentCapabilityRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface WebAgentCapabilityDefinition {
  capabilityId: WebAgentToolType;
  title: string;
  description: string;
  defaultPermission: WebAgentPermissionState;
  riskLevel: WebAgentCapabilityRiskLevel;
  previewOnly: true;
  devOnly: true;
  liveExecutionEnabled: boolean;
  notes: readonly string[];
}

const capabilityRegistry: readonly WebAgentCapabilityDefinition[] = [
  {
    capabilityId: WebAgentToolType.Network,
    title: "Network",
    description:
      "Outbound HTTP or API access is exposed as a dev-only live preview path.",
    defaultPermission: "devOnlyLive",
    riskLevel: "critical",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: true,
    notes: [
      "Live network fetch is only enabled in non-production dev preview mode.",
      "No raw response is stored.",
      "HTTP and HTTPS targets are still blocked when they are internal or unsafe.",
    ],
  },
  {
    capabilityId: WebAgentToolType.File,
    title: "File",
    description:
      "File read and write surface is present as type metadata only.",
    defaultPermission: "disabled",
    riskLevel: "high",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    notes: [
      "No file read is executed.",
      "No file write is executed.",
      "Shell-adjacent file workflows stay scaffold-only.",
    ],
  },
  {
    capabilityId: WebAgentToolType.Shell,
    title: "Shell",
    description:
      "Terminal and command execution are represented as a disabled capability.",
    defaultPermission: "disabled",
    riskLevel: "high",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    notes: [
      "No shell process is spawned.",
      "No background command runs.",
      "The capability exists only as a type boundary.",
    ],
  },
  {
    capabilityId: WebAgentToolType.Mcp,
    title: "MCP",
    description:
      "MCP connection wiring is shown as schema only and never connects.",
    defaultPermission: "disabled",
    riskLevel: "high",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    notes: [
      "GitHub and Slack remain preview targets only.",
      "No transport handshake is performed.",
      "Only connection metadata is surfaced.",
    ],
  },
  {
    capabilityId: WebAgentToolType.Browser,
    title: "Browser",
    description:
      "Browser capability is reserved for a future approval-gated live path.",
    defaultPermission: "requiresUserApproval",
    riskLevel: "high",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    notes: [
      "No browser tab is opened.",
      "No live navigation is performed.",
      "This round only previews the approval boundary.",
    ],
  },
  {
    capabilityId: WebAgentToolType.Code,
    title: "Code",
    description:
      "Code inspection and code-aware reasoning are modeled as read-only metadata.",
    defaultPermission: "readOnly",
    riskLevel: "medium",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    notes: [
      "No edit or patch execution is enabled.",
      "Only inspection-oriented behavior is described.",
    ],
  },
  {
    capabilityId: WebAgentToolType.InternalRead,
    title: "Internal read",
    description:
      "Internal read is the safest scaffolded capability and stays preview-only.",
    defaultPermission: "previewOnly",
    riskLevel: "low",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    notes: [
      "Safe to show in preview UI.",
      "No live state access is attached here.",
    ],
  },
  {
    capabilityId: WebAgentToolType.InternalWrite,
    title: "Internal write",
    description:
      "Internal write is explicitly forbidden in this scaffold round.",
    defaultPermission: "forbidden",
    riskLevel: "critical",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    notes: [
      "No state mutation path is wired.",
      "No persistence write is enabled.",
    ],
  },
] as const;

export function getWebAgentCapabilityRegistry(): readonly WebAgentCapabilityDefinition[] {
  return capabilityRegistry.map((capability) =>
    cloneWebAgentCapabilityDefinition(capability),
  );
}

export function createWebAgentCapabilityRegistryPreview(): readonly WebAgentCapabilityDefinition[] {
  return getWebAgentCapabilityRegistry();
}

export function createWebAgentCapabilityMatrixPreview(): readonly WebAgentCapabilityDefinition[] {
  return getWebAgentCapabilityRegistry();
}

export function getWebAgentCapabilityById(
  capabilityId: WebAgentToolType,
): WebAgentCapabilityDefinition | null {
  const capability = capabilityRegistry.find(
    (entry) => entry.capabilityId === capabilityId,
  );

  return capability === undefined
    ? null
    : cloneWebAgentCapabilityDefinition(capability);
}

export function getWebAgentCapabilityDefaultPermissions(): readonly {
  capabilityId: WebAgentToolType;
  defaultPermission: WebAgentPermissionState;
}[] {
  return capabilityRegistry.map((capability) => ({
    capabilityId: capability.capabilityId,
    defaultPermission: capability.defaultPermission,
  }));
}

export function getWebAgentCapabilityPermissionPolicyCrossCheck(): readonly {
  capabilityId: WebAgentToolType;
  capabilityPermission: WebAgentPermissionState;
  policyPermission: WebAgentPermissionState;
  matches: boolean;
}[] {
  const policy = getWebAgentPermissionPolicy();

  return capabilityRegistry.map((capability) => {
    const rule = policy.find((entry) => entry.capabilityId === capability.capabilityId);
    const policyPermission = rule?.permission ?? "disabled";

    return {
      capabilityId: capability.capabilityId,
      capabilityPermission: capability.defaultPermission,
      policyPermission,
      matches: capability.defaultPermission === policyPermission,
    };
  });
}

function cloneWebAgentCapabilityDefinition(
  capability: WebAgentCapabilityDefinition,
): WebAgentCapabilityDefinition {
  return {
    ...capability,
    notes: [...capability.notes],
  };
}
