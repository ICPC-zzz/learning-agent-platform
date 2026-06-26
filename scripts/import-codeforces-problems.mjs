/**
 * Sync Codeforces official API metadata into the local Problem table.
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-codeforces-problems.mjs [options]
 *
 * Options:
 *   --limit <n>         Sync at most n eligible problems (default: CODEFORCES_IMPORT_TARGET or 10000)
 *   --dry-run           Fetch and validate without writing to the database
 *   --min-rating <n>    Minimum rating for inclusion (default: 800)
 *   --max-rating <n>    Maximum rating for inclusion (default: 2400)
 *   --include-unrated   Include problems without a rating
 *   --exclude-tag <tag> Exclude problems with this tag (repeatable; default: interactive)
 *   --scope all         Skip all default filtering (DANGEROUS — imports all CF problems)
 *   --preset <name>     Use a curated pool preset (e.g. "full-pool-v2")
 *   --target-size <n>   Override the preset's default target size (max 30000)
 *   --cleanup-report    Read-only analysis of existing problems against current policy
 *
 * This script intentionally uses only problemset.problems. It does not fetch
 * Codeforces pages and writes only minimal metadata.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const webSrc = resolve(projectRoot, "apps/web/src");
const dbDist = resolve(projectRoot, "packages/db/dist");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const TARGET_IMPORT_COUNT = parseCliLimit(
  process.argv,
  normalizePositiveInteger(
    process.env.CODEFORCES_IMPORT_TARGET,
    10000,
  ),
);
const DRY_RUN = process.argv.includes("--dry-run");
const CLEANUP_REPORT = process.argv.includes("--cleanup-report");
const SCOPE_ALL = process.argv.includes("--scope") &&
  process.argv[process.argv.indexOf("--scope") + 1] === "all";

const PRESET_NAME = parseCliStringOption("--preset");
const TARGET_SIZE_RAW = parseCliPositiveInteger("--target-size");
const TARGET_SIZE = TARGET_SIZE_RAW ?? null;

const INCLUDE_UNRATED = process.argv.includes("--include-unrated");

const CLI_MIN_RATING = parseCliRating("--min-rating", 800);
const CLI_MAX_RATING = parseCliRating("--max-rating", 2400);

const CLI_EXCLUDE_TAGS = parseCliExcludeTags();

const FETCH_TIMEOUT_MS = clampInteger(
  normalizePositiveInteger(process.env.CODEFORCES_IMPORT_TIMEOUT_MS, 20000),
  5000,
  60000,
);
const CODEFORCES_API_URL = "https://codeforces.com/api/problemset.problems";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

if (CLI_MIN_RATING !== null && CLI_MAX_RATING !== null && CLI_MIN_RATING > CLI_MAX_RATING) {
  console.error(
    `Invalid rating range: min-rating (${CLI_MIN_RATING}) is greater than max-rating (${CLI_MAX_RATING}).`,
  );
  process.exit(1);
}

// Preset validation
if (PRESET_NAME !== null && SCOPE_ALL) {
  console.error(
    "Cannot use --preset with --scope all. A preset defines a curated pool with its own policy and quotas.",
  );
  process.exit(1);
}

if (TARGET_SIZE !== null && (TARGET_SIZE < 100 || TARGET_SIZE > 30000)) {
  console.error(
    `Invalid --target-size ${TARGET_SIZE}. Must be between 1000 and 30000.`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

await ensureDatabaseUrl();

const { getPrismaClient } = await import(
  pathToFileURL(resolve(dbDist, "client.js")).href
);
const { syncCodeforcesProblemMetadata } = await import(
  pathToFileURL(resolve(webSrc, "lib/codeforces-metadata-sync.ts")).href
);
const {
  DEFAULT_CODEFORCES_CATALOG_POLICY,
  FULL_POOL_CATALOG_POLICY,
  mergeCatalogPolicy,
  classifyProblemAgainstPolicy,
  ALL_REJECTION_REASONS,
} = await import(
  pathToFileURL(resolve(webSrc, "lib/codeforces-catalog-policy.ts")).href
);
const {
  requirePreset,
  validatePoolConfig,
  MAX_TARGET_SIZE,
} = await import(
  pathToFileURL(resolve(webSrc, "lib/codeforces-curated-pool.ts")).href
);

const prisma = getPrismaClient();

// Build pool config from preset
let poolConfig = null;
let policy = null;
if (PRESET_NAME !== null) {
  const resolved = requirePreset(PRESET_NAME);
  if (TARGET_SIZE !== null) {
    resolved.targetSize = Math.min(TARGET_SIZE, MAX_TARGET_SIZE);
  }
  const validationErrors = validatePoolConfig(resolved);
  if (validationErrors.length > 0) {
    console.error("Invalid pool config:");
    for (const err of validationErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  poolConfig = resolved;

  // When using a preset, choose the right policy
  if (PRESET_NAME === "full-pool-v2") {
    policy = { ...FULL_POOL_CATALOG_POLICY };
  } else {
    policy = { ...DEFAULT_CODEFORCES_CATALOG_POLICY };
  }
}

// Build policy from CLI args (only if not using preset)
if (!poolConfig) {
  if (SCOPE_ALL) {
    console.warn("");
    console.warn("⚠️  WARNING: --scope all bypasses the default catalog policy.");
    console.warn("   This will sync ALL Codeforces problems without rating/type/tag filtering.");
    console.warn("   This is a dangerous operation intended only for development or migration.");
    console.warn("");
    policy = null; // null policy = no filtering
  } else {
    policy = mergeCatalogPolicy({
      minRating: CLI_MIN_RATING ?? DEFAULT_CODEFORCES_CATALOG_POLICY.minRating,
      maxRating: CLI_MAX_RATING ?? DEFAULT_CODEFORCES_CATALOG_POLICY.maxRating,
      includeUnrated: INCLUDE_UNRATED,
      excludeTags: CLI_EXCLUDE_TAGS.length > 0
        ? CLI_EXCLUDE_TAGS
        : [...DEFAULT_CODEFORCES_CATALOG_POLICY.excludeTags],
    });
  }
}

// ---------------------------------------------------------------------------
// Cleanup report mode (read-only)
// ---------------------------------------------------------------------------

if (CLEANUP_REPORT) {
  const reportPolicy = policy ?? DEFAULT_CODEFORCES_CATALOG_POLICY;
  console.log("Codeforces catalog cleanup report (READ-ONLY)");
  console.log("Policy:");
  console.log(`  Rating range: ${reportPolicy.minRating}–${reportPolicy.maxRating}`);
  console.log(`  Include unrated: ${reportPolicy.includeUnrated}`);
  console.log(`  Excluded tags: ${reportPolicy.excludeTags.join(", ") || "(none)"}`);
  console.log(`  Allowed types: ${reportPolicy.allowedTypes.join(", ")}`);
  console.log("");

  await runCleanupReport(prisma, reportPolicy);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Sync mode
// ---------------------------------------------------------------------------

if (DRY_RUN) {
  console.log("Codeforces metadata sync (DRY RUN)");
  console.log(`Endpoint: problemset.problems`);
  console.log(`Target import count: ${TARGET_IMPORT_COUNT}`);
  console.log("HTML fetch: disabled");
  console.log("Database write: disabled (--dry-run)");
  if (poolConfig) {
    console.log(`Preset: ${poolConfig.preset}`);
    console.log(`Target size: ${poolConfig.targetSize}`);
    console.log(`Rating bands: ${poolConfig.quotas.length}`);
  } else if (policy) {
    console.log(`Rating range: ${policy.minRating}–${policy.maxRating}`);
    console.log(`Include unrated: ${policy.includeUnrated}`);
    console.log(`Excluded tags: ${policy.excludeTags.join(", ") || "(none)"}`);
  } else {
    console.log("Policy: NONE (--scope all — no filtering)");
  }

  const realStore = createPrismaProblemMetadataStore(prisma, TARGET_IMPORT_COUNT);
  const store = createDryRunStore(realStore);

  const result = await syncCodeforcesProblemMetadata({
    fetchProblemSet: fetchCodeforcesProblemsetJson,
    store,
    maxProblems: poolConfig ? null : TARGET_IMPORT_COUNT,
    policy,
    poolConfig,
  });

  printSyncResult(result, true);

  console.log("");
  console.log("Dry-run finished (no database writes)");
} else {
  const store = createPrismaProblemMetadataStore(prisma, TARGET_IMPORT_COUNT);

  console.log("Codeforces metadata sync");
  console.log(`Endpoint: problemset.problems`);
  console.log(`Target import count: ${TARGET_IMPORT_COUNT}`);
  console.log("HTML fetch: disabled");
  if (poolConfig) {
    console.log(`Preset: ${poolConfig.preset}`);
    console.log(`Target size: ${poolConfig.targetSize}`);
    console.log(`Rating bands: ${poolConfig.quotas.length}`);
  } else if (policy) {
    console.log(`Rating range: ${policy.minRating}–${policy.maxRating}`);
    console.log(`Include unrated: ${policy.includeUnrated}`);
    console.log(`Excluded tags: ${policy.excludeTags.join(", ") || "(none)"}`);
  } else {
    console.log("Policy: NONE (--scope all — no filtering)");
  }

  const result = await syncCodeforcesProblemMetadata({
    fetchProblemSet: fetchCodeforcesProblemsetJson,
    store,
    maxProblems: poolConfig ? null : TARGET_IMPORT_COUNT,
    policy,
    poolConfig,
  });

  printSyncResult(result, false);

  console.log("");
  console.log("Sync finished");
}

// ---------------------------------------------------------------------------
// Cleanup report
// ---------------------------------------------------------------------------

async function runCleanupReport(prismaClient, reportPolicy) {
  // Query all Codeforces problems from DB
  const allProblems = await prismaClient.problem.findMany({
    where: {
      OR: [
        { source: "codeforces" },
        { sourceUrl: { contains: "codeforces.com/problemset/problem" } },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  const totalCount = allProblems.length;

  if (totalCount === 0) {
    console.log("No Codeforces problems found in the database.");
    return;
  }

  // Collect all problem IDs for user-association queries
  const problemIds = allProblems.map((p) => p.id);

  // Check user associations (batch queries for performance)
  const [
    favoriteProblemIds,
    wrongBookProblemIds,
    attemptProblemIds,
    recommendationProblemIds,
  ] = await Promise.all([
    prismaClient.problemFavorite
      .findMany({
        where: { problemId: { in: problemIds } },
        select: { problemId: true },
        distinct: ["problemId"],
      })
      .then((rows) => new Set(rows.map((r) => r.problemId))),
    prismaClient.problemWrongBook
      .findMany({
        where: { problemId: { in: problemIds } },
        select: { problemId: true },
        distinct: ["problemId"],
      })
      .then((rows) => new Set(rows.map((r) => r.problemId))),
    prismaClient.problemAttempt
      .findMany({
        where: { problemId: { in: problemIds } },
        select: { problemId: true },
        distinct: ["problemId"],
      })
      .then((rows) => new Set(rows.map((r) => r.problemId))),
    prismaClient.dailyRecommendation
      .findMany({
        where: { problemId: { in: problemIds } },
        select: { problemId: true },
        distinct: ["problemId"],
      })
      .then((rows) => new Set(rows.map((r) => r.problemId))),
  ]);

  // Classify each problem
  const eligible = [];
  const ineligible = [];

  const rejectionCounts = Object.fromEntries(
    ALL_REJECTION_REASONS.map((r) => [r, 0]),
  );

  for (const problem of allProblems) {
    const hasAssociations =
      favoriteProblemIds.has(problem.id) ||
      wrongBookProblemIds.has(problem.id) ||
      attemptProblemIds.has(problem.id) ||
      recommendationProblemIds.has(problem.id);

    const classification = classifyProblemAgainstPolicy(
      problem,
      hasAssociations,
      reportPolicy,
    );

    if (classification.eligible) {
      eligible.push(problem);
    } else {
      ineligible.push({ problem, classification });
      const reason = classification.reason ?? "unknown";
      rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1;
    }
  }

  // Ineligible breakdown
  const ineligibleWithAssociations = ineligible.filter(
    (e) => e.classification.hasUserAssociations,
  );
  const ineligibleWithoutAssociations = ineligible.filter(
    (e) => !e.classification.hasUserAssociations,
  );

  // Print report
  console.log("========================================");
  console.log("  CODEFORCES CATALOG CLEANUP REPORT");
  console.log("  (READ-ONLY — NO DELETIONS)");
  console.log("========================================");
  console.log("");
  console.log(`Total Codeforces problems in DB:     ${totalCount}`);
  console.log(`Eligible (matches current policy):   ${eligible.length}`);
  console.log(`Ineligible (outside policy):         ${ineligible.length}`);
  console.log("");
  console.log("--- Rating distribution ---");
  console.log(`  Rating missing:                     ${rejectionCounts["rating_missing"] ?? 0}`);
  console.log(`  Rating below ${reportPolicy.minRating}:               ${rejectionCounts["rating_below_min"] ?? 0}`);
  console.log(`  Rating above ${reportPolicy.maxRating}:              ${rejectionCounts["rating_above_max"] ?? 0}`);
  console.log("");
  console.log("--- Type / Tag distribution ---");
  console.log(`  Interactive:                        ${rejectionCounts["interactive"] ?? 0}`);
  console.log(`  Unsupported type:                   ${rejectionCounts["unsupported_type"] ?? 0}`);
  console.log("");
  console.log("--- Structural issues ---");
  console.log(`  Contest ID missing:                 ${rejectionCounts["contest_id_missing"] ?? 0}`);
  console.log(`  Index missing:                      ${rejectionCounts["index_missing"] ?? 0}`);
  console.log(`  Name missing:                       ${rejectionCounts["name_missing"] ?? 0}`);
  console.log("");
  console.log("--- User association status ---");
  console.log(`  Ineligible WITH user associations:   ${ineligibleWithAssociations.length}`);
  console.log(`  Ineligible WITHOUT associations:     ${ineligibleWithoutAssociations.length}`);
  console.log("");

  if (ineligible.length > 0) {
    const sampleSize = Math.min(5, ineligible.length);
    console.log(`Sample of ineligible problems (${sampleSize} of ${ineligible.length}):`);
    for (let i = 0; i < sampleSize; i++) {
      const entry = ineligible[i];
      console.log(
        `  - [${entry.classification.externalKey}] ${entry.classification.title}` +
        ` (rating: ${entry.classification.rating ?? "none"}, ` +
        `reason: ${entry.classification.reason}, ` +
        `associations: ${entry.classification.hasUserAssociations ? "yes" : "no"})`,
      );
    }
  }

  console.log("");
  console.log("⚠️  NO DELETIONS PERFORMED. This report is read-only.");
  console.log("   User associations checked: favorites, practice, wrong-book, attempts, recommendations.");
}

// ---------------------------------------------------------------------------
// Sync result printing
// ---------------------------------------------------------------------------

function printSyncResult(result, isDryRun) {
  const action = isDryRun ? "Would create" : "Created";
  const actionUpdate = isDryRun ? "Would update" : "Updated";

  console.log("");
  console.log(`${isDryRun ? "Dry-run" : "Sync"} summary:`);
  console.log(`  Fetched:    ${result.fetched}`);
  console.log(`  Valid:      ${result.valid}`);
  console.log(`  Eligible:   ${result.eligible}`);
  console.log(`  Selected:   ${result.selected}`);
  console.log(`  ${action}:     ${result.created}`);
  console.log(`  ${actionUpdate}:     ${result.updated}`);
  console.log(`  Unchanged:  ${result.unchanged}`);
  console.log(`  Skipped:    ${result.skipped}`);

  // Rejection reasons
  const reasons = Object.entries(result.rejectedByReason);
  if (reasons.length > 0) {
    console.log("");
    console.log("  Rejection reasons:");
    for (const [reason, count] of reasons.sort(([, a], [, b]) => b - a)) {
      console.log(`    ${reason}: ${count}`);
    }
  }

  // Pool-specific: rating distribution
  if (result.ratingDistribution && result.ratingDistribution.length > 0) {
    console.log("");
    console.log("  Rating band distribution:");
    for (const band of result.ratingDistribution) {
      console.log(`    ${band.rating}: ${band.selected}/${band.available} (quota: ${band.quota})`);
    }
  }

  // Pool-specific: tag distribution (top 20)
  if (result.tagDistribution && result.tagDistribution.length > 0) {
    console.log("");
    console.log("  Tag distribution (top 20):");
    const topTags = result.tagDistribution.slice(0, 20);
    for (const entry of topTags) {
      console.log(`    ${entry.tag}: ${entry.count}`);
    }
  }

  if (result.errors.length > 0) {
    console.log("");
    console.log("  Warnings:");
    for (const error of result.errors.slice(0, 20)) {
      console.log(`    - ${error.key ? `${error.key}: ` : ""}${error.reason}`);
    }
    if (result.errors.length > 20) {
      console.log(`    - ... ${result.errors.length - 20} more warnings`);
    }
  }
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

async function fetchCodeforcesProblemsetJson() {
  const response = await fetchJson(CODEFORCES_API_URL, FETCH_TIMEOUT_MS);

  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Codeforces API returned a non-object response");
  }

  if (response.status !== "OK") {
    throw new Error(`Codeforces API returned status ${String(response.status ?? "unknown")}`);
  }

  if (!response.result || typeof response.result !== "object" || Array.isArray(response.result)) {
    throw new Error("Codeforces API response missing result object");
  }

  return {
    status: "OK",
    result: {
      problems: Array.isArray(response.result.problems) ? response.result.problems : [],
      problemStatistics: Array.isArray(response.result.problemStatistics)
        ? response.result.problemStatistics
        : [],
    },
    _rawExposed: false,
  };
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "learning-agent-platform-codeforces-metadata-sync/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Codeforces API returned HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Codeforces API request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Store factories
// ---------------------------------------------------------------------------

function createPrismaProblemMetadataStore(prismaClient, targetImportCount) {
  return {
    async listExistingProblems() {
      return prismaClient.problem.findMany({
        where: {
          OR: [
            { source: "codeforces" },
            { sourceUrl: { contains: "codeforces.com/problemset/problem" } },
          ],
        },
        take: Math.max(targetImportCount * 2, 20000),
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      });
    },

    async createProblem(input) {
      return prismaClient.problem.create({
        data: {
          title: input.title,
          description: input.description,
          difficulty: input.difficulty,
          tags: input.tags,
          source: input.source,
          sourceUrl: input.sourceUrl,
          metadata: input.metadata,
        },
      });
    },

    async updateProblem(id, input) {
      return prismaClient.problem.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          difficulty: input.difficulty,
          tags: input.tags,
          source: input.source,
          sourceUrl: input.sourceUrl,
          metadata: input.metadata,
        },
      });
    },
  };
}

function createDryRunStore(realStore) {
  let nextDryId = 1;
  let dryRunCreates = 0;
  let dryRunUpdates = 0;

  return {
    async listExistingProblems() {
      return realStore.listExistingProblems();
    },
    async createProblem(input) {
      dryRunCreates += 1;
      const preview = {
        id: `dry-run-${nextDryId++}`,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        tags: [...input.tags],
        source: input.source,
        sourceUrl: input.sourceUrl,
        metadata: { ...input.metadata },
      };
      console.log(
        `  [DRY-RUN] Would create: ${input.title} (key: ${input.metadata.externalId})`,
      );
      return preview;
    },
    async updateProblem(id, input) {
      dryRunUpdates += 1;
      const preview = {
        id,
        title: input.title,
        description: input.description,
        difficulty: input.difficulty,
        tags: [...input.tags],
        source: input.source,
        sourceUrl: input.sourceUrl,
        metadata: { ...input.metadata },
      };
      console.log(
        `  [DRY-RUN] Would update: ${id} → ${input.title}`,
      );
      return preview;
    },
  };
}

// ---------------------------------------------------------------------------
// CLI helpers
// ---------------------------------------------------------------------------

async function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return;
  }

  throw new Error("DATABASE_URL not found. Set it explicitly before running the metadata sync.");
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function clampInteger(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parseCliLimit(argv, fallback) {
  const limitIndex = argv.indexOf("--limit");
  if (limitIndex < 0 || limitIndex + 1 >= argv.length) {
    return fallback;
  }

  const raw = argv[limitIndex + 1];
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `Invalid --limit value "${raw}". Expected a positive integer.`,
    );
    process.exit(1);
  }

  return parsed;
}

function parseCliRating(flag, fallback) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return fallback;
  }

  const raw = process.argv[index + 1];
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `Invalid ${flag} value "${raw}". Expected a positive integer.`,
    );
    process.exit(1);
  }

  return parsed;
}

function parseCliExcludeTags() {
  const tags = [];
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === "--exclude-tag" && i + 1 < process.argv.length) {
      const raw = process.argv[i + 1];
      if (typeof raw === "string" && raw.trim().length > 0 && !raw.startsWith("-")) {
        tags.push(raw.trim().toLowerCase());
      }
    }
  }
  return tags;
}

function parseCliStringOption(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return null;
  }
  const raw = process.argv[index + 1];
  if (typeof raw !== "string" || raw.trim().length === 0 || raw.startsWith("-")) {
    return null;
  }
  return raw.trim();
}

function parseCliPositiveInteger(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) {
    return null;
  }
  const raw = process.argv[index + 1];
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `Invalid ${flag} value "${raw}". Expected a positive integer.`,
    );
    process.exit(1);
  }

  return parsed;
}
