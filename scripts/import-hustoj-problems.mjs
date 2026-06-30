/**
 * Import HUSTOJ free problems into the local database.
 *
 * Usage:
 *   node --experimental-strip-types scripts/import-hustoj-problems.mjs
 *
 * Optional env:
 *   HUSTOJ_IMPORT_TARGET=10000
 *   HUSTOJ_IMPORT_CONCURRENCY=4
 *   HUSTOJ_IMPORT_BASE_URL=http://tk.hustoj.com
 *   HUSTOJ_IMPORT_SEARCH=free
 *   HUSTOJ_IMPORT_TIMEOUT_MS=20000
 *   HUSTOJ_IMPORT_PROVIDER_ID=hustoj
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import dotenv from "dotenv";

import {
  buildHustojListUrl,
  buildHustojProblemUrl,
  parseHustojProblemListPage,
  parseHustojProblemPage,
} from "./hustoj-problem-parser.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
loadProjectEnvironment(projectRoot);

const TARGET_IMPORT_COUNT = normalizePositiveInteger(
  process.env.HUSTOJ_IMPORT_TARGET,
  10000,
);
const CONCURRENCY = clampInteger(
  normalizePositiveInteger(process.env.HUSTOJ_IMPORT_CONCURRENCY, 4),
  1,
  8,
);
const FETCH_TIMEOUT_MS = clampInteger(
  normalizePositiveInteger(process.env.HUSTOJ_IMPORT_TIMEOUT_MS, 20000),
  5000,
  60000,
);
const BASE_URL =
  normalizeNonEmptyText(process.env.HUSTOJ_IMPORT_BASE_URL) ?? "http://tk.hustoj.com";
const SEARCH_TERM = normalizeNonEmptyText(process.env.HUSTOJ_IMPORT_SEARCH) ?? "free";
const DEFAULT_PROVIDER_ID =
  normalizeNonEmptyText(process.env.HUSTOJ_IMPORT_PROVIDER_ID) ?? "hustoj";

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

console.log(`Target import count: ${TARGET_IMPORT_COUNT}`);
console.log(`Worker concurrency: ${CONCURRENCY}`);
console.log(`Base URL: ${BASE_URL}`);
console.log(`Search term: ${SEARCH_TERM}`);

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

let page = 1;
let createdCount = 0;
let existingCount = 0;
let skippedCount = 0;
let failedCount = 0;
let listedCount = 0;
let loggedSkipSamples = 0;
const skipReasonCounts = {
  missingStatement: 0,
  missingInput: 0,
  missingOutput: 0,
  missingExamples: 0,
  interactive: 0,
};

while (createdCount < TARGET_IMPORT_COUNT) {
  const listUrl = buildHustojListUrl(BASE_URL, SEARCH_TERM, page);
  let listHtml;
  try {
    listHtml = await fetchWithRetry(listUrl, FETCH_TIMEOUT_MS, 3);
  } catch (error) {
    failedCount += 1;
    console.log(`[page ${page}] list fetch failed: ${safeErrorMessage(error)}`);
    break;
  }

  const entries = parseHustojProblemListPage(listHtml);
  if (entries.length === 0) {
    console.log(`[page ${page}] no more problem rows found`);
    break;
  }

  listedCount += entries.length;
  console.log(`[page ${page}] listed ${entries.length} problem(s)`);

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    if (createdCount >= TARGET_IMPORT_COUNT) {
      break;
    }

    const batch = entries.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map((entry, batchIndex) =>
        processProblemEntry({
          entry,
          page,
          batchIndex,
        }),
      ),
    );
  }

  page += 1;
}

console.log("");
console.log("Import finished");
console.log(`Listed: ${listedCount}`);
console.log(`Created: ${createdCount}`);
console.log(`Existing: ${existingCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Failed: ${failedCount}`);
console.log(
  `Skip breakdown: statement=${skipReasonCounts.missingStatement}, input=${skipReasonCounts.missingInput}, output=${skipReasonCounts.missingOutput}, examples=${skipReasonCounts.missingExamples}, interactive=${skipReasonCounts.interactive}`,
);

async function processProblemEntry({ entry, page: pageNumber, batchIndex }) {
  if (createdCount >= TARGET_IMPORT_COUNT) {
    return;
  }

  const sourceUrl = buildHustojProblemUrl(BASE_URL, entry.problemId);
  const sourceKey = normalizeSourceKey(sourceUrl);
  const externalProblemId = `${DEFAULT_PROVIDER_ID}:${entry.problemId}`;

  if (!sourceKey) {
    skippedCount += 1;
    return;
  }

  if (existingSourceKeys.has(sourceKey) || existingExternalIds.has(externalProblemId)) {
    existingCount += 1;
    return;
  }

  let problemHtml;
  try {
    problemHtml = await fetchWithRetry(sourceUrl, FETCH_TIMEOUT_MS, 3);
  } catch (error) {
    failedCount += 1;
    console.log(
      `[page ${pageNumber} item ${batchIndex + 1}] fetch failed for ${externalProblemId}: ${safeErrorMessage(error)}`,
    );
    return;
  }

  const parsed = parseHustojProblemPage(problemHtml, entry.title);
  const statement = normalizeMultilineText(parsed.statement);
  const inputDescription = normalizeMultilineText(parsed.inputDescription);
  const outputDescription = normalizeMultilineText(parsed.outputDescription);
  const sampleInput = normalizeMultilineText(parsed.sampleInput);
  const sampleOutput = normalizeMultilineText(parsed.sampleOutput);
  const examples = normalizeExampleArray(parsed.examples);
  const tags = normalizeTags(parsed.sourceLabels.length > 0 ? parsed.sourceLabels : [SEARCH_TERM]);
  const sourceText = buildSourceText(parsed.sourceLabels);

  const eligibility = evaluateProblemImportEligibility({
    title: parsed.title,
    summary: buildSummary(statement),
    statement,
    inputDescription,
    outputDescription,
    examples,
    source: sourceText,
    sourceUrl,
    tags,
  });

  if (!eligibility.canImport) {
    skippedCount += 1;
    if (!eligibility.hasStatement) {
      skipReasonCounts.missingStatement += 1;
    }
    if (!eligibility.hasInputDescription) {
      skipReasonCounts.missingInput += 1;
    }
    if (!eligibility.hasOutputDescription) {
      skipReasonCounts.missingOutput += 1;
    }
    if (!eligibility.hasExamples) {
      skipReasonCounts.missingExamples += 1;
    }
    if (eligibility.isInteractive) {
      skipReasonCounts.interactive += 1;
    }

    if (loggedSkipSamples < 8) {
      loggedSkipSamples += 1;
      console.log(
        `[page ${pageNumber} item ${batchIndex + 1}] skipped ${externalProblemId} | ` +
          `title="${parsed.title}" | ` +
          `statement=${Boolean(statement)} input=${Boolean(inputDescription)} ` +
          `output=${Boolean(outputDescription)} examples=${examples.length} ` +
          `sampleInput=${Boolean(sampleInput)} sampleOutput=${Boolean(sampleOutput)} ` +
          `interactive=${eligibility.isInteractive}`,
      );
    }
    return;
  }

  try {
    const created = await repository.createProblem({
      id: `hustoj-${entry.problemId}`,
      title: parsed.title.trim().slice(0, 200),
      description: buildSummary(statement),
      difficulty: "unknown",
      tags,
      source: sourceText,
      sourceUrl: sourceUrl.trim().slice(0, 2000),
      metadata: {
        importSource: "hustoj-free-html",
        importedAt: new Date().toISOString(),
        providerId: DEFAULT_PROVIDER_ID,
        externalProblemId,
        problemId: entry.problemId,
        listSearchTerm: SEARCH_TERM,
        listPage: pageNumber,
        sourceUrl,
        statement,
        inputDescription,
        outputDescription,
        examples,
        sampleInput,
        sampleOutput,
        hint: parsed.hint ?? null,
        sourceLabels: parsed.sourceLabels,
      },
    });

    createdCount += 1;
    existingSourceKeys.add(sourceKey);
    existingExternalIds.add(externalProblemId);

    if (createdCount % 100 === 0 || createdCount === 1) {
      console.log(
        `[page ${pageNumber} item ${batchIndex + 1}] created ${createdCount}/${TARGET_IMPORT_COUNT} | existing ${existingCount} | skipped ${skippedCount} | failed ${failedCount} | latest ${created.id}`,
      );
    }
  } catch (error) {
    failedCount += 1;
    console.log(
      `[page ${pageNumber} item ${batchIndex + 1}] write failed for ${externalProblemId}: ${safeErrorMessage(error)}`,
    );
  }
}

async function fetchWithRetry(url, timeoutMs, retries) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        break;
      }

      await delay(250 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function ensureDatabaseUrl() {
  try {
    const { hasDatabaseUrl } = await import(
      pathToFileURL(resolve(dbDist, "index.js")).href
    );
    if (!hasDatabaseUrl()) {
      throw new Error("DATABASE_URL is missing");
    }
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Missing database configuration: ${error.message}`
        : "Missing database configuration",
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

function normalizeSourceKey(value) {
  const normalized = normalizeNonEmptyText(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    url.hash = "";
    return url.toString().toLowerCase();
  } catch {
    return normalized.toLowerCase();
  }
}

function extractMetadataString(metadata, key) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];
  return normalizeNonEmptyText(value);
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

      const input = normalizeMultilineText(
        example.input ?? example.sampleInput ?? example.sample_input ?? example.stdin,
      );
      const output = normalizeMultilineText(
        example.output ?? example.sampleOutput ?? example.sample_output ?? example.stdout,
      );

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

function buildSourceText(sourceLabels) {
  const labels = Array.isArray(sourceLabels) ? sourceLabels : [];
  const parts = ["hustoj", SEARCH_TERM, ...labels];
  const seen = new Set();
  const result = [];

  for (const part of parts) {
    const normalized = normalizeNonEmptyText(part)?.toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result.join(" ");
}

function buildSummary(statement) {
  const normalized = normalizeWhitespace(statement);
  if (!normalized) {
    return "";
  }

  return normalized.length > 500 ? `${normalized.slice(0, 497)}...` : normalized;
}

function normalizeWhitespace(value) {
  const normalized = normalizeMultilineText(value);
  if (!normalized) {
    return "";
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function normalizeMultilineText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\r\n?/g, "\n").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNonEmptyText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
