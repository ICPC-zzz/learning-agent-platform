/**
 * Crawl VJudge problems into the local database.
 *
 * This script reads the local Chrome profile to reuse the logged-in VJudge
 * session, fetches the problem list page API, loads each problem detail page,
 * and stores the cleaned result in the database.
 *
 * Usage:
 *   node --experimental-strip-types scripts/crawl-vjudge-problems.mjs
 *
 * Optional env:
 *   VJUDGE_CRAWL_TARGET=20000
 *   VJUDGE_CRAWL_CONCURRENCY=4
 *   VJUDGE_CRAWL_PAGE_SIZE=100
 *   VJUDGE_CRAWL_TIMEOUT_MS=20000
 *   VJUDGE_COOKIE_FILE=.local/vjudge-cookie.txt
 *   VJUDGE_CHROME_USER_DATA_DIR=C:\Users\...\Google\Chrome\User Data
 *   VJUDGE_CHROME_PROFILE_DIR=Default
 */

import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createDecipheriv } from "node:crypto";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";

import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
loadProjectEnvironment(projectRoot);

const TARGET_IMPORT_COUNT = normalizePositiveInteger(process.env.VJUDGE_CRAWL_TARGET, 20000);
const CONCURRENCY = clampInteger(
  normalizePositiveInteger(process.env.VJUDGE_CRAWL_CONCURRENCY, 4),
  1,
  8,
);
const PAGE_SIZE = clampInteger(
  normalizePositiveInteger(process.env.VJUDGE_CRAWL_PAGE_SIZE, 100),
  20,
  200,
);
const REQUEST_DELAY_MS = clampInteger(
  normalizePositiveInteger(process.env.VJUDGE_CRAWL_DELAY_MS, 250),
  0,
  5000,
);
const FETCH_TIMEOUT_MS = clampInteger(
  normalizePositiveInteger(process.env.VJUDGE_CRAWL_TIMEOUT_MS, 20000),
  5000,
  60000,
);
const FETCH_MODE = normalizeNonEmptyText(process.env.VJUDGE_CRAWL_FETCH_MODE) ?? "auto";
const DEFAULT_PROVIDER_ID = normalizeNonEmptyText(process.env.VJUDGE_CRAWL_PROVIDER_ID) ?? "vjudge";
const DEFAULT_COOKIE_FILE = resolve(projectRoot, ".local", "vjudge-cookie.txt");
const EXPLICIT_VJUDGE_COOKIE_HEADER = normalizeNonEmptyText(process.env.VJUDGE_CHROME_COOKIE_HEADER);
const COOKIE_FILE_PATH = normalizeNonEmptyText(process.env.VJUDGE_COOKIE_FILE) ?? DEFAULT_COOKIE_FILE;
const BROWSER_USER_DATA_DIR =
  normalizeNonEmptyText(process.env.VJUDGE_BROWSER_USER_DATA_DIR) ??
  normalizeNonEmptyText(process.env.VJUDGE_CHROME_USER_DATA_DIR) ??
  getDefaultBrowserUserDataDir();
const BROWSER_PROFILE_DIR =
  normalizeNonEmptyText(process.env.VJUDGE_BROWSER_PROFILE_DIR) ??
  normalizeNonEmptyText(process.env.VJUDGE_CHROME_PROFILE_DIR) ??
  "Default";
const PLAYWRIGHT_MODULE_URL =
  normalizeNonEmptyText(process.env.VJUDGE_PLAYWRIGHT_MODULE_URL) ??
  pathToFileURL(
    resolve(
      "C:\\Users\\48842\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\.pnpm\\playwright-core@1.60.0\\node_modules\\playwright-core\\index.mjs",
    ),
  ).href;
const BROWSER_HEADLESS = normalizeNonEmptyText(process.env.VJUDGE_BROWSER_HEADLESS) === "1";
const VJUDGE_CHALLENGE_MARKERS = [
  "安全验证",
  "正在进行安全验证",
  "human verification",
  "verify you are human",
  "just a moment",
  "attention required",
  "checking your browser",
  "enable cookies and javascript",
];

const dbDist = resolve(projectRoot, "packages/db/dist");
const webSrc = resolve(projectRoot, "apps/web/src");

await ensureDatabaseUrl();

const { getPrismaClient } = await import(pathToFileURL(resolve(dbDist, "client.js")).href);
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
console.log(`Page size: ${PAGE_SIZE}`);
console.log(`Timeout: ${FETCH_TIMEOUT_MS} ms`);
console.log(`Fetch mode: ${FETCH_MODE}`);

