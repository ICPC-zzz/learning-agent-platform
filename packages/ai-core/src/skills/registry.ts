import { assertValidSkillManifest } from "./validation";
import { cloneSkillManifest, createSkillId, normalizeSkillName } from "./utils";
import type { SkillManifest, SkillRegistry } from "./types";

export class SkillRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillRegistryError";
  }
}

export class InMemorySkillRegistry implements SkillRegistry {
  private readonly manifestsById = new Map<string, SkillManifest>();

  private readonly idByNormalizedName = new Map<string, string>();

  constructor(initialManifests: readonly SkillManifest[] = []) {
    for (const manifest of initialManifests) {
      this.register(manifest);
    }
  }

  register(manifest: SkillManifest): SkillManifest {
    assertValidSkillManifest(manifest);

    const skillId = manifest.id?.trim() ?? createSkillId(manifest.name);
    const normalizedName = normalizeSkillName(manifest.name);

    if (this.manifestsById.has(skillId)) {
      throw new SkillRegistryError(
        `Skill with id "${skillId}" is already registered.`,
      );
    }

    if (this.idByNormalizedName.has(normalizedName)) {
      throw new SkillRegistryError(
        `Skill with name "${manifest.name}" is already registered.`,
      );
    }

    const registeredManifest = cloneSkillManifest({
      ...manifest,
      id: skillId,
    });

    this.manifestsById.set(skillId, registeredManifest);
    this.idByNormalizedName.set(normalizedName, skillId);

    return cloneSkillManifest(registeredManifest);
  }

  getById(id: string): SkillManifest | undefined {
    const manifest = this.manifestsById.get(id);

    return manifest === undefined ? undefined : cloneSkillManifest(manifest);
  }

  getByName(name: string): SkillManifest | undefined {
    const skillId = this.idByNormalizedName.get(normalizeSkillName(name));

    if (skillId === undefined) {
      return undefined;
    }

    return this.getById(skillId);
  }

  list(): SkillManifest[] {
    return Array.from(this.manifestsById.values()).map((manifest) =>
      cloneSkillManifest(manifest),
    );
  }

  has(idOrName: string): boolean {
    return (
      this.manifestsById.has(idOrName) ||
      this.idByNormalizedName.has(normalizeSkillName(idOrName))
    );
  }
}
