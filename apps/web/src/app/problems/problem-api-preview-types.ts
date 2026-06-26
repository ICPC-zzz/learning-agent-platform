import type { ExternalApiProviderMode } from "@learning-agent-platform/shared";

import type {
  ProblemApiFilters,
  ProblemPaginationPreview,
  ProblemPreviewItem,
} from "@learning-agent-platform/learning-engine";

export interface ProblemApiPreviewStatusSnapshot {
  providerMode: ExternalApiProviderMode;
  safeToExposeToClient: true;
  productionReady: false;
  blockedReason: string | null;
  missingEnvNames: string[];
}

export interface ProblemApiPreviewViewModel {
  providerMode: ExternalApiProviderMode;
  safeToExposeToClient: true;
  productionReady: false;
  rawResponseStored: false;
  blockedReason: string | null;
  error: string | null;
  missingEnvNames: string[];
  query: string;
  filters: ProblemApiFilters;
  paginationPreview: ProblemPaginationPreview;
  totalResults: number;
  itemsPreview: ProblemPreviewItem[];
  sourceMode: "search" | "list" | "mock";
  externalApiQueried: boolean;
  apiBlocked: boolean;
}