let cookieHeader = await buildVJudgeCookieHeader();
if (!cookieHeader) {
  if (FETCH_MODE !== "browser") {
    throw new Error(
      "Unable to acquire VJudge cookies. Set VJUDGE_COOKIE_FILE, VJUDGE_CHROME_COOKIE_HEADER or VJUDGE_USERNAME/VJUDGE_PASSWORD.",
    );
  }

  cookieHeader = "";
}
let browserFetchSession = null;
let activeFetchMode = FETCH_MODE;

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

let start = 0;
let createdCount = 0;
let existingCount = 0;
let skippedCount = 0;
let failedCount = 0;
let listedCount = 0;

while (createdCount < TARGET_IMPORT_COUNT) {
  const pageRows = await fetchVJudgeProblemListPage(start, PAGE_SIZE);
  if (pageRows.length === 0) {
    console.log(`[start=${start}] no more rows`);
    break;
  }

  listedCount += pageRows.length;
  console.log(`[start=${start}] listed ${pageRows.length} row(s)`);

  for (let i = 0; i < pageRows.length; i += CONCURRENCY) {
    if (createdCount >= TARGET_IMPORT_COUNT) {
      break;
    }

    const batch = pageRows.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map((row, batchIndex) =>
        processProblemRow({
          row,
          pageStart: start,
          batchIndex,
          existingSourceKeys,
          existingExternalIds,
        }),
      ),
    );
  }

  start += PAGE_SIZE;
}

console.log("");
console.log("Crawl finished");
console.log(`Listed: ${listedCount}`);
console.log(`Created: ${createdCount}`);
console.log(`Existing: ${existingCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Failed: ${failedCount}`);

async function processProblemRow({
  row,
  pageStart,
  batchIndex,
  existingSourceKeys,
  existingExternalIds,
}) {
  if (createdCount >= TARGET_IMPORT_COUNT) {
    return;
  }

  const title = normalizeNonEmptyText(row.title ?? row.problemTitle ?? row.name);
  const problemId = normalizeNonEmptyText(
    row.id ?? row.problemId ?? row.problem_key ?? row.key,
  );
  const originOJ = normalizeNonEmptyText(row.originOJ ?? row.oj ?? row.originOj ?? row.platform);
  const originProb = normalizeNonEmptyText(row.originProb ?? row.probNum ?? row.problemNum);
  const externalProblemId = normalizeNonEmptyText(
    row.externalProblemId ?? (originOJ && originProb ? `${originOJ}:${originProb}` : null),
  );
  const problemSlug =
    originOJ && originProb ? `${originOJ}-${originProb}` : problemId;
  const problemPageUrl = problemSlug !== null ? `https://vjudge.net/problem/${problemSlug}` : null;

  if (!title || !problemPageUrl || !externalProblemId) {
    skippedCount += 1;
    return;
  }

  if (existingExternalIds.has(externalProblemId)) {
    existingCount += 1;
    return;
  }

  let problemHtml;
  try {
    problemHtml = await fetchText(problemPageUrl, FETCH_TIMEOUT_MS);
  } catch (error) {
    failedCount += 1;
    console.log(
      `[start=${pageStart} item=${batchIndex + 1}] fetch failed for ${externalProblemId}: ${safeErrorMessage(error)}`,
    );
    return;
  }

  const parsed = parseVjudgeProblemPage(problemHtml, title);
  if (!parsed) {
    skippedCount += 1;
    return;
  }

  const sourceUrl = parsed.sourceUrl ?? extractSourceUrlFromRow(row.source) ?? null;
  const sourceKey =
    normalizeProblemSourceKey(row.source ?? originOJ, sourceUrl) ??
    normalizeProblemSourceKey(originOJ, sourceUrl) ??
    "other";

  if (!sourceUrl) {
    skippedCount += 1;
    return;
  }

  if (existingSourceKeys.has(sourceKey) || existingExternalIds.has(externalProblemId)) {
    existingCount += 1;
    return;
  }

  const statement = normalizeProblemProseText(parsed.statement);
  const inputDescription = normalizeProblemProseText(parsed.inputDescription);
  const outputDescription = normalizeProblemProseText(parsed.outputDescription);
  const constraints = normalizeProblemProseText(parsed.constraints);
  const examples = normalizeExampleArray(parsed.examples);
  const judgeTestCases = normalizeExampleArray(parsed.judgeTestCases ?? parsed.examples);
  const summary = normalizeProblemProseText(parsed.summary) ?? statement?.slice(0, 500) ?? null;
  const tags = normalizeTags([
    sourceKey,
    originOJ,
    normalizeNonEmptyText(row.sourceLabel ?? row.sourceText),
  ]);

  const eligibility = evaluateProblemImportEligibility({
    title,
    summary,
    statement,
    inputDescription,
    outputDescription,
    examples,
    constraints,
    source: sourceKey,
    sourceUrl,
    tags,
  });

  if (!eligibility.canImport) {
    skippedCount += 1;
    return;
  }

  try {
    const created = await repository.createProblem({
      title: title.trim().slice(0, 200),
      description: statement.slice(0, 10000),
      difficulty: "UNKNOWN",
      tags,
      source: sourceKey,
      sourceUrl: sourceUrl.trim().slice(0, 2000),
      metadata: {
        importSource: "vjudge-crawl",
        importedAt: new Date().toISOString(),
        providerId: DEFAULT_PROVIDER_ID,
        externalProblemId,
        platform: originOJ,
        originOJ,
        originProb,
        problemId: problemSlug,
        sourceUrl,
        problemUrl: problemPageUrl,
        descriptionUrl: problemPageUrl,
        statement,
        inputDescription,
        outputDescription,
        examples,
        judgeTestCases,
        constraints,
        summary,
      },
    });

    createdCount += 1;
    existingSourceKeys.add(sourceKey);
    existingExternalIds.add(externalProblemId);

    if (createdCount % 100 === 0 || createdCount === 1) {
      console.log(
        `[start=${pageStart} item=${batchIndex + 1}] created ${createdCount}/${TARGET_IMPORT_COUNT} | existing ${existingCount} | skipped ${skippedCount} | failed ${failedCount} | latest ${created.id}`,
      );
    }
  } catch (error) {
    failedCount += 1;
    console.log(
      `[start=${pageStart} item=${batchIndex + 1}] write failed for ${externalProblemId}: ${safeErrorMessage(error)}`,
    );
  }
}

