"use server";

import { cookies } from "next/headers";
import type { TextImportSaveRequestPreview } from "./text-import-save-request.ts";
import { isTextImportSaveDevEnabled } from "./text-import-save-dev-guard.ts";
import { writeTextImportSaveToDevStore } from "./text-import-save-dev-writer.ts";
import {
  evaluateImportDbPersistGuard,
  type ImportDbPersistGuardResult,
} from "./text-import-db-persist-guard.ts";
import {
  writeImportToDatabase,
  type ImportDbPersistWriterResult,
} from "./text-import-db-persist-writer.ts";
import { resolveImportOwnerContext } from "./text-import-owner-context.ts";

export interface TextImportSaveDevServerActionResult {
  success: boolean;
  previewOnly: true;
  implemented: boolean;
  safeToExposeToClient: true;
  reasonCode: string;
  writesDatabase: boolean;
  callsRepository: boolean;
  usesDevStore: boolean;
  message: string;
  bookId: string | null;
  chapterIds: string[];
  chapterCount: number;
  dbPersistGuard: ImportDbPersistGuardResult;
  usedDbPersist: boolean;
}

const NOOP_RESULT: TextImportSaveDevServerActionResult = {
  success: false,
  previewOnly: true,
  implemented: false,
  safeToExposeToClient: true,
  reasonCode: "save-disabled-by-default",
  writesDatabase: false,
  callsRepository: false,
  usesDevStore: false,
  message: "Save is disabled by default.",
  bookId: null,
  chapterIds: [],
  chapterCount: 0,
  dbPersistGuard: evaluateImportDbPersistGuard(),
  usedDbPersist: false,
};

const BLOCKED_RESULT: TextImportSaveDevServerActionResult = {
  success: false,
  previewOnly: true,
  implemented: true,
  safeToExposeToClient: true,
  reasonCode: "save-request-blocked",
  writesDatabase: false,
  callsRepository: false,
  usesDevStore: false,
  message: "Save request validation failed.",
  bookId: null,
  chapterIds: [],
  chapterCount: 0,
  dbPersistGuard: evaluateImportDbPersistGuard(),
  usedDbPersist: false,
};

export async function saveTextImportDevServerAction(
  _previousState: TextImportSaveDevServerActionResult | null,
  saveRequest: TextImportSaveRequestPreview | null,
): Promise<TextImportSaveDevServerActionResult> {
  const dbPersistGuard = evaluateImportDbPersistGuard();

  if (!isTextImportSaveDevEnabled()) {
    return { ...NOOP_RESULT, dbPersistGuard };
  }

  if (saveRequest === null) return { ...BLOCKED_RESULT, dbPersistGuard };
  if (!saveRequest.saveReady) return { ...BLOCKED_RESULT, dbPersistGuard };
  if (saveRequest.blockedReasons.length > 0)
    return { ...BLOCKED_RESULT, dbPersistGuard };
  if (!saveRequest.userExplicitlyConfirmed)
    return { ...BLOCKED_RESULT, dbPersistGuard };
  if (saveRequest.safeToExposeToClient !== true)
    return { ...BLOCKED_RESULT, dbPersistGuard };

  if (dbPersistGuard.enabled) {
    let ownerId: string | null = null;
    try {
      const cookieStore = await cookies();
      const raw = cookieStore.get("lap-web-dev-session")?.value;
      const ownerContext = resolveImportOwnerContext(raw);
      if (ownerContext.hasOwner) {
        ownerId = ownerContext.ownerId;
      }
    } catch {
      // Cookie read failed - proceed without owner
    }

    const dbResult: ImportDbPersistWriterResult =
      await writeImportToDatabase({ saveRequest, ownerId });

    return {
      success: dbResult.success,
      previewOnly: true,
      implemented: true,
      safeToExposeToClient: true,
      reasonCode: dbResult.reasonCode,
      writesDatabase: dbResult.writesDatabase,
      callsRepository: dbResult.callsRepository,
      usesDevStore: false,
      message: dbResult.message,
      bookId: dbResult.bookId,
      chapterIds: dbResult.chapterIds,
      chapterCount: dbResult.chapterCount,
      dbPersistGuard,
      usedDbPersist: true,
    };
  }

  const result = writeTextImportSaveToDevStore(saveRequest);

  return {
    success: result.success,
    previewOnly: true,
    implemented: true,
    safeToExposeToClient: true,
    reasonCode: result.reasonCode,
    writesDatabase: false,
    callsRepository: false,
    usesDevStore: result.success,
    message: result.message,
    bookId: result.bookId,
    chapterIds: result.chapterIds,
    chapterCount: result.chapterIds.length,
    dbPersistGuard,
    usedDbPersist: false,
  };
}
