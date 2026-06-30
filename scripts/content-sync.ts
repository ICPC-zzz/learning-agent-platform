import {
  syncAllDailyContent,
  syncDailyHotTopics,
  syncGithubDailyReport,
  syncTechnicalArticles,
} from "../apps/web/src/lib/content/daily-content-sync-job.ts";

async function main() {
  const args = new Set(process.argv.slice(2));
  const force = args.has("--force");
  const results = args.has("--hot")
    ? [await syncDailyHotTopics({ force, leaseOwner: "cli-content-sync-hot" })]
    : args.has("--github")
      ? [await syncGithubDailyReport({ force, leaseOwner: "cli-content-sync-github" })]
      : args.has("--articles")
        ? [await syncTechnicalArticles({ force, leaseOwner: "cli-content-sync-articles" })]
      : await syncAllDailyContent({ force, leaseOwner: "cli-content-sync-all" });

  for (const result of results) {
    console.log(`${result.kind}: ${result.status} saved=${result.saved} fetched=${result.fetched} ${result.safeSummary}`);
  }

  if (results.some((result) => !result.ok && result.status !== "skipped")) {
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error("内容同步命令执行失败，已保留上一次成功快照。");
  process.exitCode = 1;
});