async function fetchVJudgeProblemListPage(start, length) {
  const url = new URL("https://vjudge.net/problem/data");
  url.searchParams.set("draw", "1");
  url.searchParams.set("start", String(start));
  url.searchParams.set("length", String(length));
  url.searchParams.set("sortDir", "desc");
  url.searchParams.set("sortCol", "7");
  url.searchParams.set("OJId", "All");
  url.searchParams.set("probNum", "");
  url.searchParams.set("title", "");
  url.searchParams.set("source", "");
  url.searchParams.set("category", "all");

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const text = await fetchText(url.toString(), FETCH_TIMEOUT_MS);
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("VJudge list API returned a non-object response");
      }

      if (!Array.isArray(parsed.data)) {
        return [];
      }

      return parsed.data;
    } catch (error) {
      const message = safeErrorMessage(error);
      const is403 = message.includes("HTTP 403");
      const shouldRetry = attempt < 5 && (is403 || isTransientNetworkError(error));

      if (!shouldRetry) {
        throw error;
      }

      console.log(`[start=${start}] retrying list page after ${message} (attempt ${attempt})`);
      if ((is403 || isTransientNetworkError(error)) && FETCH_MODE !== "direct") {
        activeFetchMode = "browser";
        await ensureVJudgeBrowserSession();
      } else if (is403) {
        cookieHeader = await refreshVjudgeSession();
      }
      await delay(Math.min(5000 * attempt, 30000));
    }
  }

  return [];
}

