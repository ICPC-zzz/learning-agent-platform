/**
 * Deduplicate books in the local library by Open Library work key.
 * Keeps the oldest (first created) book for each work key, deletes duplicates.
 *
 * cd apps/web && node --experimental-strip-types ../../scripts/dedup-books.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// Load DATABASE_URL
let DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) {
  for (const p of [resolve(projectRoot,".env"), resolve(projectRoot,"apps/web/.env.local"), resolve(projectRoot,"packages/db/.env")]) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p,"utf-8").split("\n")) {
      const t = line.trim();
      if (t.startsWith("#") || !t.includes("=")) continue;
      const idx = t.indexOf("=");
      let val = t.slice(idx+1).trim();
      if ((val.startsWith('"')&&val.endsWith('"'))||(val.startsWith("'")&&val.endsWith("'"))) val = val.slice(1,-1);
      if (t.slice(0,idx).trim() === "DATABASE_URL") { DATABASE_URL = val; break; }
    }
    if (DATABASE_URL) break;
  }
}
if (!DATABASE_URL) { console.error("DATABASE_URL not found"); process.exit(1); }
process.env.DATABASE_URL = DATABASE_URL;

const dbDist = resolve(projectRoot, "packages/db/dist");
const { getPrismaClient } = await import("file://"+dbDist+"/client.js");
const { PrismaBookRepository } = await import("file://"+dbDist+"/repositories/book-repository.js");

async function main() {
  const repo = new PrismaBookRepository(getPrismaClient());
  const allBooks = await repo.listBooks({ limit: 99999 });
  console.log("Total books:", allBooks.length);

  // Group by workKey (from metadata.externalId or metadata.sourceUrl)
  const byKey = new Map(); // key -> [books]
  const noKey = [];

  for (const book of allBooks) {
    let key = null;
    const meta = book.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const m = meta;
      // Try externalId first (OL work key like "/works/OL123W")
      if (typeof m.externalId === "string" && m.externalId.startsWith("/works/")) {
        key = m.externalId;
      } else if (typeof m.sourceUrl === "string" && m.sourceUrl.includes("/works/")) {
        const match = m.sourceUrl.match(/\/works\/OL\d+W/);
        if (match) key = match[0];
      }
    }
    if (key) {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(book);
    } else {
      noKey.push(book);
    }
  }

  // Count duplicates
  let dupCount = 0;
  let toDelete = [];
  for (const [key, books] of byKey) {
    if (books.length > 1) {
      // Keep the first (oldest), delete the rest
      const sorted = books.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      for (let i = 1; i < sorted.length; i++) {
        toDelete.push(sorted[i]);
        dupCount++;
      }
    }
  }

  console.log("Unique works:", byKey.size);
  console.log("Books without work key:", noKey.length);
  console.log("Duplicate books to delete:", dupCount);

  if (dupCount === 0) {
    console.log("No duplicates found.");
    return;
  }

  console.log("\nDeleting", dupCount, "duplicate books...");
  let deleted = 0, failed = 0;

  for (const book of toDelete) {
    try {
      const r = await repo.deleteBook({ bookId: book.id });
      if (r.success) deleted++;
      else { console.log("  FAIL:", book.title.slice(0,50), r.message); failed++; }
    } catch (e) {
      console.log("  ERROR:", book.title.slice(0,50), e.message.slice(0,60));
      failed++;
    }
  }

  console.log("\nDeleted:", deleted, "Failed:", failed);
}

main().catch(e => { console.error("Fatal:", e.message||e); process.exit(1); });
