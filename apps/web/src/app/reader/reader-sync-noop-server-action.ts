"use server";

// Reader No-op Server Action v1 (A287)
//
// Thin "use server" wrapper around the no-op validation core.
// This file exists so Next.js App Router recognizes it as a server action,
// but it does NOT perform real sync — all responses are preview-only.
//
// No repository, no DB, no fetch, no network, no LLM, no tools, no Agent loop.
// Status: preview-only / no-op / not implemented

import { validateNoopInput } from "./reader-sync-noop-server-action-core";

/**
 * Preview-only no-op server action.
 *
 * Accepts a whitelist-constrained input, validates it, and returns a fixed
 * preview-only / not-implemented response. This action does NOT:
 * - Access the repository
 * - Write to the database
 * - Make network requests (fetch)
 * - Call LLM providers
 * - Execute tools
 * - Start Agent loops
 * - Read or write audit logs
 * - Return real userId, auditId, or serverProgressRatio
 *
 * @param {unknown} input - Raw input (must conform to no-op whitelist)
 * @returns {Promise<object>} A structured response with success=false, implemented=false, previewOnly=true
 */
export async function previewReaderSyncNoopServerAction(
  input: unknown,
): Promise<ReturnType<typeof validateNoopInput>> {
  // All validation and response construction is delegated to the pure core.
  // The core function has no side effects — no DB, no network, no repository.
  var result = validateNoopInput(input);

  // Return as a resolved promise (server actions are async by convention).
  // We use Promise.resolve to avoid introducing any async I/O.
  return Promise.resolve(result);
}
