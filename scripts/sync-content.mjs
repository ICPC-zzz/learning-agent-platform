/**
 * A500 Content Sync — Standalone script to sync daily hotspots and GitHub daily.
 *
 * Uses the same HackerNews / DEV.to / GitHub API endpoints as the web sync
 * functions, but writes directly to JSON files without requiring the Next.js
 * dev server or Prisma database.
 *
 * Usage: node sync-content.mjs [--hotspots] [--github] [--articles]
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");
const DATA_DIR = resolve(PROJECT_ROOT, "apps/web/src/data");
const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// API fetchers
// ---------------------------------------------------------------------------

const HN_TOP_STORIES = "https://hacker-news.firebaseio.com/v0/topstories.json";
const HN_ITEM = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const DEV_ARTICLES = "https://dev.to/api/articles?per_page=50&tag=programming";
const GITHUB_SEARCH =
  "https://api.github.com/search/repositories?q=created:>%DATE%&sort=stars&order=desc&per_page=30";

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LearningAgentPlatform/1.0", ...headers },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// HackerNews
// ---------------------------------------------------------------------------

async function fetchHackerNewsHotspots(topN = 30) {
  console.log("[HN] Fetching top stories...");
  const ids = await fetchJson(HN_TOP_STORIES);
  const topIds = ids.slice(0, topN);

  const stories = [];
  for (const id of topIds) {
    try {
      const item = await fetchJson(HN_ITEM(id));
      if (item && item.type === "story" && item.url) {
        stories.push({
          id: `hn-${item.id}`,
          title: item.title || "",
          summary: null,
          originalUrl: item.url,
          discussionUrl: `https://news.ycombinator.com/item?id=${item.id}`,
          author: item.by || null,
          source: "hackernews",
          sourceLabel: "Hacker News",
          publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null,
          score: item.score || 0,
          commentCount: item.descendants || 0,
          tags: [],
        });
      }
    } catch (e) {
      console.warn(`[HN] Failed item ${id}: ${e.message}`);
    }
    // Small delay to be polite
    if (stories.length % 10 === 0) await sleep(200);
  }
  console.log(`[HN] Fetched ${stories.length} stories`);
  return stories;
}

// ---------------------------------------------------------------------------
// DEV.to
// ---------------------------------------------------------------------------

async function fetchForemArticles() {
  console.log("[DEV] Fetching DEV.to articles...");
  try {
    const articles = await fetchJson(DEV_ARTICLES);
    const result = articles.map((a) => ({
      id: `dev-${a.id}`,
      title: a.title || "",
      summary: a.description || null,
      originalUrl: a.url || a.canonical_url,
      discussionUrl: null,
      author: a.user?.name || null,
      source: "forem",
      sourceLabel: "DEV Community",
      publishedAt: a.published_at || a.created_at || null,
      score: a.positive_reactions_count || 0,
      commentCount: a.comments_count || 0,
      tags: Array.isArray(a.tag_list) ? a.tag_list : [],
    }));
    console.log(`[DEV] Fetched ${result.length} articles`);
    return result;
  } catch (e) {
    console.warn(`[DEV] Failed: ${e.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// GitHub
// ---------------------------------------------------------------------------

async function fetchGitHubDaily() {
  const today = new Date();
  const fourDaysAgo = new Date(today);
  fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
  const dateStr = fourDaysAgo.toISOString().slice(0, 10);

  const url = GITHUB_SEARCH.replace("%DATE%", dateStr);
  console.log("[GitHub] Searching trending repos...");
  const headers = {};
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const data = await fetchJson(url, headers);
    const repos = (data.items || []).map((r) => {
      const pushed = r.pushed_at ? new Date(r.pushed_at).getTime() : 0;
      const daysSincePush = Math.floor((Date.now() - pushed) / 86400000);
      const isActive = daysSincePush <= 7;

      return {
        id: `gh-${r.id}`,
        fullName: r.full_name,
        owner: r.owner?.login || "",
        name: r.name,
        description: r.description || null,
        htmlUrl: r.html_url,
        primaryLanguage: r.language || null,
        topics: r.topics || [],
        stars: r.stargazers_count || 0,
        starDelta24h: null,
        forks: r.forks_count || 0,
        license: r.license?.spdx_id || null,
        pushedAt: r.pushed_at || null,
        latestReleaseTag: null,
        isFirstDay: true,
        reasons: isActive ? ["近期活跃"] : [],
      };
    });

    // Filter: only repos with >50 stars and active in last 7 days
    const filtered = repos.filter((r) => r.stars > 50);
    console.log(`[GitHub] Fetched ${repos.length}, filtered to ${filtered.length}`);
    return filtered;
  } catch (e) {
    console.warn(`[GitHub] Failed: ${e.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

function writeDailyJson(filename, data) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(resolve(DATA_DIR, filename), JSON.stringify(data, null, 2), "utf-8");
  console.log(`[Write] ${filename} (${JSON.stringify(data).length} bytes)`);
}

// ---------------------------------------------------------------------------
// Sync functions
// ---------------------------------------------------------------------------

async function syncHotspots() {
  console.log("\n=== Syncing Daily Tech Hotspots ===");
  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  let hotspots = [];
  try {
    const [hn, dev] = await Promise.all([
      fetchHackerNewsHotspots(30),
      fetchForemArticles(),
    ]);
    hotspots = [...hn, ...dev];

    // Simple dedup by URL
    const seen = new Set();
    hotspots = hotspots.filter((h) => {
      const key = h.originalUrl || `${h.source}:${h.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by score desc
    hotspots.sort((a, b) => b.score - a.score);
  } catch (e) {
    console.error(`Hotspot sync failed: ${e.message}`);
  }

  if (hotspots.length > 0 || !generatedFileExists("daily-hotspots.generated.json")) {
    writeDailyJson("daily-hotspots.generated.json", {
      generatedAt: new Date().toISOString(),
      date: today,
      count: hotspots.length,
      hotspots,
    });
  } else {
    console.log("[Preserved] daily-hotspots.generated.json because this sync produced no items");
  }

  console.log(`[Done] ${hotspots.length} hotspots in ${Date.now() - started}ms`);
  return hotspots.length;
}

async function syncGitHub() {
  console.log("\n=== Syncing GitHub Daily ===");
  const started = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  let repos = [];
  try {
    repos = await fetchGitHubDaily();
  } catch (e) {
    console.error(`GitHub sync failed: ${e.message}`);
  }

  if (repos.length > 0 || !generatedFileExists("daily-github.generated.json")) {
    writeDailyJson("daily-github.generated.json", {
      generatedAt: new Date().toISOString(),
      date: today,
      count: repos.length,
      isFirstDay: true,
      repos,
    });
  } else {
    console.log("[Preserved] daily-github.generated.json because this sync produced no items");
  }

  console.log(`[Done] ${repos.length} repos in ${Date.now() - started}ms`);
  return repos.length;
}

async function syncArticles() {
  console.log("\n=== Syncing Technical Articles ===");
  const started = Date.now();
  const scriptPath = resolve(PROJECT_ROOT, "services/article-feed-ingestor/ingest.py");
  const before = countGeneratedArticles();
  const candidates = process.platform === "win32"
    ? [
        { command: "python", args: [scriptPath] },
        { command: "py", args: ["-3", scriptPath] },
      ]
    : [
        { command: "python3", args: [scriptPath] },
        { command: "python", args: [scriptPath] },
      ];

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const { stdout, stderr } = await execFileAsync(candidate.command, candidate.args, {
        cwd: PROJECT_ROOT,
        timeout: 180000,
        maxBuffer: 1024 * 1024,
      });
      if (stdout.trim()) console.log(stdout.trim());
      if (stderr.trim()) console.warn(stderr.trim());
      const after = countGeneratedArticles();
      console.log(`[Done] ${after} articles, +${Math.max(0, after - before)} in ${Date.now() - started}ms`);
      return after;
    } catch (error) {
      lastError = error;
    }
  }

  console.error(`Article sync failed: ${lastError?.message || String(lastError)}`);
  console.log(`[Preserved] ${before} existing articles`);
  return before;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function countGeneratedArticles() {
  try {
    const filePath = resolve(DATA_DIR, "articles.generated.json");
    if (!existsSync(filePath)) return 0;
    const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function generatedFileExists(filename) {
  return existsSync(resolve(DATA_DIR, filename));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const doHotspots = args.includes("--hotspots") || args.length === 0;
const doGitHub = args.includes("--github") || args.length === 0;
const doArticles = args.includes("--articles") || args.length === 0;

console.log(`A500 Content Sync — ${new Date().toISOString()}`);
console.log(`Data dir: ${DATA_DIR}`);

let results = { hotspots: 0, github: 0, articles: 0 };

if (doHotspots) {
  results.hotspots = await syncHotspots();
}
if (doGitHub) {
  results.github = await syncGitHub();
}
if (doArticles) {
  results.articles = await syncArticles();
}

console.log("\n=== Sync Complete ===");
console.log(`Hotspots: ${results.hotspots}`);
console.log(`GitHub: ${results.github}`);
console.log(`Articles: ${results.articles}`);
