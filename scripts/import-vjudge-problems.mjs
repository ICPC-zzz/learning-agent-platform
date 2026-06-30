/**
 * Import VJudge problem snapshots into the local database.
 *
 * This script expects a JSON export produced from a VJudge list/detail crawl.
 * The export can be an array of problem objects, or an object with a
 * `problems` array.
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-vjudge-problems.mjs --input path\to\vjudge-export.json
 *
 * Optional env:
 *   VJUDGE_IMPORT_TARGET=10000
 *   VJUDGE_IMPORT_CONCURRENCY=4
 *   VJUDGE_IMPORT_FILE=path\to\vjudge-export.json
 *   VJUDGE_IMPORT_SOURCE=vjudge
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
loadProjectEnvironment(projectRoot);

const TARGET_IMPORT_COUNT = normalizePositiveInteger(process.env.VJUDGE_IMPORT_TARGET, 10000);
const CONCURRENCY = clampInteger(
  normalizePositiveInteger(process.env.VJUDGE_IMPORT_CONCURRENCY, 4),
  1,
  8,
);
const INPUT_FILE = resolveInputFile(process.argv.slice(2));
const DEFAULT_PROVIDER_ID = normalizeNonEmptyText(process.env.VJUDGE_IMPORT_SOURCE) ?? "vjudge";

if (!INPUT_FILE) {
  throw new Error(
    "Missing VJudge export file. Pass --input <path> or set VJUDGE_IMPORT_FILE.",
  );
}

const dbDist = resolve(projectRoot, "packages/db/dist");
const webSrc = resolve(projectRoot, "apps/web/src");

await ensureDatabaseUrl();

const { getPrismaClient } = await import(
  pathToFileURL(resolve(dbDist, "client.js")).href
);
const { PrismaLearningRepository } = await import(
  pathToFileURL(resolve(dbDist, "repositories/learning-repository.js")).href
);
const { evaluateProblemImportEligibility } = await import(
  pathToFileURL(resolve(webSrc, "app/import/problem-import-eligibility.ts")).href
);
const { normalizeProblemSourceKey } = await import(
  pathToFileURL(resolve(webSrc, "app/problems/problem-source-label.ts")).href
);
const { normalizeProblemProseText, normalizeProblemCodeText } = await import(
  pathToFileURL(resolve(webSrc, "app/problems/problem-text-normalizer.ts")).href
);
console.log(`Target import count: ${TARGET_IMPORT_COUNT}`);
console.log(`Worker concurrency: ${CONCURRENCY}`);
console.log(`Input file: ${INPUT_FILE}`);

const rawSnapshots = loadSnapshots(INPUT_FILE);
const candidateSnapshots = rawSnapshots
  .map((snapshot, index) => normalizeSnapshot(snapshot, index, DEFAULT_PROVIDER_ID))
  .filter((snapshot) => snapshot !== null);

console.log(`Loaded snapshot rows: ${rawSnapshots.length}`);
console.log(`Normalized candidates: ${candidateSnapshots.length}`);

const repository = new PrismaLearningRepository(getPrismaClient());
const existingRecords = await repository.listProblems({ limit: 20000 });
const existingSourceKeys = new Set();
const existingExternalIds = new Set();

for (const record of existingRecords) {
  const sourceKey = normalizeSourceKey(record.sourceUrl ?? null);
  if (sourceKey) {
    existingSourceKeys.add(sourceKey);
  }

  const externalId = extractMetadataString(record.metadata, "externalProblemId");
  if (externalId) {
    existingExternalIds.add(externalId);
  }
}

console.log(`Existing problem records: ${existingRecords.length}`);

let nextIndex = 0;
let createdCount = 0;
let existingCount = 0;
let skippedCount = 0;
let failedCount = 0;

const workers = Array.from({ length: CONCURRENCY }, (_, index) => runWorker(index + 1));
await Promise.all(workers);

console.log("");
console.log("Import finished");
console.log(`Created: ${createdCount}`);
console.log(`Existing: ${existingCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Failed: ${failedCount}`);

async function runWorker(workerId) {
  while (true) {
    if (createdCount >= TARGET_IMPORT_COUNT) {
      return;
    }

    const index = nextIndex;
    nextIndex += 1;
    const snapshot = candidateSnapshots[index];

    if (!snapshot) {
      return;
    }

    const sourceKey = normalizeSourceKey(snapshot.sourceUrl);
    if (!sourceKey) {
      skippedCount += 1;
      continue;
    }

    if (existingSourceKeys.has(sourceKey) || existingExternalIds.has(snapshot.externalProblemId)) {
      existingCount += 1;
      continue;
    }

    const judgeTestCases = normalizeExampleArray(snapshot.judgeTestCases ?? snapshot.examples);

    const eligibility = evaluateProblemImportEligibility({
      title: snapshot.title,
      summary: snapshot.summary,
      statement: snapshot.statement,
      inputDescription: snapshot.inputDescription,
      outputDescription: snapshot.outputDescription,
      examples: snapshot.examples,
      constraints: snapshot.constraints,
      source: snapshot.source,
      sourceUrl: snapshot.sourceUrl,
      tags: snapshot.tags,
    });

    if (!eligibility.canImport) {
      skippedCount += 1;
      continue;
    }

    try {
      const normalizedStatement = normalizeMultilineText(snapshot.statement) ?? snapshot.statement.trim();
      const normalizedInputDescription = normalizeMultilineText(snapshot.inputDescription);
      const normalizedOutputDescription = normalizeMultilineText(snapshot.outputDescription);
      const normalizedConstraints = normalizeMultilineText(snapshot.constraints);
      const normalizedSummary = normalizeMultilineText(snapshot.summary);
      const sourceKey =
        normalizeProblemSourceKey(snapshot.source ?? snapshot.platform ?? snapshot.oj ?? null, snapshot.sourceUrl) ??
        "other";
      const created = await repository.createProblem({
        title: snapshot.title.trim().slice(0, 200),
        description: normalizedStatement.slice(0, 10000),
        difficulty: normalizeDifficulty(snapshot.difficulty),
        tags: normalizeTags(snapshot.tags),
        source: sourceKey,
        sourceUrl: snapshot.sourceUrl.trim().slice(0, 2000),
        metadata: {
          importSource: "vjudge-snapshot",
          importedAt: new Date().toISOString(),
          providerId: snapshot.source ?? DEFAULT_PROVIDER_ID,
          platform: snapshot.platform ?? snapshot.oj ?? null,
          externalProblemId: snapshot.externalProblemId,
          contestId: snapshot.contestId ?? null,
          index: snapshot.index ?? null,
          rating: snapshot.rating ?? null,
          solvedCount: snapshot.solvedCount ?? null,
          sourceUrl: snapshot.sourceUrl,
          originUrl: snapshot.originUrl ?? snapshot.originalUrl ?? null,
          problemUrl: snapshot.problemUrl ?? null,
          descriptionUrl: snapshot.descriptionUrl ?? null,
          statement: normalizedStatement,
          inputDescription: normalizedInputDescription,
          outputDescription: normalizedOutputDescription,
          examples: snapshot.examples,
          judgeTestCases,
          constraints: normalizedConstraints,
          summary: normalizedSummary,
        },
      });

      createdCount += 1;
      existingSourceKeys.add(sourceKey);
      existingExternalIds.add(snapshot.externalProblemId);

      if (createdCount % 100 === 0 || createdCount === 1) {
        console.log(
          `[${workerId}] created ${createdCount}/${TARGET_IMPORT_COUNT} | existing ${existingCount} | skipped ${skippedCount} | failed ${failedCount} | latest ${created.id}`,
        );
      }
    } catch (error) {
      failedCount += 1;
      console.log(`[${workerId}] write failed for ${snapshot.externalProblemId}: ${safeErrorMessage(error)}`);
    }
  }
}

function loadSnapshots(filePath) {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === "object" && Array.isArray(parsed.problems)) {
    return parsed.problems;
  }

  throw new Error("VJudge export must be an array or an object with a problems array");
}

function normalizeSnapshot(snapshot, index, defaultProviderId) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }

  const record = snapshot;
  const title = normalizeNonEmptyText(record.title ?? record.problemTitle ?? record.name);
  const sourceUrl = normalizeNonEmptyText(
    record.sourceUrl ??
      record.originUrl ??
      record.originalUrl ??
      record.problemUrl ??
      record.url ??
      record.link ??
      record.href,
  );
  const statement = normalizeMultilineText(
    record.statement ?? record.problemStatement ?? record.description ?? record.content,
  );
  const inputDescription = normalizeMultilineText(
    record.inputDescription ?? record.inputFormat ?? record.inputSpec ?? record.input,
  );
  const outputDescription = normalizeMultilineText(
    record.outputDescription ?? record.outputFormat ?? record.outputSpec ?? record.output,
  );
  const examples = normalizeExampleArray(
    record.examples ?? record.samples ?? record.sampleCases ?? record.sampleExamples,
  );
  const judgeTestCases = normalizeExampleArray(
    record.judgeTestCases ?? record.generatedJudgeTestCases ?? record.generatedTests,
  );

  if (!title || !sourceUrl || !statement || !inputDescription || !outputDescription || examples.length === 0) {
    return null;
  }

  return {
    externalProblemId: normalizeNonEmptyText(
      record.externalProblemId ??
        record.problemId ??
        record.id ??
        record.slug ??
        `${defaultProviderId}:${index}`,
    ) ?? `${defaultProviderId}:${index}`,
    providerId: normalizeNonEmptyText(record.providerId) ?? defaultProviderId,
    title,
    difficulty: normalizeDifficulty(record.difficulty),
    tags: normalizeTags(record.tags),
    summary: normalizeMultilineText(record.summary) ?? statement.slice(0, 500),
    sourceUrl,
    statement,
    inputDescription,
    outputDescription,
    examples,
    judgeTestCases: judgeTestCases.length > 0 ? judgeTestCases : undefined,
    constraints: normalizeMultilineText(record.constraints) ?? null,
    source:
      normalizeProblemSourceKey(
        normalizeNonEmptyText(record.source ?? record.providerId),
        sourceUrl,
      ) ??
      normalizeProblemSourceKey(
        normalizeNonEmptyText(record.platform ?? record.oj ?? record.originOJ),
        sourceUrl,
      ) ??
      "other",
    platform: normalizeNonEmptyText(record.platform ?? record.oj ?? record.originOJ),
    originUrl: normalizeNonEmptyText(
      record.originUrl ?? record.originalUrl ?? record.originLink ?? record.originHref,
    ),
    problemUrl: normalizeNonEmptyText(record.problemUrl ?? record.url ?? record.link ?? record.href),
    descriptionUrl: normalizeNonEmptyText(
      record.descriptionUrl ?? record.descriptionHref ?? record.descriptionPath,
    ),
    contestId: normalizeOptionalInteger(record.contestId),
    index: normalizeNonEmptyText(record.index),
    rating: normalizeOptionalInteger(record.rating),
    solvedCount: normalizeOptionalInteger(record.solvedCount),
  };
}

function normalizeDifficulty(value) {
  const normalized = normalizeNonEmptyText(value)?.toLowerCase();
  if (
    normalized === "easy" ||
    normalized === "medium" ||
    normalized === "hard" ||
    normalized === "challenge"
  ) {
    return normalized.toUpperCase();
  }
  return "UNKNOWN";
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen = new Set();
  const result = [];
  for (const tag of tags) {
    const normalized = normalizeNonEmptyText(tag)?.toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeExampleArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(0, 20)
    .map((example) => {
      if (!example || typeof example !== "object" || Array.isArray(example)) {
        return null;
      }

      const input = normalizeCodeText(
        example.input ??
          example.sampleInput ??
          example.sample_input ??
          example.testInput ??
          example.test_input ??
          example.stdin,
      );
      const output =
        normalizeCodeText(example.output) ??
        normalizeCodeText(example.expectedOutput) ??
        normalizeCodeText(example.sampleOutput) ??
        normalizeCodeText(example.sample_output) ??
        normalizeCodeText(example.testOutput) ??
        normalizeCodeText(example.test_output) ??
        normalizeCodeText(example.stdout);

      if (!input || !output) {
        return null;
      }

      const normalized = { input, output };
      const explanation = normalizeMultilineText(example.explanation);
      const label = normalizeNonEmptyText(example.label);
      if (explanation) {
        normalized.explanation = explanation;
      }
      if (label) {
        normalized.label = label;
      }
      return normalized;
    })
    .filter(Boolean);
}

function normalizeOptionalInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

function normalizeNonEmptyText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMultilineText(value) {
  return normalizeProblemProseText(value);
}

function normalizeCodeText(value) {
  return normalizeProblemCodeText(value);
}

async function ensureDatabaseUrl() {
  try {
    const { hasDatabaseUrl } = await import(pathToFileURL(resolve(dbDist, "index.js")).href);
    if (!hasDatabaseUrl()) {
      throw new Error("DATABASE_URL is missing");
    }
  } catch (error) {
    throw new Error(
      error instanceof Error ? `Missing database configuration: ${error.message}` : "Missing database configuration",
    );
  }
}

function loadProjectEnvironment(rootDir) {
  const envPath = resolve(rootDir, ".env");
  const envLocalPath = resolve(rootDir, ".env.local");

  if (existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }

  if (existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
  }
}

function resolveInputFile(argv) {
  const direct = argv.find((arg) => arg.startsWith("--input="));
  if (direct) {
    return resolve(process.cwd(), direct.slice("--input=".length));
  }

  const inputIndex = argv.indexOf("--input");
  if (inputIndex >= 0 && typeof argv[inputIndex + 1] === "string") {
    return resolve(process.cwd(), argv[inputIndex + 1]);
  }

  const shortIndex = argv.indexOf("-i");
  if (shortIndex >= 0 && typeof argv[shortIndex + 1] === "string") {
    return resolve(process.cwd(), argv[shortIndex + 1]);
  }

  const envFile = process.env.VJUDGE_IMPORT_FILE?.trim();
  if (envFile) {
    return resolve(process.cwd(), envFile);
  }

  return null;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function clampInteger(value, min, max) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function normalizeSourceKey(sourceUrl) {
  const normalized = normalizeNonEmptyText(sourceUrl);
  return normalized ? normalized.toLowerCase() : null;
}

function inferSourceLabel(input) {
  const fromUrl = inferSourceLabelFromUrl(input.sourceUrl);
  if (fromUrl) {
    return fromUrl;
  }

  const fromPlatform = inferSourceLabelFromText(input.platform);
  if (fromPlatform) {
    return fromPlatform;
  }

  const fromSource = inferSourceLabelFromText(input.source);
  if (fromSource) {
    return fromSource;
  }

  return null;
}

function inferSourceLabelFromUrl(sourceUrl) {
  const normalized = normalizeNonEmptyText(sourceUrl);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();

    const hostMap = [
      ["codeforces.com", "Codeforces"],
      ["leetcode.com", "LeetCode"],
      ["leetcode.cn", "LeetCode"],
      ["nowcoder.com", "牛客"],
      ["ac.nowcoder.com", "牛客"],
      ["atcoder.jp", "AtCoder"],
      ["lanqiao.cn", "蓝桥杯"],
      ["lanqiaocup.com", "蓝桥杯"],
      ["pintia.cn", "PTA"],
      ["pta.edu.cn", "PTA"],
      ["luogu.com.cn", "洛谷"],
      ["acwing.com", "AcWing"],
      ["vjudge.net", "VJudge"],
      ["acm.hdu.edu.cn", "HDU"],
      ["poj.org", "POJ"],
      ["uva.onlinejudge.org", "UVA"],
      ["open.kattis.com", "Kattis"],
    ];

    for (const [needle, label] of hostMap) {
      if (host === needle || host.endsWith(`.${needle}`) || host.includes(needle)) {
        return label;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function inferSourceLabelFromText(value) {
  const normalized = normalizeNonEmptyText(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  const aliases = [
    ["codeforces", "Codeforces"],
    ["leetcode", "LeetCode"],
    ["nowcoder", "牛客"],
    ["niuke", "牛客"],
    ["atcoder", "AtCoder"],
    ["lanqiao", "蓝桥杯"],
    ["pintia", "PTA"],
    ["pta", "PTA"],
    ["luogu", "洛谷"],
    ["acwing", "AcWing"],
    ["vjudge", "VJudge"],
    ["hustoj", "HUSTOJ"],
    ["hdu", "HDU"],
    ["poj", "POJ"],
    ["uva", "UVA"],
    ["kattis", "Kattis"],
  ];

  for (const [needle, label] of aliases) {
    if (lower === needle || lower.includes(needle)) {
      return label;
    }
  }

  return normalized;
}

function extractMetadataString(metadata, key) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];
  return normalizeNonEmptyText(value);
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}
