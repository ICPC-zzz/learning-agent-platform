import type { WebAgentToolType } from "./web-agent-capability-registry.ts";

export const WebAgentPermissionState = {
  Disabled: "disabled",
  PreviewOnly: "previewOnly",
  ReadOnly: "readOnly",
  RequiresUserApproval: "requiresUserApproval",
  DevOnlyLive: "devOnlyLive",
  Forbidden: "forbidden",
} as const;

export type WebAgentPermissionState =
  (typeof WebAgentPermissionState)[keyof typeof WebAgentPermissionState];

export interface WebAgentPermissionPolicyRule {
  capabilityId: WebAgentToolType;
  permission: WebAgentPermissionState;
  previewVisible: true;
  liveExecutionAllowed: boolean;
  reason: string;
  devOnly: true;
  notes: readonly string[];
}

const permissionPolicy: readonly WebAgentPermissionPolicyRule[] = [
  {
    capabilityId: "network",
    permission: WebAgentPermissionState.DevOnlyLive,
    previewVisible: true,
    liveExecutionAllowed: true,
    reason: "Outbound network access is available only through the dev-only safe web fetch preview path.",
    devOnly: true,
    notes: ["Live HTTP or HTTPS preview requires explicit dev-only guards."],
  },
  {
    capabilityId: "file",
    permission: WebAgentPermissionState.Disabled,
    previewVisible: true,
    liveExecutionAllowed: false,
    reason: "File access is represented as metadata only and is not executable.",
    devOnly: true,
    notes: ["No file read or file write operation is performed."],
  },
  {
    capabilityId: "shell",
    permission: WebAgentPermissionState.Disabled,
    previewVisible: true,
    liveExecutionAllowed: false,
    reason: "Shell execution stays disabled and is only described in preview metadata.",
    devOnly: true,
    notes: ["No shell, terminal, or process execution is started."],
  },
  {
    capabilityId: "mcp",
    permission: WebAgentPermissionState.Disabled,
    previewVisible: true,
    liveExecutionAllowed: false,
    reason: "MCP is rendered as a connection schema preview only.",
    devOnly: true,
    notes: ["No GitHub, Slack, or other MCP connection is opened."],
  },
  {
    capabilityId: "browser",
    permission: WebAgentPermissionState.RequiresUserApproval,
    previewVisible: true,
    liveExecutionAllowed: false,
    reason: "Browser access would require explicit approval in a future live path.",
    devOnly: true,
    notes: ["This scaffold only documents the approval boundary."],
  },
  {
    capabilityId: "code",
    permission: WebAgentPermissionState.ReadOnly,
    previewVisible: true,
    liveExecutionAllowed: false,
    reason: "Code access is previewed as read-only inspection metadata only.",
    devOnly: true,
    notes: ["No edit, patch, or write action is enabled here."],
  },
  {
    capabilityId: "internalRead",
    permission: WebAgentPermissionState.PreviewOnly,
    previewVisible: true,
    liveExecutionAllowed: false,
    reason: "Internal read access is safe to surface as preview-only metadata.",
    devOnly: true,
    notes: ["Used for safe view-only context assembly."],
  },
  {
    capabilityId: "internalWrite",
    permission: WebAgentPermissionState.Forbidden,
    previewVisible: true,
    liveExecutionAllowed: false,
    reason: "Internal write access remains forbidden in this scaffold round.",
    devOnly: true,
    notes: ["No state mutation is enabled."],
  },
] as const;

export function getWebAgentPermissionPolicy(): readonly WebAgentPermissionPolicyRule[] {
  return permissionPolicy.map((rule) => cloneWebAgentPermissionPolicyRule(rule));
}

export function createWebAgentPermissionPolicyPreview(): readonly WebAgentPermissionPolicyRule[] {
  return getWebAgentPermissionPolicy();
}

export function evaluateWebAgentPermissionPolicy(
  capabilityId: WebAgentToolType,
): WebAgentPermissionPolicyRule {
  const rule = permissionPolicy.find(
    (entry) => entry.capabilityId === capabilityId,
  );

  if (rule === undefined) {
    return {
      capabilityId,
      permission: WebAgentPermissionState.Disabled,
      previewVisible: true,
      liveExecutionAllowed: false,
      reason: "Unknown capability ids stay disabled by default.",
      devOnly: true,
      notes: ["Unknown capabilities are not authorized in the scaffold."],
    };
  }

  return cloneWebAgentPermissionPolicyRule(rule);
}

export function getWebAgentPermissionLegend(): readonly WebAgentPermissionState[] {
  return Object.values(WebAgentPermissionState);
}

export function describeWebAgentPermissionState(
  permission: WebAgentPermissionState,
): string {
  switch (permission) {
    case WebAgentPermissionState.Disabled:
      return "disabled";
    case WebAgentPermissionState.PreviewOnly:
      return "preview only";
    case WebAgentPermissionState.ReadOnly:
      return "read only";
    case WebAgentPermissionState.RequiresUserApproval:
      return "requires user approval";
    case WebAgentPermissionState.DevOnlyLive:
      return "dev-only live";
    case WebAgentPermissionState.Forbidden:
      return "forbidden";
  }
}

function cloneWebAgentPermissionPolicyRule(
  rule: WebAgentPermissionPolicyRule,
): WebAgentPermissionPolicyRule {
  return {
    ...rule,
    notes: [...rule.notes],
  };
}
