// ============================================================
// Agent Runtime v1  --  Enhanced Tool Registry
// ============================================================
// Unified registry for AgentTool instances. Supports lookup, filtering,
// freeze, and reset (test-only).

import type { AgentId } from "../core/agent-types.ts";
import type {
  AgentTool,
  AgentToolCategory,
  AgentToolMetadata,
} from "./tool-types.ts";

// -----------------------------------------------------------
// Registry Error
// -----------------------------------------------------------

export class AgentToolRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentToolRegistryError";
  }
}

// -----------------------------------------------------------
// Registry Interface
// -----------------------------------------------------------

export interface AgentToolRegistry {
  register(tool: AgentTool): void;
  get(name: string): AgentTool | undefined;
  list(): AgentTool[];
  listByAgent(agentId: AgentId): AgentTool[];
  listByCategory(category: AgentToolCategory): AgentTool[];
  listEnabled(): AgentTool[];
  isEnabled(name: string): boolean;
  has(name: string): boolean;
  freeze(): void;
  reset(): void;
}

// -----------------------------------------------------------
// In-Memory Implementation
// -----------------------------------------------------------

export class InMemoryAgentToolRegistry implements AgentToolRegistry {
  private readonly tools = new Map<string, AgentTool>();
  private readonly enabledTools = new Set<string>();
  private frozen = false;

  register(tool: AgentTool): void {
    if (this.frozen) {
      throw new AgentToolRegistryError(
        "Registry is frozen. Cannot register new tools.",
      );
    }

    const name = tool.metadata.name;

    if (this.tools.has(name)) {
      throw new AgentToolRegistryError(
        `Tool "${name}" is already registered.`,
      );
    }

    this.tools.set(name, tool);

    // Tools that are not disabledByDefault are automatically enabled
    if (!tool.metadata.disabledByDefault) {
      this.enabledTools.add(name);
    }
  }

  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentTool[] {
    return [...this.tools.values()];
  }

  listByAgent(agentId: AgentId): AgentTool[] {
    return [...this.tools.values()].filter(
      (t) =>
        t.metadata.allowedAgents.length === 0 ||
        t.metadata.allowedAgents.includes(agentId),
    );
  }

  listByCategory(category: AgentToolCategory): AgentTool[] {
    return [...this.tools.values()].filter(
      (t) => t.metadata.category === category,
    );
  }

  listEnabled(): AgentTool[] {
    return [...this.tools.values()].filter((t) =>
      this.enabledTools.has(t.metadata.name),
    );
  }

  isEnabled(name: string): boolean {
    return this.enabledTools.has(name);
  }

  /**
   * Explicitly enable a tool by name.
   * Throws if the tool is not registered.
   */
  enable(name: string): void {
    if (!this.tools.has(name)) {
      throw new AgentToolRegistryError(
        `Cannot enable unknown tool "${name}".`,
      );
    }

    this.enabledTools.add(name);
  }

  /**
   * Explicitly disable a tool by name.
   */
  disable(name: string): void {
    this.enabledTools.delete(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  freeze(): void {
    this.frozen = true;
  }

  /**
   * Reset the registry to empty, unfrozen state. For testing only.
   */
  reset(): void {
    this.tools.clear();
    this.enabledTools.clear();
    this.frozen = false;
  }

  /** Returns true if the registry is frozen. */
  get isFrozen(): boolean {
    return this.frozen;
  }
}
