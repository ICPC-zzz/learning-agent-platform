import { InMemorySkillRegistry } from "./registry";
import { createSkillInstallReview } from "./review";
import type {
  SkillInstallReview,
  SkillInstallReviewOptions,
  SkillInstallReviewRequest,
  SkillManifest,
  SkillManifestRequest,
  SkillRegistry,
  SkillRuntime,
} from "./types";

export interface InMemorySkillRuntimeOptions {
  registry?: SkillRegistry;
  initialManifests?: readonly SkillManifest[];
}

export class SkillRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillRuntimeError";
  }
}

export class InMemorySkillRuntime implements SkillRuntime {
  private readonly registry: SkillRegistry;

  constructor();
  constructor(registry: SkillRegistry);
  constructor(initialManifests: readonly SkillManifest[]);
  constructor(options: InMemorySkillRuntimeOptions);
  constructor(
    input:
      | SkillRegistry
      | readonly SkillManifest[]
      | InMemorySkillRuntimeOptions = {},
  ) {
    if (isSkillManifestArray(input)) {
      this.registry = new InMemorySkillRegistry(input);
      return;
    }

    if (isSkillRegistry(input)) {
      this.registry = input;
      return;
    }

    this.registry =
      input.registry ?? new InMemorySkillRegistry(input.initialManifests ?? []);
  }

  async getManifest(request: SkillManifestRequest): Promise<SkillManifest> {
    return this.resolveManifest(request);
  }

  async reviewInstall(
    request: SkillInstallReviewRequest,
  ): Promise<SkillInstallReview> {
    const manifestRequest: SkillManifestRequest = {};

    if (request.id !== undefined) {
      manifestRequest.id = request.id;
    }

    if (request.skillId !== undefined) {
      manifestRequest.skillId = request.skillId;
    }

    if (request.name !== undefined) {
      manifestRequest.name = request.name;
    }

    if (request.skillName !== undefined) {
      manifestRequest.skillName = request.skillName;
    }

    if (request.metadata !== undefined) {
      manifestRequest.metadata = request.metadata;
    }

    const manifest = request.manifest ?? this.resolveManifest(manifestRequest);
    const reviewOptions: SkillInstallReviewOptions = {};

    if (request.currentAutonomyLevel !== undefined) {
      reviewOptions.currentAutonomyLevel = request.currentAutonomyLevel;
    }

    if (request.availableTools !== undefined) {
      reviewOptions.availableTools = request.availableTools;
    }

    if (request.toolDefinitions !== undefined) {
      reviewOptions.toolDefinitions = request.toolDefinitions;
    }

    if (request.metadata !== undefined) {
      reviewOptions.metadata = request.metadata;
    }

    return createSkillInstallReview(manifest, reviewOptions);
  }

  private resolveManifest(request: SkillManifestRequest): SkillManifest {
    const skillId = request.skillId ?? request.id;

    if (skillId !== undefined) {
      const manifest = this.registry.getById(skillId);

      if (manifest !== undefined) {
        return manifest;
      }
    }

    const skillName = request.skillName ?? request.name;

    if (skillName !== undefined) {
      const manifest = this.registry.getByName(skillName);

      if (manifest !== undefined) {
        return manifest;
      }
    }

    throw new SkillRuntimeError(
      `Skill manifest not found for request "${formatManifestRequest(request)}".`,
    );
  }
}

function isSkillRegistry(value: unknown): value is SkillRegistry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SkillRegistry>;

  return (
    typeof candidate.register === "function" &&
    typeof candidate.getById === "function" &&
    typeof candidate.getByName === "function" &&
    typeof candidate.list === "function" &&
    typeof candidate.has === "function"
  );
}

function isSkillManifestArray(value: unknown): value is readonly SkillManifest[] {
  return Array.isArray(value);
}

function formatManifestRequest(request: SkillManifestRequest): string {
  return (
    request.skillId ??
    request.id ??
    request.skillName ??
    request.name ??
    "unknown"
  );
}
