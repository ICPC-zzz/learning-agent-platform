/**
 * sync-daily-content.mjs — Standalone daily content sync script.
 *
 * Fetches tech hotspots (HN + DEV) and GitHub trending repos,
 * saves results to JSON files in apps/web/src/data/.
 *
 * NO Prisma. NO Next.js. Just fetch + write JSON.
 *
 * Usage:
 *   node --experimental-strip-types scripts/sync-daily-content.mjs
 *   node --experimental-strip-types scripts/sync-daily-content.mjs --hotspots
 *   node --experimental-strip-types scripts/sync-daily-content.mjs --github
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "apps", "web", "src", "data");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeJson(filename, data) {
  ensureDir();
  fs.writeFileSync(
    path.join(DATA_DIR, filename),
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

/** fetchJson with retry on transient failures (timeout, network error, 5xx).
 *  Does NOT retry on 4xx (client errors are permanent). */
async function fetchJsonRetry(url, headers = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "learning-agent-platform/1.0", ...headers },
        signal: controller.signal,
      });
      if (!res.ok) {
        if (attempt < retries && res.status >= 500) {
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(
            `  HTTP ${res.status} from ${url.slice(0, 80)} — retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`
          );
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        console.warn(`  HTTP ${res.status} from ${url.slice(0, 80)}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      if (attempt < retries && (e.name === "AbortError" || e.message?.includes("fetch"))) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `  Fetch failed: ${url.slice(0, 80)} — ${e.message} — retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      console.warn(`  Fetch failed: ${url.slice(0, 80)} — ${e.message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Quiet release fetcher — 404 is normal (no releases), don't log it. */
async function fetchRelease(url, headers = {}) {
  for (let attempt = 0; attempt <= 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "learning-agent-platform/1.0", ...headers },
        signal: controller.signal,
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        console.warn(`  HTTP ${res.status} from ${url.slice(0, 80)}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      if (attempt < 1 && (e.name === "AbortError" || e.message?.includes("fetch"))) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (attempt === 1) console.warn(`  Fetch failed: ${url.slice(0, 80)} — ${e.message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Silent retry for batch item fetches — no per-item noise. */
async function fetchSilentRetry(url, headers = {}, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "learning-agent-platform/1.0", ...headers },
        signal: controller.signal,
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        if (attempt < retries && res.status >= 500) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 2000));
          continue;
        }
        return null;
      }
      return await res.json();
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 2000));
        continue;
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

function normUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    u.hostname = u.hostname.toLowerCase();
    u.hash = "";
    const tracking = /^(utm_|fbclid|gclid|gclsrc|dclid|msclkid|ref|ref_src|mc_cid|mc_eid|_ga|_gl)$/i;
    for (const k of [...u.searchParams.keys()]) {
      if (tracking.test(k)) u.searchParams.delete(k);
    }
    let pathname = u.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) pathname = pathname.slice(0, -1);
    if (pathname === "") pathname = "/";
    u.pathname = pathname;
    return u.toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

function str(v, fallback = "") {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  return fallback;
}

// ===========================================================================
// Hacker News
// ===========================================================================

async function fetchHackerNews() {
  console.log("Fetching Hacker News top stories...");
  const topIds =
    (await fetchJsonRetry("https://hacker-news.firebaseio.com/v0/topstories.json")) ?? [];
  const bestIds =
    (await fetchJsonRetry("https://hacker-news.firebaseio.com/v0/beststories.json")) ?? [];
  const allIds = [...new Set([...topIds, ...bestIds])].slice(0, 80);

  console.log(`  Got ${allIds.length} candidate IDs, fetching details...`);
  const now = Date.now();
  const cutoff = 48 * 60 * 60 * 1000;
  const items = [];

  for (let i = 0; i < allIds.length; i += 4) {
    const batch = allIds.slice(i, i + 4);
    const results = await Promise.all(
      batch.map((id) =>
        fetchSilentRetry(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
      ),
    );

    let batchOk = 0;
    for (const item of results) {
      if (!item || item.type !== "story" || item.deleted || item.dead) continue;
      if (!item.title) continue;
      batchOk++;
      const ts = item.time ? item.time * 1000 : 0;
      if (ts && now - ts > cutoff) continue;

      items.push({
        id: `hn:${item.id}`,
        title: item.title.trim(),
        summary: null,
        originalUrl: item.url?.trim() ?? null,
        discussionUrl: `https://news.ycombinator.com/item?id=${item.id}`,
        author: item.by ?? null,
        source: "hackernews",
        publishedAt: ts ? new Date(ts).toISOString() : null,
        score: item.score ?? 0,
        commentCount: item.descendants ?? 0,
        tags: [],
      });
    }

    if (batchOk < batch.length) {
      console.warn(
        `  Batch ${i / 4 + 1}/${Math.ceil(allIds.length / 4)}: ${batchOk}/${batch.length} items OK`
      );
    }

    if (i + 4 < allIds.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  items.sort((a, b) => b.score - a.score);
  console.log(`  Got ${items.length} HN stories after filtering`);
  return items.slice(0, 25);
}

// ===========================================================================
// DEV.to / Forem
// ===========================================================================

async function fetchForem() {
  console.log("Fetching DEV.to popular articles...");
  const items = [];

  for (let page = 1; page <= 3; page++) {
    const data = await fetchJsonRetry(
      `https://dev.to/api/articles?page=${page}&per_page=20&top=3`,
    );
    if (!data || data.length === 0) break;

    for (const d of data) {
      items.push({
        id: `forem:${d.id}`,
        title: str(d.title),
        summary: d.description?.trim() ?? null,
        originalUrl: d.canonical_url ?? d.url,
        discussionUrl: null,
        author: d.user?.name ?? d.user?.username ?? null,
        source: "forem",
        publishedAt: d.published_at ?? null,
        score: d.positive_reactions_count ?? 0,
        commentCount: d.comments_count ?? 0,
        tags: (d.tag_list ?? []).slice(0, 5),
      });
    }
  }

  console.log(`  Got ${items.length} DEV articles`);
  return items;
}

// ===========================================================================
// Deduplication
// ===========================================================================

function deduplicate(items) {
  const seen = new Map();
  const result = [];

  for (const item of items) {
    const key1 = `${item.source}:${item.id}`;
    if (seen.has(key1)) continue;

    if (item.originalUrl) {
      const nu = normUrl(item.originalUrl);
      if (nu) {
        const key2 = `url:${nu}`;
        if (seen.has(key2)) continue;
        seen.set(key2, true);
      }
    }

    seen.set(key1, true);
    result.push(item);
  }

  return result;
}

// ===========================================================================
// GitHub
// ===========================================================================

function getGhToken() {
  try {
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
    const envPath = path.resolve(__dirname, "..", "apps", "web", ".env.local");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^GITHUB_TOKEN=(.+)$/m);
      if (match) return match[1].trim();
    }
  } catch {}
  return null;
}

