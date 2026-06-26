/**
 * Local imported problem store — localStorage-backed persistence for problems
 * imported from external Problem API providers.
 *
 * @module local-imported-problem-store
 * @previewOnly — localStorage; not production DB
 */

/** A single example entry for an imported problem. */
export interface ImportedProblemExample {
  input: string;
  output: string;
  explanation?: string;
  label?: string;
}

export interface ImportedProblemEntry {
  /** Locally-generated ID for the imported problem. */
  importedProblemId: string;
  /** Provider ID (e.g., "problem-api-dev"). */
  providerId: string;
  /** External problem ID from the provider. */
  externalProblemId: string;
  /** Source label for dedup grouping (e.g., provider name). */
  source: string;
  /** Problem title. */
  title: string;
  /** Difficulty. */
  difficulty: "easy" | "medium" | "hard" | "challenge" | "unknown";
  /** Tags. */
  tags: string[];
  /** Problem statement / full description. */
  statement: string;
  /** Short summary / description (fallback when statement is unavailable). */
  summary: string;
  /** Input format description. */
  inputDescription: string;
  /** Output format description. */
  outputDescription: string;
  /** Sample input/output examples. */
  examples: ImportedProblemExample[];
  /** Judge-ready test cases generated from examples or source data. */
  judgeTestCases?: ImportedProblemExample[];
  /** Problem constraints (e.g., time/memory limits). */
  constraints: string;
  /** Source URL. */
  sourceUrl: string;
  /** When this was imported. */
  importedAt: string;
  /** Whether this was written to DB. */
  dbWritten: boolean;
  /** DB problem ID if written. */
  dbId?: string;
  /** Storage mode hint: db, localStorage, or fallback. */
  storageMode: "db" | "localStorage" | "fallback";
}

const STORAGE_KEY = "lap-imported-problems";

// ---------------------------------------------------------------------------
// Deduplication helpers
// ---------------------------------------------------------------------------

/**
 * Build a conservative dedupe key from externalId + provider + source + title.
 * Two entries with identical dedupe keys are considered duplicates.
 */
export function buildDedupeKey(entry: {
  externalProblemId: string;
  providerId: string;
  source?: string;
  title: string;
}): string {
  const sourceKey = (entry.source ?? entry.providerId ?? "").trim().toLowerCase();
  const titleKey = entry.title.trim().toLowerCase().slice(0, 80);
  const extKey = entry.externalProblemId.trim().toLowerCase();
  const provKey = entry.providerId.trim().toLowerCase();
  return `${provKey}:${extKey}:${sourceKey}:${titleKey}`;
}

/**
 * Deduplicate an array of ImportedProblemEntry entries.
 * Priority: DB > localStorage > fallback.
 * When two entries have the same dedupe key, the one with higher priority wins.
 */
export function deduplicateImportedProblems(
  entries: ImportedProblemEntry[],
): ImportedProblemEntry[] {
  const STORAGE_PRIORITY: Record<string, number> = {
    db: 3,
    localStorage: 2,
    fallback: 1,
  };

  const seen = new Map<string, ImportedProblemEntry>();

  for (const entry of entries) {
    const key = buildDedupeKey(entry);
    const existing = seen.get(key);

    if (existing === undefined) {
      seen.set(key, entry);
      continue;
    }

    const existingPriority = STORAGE_PRIORITY[existing.storageMode] ?? 0;
    const currentPriority = STORAGE_PRIORITY[entry.storageMode] ?? 0;

    if (currentPriority > existingPriority) {
      seen.set(key, entry);
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

function generateImportedProblemId(providerId: string, externalProblemId: string): string {
  const slug = `${providerId}:${externalProblemId}`.replace(/[^a-zA-Z0-9:_-]/g, "-").slice(0, 80);
  return `imp-${slug}-${Date.now().toString(36)}`;
}

export function loadImportedProblems(): ImportedProblemEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidImportedProblemEntry);
  } catch {
    return [];
  }
}

export function saveImportedProblem(entry: ImportedProblemEntry): boolean {
  try {
    const problems = loadImportedProblems();
    // Deduplicate by providerId + externalProblemId
    const existingIdx = problems.findIndex(
      (p) => p.providerId === entry.providerId && p.externalProblemId === entry.externalProblemId,
    );
    if (existingIdx >= 0) {
      // Merge: update the existing entry but keep original importedAt if newer
      problems[existingIdx] = {
        ...problems[existingIdx],
        ...entry,
        importedAt: problems[existingIdx].importedAt ?? entry.importedAt,
      };
    } else {
      problems.push(entry);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
    return true;
  } catch {
    return false;
  }
}

export function getImportedProblemById(
  importedProblemId: string,
): ImportedProblemEntry | null {
  const problems = loadImportedProblems();
  return problems.find((p) => p.importedProblemId === importedProblemId) ?? null;
}

export function getImportedProblemByProviderKey(
  providerId: string,
  externalProblemId: string,
): ImportedProblemEntry | null {
  const problems = loadImportedProblems();
  return (
    problems.find(
      (p) => p.providerId === providerId && p.externalProblemId === externalProblemId,
    ) ?? null
  );
}

export function createImportedProblemEntry(input: {
  providerId: string;
  externalProblemId: string;
  title: string;
  difficulty: ImportedProblemEntry["difficulty"];
  tags: string[];
  statement?: string;
  summary?: string;
  inputDescription?: string;
  outputDescription?: string;
  examples?: ImportedProblemExample[];
  judgeTestCases?: ImportedProblemExample[];
  constraints?: string;
  source?: string;
  sourceUrl?: string;
  dbWritten?: boolean;
  dbId?: string;
  storageMode?: ImportedProblemEntry["storageMode"];
}): ImportedProblemEntry {
  return {
    importedProblemId: generateImportedProblemId(input.providerId, input.externalProblemId),
    providerId: input.providerId,
    externalProblemId: input.externalProblemId,
    source: input.source ?? input.providerId,
    title: input.title,
    difficulty: input.difficulty,
    tags: input.tags,
    statement: input.statement ?? input.summary ?? "",
    summary: input.summary ?? input.statement ?? "",
    inputDescription: input.inputDescription ?? "",
    outputDescription: input.outputDescription ?? "",
    examples: input.examples ?? [],
    judgeTestCases: input.judgeTestCases ?? input.examples ?? [],
    constraints: input.constraints ?? "",
    sourceUrl: input.sourceUrl ?? "",
    importedAt: new Date().toISOString(),
    dbWritten: input.dbWritten ?? false,
    dbId: input.dbId,
    storageMode: input.storageMode ?? (input.dbWritten ? "db" : "localStorage"),
  };
}

function isValidImportedProblemEntry(value: unknown): value is ImportedProblemEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.importedProblemId === "string" &&
    typeof v.providerId === "string" &&
    typeof v.externalProblemId === "string" &&
    typeof v.title === "string" &&
    typeof v.importedAt === "string"
  );
}

/**
 * Check if a problem with the given provider+externalId combo already exists
 * in localStorage. Returns the existing entry if found, null otherwise.
 */
export function checkDuplicateProblemImport(
  providerId: string,
  externalProblemId: string,
): ImportedProblemEntry | null {
  return getImportedProblemByProviderKey(providerId, externalProblemId);
}