async function fetchText(url, timeoutMs) {
  let lastError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);

    try {
      if (REQUEST_DELAY_MS > 0) {
        await delay(REQUEST_DELAY_MS);
      }

      if (activeFetchMode === "browser") {
        return await fetchTextInBrowser(url, timeoutMs, controller.signal);
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
          Cookie: cookieHeader,
          Referer: "https://vjudge.net/problem",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 403 && FETCH_MODE !== "direct") {
          activeFetchMode = "browser";
          await ensureVJudgeBrowserSession();
          continue;
        }

        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      const message = safeErrorMessage(error);
      const is403 = message.includes("HTTP 403");
      const shouldRetry = attempt < 4 && (is403 || isTransientNetworkError(error));

      if (!shouldRetry) {
        break;
      }

      console.log(`retrying ${url} after ${message} (attempt ${attempt})`);
      if ((is403 || isTransientNetworkError(error)) && FETCH_MODE !== "direct") {
        activeFetchMode = "browser";
        await ensureVJudgeBrowserSession();
      } else if (is403) {
        cookieHeader = await refreshVjudgeSession();
      }
      await delay(Math.min(5000 * attempt, 30000));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function parseVjudgeProblemPage(html, fallbackTitle) {
  const text = htmlToPlainText(html);
  const lines = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .filter((line, index, all) => index === 0 || line.length > 0 || all[index - 1].length > 0);

  const inputIndex = findHeadingIndex(lines, [
    "Input",
    "Input Format",
    "Input Description",
    "输入",
    "输入格式",
    "输入描述",
  ]);
  const outputIndex = findHeadingIndex(lines, [
    "Output",
    "Output Format",
    "Output Description",
    "输出",
    "输出格式",
    "输出描述",
  ], inputIndex ?? 0);
  const constraintsIndex = findHeadingIndex(lines, [
    "Constraints",
    "Constraint",
    "Limits",
    "数据范围",
    "约束",
  ], outputIndex ?? 0);
  const examplesIndex = findHeadingIndex(lines, [
    "Examples",
    "Example",
    "Sample Input",
    "Sample Output",
    "样例",
    "样例输入",
    "样例输出",
  ], outputIndex ?? 0);
  const noteIndex = findHeadingIndex(lines, [
    "Note",
    "Hint",
    "Remarks",
    "备注",
    "说明",
  ], examplesIndex ?? outputIndex ?? 0);
  const contentStart = findContentStart(lines);

  if (contentStart === null) {
    return null;
  }

  const statementEnd = firstDefinedIndex([
    inputIndex,
    outputIndex,
    constraintsIndex,
    examplesIndex,
    noteIndex,
    lines.length,
  ]);
  const statement = normalizeSectionLines(lines.slice(contentStart, statementEnd));
  const inputDescription = inputIndex !== null
    ? normalizeSectionLines(lines.slice(inputIndex + 1, firstDefinedIndex([outputIndex, constraintsIndex, examplesIndex, noteIndex, lines.length])))
    : null;
  const outputDescription = outputIndex !== null
    ? normalizeSectionLines(lines.slice(outputIndex + 1, firstDefinedIndex([constraintsIndex, examplesIndex, noteIndex, lines.length])))
    : null;
  const constraints = constraintsIndex !== null
    ? normalizeSectionLines(lines.slice(constraintsIndex + 1, firstDefinedIndex([examplesIndex, noteIndex, lines.length])))
    : null;
  const sampleStart = examplesIndex !== null ? examplesIndex + 1 : firstDefinedIndex([noteIndex, lines.length]);
  const sampleEnd = firstDefinedIndex([noteIndex, lines.length]);
  const examples = parseExamples(lines.slice(sampleStart, sampleEnd));
  const sourceUrl = extractSourceUrlFromHtml(html);

  if (!statement || !inputDescription || !outputDescription || examples.length === 0) {
    return null;
  }

  return {
    title: normalizeNonEmptyText(fallbackTitle) ?? fallbackTitle,
    statement,
    inputDescription,
    outputDescription,
    constraints: constraints ?? null,
    examples,
    judgeTestCases: examples,
    summary: buildSummary(statement),
    sourceUrl,
  };
}

function findContentStart(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].toLowerCase();
    if (
      line.includes("time limit") ||
      line.includes("memory limit") ||
      line.includes("source") ||
      line.includes("author") ||
      line.includes("tester")
    ) {
      return index + 1;
    }
  }

  return 0;
}

function findHeadingIndex(lines, headings, startIndex = 0) {
  const normalizedHeadings = headings.map((heading) => heading.trim().toLowerCase());

  for (let index = Math.max(0, startIndex); index < lines.length; index += 1) {
    const line = lines[index].trim().toLowerCase();
    if (normalizedHeadings.includes(line)) {
      return index;
    }
  }

  return null;
}

function firstDefinedIndex(indices) {
  for (const index of indices) {
    if (typeof index === "number") {
      return index;
    }
  }

  return 0;
}

function parseExamples(lines) {
  const examples = [];
  let currentInput = [];
  let currentOutput = [];
  let mode = "idle";

  for (const line of lines) {
    const trimmed = line.trim();

    if (isInputLabel(trimmed)) {
      if (currentInput.length > 0 || currentOutput.length > 0) {
        pushExample(examples, currentInput, currentOutput);
        currentInput = [];
        currentOutput = [];
      }
      mode = "input";
      continue;
    }

    if (isOutputLabel(trimmed)) {
      mode = "output";
      continue;
    }

    if (isExampleBoundaryLabel(trimmed)) {
      continue;
    }

    if (mode === "input") {
      currentInput.push(line);
    } else if (mode === "output") {
      currentOutput.push(line);
    }
  }

  pushExample(examples, currentInput, currentOutput);
  return examples;
}

