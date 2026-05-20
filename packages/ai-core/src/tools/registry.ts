import { ToolRegistryError } from "./errors";
import {
  ToolCallErrorCode,
  type ToolDefinition,
  type ToolRegistration,
} from "./types";
import { cloneToolDefinition, normalizeToolName, validateToolDefinition } from "./utils";

export class InMemoryToolRegistry {
  private readonly registrations = new Map<string, ToolRegistration>();

  constructor(initialRegistrations: readonly ToolRegistration[] = []) {
    for (const registration of initialRegistrations) {
      this.register(registration);
    }
  }

  register(registration: ToolRegistration): ToolDefinition {
    if (typeof registration.handler !== "function") {
      throw new ToolRegistryError(
        ToolCallErrorCode.InvalidToolDefinition,
        "Tool handler must be a function.",
      );
    }

    const definition = validateToolDefinition(registration.definition);

    if (this.registrations.has(definition.name)) {
      throw new ToolRegistryError(
        ToolCallErrorCode.DuplicateTool,
        `Tool "${definition.name}" is already registered.`,
      );
    }

    this.registrations.set(definition.name, {
      ...registration,
      definition,
    });

    return cloneToolDefinition(definition);
  }

  get(name: string): ToolRegistration | undefined {
    const normalizedName = tryNormalizeToolName(name);

    if (normalizedName === undefined) {
      return undefined;
    }

    const registration = this.registrations.get(normalizedName);

    if (registration === undefined) {
      return undefined;
    }

    return {
      ...registration,
      definition: cloneToolDefinition(registration.definition),
    };
  }

  list(): ToolDefinition[] {
    return [...this.registrations.values()].map((registration) =>
      cloneToolDefinition(registration.definition),
    );
  }

  has(name: string): boolean {
    const normalizedName = tryNormalizeToolName(name);

    return normalizedName !== undefined && this.registrations.has(normalizedName);
  }
}

function tryNormalizeToolName(name: string): string | undefined {
  try {
    return normalizeToolName(name);
  } catch {
    return undefined;
  }
}
