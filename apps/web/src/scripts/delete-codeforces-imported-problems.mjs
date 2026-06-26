#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../../../..");
loadProjectEnvironment(projectRoot);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const batchSize = parseBatchSize(args);

  console.log(`Codeforces cleanup: ${dryRun ? "DRY RUN" : "DELETE"}`);

  const missing = [];
  if (process.env.NODE_ENV === "production") {
    missing.push("NODE_ENV=production");
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    // ok
  } else {
    missing.push("DATABASE_URL");
  }
  if (process.env.LAP_ALLOW_REAL_DB_INTEGRATION !== "true") {
    missing.push("LAP_ALLOW_REAL_DB_INTEGRATION=true");
  }
  if (process.env.LAP_IMPORT_DB_PERSIST_DEV_ENABLED !== "true") {
    missing.push("LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true");
  }

  if (missing.length > 0) {
    console.error("Missing env:", missing.join(", "));
    process.exit(1);
  }

  const db = await import("@learning-agent-platform/db");
  const prisma = db.getPrismaClient();

  try {
    const candidates = await prisma.problem.findMany({
      where: {
        source: {
          contains: "codeforces",
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        title: true,
        source: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    console.log(`Matched ${candidates.length} problem(s).`);

    if (candidates.length === 0) {
      return;
    }

    if (dryRun) {
      for (const item of candidates.slice(0, 20)) {
        console.log(`- ${item.id} | ${item.title} | ${item.source ?? "n/a"}`);
      }
      if (candidates.length > 20) {
        console.log(`... and ${candidates.length - 20} more`);
      }
      return;
    }

    let deleted = 0;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const ids = batch.map((item) => item.id);

      await prisma.$transaction(async (tx) => {
        await tx.problemAttempt.deleteMany({ where: { problemId: { in: ids } } });
        await tx.problemWrongBook.deleteMany({ where: { problemId: { in: ids } } });
        await tx.problemFavorite.deleteMany({ where: { problemId: { in: ids } } });
        await tx.learningActivity.deleteMany({ where: { problemId: { in: ids } } });
        await tx.dailyRecommendation.deleteMany({ where: { problemId: { in: ids } } });
        await tx.problem.deleteMany({ where: { id: { in: ids } } });
      });

      deleted += batch.length;
      console.log(`Deleted ${deleted}/${candidates.length}`);
    }

    console.log(`Done. Deleted ${deleted} problem(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

function parseBatchSize(args) {
  const index = args.indexOf("--batch-size");
  if (index >= 0 && args[index + 1]) {
    const value = Number(args[index + 1]);
    if (Number.isFinite(value) && value > 0) {
      return Math.min(Math.max(Math.trunc(value), 1), 1000);
    }
  }

  return 200;
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

main().catch((error) => {
  console.error("Fatal:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