function ghHeaders() {
  const token = getGhToken();
  return {
    Accept: "application/vnd.github.v3+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchGitHub() {
  console.log("Fetching GitHub trending repos...");
  const token = getGhToken();
  console.log(
    `  GitHub Token: ${token ? "configured" : "NOT configured (anonymous, low rate limit)"}`
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const seen = new Set();
  const repos = [];

  console.log("  Searching new repos (created > 7d, stars >= 20)...");
  const q1 =
    `https://api.github.com/search/repositories?q=created:>${sevenDaysAgo}+stars:>=20&sort=stars&order=desc&per_page=15`;
  const r1 = await fetchJsonRetry(q1, ghHeaders());
  if (r1?.items) {
    for (const item of r1.items) {
      if (seen.has(item.id) || item.archived || item.fork) continue;
      seen.add(item.id);
      repos.push(normRepo(item));
    }
  }

  console.log("  Searching active repos (pushed > 3d, stars >= 50)...");
  const q2 =
    `https://api.github.com/search/repositories?q=pushed:>${threeDaysAgo}+stars:>=50&sort=updated&order=desc&per_page=10`;
  const r2 = await fetchJsonRetry(q2, ghHeaders());
  if (r2?.items) {
    for (const item of r2.items) {
      if (seen.has(item.id) || item.archived || item.fork) continue;
      seen.add(item.id);
      repos.push(normRepo(item));
    }
  }

  console.log("  Searching AI topic...");
  const q3 =
    `https://api.github.com/search/repositories?q=topic:artificial-intelligence+stars:>=10+created:>${sevenDaysAgo}&sort=stars&order=desc&per_page=5`;
  const r3 = await fetchJsonRetry(q3, ghHeaders());
  if (r3?.items) {
    for (const item of r3.items) {
      if (seen.has(item.id) || item.archived || item.fork) continue;
      seen.add(item.id);
      repos.push(normRepo(item));
    }
  }

  console.log(`  Got ${repos.length} GitHub repos`);

  console.log("  Fetching releases for top repos...");
  for (let i = 0; i < Math.min(repos.length, 10); i++) {
    const repo = repos[i];
    if (!repo) continue;
    try {
      const release = await fetchRelease(
        `https://api.github.com/repos/${repo.fullName}/releases/latest`,
        ghHeaders(),
      );
      if (release) {
        repo.latestReleaseTag = release.tag_name ?? null;
        repo.latestReleaseName = release.name ?? release.tag_name ?? null;
        repo.latestReleaseUrl = release.html_url ?? null;
        repo.latestReleasePublishedAt = release.published_at ?? null;
        repo.prerelease = release.prerelease ?? false;
      }
    } catch {
      // no release data
    }
  }

  return repos;
}

function normRepo(item) {
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(item.created_at).getTime()) / (24 * 60 * 60 * 1000),
  );
  const reasons = [];
  if (daysSinceCreated <= 7) reasons.push(`${daysSinceCreated}天前新建`);

  const repo = {
    id: `github:${item.id}`,
    fullName: item.full_name,
    owner: item.owner?.login ?? "",
    name: item.name,
    description: item.description?.trim() ?? null,
    htmlUrl: item.html_url,
    primaryLanguage: item.language?.trim() ?? null,
    topics: item.topics ?? [],
    stars: item.stargazers_count ?? 0,
    forks: item.forks_count ?? 0,
    openIssues: item.open_issues_count ?? 0,
    license: item.license?.spdx_id ?? null,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    pushedAt: item.pushed_at,
    archived: item.archived ?? false,
    fork: item.fork ?? false,
    reasons,
    latestReleaseTag: null,
    latestReleaseName: null,
    latestReleaseUrl: null,
    latestReleasePublishedAt: null,
    prerelease: false,
  };

  return repo;
}

