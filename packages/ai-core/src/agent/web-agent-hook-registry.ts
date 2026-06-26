export const WebAgentHookLifecycle = {
  PreCommit: "pre-commit",
  Test: "test",
} as const;

export type WebAgentHookLifecycle =
  (typeof WebAgentHookLifecycle)[keyof typeof WebAgentHookLifecycle];

export interface WebAgentHookDefinition {
  hookId: string;
  lifecycle: WebAgentHookLifecycle;
  title: string;
  description: string;
  previewOnly: true;
  devOnly: true;
  liveExecutionEnabled: false;
  trigger: string;
  suggestedChecks: readonly string[];
  notes: readonly string[];
}

const hookRegistry: readonly WebAgentHookDefinition[] = [
  {
    hookId: "pre-commit-preview",
    lifecycle: WebAgentHookLifecycle.PreCommit,
    title: "Pre-commit preview",
    description:
      "Documents the checks that would run before commit, but never installs or executes a hook.",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    trigger: "Before git commit creation",
    suggestedChecks: ["lint", "typecheck", "secret-scan"],
    notes: [
      "No pre-commit hook is registered.",
      "No repository state is changed.",
    ],
  },
  {
    hookId: "test-preview",
    lifecycle: WebAgentHookLifecycle.Test,
    title: "Test preview",
    description:
      "Summarizes a test hook boundary and the checks that should be described in the UI.",
    previewOnly: true,
    devOnly: true,
    liveExecutionEnabled: false,
    trigger: "Before or after preview test runs",
    suggestedChecks: ["node --test", "pnpm lint", "pnpm typecheck"],
    notes: [
      "No test process is launched from this scaffold.",
      "Only preview metadata is surfaced.",
    ],
  },
] as const;

export function getWebAgentHookRegistry(): readonly WebAgentHookDefinition[] {
  return hookRegistry.map((hook) => cloneWebAgentHookDefinition(hook));
}

export function createWebAgentHookRegistryPreview(): readonly WebAgentHookDefinition[] {
  return getWebAgentHookRegistry();
}

function cloneWebAgentHookDefinition(
  hook: WebAgentHookDefinition,
): WebAgentHookDefinition {
  return {
    ...hook,
    suggestedChecks: [...hook.suggestedChecks],
    notes: [...hook.notes],
  };
}
