"use server";

import { cookies } from "next/headers";
import type { ImportedBookDraft } from "@learning-agent-platform/book-engine";

import { getDevAuthGuardStatus } from "../../lib/web-auth-dev-guard.ts";
import { deserializeDevSession } from "../../lib/web-auth-dev-session.ts";
import {
  evaluateImportedDraftDbWriteGuard,
} from "./imported-draft-db-write-guard.ts";
import {
  writeImportedDraftToDevDatabase,
  type ImportedDraftDbWriteOwnerMode,
  type ImportedDraftDbWriteResult,
} from "./imported-draft-db-write-adapter.ts";

export async function saveImportedDraftToDevDatabaseAction(
  draft: ImportedBookDraft | null,
): Promise<ImportedDraftDbWriteResult> {
  const guard = evaluateImportedDraftDbWriteGuard();

  if (!guard.enabled) {
    return writeImportedDraftToDevDatabase({ draft, guard });
  }

  const ownerContext = await resolveImportedDraftOwnerContext();
  return writeImportedDraftToDevDatabase({
    draft,
    guard,
    ownerMode: ownerContext.ownerMode,
    ownerLabel: ownerContext.ownerLabel,
  });
}

interface ImportedDraftOwnerContext {
  ownerMode: ImportedDraftDbWriteOwnerMode;
  ownerLabel: string | null;
}

async function resolveImportedDraftOwnerContext(): Promise<ImportedDraftOwnerContext> {
  const devAuthGuard = getDevAuthGuardStatus();

  if (!devAuthGuard.enabled) {
    return {
      ownerMode: "anonymous-fallback",
      ownerLabel: null,
    };
  }

  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get("lap-web-dev-session")?.value;
    const session = deserializeDevSession(rawSession);

    if (session !== null) {
      return {
        ownerMode: "trusted-dev-session",
        ownerLabel: session.displayName,
      };
    }
  } catch {
    // Ignore cookie read failures and fall back to anonymous owner mode.
  }

  return {
    ownerMode: "anonymous-fallback",
    ownerLabel: null,
  };
}

export type {
  ImportedDraftDbWriteGuardResult,
} from "./imported-draft-db-write-guard.ts";
