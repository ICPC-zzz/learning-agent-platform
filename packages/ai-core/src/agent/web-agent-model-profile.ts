export const WebAgentModelProfileId = {
  FastCheap: "fast-cheap",
  DeepExpensive: "deep-expensive",
  CurrentDev: "current-dev",
} as const;

export type WebAgentModelProfileId =
  (typeof WebAgentModelProfileId)[keyof typeof WebAgentModelProfileId];

export type WebAgentModelFamily =
  | "haiku-like"
  | "opus-like"
  | "openai-compatible";

export type WebAgentModelCostBias = "cheap" | "balanced" | "expensive";
export type WebAgentModelLatencyBias = "low" | "medium" | "high";
export type WebAgentModelReasoningDepth = "shallow" | "balanced" | "deep";

export interface WebAgentModelProfile {
  profileId: WebAgentModelProfileId;
  label: string;
  description: string;
  modelFamily: WebAgentModelFamily;
  routingTarget: string;
  costBias: WebAgentModelCostBias;
  latencyBias: WebAgentModelLatencyBias;
  reasoningDepth: WebAgentModelReasoningDepth;
  devOnly: true;
  liveProviderEnabled: false;
  previewOnly: true;
  notes: readonly string[];
}

const modelProfiles: readonly WebAgentModelProfile[] = [
  {
    profileId: WebAgentModelProfileId.FastCheap,
    label: "Fast / cheap",
    description:
      "A short-turn route for cheap, low-latency preview reasoning, modeled after Haiku-like behavior.",
    modelFamily: "haiku-like",
    routingTarget: "haiku-like-fast-preview",
    costBias: "cheap",
    latencyBias: "low",
    reasoningDepth: "shallow",
    devOnly: true,
    liveProviderEnabled: false,
    previewOnly: true,
    notes: [
      "Use for quick intent routing and lightweight classification.",
      "No live Anthropic call is made here.",
    ],
  },
  {
    profileId: WebAgentModelProfileId.DeepExpensive,
    label: "Deep / expensive",
    description:
      "A slower and more capable route for hard reasoning, modeled after Opus-like behavior.",
    modelFamily: "opus-like",
    routingTarget: "opus-like-deep-preview",
    costBias: "expensive",
    latencyBias: "high",
    reasoningDepth: "deep",
    devOnly: true,
    liveProviderEnabled: false,
    previewOnly: true,
    notes: [
      "Use for critic-style review and deeper analysis previews.",
      "Routing only; no provider call is performed.",
    ],
  },
  {
    profileId: WebAgentModelProfileId.CurrentDev,
    label: "Current dev / Spark",
    description:
      "The default development route is OpenAI-compatible and intentionally preview-only.",
    modelFamily: "openai-compatible",
    routingTarget: "spark-openai-compatible-dev",
    costBias: "balanced",
    latencyBias: "medium",
    reasoningDepth: "balanced",
    devOnly: true,
    liveProviderEnabled: false,
    previewOnly: true,
    notes: [
      "Keeps the current dev Spark/OpenAI-compatible path visible.",
      "No live provider is invoked in this scaffold round.",
    ],
  },
] as const;

export function getWebAgentModelProfiles(): readonly WebAgentModelProfile[] {
  return modelProfiles.map((profile) => cloneWebAgentModelProfile(profile));
}

export function getWebAgentModelProfileById(
  profileId: WebAgentModelProfileId,
): WebAgentModelProfile | null {
  const profile = modelProfiles.find((entry) => entry.profileId === profileId);
  return profile === undefined ? null : cloneWebAgentModelProfile(profile);
}

export function createWebAgentModelProfilePreview(): readonly WebAgentModelProfile[] {
  return getWebAgentModelProfiles();
}

function cloneWebAgentModelProfile(
  profile: WebAgentModelProfile,
): WebAgentModelProfile {
  return {
    ...profile,
    notes: [...profile.notes],
  };
}
