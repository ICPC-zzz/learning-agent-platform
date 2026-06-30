/**
 * OL Batch Import — 10K Programming Books
 * Uses PowerShell Invoke-WebRequest (goes through system proxy).
 *
 * cd E:\code\learning-agent-platform
 * node --experimental-strip-types scripts/ol-batch-import-10k.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ── DATABASE_URL ───────────────────────────────────────────────────

let DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) {
  const candidates = [
    resolve(projectRoot, ".env"),
    resolve(projectRoot, "apps/web/.env.local"),
    resolve(projectRoot, "packages/db/.env"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      for (const line of readFileSync(p, "utf-8").split("\n")) {
        const t = line.trim();
        if (t.startsWith("#") || !t.includes("=")) continue;
        const idx = t.indexOf("=");
        let val = t.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        if (t.slice(0, idx).trim() === "DATABASE_URL") { DATABASE_URL = val; break; }
      }
      if (DATABASE_URL) { console.log("DATABASE_URL found in", p); break; }
    } catch {}
  }
}
if (!DATABASE_URL) { console.error("DATABASE_URL not found"); process.exit(1); }
process.env.DATABASE_URL = DATABASE_URL;

// ── Imports (file:// to skip workspace pkg resolution) ─────────────

const dbDist = resolve(projectRoot, "packages/db/dist");
const webSrc = resolve(projectRoot, "apps/web/src");

const { getPrismaClient } = await import(`file://${dbDist}/client.js`);
const { PrismaBookRepository } = await import(`file://${dbDist}/repositories/book-repository.js`);
const { createOpenLibraryImportDraft } = await import(`file://${webSrc}/lib/open-library-import-adapter.ts`);

// ── Fetch via PowerShell (uses system proxy) ───────────────────────

async function olFetch(url) {
  await new Promise(r => setTimeout(r, 350)); // rate limit
  const ps = `[Console]::OutputEncoding=[Text.Encoding]::UTF8; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; try { $r=Invoke-WebRequest -Uri '${url}' -UseBasicParsing -TimeoutSec 25; $r.Content } catch { exit 1 }`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = execSync(`powershell -NoProfile -Command "${ps}"`, {
        encoding: "utf-8", maxBuffer: 10 * 1024 * 1024, timeout: 35000,
      });
      return JSON.parse(raw);
    } catch (e) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 3000)); continue; }
      throw new Error("OL request failed after 3 attempts");
    }
  }
}

// ── Categories ─────────────────────────────────────────────────────

const CATS = [
  { k:"Python", l:"Python", q:["python programming","python language","django","flask","python data science","python machine learning"] },
  { k:"JavaScript", l:"JavaScript", q:["javascript programming","node.js","react js","typescript","vue.js","frontend development"] },
  { k:"Algorithm", l:"Algorithm", q:["algorithms","algorithm design","data structures","computational complexity","graph algorithms","dynamic programming"] },
  { k:"Data Structures", l:"Data Structures", q:["data structures","abstract data types","tree algorithms","hash tables","sorting algorithms","graph theory"] },
  { k:"Database", l:"Database", q:["database systems","SQL programming","NoSQL","database design","data management","postgresql"] },
  { k:"Web Dev", l:"Web Dev", q:["web development","full stack","web application","responsive design","REST API","frontend frameworks"] },
  { k:"Machine Learning", l:"Machine Learning", q:["machine learning","deep learning","neural networks","artificial intelligence","data mining","natural language processing"] },
  { k:"System Design", l:"System Design", q:["system design","software architecture","distributed systems","microservices","design patterns","scalability"] },
  { k:"Java", l:"Java", q:["java programming","spring framework","java enterprise","android development","JVM","hibernate"] },
  { k:"Go", l:"Go", q:["go programming","golang","concurrent programming","go web framework","systems programming","microservices go"] },
  { k:"Rust", l:"Rust", q:["rust programming","rust language","systems programming","webassembly","embedded rust","rust async"] },
  { k:"C/C++", l:"C/C++", q:["C++ programming","C programming language","STL","embedded systems","game programming","operating systems"] },
  { k:"Linux", l:"Linux", q:["linux system administration","unix programming","linux kernel","shell scripting","linux security","open source"] },
  { k:"Security", l:"Security", q:["computer security","network security","cryptography","penetration testing","application security","ethical hacking"] },
  { k:"Testing", l:"Testing", q:["software testing","test automation","unit testing","integration testing","test driven development","quality assurance"] },
  { k:"DevOps", l:"DevOps", q:["devops","continuous integration","docker containers","kubernetes","infrastructure code","cloud computing"] },
];

const PER_CAT = 800;
const LIMIT = 50;

const KW = new Set([
  "programming","software","computer","algorithm","data structure","database","web","network",
  "security","machine learning","artificial intelligence","language","framework","compiler",
  "operating system","linux","unix","testing","devops","cloud","distributed","microservice",
  "architecture","python","java","javascript","typescript","rust","golang","go","c++",
  "c programming","ruby","php","swift","kotlin","html","css","react","angular","vue",
  "node","spring","django","flask","sql","nosql","docker","kubernetes","neural","deep learning",
]);

function isChineseBook(doc) {
  const langs = doc.language || [];
  if (langs.some(l => l === "chi" || l === "zho" || l === "zh" || (typeof l === "string" && l.startsWith("zh")))) return true;
  // Also check title for CJK characters
  const title = doc.title || "";
  if (/[\u4e00-\u9fff]/.test(title)) return true;
  return false;
}

function isProg(doc) {
  const t = (doc.title||"").toLowerCase();
  const bad = ["poem","poetry","novel","fiction","biography","memoir","cookbook","recipe",
    "travel","romance","thriller","mystery","fantasy","history of","philosophy","religion",
    "political","economics","sociology","covid","pandemic","health","medicine","music","art of",
    "children","juvenile","young adult","comic","graphic novel"];
  for (const w of bad) { if (t.includes(w)) return false; }
  const subjs = (doc.subject||[]).map(s=>s.toLowerCase());
  for (const s of subjs) { for (const pk of KW) { if (s.includes(pk)) return true; } }
  const pt = ["python","java","javascript","typescript","programming","algorithm","database",
    "web development","machine learning","deep learning","software","linux","rust","golang",
    "c++","coding","developer","react","angular","vue","node.js","spring","django","docker","kubernetes"];
  for (const w of pt) { if (t.includes(w)) return true; }
  return false;
}

function toPreview(doc) {
  const title = (doc.title||"").trim()||"Untitled";
  const cid = typeof doc.cover_i==="number"&&doc.cover_i>0 ? doc.cover_i : undefined;
  // workKey is the stable OL identifier; use it as the primary dedup key
  const workKey = doc.key ? (doc.key.startsWith("/works/") ? doc.key : "/works/"+doc.key) : undefined;
  return {
    provider:"open-library", externalId:doc.key||"ol-"+Math.random().toString(36).slice(2),
    title, authorNames:(doc.author_name||[]).map(a=>a.trim()).filter(Boolean),
    firstPublishYear:typeof doc.first_publish_year==="number"?doc.first_publish_year:undefined,
    isbn:(doc.isbn||[]).slice(0,5), language:(doc.language||[]),
    coverId:cid, coverUrl:cid?"https://covers.openlibrary.org/b/id/"+cid+"-M.jpg":"",
    workKey,
    editionKey:doc.cover_edition_key?"/books/"+doc.cover_edition_key:undefined,
    subjects:(doc.subject||[]).slice(0,10),
    sourceUrl:"https://openlibrary.org"+doc.key,
    externalLabel:"External", retrievalMethod:"search",
  };
}

async function importOne(repo, preview, category, existKeys) {
  const dedupKey = preview.workKey || preview.title;
  if (existKeys.has(dedupKey)) return "exist";
  try {
    const draft = createOpenLibraryImportDraft(preview, null);
    if (!draft.description && preview.subjects.length>0)
      draft.description = "Subjects: "+preview.subjects.slice(0,8).join(", ");
    const author = draft.authorNames.length>0?draft.authorNames.join(", "):null;
    const isChinese = isChineseBook({title:preview.title, language:preview.language});
    const meta = {
      chapterCount:1, provider:"open-library", externalId:preview.workKey||draft.externalId,
      sourceUrl:draft.sourceUrl, coverId:preview.coverId??null,
      coverUrl:preview.coverUrl||"", language: isChinese ? "zho" : (preview.language?.[0]||"eng"),
      firstPublishYear:preview.firstPublishYear??null,
      subjects:preview.subjects.slice(0,10), warnings:draft.warnings,
      importMethod:"ol-batch-10k", importCategory:category, category, noFullText:true,
    };
    const txt = [
      "# "+draft.title,"","Author: "+(author||"Unknown"),
      "Category: "+category,"Language: "+meta.language,
      "Published: "+(meta.firstPublishYear||"?"),"",
      "Subjects: "+preview.subjects.slice(0,10).join(", "),"",
      draft.description||"No description.","",
      "---","Open Library metadata — no full text.",
    ].join("\n");
    const r = await repo.createBookWithContent({
      title:draft.title, author, sourceType:"IMPORTED_TEXT", sourceMetadata:meta,
      chapters:[{title:"Info",orderIndex:0,level:0,plainText:txt}],
      chunks:[{chapterOrderIndex:0,orderIndex:0,plainText:txt}],
    });
    try { await repo.updateBookMetadata({bookId:r.bookId, description:(draft.description||category+" book.").slice(0,5000), tags:[category,...preview.subjects.slice(0,5)], metadata:meta}); } catch {}
    existKeys.add(dedupKey);
    return "created";
  } catch(e) { return "fail"; }
}

// ── Main ───────────────────────────────────────────────────────────

console.log("=== OL Batch Import — 10K Programming Books ===\n");
const repo = new PrismaBookRepository(getPrismaClient());
const exist = await repo.listBooks({limit:99999});

// Build dedup set from existing workKeys in metadata
const keys = new Set();
for (const b of exist) {
  const meta = b.metadata;
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const m = meta;
    // externalId stores the OL work key like "/works/OL123W"
    if (typeof m.externalId === "string" && m.externalId.startsWith("/works/")) {
      keys.add(m.externalId);
    }
  }
  // Also add title as fallback for books without workKey
  keys.add(b.title);
}
console.log("In library:", exist.length, "Unique keys:", keys.size);

if (exist.length >= 8000) { console.log("Already 8K+. Delete first."); process.exit(0); }

let cr=0, ex=0, fl=0;
for (let ci=0; ci<CATS.length; ci++) {
  const cat = CATS[ci];
  console.log("\n["+(ci+1)+"/"+CATS.length+"] "+cat.l);
  let cc = 0;
  for (const q of cat.q) {
    if (cc >= PER_CAT) break;
    for (let page=1; page<=15; page++) {
      if (cc >= PER_CAT) break;
      try {
        const data = await olFetch("https://openlibrary.org/search.json?q="+encodeURIComponent(q)+"&limit="+LIMIT+"&page="+page);
        const docs = (data.docs||[]).filter(isProg);
        if (!docs.length) continue;
        // Sort: Chinese books first, then by cover presence
        docs.sort(function(a,b) {
          var aChi = isChineseBook(a) ? 0 : 1;
          var bChi = isChineseBook(b) ? 0 : 1;
          if (aChi !== bChi) return aChi - bChi;
          var aCov = (typeof a.cover_i === "number" && a.cover_i > 0) ? 0 : 1;
          var bCov = (typeof b.cover_i === "number" && b.cover_i > 0) ? 0 : 1;
          return aCov - bCov;
        });
        for (const doc of docs) {
          if (cc >= PER_CAT) break;
          const pv = toPreview(doc);
          const r = await importOne(repo, pv, cat.k, keys);
          if (r==="created") { cc++; cr++; }
          else if (r==="exist") ex++;
          else fl++;
          if (cr%100===0) console.log("  > "+cr+" new, "+ex+" dup, "+fl+" err");
        }
        if (docs.length < LIMIT) break;
      } catch(e) { console.log("  ! "+e.message.slice(0,100)); await new Promise(r=>setTimeout(r,2000)); }
    }
  }
  console.log("  => "+cat.l+": "+cc);
}
console.log("\n=== "+cr+" created, "+ex+" dup, "+fl+" err ===");