// ===========================================================================
// Main
// ===========================================================================

async function main() {
  const args = process.argv.slice(2);
  const doAll = args.length === 0;
  const doHotspots = doAll || args.includes("--hotspots");
  const doGithub = doAll || args.includes("--github");

  console.log("=== Daily Content Sync ===\n");

  if (doHotspots) {
    console.log("--- Tech Hotspots ---");
    const [hn, forem] = await Promise.all([fetchHackerNews(), fetchForem()]);
    const merged = deduplicate([...hn, ...forem]);
    console.log(`  Total after dedup: ${merged.length}`);

    writeJson("daily-hotspots.generated.json", {
      generatedAt: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      count: merged.length,
      hotspots: merged,
    });
    console.log("  Saved to apps/web/src/data/daily-hotspots.generated.json\n");
  }

  if (doGithub) {
    console.log("--- GitHub Daily Report ---");
    const repos = await fetchGitHub();

    repos.sort((a, b) => {
      const aNew = a.reasons.some((r) => r.includes("天前新建")) ? 1 : 0;
      const bNew = b.reasons.some((r) => r.includes("天前新建")) ? 1 : 0;
      if (aNew !== bNew) return bNew - aNew;
      return (b.stars ?? 0) - (a.stars ?? 0);
    });

    writeJson("daily-github.generated.json", {
      generatedAt: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      count: repos.length,
      isFirstDay: true,
      repos: repos.map((r) => ({
        id: r.id,
        title: r.fullName,
        summary: r.description,
        originalUrl: r.htmlUrl,
        author: r.owner,
        source: "github",
        publishedAt: r.createdAt,
        score: r.stars,
        commentCount: r.forks,
        metadataJson: {
          fullName: r.fullName,
          owner: r.owner,
          name: r.name,
          description: r.description,
          homepage: r.htmlUrl,
          primaryLanguage: r.primaryLanguage,
          topics: r.topics,
          stars: r.stars,
          forks: r.forks,
          openIssues: r.openIssues,
          license: r.license,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          pushedAt: r.pushedAt,
          starDelta24h: null,
          isFirstDay: true,
          reasons: r.reasons,
          release: r.latestReleaseTag
            ? {
                latestReleaseTag: r.latestReleaseTag,
                latestReleaseName: r.latestReleaseName,
                latestReleaseUrl: r.latestReleaseUrl,
                latestReleasePublishedAt: r.latestReleasePublishedAt,
                prerelease: r.prerelease,
                draft: false,
              }
            : null,
        },
      })),
    });
    console.log("  Saved to apps/web/src/data/daily-github.generated.json\n");
  }

  console.log("=== Sync complete ===");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