function pushExample(target, inputLines, outputLines) {
  const input = normalizeCodeBlock(inputLines);
  const output = normalizeCodeBlock(outputLines);

  if (!input || !output) {
    return;
  }

  target.push({ input, output });
}

function isInputLabel(value) {
  return /^(sample\s*)?input$/i.test(value) || value === "样例输入" || value === "输入";
}

function isOutputLabel(value) {
  return /^(sample\s*)?output$/i.test(value) || value === "样例输出" || value === "输出";
}

function isExampleBoundaryLabel(value) {
  return (
    /^examples?$/i.test(value) ||
    value === "样例" ||
    value === "例子" ||
    value === "说明" ||
    value === "note" ||
    value === "hint"
  );
}

function normalizeCodeBlock(lines) {
  const text = lines.join("\n").replace(/\r/g, "").trim();
  return text.length > 0 ? text : "";
}

function normalizeSectionLines(lines) {
  const normalized = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      if (normalized.length > 0 && normalized[normalized.length - 1] !== "") {
        normalized.push("");
      }
      continue;
    }

    normalized.push(trimmed);
  }

  return normalizeProblemProseText(normalized.join("\n"));
}

function htmlToPlainText(html) {
  let text = String(html);
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|li|tr|h[1-6]|section|article|table|ul|ol|pre|blockquote)>/gi, "\n");
  text = text.replace(/<(p|div|li|tr|h[1-6]|section|article|table|ul|ol|pre|blockquote)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeHtmlEntities(text);
  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(/\u00a0/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function extractSourceUrlFromRow(sourceHtml) {
  if (typeof sourceHtml !== "string") {
    return null;
  }

  const hrefMatch = sourceHtml.match(/href=['"]([^'"]+)['"]/i);
  if (hrefMatch) {
    const resolved = normalizeAbsoluteUrl(hrefMatch[1]);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function extractSourceUrlFromHtml(html) {
  const candidates = [];
  const hrefMatches = html.matchAll(/href=['"]([^'"]+)['"]/gi);

  for (const match of hrefMatches) {
    const resolved = normalizeAbsoluteUrl(match[1]);
    if (!resolved) {
      continue;
    }

    const host = new URL(resolved).hostname.toLowerCase();
    if (host.includes("vjudge.net")) {
      continue;
    }

    candidates.push(resolved);
  }

  return candidates[0] ?? null;
}

function normalizeAbsoluteUrl(value) {
  const normalized = normalizeNonEmptyText(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized, "https://vjudge.net");
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
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

      const input =
        normalizeProblemCodeText(example.input) ??
        normalizeProblemCodeText(example.sampleInput) ??
        normalizeProblemCodeText(example.sample_input) ??
        normalizeProblemCodeText(example.testInput) ??
        normalizeProblemCodeText(example.test_input) ??
        normalizeProblemCodeText(example.stdin);
      const output =
        normalizeProblemCodeText(example.output) ??
        normalizeProblemCodeText(example.expectedOutput) ??
        normalizeProblemCodeText(example.sampleOutput) ??
        normalizeProblemCodeText(example.sample_output) ??
        normalizeProblemCodeText(example.testOutput) ??
        normalizeProblemCodeText(example.test_output) ??
        normalizeProblemCodeText(example.stdout);

      if (!input || !output) {
        return null;
      }

      const normalized = { input, output };
      const explanation = normalizeProblemProseText(example.explanation);
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

function buildSummary(statement) {
  const normalized = normalizeWhitespace(statement);
  if (!normalized) {
    return "";
  }

  return normalized.length > 500 ? `${normalized.slice(0, 497)}...` : normalized;
}

function normalizeWhitespace(value) {
  const normalized = normalizeProblemProseText(value);
  if (!normalized) {
    return "";
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function normalizeNonEmptyText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCookieHeaderText(value) {
  const normalized = normalizeNonEmptyText(value);
  if (!normalized) {
    return null;
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const firstLine = lines[0].replace(/^Cookie:\s*/i, "");
  return normalizeNonEmptyText(firstLine);
}

function normalizeSourceKey(value) {
  return normalizeAbsoluteUrl(value) ?? normalizeNonEmptyText(value)?.toLowerCase() ?? null;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function clampInteger(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, " ").trim().slice(0, 240);
}

function isTransientNetworkError(error) {
  const message = safeErrorMessage(error);
  return (
    message.includes("fetch failed") ||
    message.includes("Connect Timeout") ||
    message.includes("ECONNRESET") ||
    message.includes("ETIMEDOUT") ||
    message.includes("EAI_AGAIN") ||
    message.includes("ENOTFOUND") ||
    message.includes("UND_ERR_CONNECT_TIMEOUT") ||
    message.includes("UND_ERR_SOCKET")
  );
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

function extractMetadataString(metadata, key) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];
  return normalizeNonEmptyText(value);
}

async function buildVJudgeCookieHeader() {
  const fileHeader = readVJudgeCookieFileHeader(COOKIE_FILE_PATH);
  if (fileHeader) {
    return fileHeader;
  }

  if (EXPLICIT_VJUDGE_COOKIE_HEADER) {
    return EXPLICIT_VJUDGE_COOKIE_HEADER;
  }

  const credentialHeader = await loginWithVjudgeCredentials();
  if (credentialHeader) {
    return credentialHeader;
  }

  const chromeUserDataDir =
    normalizeNonEmptyText(process.env.VJUDGE_CHROME_USER_DATA_DIR) ??
    normalizeNonEmptyText(process.env.VJUDGE_BROWSER_USER_DATA_DIR) ??
    getDefaultBrowserUserDataDir();
  const chromeProfileDir = normalizeNonEmptyText(process.env.VJUDGE_CHROME_PROFILE_DIR) ?? "Default";

  if (!chromeUserDataDir) {
    return null;
  }

  const localStatePath = resolve(chromeUserDataDir, "Local State");
  const cookieDbPaths = [
    resolve(chromeUserDataDir, chromeProfileDir, "Network", "Cookies"),
    resolve(chromeUserDataDir, chromeProfileDir, "Cookies"),
  ].filter((path) => existsSync(path));

  if (!existsSync(localStatePath) || cookieDbPaths.length === 0) {
    return null;
  }

  const masterKey = loadChromeMasterKey(localStatePath);
  const cookies = [];

  for (const cookieDbPath of cookieDbPaths) {
    try {
      cookies.push(...readChromeCookies(cookieDbPath, masterKey));
    } catch (error) {
      const message = safeErrorMessage(error);
      if (!message.includes("EBUSY") && !message.includes("locked")) {
        throw error;
      }
    }
  }

  const selected = pickVJudgeCookies(cookies);
  return selected.length > 0
    ? selected.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
    : null;
}

function readVJudgeCookieFileHeader(cookieFilePath) {
  if (!cookieFilePath || !existsSync(cookieFilePath)) {
    return null;
  }

  const raw = readFileSync(cookieFilePath, "utf8");
  return normalizeCookieHeaderText(raw);
}

async function ensureVJudgeBrowserSession() {
  if (browserFetchSession) {
    return browserFetchSession;
  }

  const { chromium } = await import(PLAYWRIGHT_MODULE_URL);
  const browserExecutables = getBrowserExecutableCandidates();
  const cookieEntries = parseBrowserCookieEntries(cookieHeader);

  let lastError = null;
  for (const executablePath of browserExecutables) {
    let browser = null;
    let context = null;
    let page = null;

    try {
      const launchOptions = { headless: BROWSER_HEADLESS };
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      }

      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: "zh-CN",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      });

      if (cookieEntries.length > 0) {
        await context.addCookies(cookieEntries);
      }

      page = await context.newPage();

      if (FETCH_MODE === "browser") {
        await page.goto("https://vjudge.net/problem", { waitUntil: "domcontentloaded" });
        await waitForVJudgeAccess(page);
      } else {
        await page.goto("https://vjudge.net/problem", { waitUntil: "domcontentloaded" });
      }

      browserFetchSession = { browser, context, page, executablePath };
      console.log(`Browser fetch session ready via ${executablePath ?? "bundled chromium"}`);
      return browserFetchSession;
    } catch (error) {
      lastError = error;
      try {
        await page?.close();
      } catch {}
      try {
        await context?.close();
      } catch {}
      try {
        await browser?.close();
      } catch {}
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchTextInBrowser(url, timeoutMs, signal) {
  const session = await ensureVJudgeBrowserSession();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("Browser request timed out")), timeoutMs);
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw signal.reason instanceof Error ? signal.reason : new Error("Request timed out");
    }
    signal.addEventListener(
      "abort",
      () => {
        controller.abort(signal.reason instanceof Error ? signal.reason : new Error("Request timed out"));
      },
      { once: true },
    );
  }

  try {
    const timeoutPromise = new Promise((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          reject(controller.signal.reason instanceof Error
            ? controller.signal.reason
            : new Error("Browser request timed out"));
        },
        { once: true },
      );
    });

    const requestPromise = session.page.evaluate(
      async ({ requestUrl }) => {
        const response = await fetch(requestUrl, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Cache-Control": "no-cache",
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        return {
          status: response.status,
          ok: response.ok,
          text: await response.text(),
        };
      },
      { requestUrl: url },
    ).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return response.text;
    });

    return await Promise.race([requestPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitForVJudgeAccess(page) {
  const deadline = Date.now() + 15 * 60 * 1000;
  let announced = false;

  while (Date.now() < deadline) {
    const bodyText = await page.locator("body").innerText().catch(() => "");
    const visibleText = normalizeWhitespace(bodyText);
    if (!looksLikeVJudgeChallenge(visibleText)) {
      return;
    }

    if (!announced) {
      console.log("");
      console.log("VJudge is showing a human verification page.");
      console.log("Solve it in the opened browser window, then this script will continue automatically.");
      announced = true;
    }

    await delay(2000);
  }

  throw new Error("Timed out waiting for VJudge human verification to be solved");
}

function looksLikeVJudgeChallenge(text) {
  const normalized = normalizeWhitespace(text).toLowerCase();
  if (!normalized) {
    return false;
  }

  return VJUDGE_CHALLENGE_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()));
}

function parseBrowserCookieEntries(cookieHeaderValue) {
  const normalized = normalizeNonEmptyText(cookieHeaderValue);
  if (!normalized) {
    return [];
  }

  const entries = new Map();
  for (const part of normalized.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const name = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    if (!name || !value) {
      continue;
    }

    entries.set(name, value);
  }

  return Array.from(entries.entries()).map(([name, value]) => ({
    name,
    value,
    url: "https://vjudge.net",
  }));
}

function getBrowserExecutableCandidates() {
  const explicitExecutable = normalizeNonEmptyText(process.env.VJUDGE_BROWSER_EXECUTABLE);
  if (explicitExecutable && existsSync(explicitExecutable)) {
    return [explicitExecutable];
  }

  const candidates = [];
  const edgeCandidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  const chromeCandidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  for (const candidate of edgeCandidates) {
    if (existsSync(candidate)) {
      candidates.push(candidate);
    }
  }

  for (const candidate of chromeCandidates) {
    if (existsSync(candidate)) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

async function loginWithVjudgeCredentials() {
  const username =
    normalizeNonEmptyText(process.env.VJUDGE_USERNAME) ??
    normalizeNonEmptyText(process.env.VJUDGE_IMPORT_USERNAME);
  const password =
    normalizeNonEmptyText(process.env.VJUDGE_PASSWORD) ??
    normalizeNonEmptyText(process.env.VJUDGE_IMPORT_PASSWORD);

  if (!username || !password) {
    return null;
  }

  const form = new URLSearchParams({ username, password });
  let lastError = null;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch("https://vjudge.net/user/login", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          "x-requested-with": "XMLHttpRequest",
          origin: "https://vjudge.net",
          referer: "https://vjudge.net/user/login",
        },
        body: form,
        redirect: "manual",
      });

      const setCookies =
        typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
      const cookiePairs = parseSetCookiePairs(setCookies);
      if (cookiePairs.length === 0) {
        if (!response.ok && ![302, 303, 307, 308].includes(response.status)) {
          throw new Error(`VJudge login failed with HTTP ${response.status}`);
        }

        throw new Error("VJudge login did not return any cookies");
      }

      if (!response.ok && ![302, 303, 307, 308].includes(response.status)) {
        throw new Error(`VJudge login failed with HTTP ${response.status}`);
      }

      return cookiePairs.join("; ");
    } catch (error) {
      lastError = error;
      if (!isTransientNetworkError(error) || attempt >= 4) {
        break;
      }

      console.log(`retrying VJudge login after ${safeErrorMessage(error)} (attempt ${attempt})`);
      await delay(Math.min(2000 * attempt, 10000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function refreshVjudgeSession() {
  const fileHeader = readVJudgeCookieFileHeader(COOKIE_FILE_PATH);
  if (fileHeader) {
    return fileHeader;
  }

  if (EXPLICIT_VJUDGE_COOKIE_HEADER) {
    return EXPLICIT_VJUDGE_COOKIE_HEADER;
  }

  const refreshed = await loginWithVjudgeCredentials();
  if (!refreshed) {
    return cookieHeader;
  }

  return refreshed;
}

function getDefaultBrowserUserDataDir() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    return null;
  }

  const edgePath = resolve(localAppData, "Microsoft", "Edge", "User Data");
  if (existsSync(edgePath)) {
    return edgePath;
  }

  const chromePath = resolve(localAppData, "Google", "Chrome", "User Data");
  if (existsSync(chromePath)) {
    return chromePath;
  }

  return null;
}

function loadChromeMasterKey(localStatePath) {
  const localState = JSON.parse(readFileSync(localStatePath, "utf8"));
  const encryptedKey = localState?.os_crypt?.encrypted_key;
  if (typeof encryptedKey !== "string" || encryptedKey.length === 0) {
    throw new Error("Chrome Local State does not expose an encrypted_key");
  }

  const encrypted = Buffer.from(encryptedKey, "base64");
  const dpapiPrefix = Buffer.from("DPAPI");
  const rawKey = encrypted.subarray(dpapiPrefix.length);
  const decrypted = decryptDpapiBuffer(rawKey);
  return decrypted;
}

function decryptDpapiBuffer(buffer) {
  const script = [
    "Add-Type -AssemblyName System.Security",
    "$bytes=[Convert]::FromBase64String('" + buffer.toString("base64") + "')",
    "$out=[System.Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Console]::Out.Write([Convert]::ToBase64String($out))",
  ].join(";");

  const result = spawnSync("powershell", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to decrypt Chrome master key");
  }

  return Buffer.from(String(result.stdout).trim(), "base64");
}

function readChromeCookies(cookieDbPath, masterKey) {
  const tempRoot = mkdtempSync(resolve(tmpdir(), "vj-cookie-"));
  const tempDbPath = resolve(tempRoot, "Cookies");
  const tempWalPath = `${tempDbPath}-wal`;
  const tempShmPath = `${tempDbPath}-shm`;
  const sourceWalPath = `${cookieDbPath}-wal`;
  const sourceShmPath = `${cookieDbPath}-shm`;

  copyFileSync(cookieDbPath, tempDbPath);
  if (existsSync(sourceWalPath)) {
    copyFileSync(sourceWalPath, tempWalPath);
  }
  if (existsSync(sourceShmPath)) {
    copyFileSync(sourceShmPath, tempShmPath);
  }

  const database = new DatabaseSync(tempDbPath, { readonly: true });
  try {
    const rows = database
      .prepare(
        "SELECT host_key, name, path, value, encrypted_value FROM cookies WHERE host_key LIKE ?",
      )
      .all("%vjudge.net%");

    return rows
      .map((row) => {
        const value = readChromeCookieValue(row, masterKey);
        if (!value) {
          return null;
        }

        return {
          host: String(row.host_key ?? ""),
          name: String(row.name ?? ""),
          path: String(row.path ?? "/"),
          value,
        };
      })
      .filter(Boolean);
  } finally {
    database.close();
    try {
      rmSync(tempDbPath, { force: true });
      rmSync(tempWalPath, { force: true });
      rmSync(tempShmPath, { force: true });
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  }
}

function readChromeCookieValue(row, masterKey) {
  const rawValue = row.value;
  if (typeof rawValue === "string" && rawValue.length > 0) {
    return rawValue;
  }

  const encrypted = row.encrypted_value;
  if (!encrypted || typeof encrypted.length !== "number") {
    return "";
  }

  const encryptedBuffer = Buffer.from(encrypted);
  const prefix = encryptedBuffer.subarray(0, 3).toString("utf8");

  if (prefix !== "v10" && prefix !== "v11") {
    return "";
  }

  const iv = encryptedBuffer.subarray(3, 15);
  const payload = encryptedBuffer.subarray(15, encryptedBuffer.length - 16);
  const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", masterKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]);
  return decrypted.toString("utf8");
}

function pickVJudgeCookies(cookies) {
  const selected = new Map();

  for (const cookie of cookies) {
    if (!cookie || !isVJudgeCookie(cookie.host)) {
      continue;
    }

    const key = `${cookie.name}|${cookie.path}`;
    const existing = selected.get(key);
    if (!existing || existing.path.length <= cookie.path.length) {
      selected.set(key, cookie);
    }
  }

  return Array.from(selected.values());
}

function isVJudgeCookie(host) {
  const normalized = String(host ?? "").toLowerCase();
  return normalized === "vjudge.net" || normalized.endsWith(".vjudge.net");
}

function parseSetCookiePairs(setCookies) {
  if (!Array.isArray(setCookies)) {
    return [];
  }

  const result = [];
  for (const cookie of setCookies) {
    if (typeof cookie !== "string" || cookie.length === 0) {
      continue;
    }

    const separator = cookie.indexOf(";");
    const pair = separator >= 0 ? cookie.slice(0, separator) : cookie;
    if (pair.includes("=")) {
      result.push(pair.trim());
    }
  }

  return result;
}
