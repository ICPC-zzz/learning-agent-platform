/**
 * Repair imported problem text fields in the local database.
 *
 * This script normalizes markdown / LaTeX artifacts in stored problem text.
 * It is safe to run multiple times.
 *
 * Usage:
 *   node --experimental-strip-types scripts/repair-imported-problem-texts.mjs
 *
 * Optional env:
 *   PROBLEM_TEXT_REPAIR_LIMIT=20000
 *   PROBLEM_TEXT_REPAIR_DRY_RUN=true
 *   PROBLEM_TEXT_REPAIR_ONLY_VJUDGE=true
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
loadProjectEnvironment(projectRoot);

const REPAIR_LIMIT = normalizePositiveInteger(process.env.PROBLEM_TEXT_REPAIR_LIMIT, 20000);
const DRY_RUN = String(process.env.PROBLEM_TEXT_REPAIR_DRY_RUN ?? "").toLowerCase() === "true";
const ONLY_VJUDGE = String(process.env.PROBLEM_TEXT_REPAIR_ONLY_VJUDGE ?? "true").toLowerCase() !== "false";

const dbDist = resolve(projectRoot, "packages/db/dist");
const webSrc = resolve(projectRoot, "apps/web/src");

await ensureDatabaseUrl();

const { getPrismaClient } = await import(pathToFileURL(resolve(dbDist, "client.js")).href);
const { normalizeProblemProseText, normalizeProblemCodeText } = await import(
  pathToFileURL(resolve(webSrc, "app/problems/problem-text-normalizer.ts")).href
);

console.log(`Repair limit: ${REPAIR_LIMIT}`);
console.log(`Dry run: ${DRY_RUN ? "yes" : "no"}`);
console.log(`Only VJudge imports: ${ONLY_VJUDGE ? "yes" : "no"}`);

const prisma = getPrismaClient();
const records = await prisma.problem.findMany({
  take: REPAIR_LIMIT,
  orderBy: [{ createdAt: "desc" }, { id: "asc" }],
});

let scannedCount = 0;
let matchedCount = 0;
let updatedCount = 0;

for (const record of records) {
  scannedCount += 1;
  if (ONLY_VJUDGE && !isLikelyVJudgeImport(record)) {
    continue;
  }

  matchedCount += 1;

  const patched = buildPatchedProblem(record);
  if (!patched.changed) {
    continue;
  }

  if (DRY_RUN) {
    console.log(`[dry-run] would update ${record.id}`);
    continue;
  }

  await prisma.problem.update({
    where: { id: record.id },
    data: {
      description: patched.description,
      metadata: patched.metadata,
    },
  });

  updatedCount += 1;
  if (updatedCount % 100 === 0 || updatedCount === 1) {
    console.log(`Updated ${updatedCount}/${matchedCount} matched problems | latest ${record.id}`);
  }
}

console.log("");
console.log("Repair finished");
console.log(`Scanned: ${scannedCount}`);
console.log(`Matched: ${matchedCount}`);
console.log(`Updated: ${updatedCount}`);

function buildPatchedProblem(record) {
  const metadata = isPlainObject(record.metadata) ? { ...record.metadata } : null;
  const description =
    typeof record.description === "string"
      ? normalizeProblemProseText(record.description)
      : record.description;
  let changed = description !== record.description;

  if (metadata) {
    if (typeof metadata.statement === "string") {
      const statement = normalizeProblemProseText(metadata.statement);
      metadata.statement = statement;
      changed ||= statement !== record.metadata?.statement;
    }

    if (typeof metadata.inputDescription === "string") {
      const inputDescription = normalizeProblemProseText(metadata.inputDescription);
      metadata.inputDescription = inputDescription;
      changed ||= inputDescription !== record.metadata?.inputDescription;
    }

    if (typeof metadata.outputDescription === "string") {
      const outputDescription = normalizeProblemProseText(metadata.outputDescription);
      metadata.outputDescription = outputDescription;
      changed ||= outputDescription !== record.metadata?.outputDescription;
    }

    if (typeof metadata.constraints === "string") {
      const constraints = normalizeProblemProseText(metadata.constraints);
      metadata.constraints = constraints;
      changed ||= constraints !== record.metadata?.constraints;
    }

    if (typeof metadata.summary === "string") {
      const summary = normalizeProblemProseText(metadata.summary);
      metadata.summary = summary;
      changed ||= summary !== record.metadata?.summary;
    }

    if (Array.isArray(metadata.examples)) {
      const examples = metadata.examples.map((example) => normalizeExampleRecord(example));
      metadata.examples = examples;
      changed ||= JSON.stringify(examples) !== JSON.stringify(record.metadata?.examples);
    }

    if (Array.isArray(metadata.judgeTestCases)) {
      const judgeTestCases = metadata.judgeTestCases.map((example) => normalizeExampleRecord(example));
      metadata.judgeTestCases = judgeTestCases;
      changed ||= JSON.stringify(judgeTestCases) !== JSON.stringify(record.metadata?.judgeTestCases);
    }
  }

  return {
    changed,
    description,
    metadata: metadata ?? record.metadata,
  };
}

function normalizeExampleRecord(value) {
  if (!isPlainObject(value)) {
    return value;
  }

  const next = { ...value };
  const input = typeof next.input === "string" ? normalizeProblemCodeText(next.input) : next.input;
  const output = typeof next.output === "string" ? normalizeProblemCodeText(next.output) : next.output;
  const explanation =
    typeof next.explanation === "string"
      ? normalizeProblemProseText(next.explanation)
      : next.explanation;

  if (typeof next.input === "string") {
    next.input = input;
  }
  if (typeof next.output === "string") {
    next.output = output;
  }
  if (typeof next.explanation === "string") {
    next.explanation = explanation;
  }

  return next;
}

function isLikelyVJudgeImport(record) {
  const metadata = isPlainObject(record.metadata) ? record.metadata : null;
  const metadataImportSource = typeof metadata?.importSource === "string" ? metadata.importSource.toLowerCase() : "";
  const metadataProvider = typeof metadata?.providerId === "string" ? metadata.providerId.toLowerCase() : "";
  const sourceUrl = typeof record.sourceUrl === "string" ? record.sourceUrl.toLowerCase() : "";

  return (
    metadataImportSource.includes("vjudge") ||
    metadataProvider.includes("vjudge") ||
    sourceUrl.includes("vjudge.net")
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}
