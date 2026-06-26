// ============================================================
// Agent Runtime v1  --  Tool Permission System
// ============================================================
// Fail-closed permission evaluation based on tool metadata,
// agent identity, user auth state, and global deny rules.
// Reference: CCX three-layer rules (allow/deny/ask), independently implemented.

import type { AgentId } from "../core/agent-types.ts";
import type {
  AgentToolMetadata,
  ToolExecutionContext,
  ToolPermissionDecision,
  ToolPermissionResult,
} from "./tool-types.ts";
import { ToolPermissionDecision as D } from "./tool-types.ts";
import { matchesGlobalDenyRule } from "./tool-types.ts";

// -----------------------------------------------------------
// Permission Evaluator
// -----------------------------------------------------------

export interface AgentToolPermissionEvaluator {
  evaluate(
    tool: AgentToolMetadata,
    context: ToolExecutionContext,
  ): ToolPermissionResult;
}

// -----------------------------------------------------------
// Default Permission Evaluator (Fail-Closed)
// -----------------------------------------------------------

export class DefaultAgentToolPermissionEvaluator
  implements AgentToolPermissionEvaluator
{
  evaluate(
    tool: AgentToolMetadata,
    context: ToolExecutionContext,
  ): ToolPermissionResult {
    // 1. Global deny rules  --  highest priority
    const globalDenyReason = matchesGlobalDenyRule(tool);

    if (globalDenyReason) {
      return {
        decision: D.Deny,
        reason: `Global deny rule: ${globalDenyReason}`,
      };
    }

    // 2. Disabled by default and not explicitly enabled → DENY
    if (tool.disabledByDefault) {
      return {
        decision: D.Deny,
        reason: `Tool "${tool.name}" is disabled by default and has not been explicitly enabled.`,
      };
    }

    // 3. Unauthenticated user → DENY (unless read-only and low sensitivity)
    if (!context.isAuthenticated) {
      if (
        tool.readOnly &&
        tool.sensitivity === "none" &&
        !tool.requiresAuthentication
      ) {
        // Allow unauthenticated read-only access to non-sensitive tools
        return {
          decision: D.Allow,
          reason: `Tool "${tool.name}" is read-only and non-sensitive; unauthenticated access allowed.`,
        };
      }

      return {
        decision: D.Deny,
        reason: `Tool "${tool.name}" requires authentication but user is not authenticated.`,
      };
    }

    // 4. Agent not in allowedAgents list → DENY
    if (
      tool.allowedAgents.length > 0 &&
      !tool.allowedAgents.includes(context.agentId)
    ) {
      return {
        decision: D.Deny,
        reason: `Agent "${context.agentId}" is not allowed to use tool "${tool.name}".`,
      };
    }

    // 5. Requires confirmation → REQUIRE_CONFIRMATION
    if (tool.requiresConfirmation && !context.isUserAuthorized) {
      return {
        decision: D.RequireConfirmation,
        reason: `Tool "${tool.name}" requires user confirmation before execution.`,
        requiredConfirmationMessage: `Allow agent "${context.agentId}" to execute "${tool.name}"?`,
      };
    }

    // 6. High sensitivity → REQUIRE_CONFIRMATION even if authorized
    if (
      tool.sensitivity === "high" ||
      tool.sensitivity === "critical"
    ) {
      return {
        decision: D.RequireConfirmation,
        reason: `Tool "${tool.name}" has ${tool.sensitivity} sensitivity and requires explicit confirmation.`,
        requiredConfirmationMessage: `This tool has ${tool.sensitivity} sensitivity. Confirm execution?`,
      };
    }

    // 7. Read-only tools → ALLOW (if other checks passed)
    if (tool.readOnly) {
      return {
        decision: D.Allow,
        reason: `Read-only tool "${tool.name}" is allowed.`,
      };
    }

    // 8. Default → ALLOW (all gates passed)
    return {
      decision: D.Allow,
      reason: `Tool "${tool.name}" passed all permission checks.`,
    };
  }
}

// -----------------------------------------------------------
// Permission Result Helpers
// -----------------------------------------------------------

export function isDenied(result: ToolPermissionResult): boolean {
  return result.decision === D.Deny;
}

export function isAllowed(result: ToolPermissionResult): boolean {
  return result.decision === D.Allow;
}

export function requiresConfirmation(
  result: ToolPermissionResult,
): boolean {
  return result.decision === D.RequireConfirmation;
}
