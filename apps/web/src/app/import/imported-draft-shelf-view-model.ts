import type { ImportedBookDraft } from "@learning-agent-platform/book-engine";

import { createImportedBookDraftLinks, listImportedBookDrafts } from "../../lib/local-imported-book-draft-store.ts";
import {
  createBlockedImportedDraftDbWriteGuard,
  type ImportedDraftDbWriteGuardResult,
} from "./imported-draft-db-write-guard.ts";

export interface ImportedDraftShelfSafetyMetadata {
  previewOnly: true;
  localOnly: true;
  syncedToCloud: false;
  writtenToDb: false;
  llmUsed: false;
  rawResponseStored: false;
}

export interface ImportedDraftShelfDbSaveStatus
  extends ImportedDraftDbWriteGuardResult {
  statusText: string;
}

export interface ImportedDraftShelfItemViewModel {
  draftId: string;
  title: string;
  authors: string[];
  providerId: string;
  externalBookId: string;
  source: ImportedBookDraft["source"];
  language: string;
  createdAt: string;
  updatedAt: string;
  chapterCount: number;
  readerUrl: string;
  bodyAvailable: boolean;
  productionReady: false;
  writesDatabase: false;
  llmUsed: false;
  externalApiUsed: false;
  rawResponseStored: false;
  safeToExposeToClient: true;
  safetyMetadata: ImportedDraftShelfSafetyMetadata;
  safeLabels: string[];
}

export interface ImportedDraftShelfViewModel {
  status: "empty" | "loaded";
  message: string;
  totalCount: number;
  drafts: ImportedDraftShelfItemViewModel[];
  devDbSaveStatus: ImportedDraftShelfDbSaveStatus;
  safeToExposeToClient: true;
  safetyMetadata: ImportedDraftShelfSafetyMetadata;
}

export const IMPORTED_DRAFT_SHELF_SAFE_LABELS = [
  "preview-only",
  "local-only",
  "not synced to cloud",
  "not written to DB",
  "no LLM",
  "no raw response",
] as const;

export const IMPORTED_DRAFT_SHELF_EMPTY_MESSAGE =
  "No localStorage imported drafts yet. This shelf is preview-only and local-only.";

export const IMPORTED_DRAFT_SHELF_LOADED_MESSAGE = (count: number) =>
  `Loaded ${count} preview drafts from localStorage only.`;

const SHELF_SAFETY_METADATA: ImportedDraftShelfSafetyMetadata = {
  previewOnly: true,
  localOnly: true,
  syncedToCloud: false,
  writtenToDb: false,
  llmUsed: false,
  rawResponseStored: false,
};

const SHELF_DB_SAVE_BLOCKED_STATUS = createShelfDbSaveStatus(
  createBlockedImportedDraftDbWriteGuard(),
);

export function buildImportedDraftShelfViewModel(
  drafts: readonly ImportedBookDraft[] = listImportedBookDrafts(),
  devDbSaveStatus: ImportedDraftDbWriteStatusInput = SHELF_DB_SAVE_BLOCKED_STATUS,
): ImportedDraftShelfViewModel {
  const shelfDbSaveStatus = createShelfDbSaveStatus(devDbSaveStatus);
  const safeDrafts = drafts
    .filter((draft) => draft.safeToExposeToClient === true)
    .map(mapImportedDraftToShelfItem);

  if (safeDrafts.length === 0) {
    return {
      status: "empty",
      message: IMPORTED_DRAFT_SHELF_EMPTY_MESSAGE,
      totalCount: 0,
      drafts: [],
      devDbSaveStatus: shelfDbSaveStatus,
      safeToExposeToClient: true,
      safetyMetadata: SHELF_SAFETY_METADATA,
    };
  }

    return {
      status: "loaded",
      message: IMPORTED_DRAFT_SHELF_LOADED_MESSAGE(safeDrafts.length),
      totalCount: safeDrafts.length,
      drafts: safeDrafts,
      devDbSaveStatus: shelfDbSaveStatus,
      safeToExposeToClient: true,
      safetyMetadata: SHELF_SAFETY_METADATA,
    };
}

export function mapImportedDraftToShelfItem(
  draft: ImportedBookDraft,
): ImportedDraftShelfItemViewModel {
  const links = createImportedBookDraftLinks(draft.draftId);

  return {
    draftId: draft.draftId,
    title: draft.title,
    authors: [...draft.authors],
    providerId: draft.providerId,
    externalBookId: draft.externalBookId,
    source: draft.source,
    language: draft.language,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    chapterCount: draft.chapters.length,
    readerUrl: links.readerHref,
    bodyAvailable: draft.bodyAvailable,
    productionReady: false,
    writesDatabase: false,
    llmUsed: false,
    externalApiUsed: false,
    rawResponseStored: false,
    safeToExposeToClient: true,
    safetyMetadata: SHELF_SAFETY_METADATA,
    safeLabels: [...IMPORTED_DRAFT_SHELF_SAFE_LABELS],
  };
}

type ImportedDraftDbWriteStatusInput =
  | ImportedDraftDbWriteGuardResult
  | ImportedDraftShelfDbSaveStatus;

function createShelfDbSaveStatus(
  input: ImportedDraftDbWriteStatusInput,
): ImportedDraftShelfDbSaveStatus {
  const baseStatus =
    "statusText" in input
      ? input
      : {
          ...input,
          statusText: input.enabled
            ? "dev-only DB save enabled"
            : input.blockedReasons[0] ?? "dev-only DB save blocked",
        };

  return {
    ...baseStatus,
    statusText: baseStatus.statusText,
  };
}
