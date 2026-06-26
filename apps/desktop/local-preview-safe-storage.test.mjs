import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  SENSITIVE_FIELD_PATTERNS,
  isSensitiveFieldName,
  collectSensitiveFieldHits,
  sanitizeSensitiveFields,
  safeReadLocalStorage,
} = require("./local-preview-safe-storage.js");

// --- isSensitiveFieldName ---

test("isSensitiveFieldName: detects all known danger field patterns", () => {
  const dangerFields = ["token","accessToken","refreshToken","cookie","session","authorization","apiKey","secret","DATABASE_URL","rawRequest","rawBody","rawHeaders","rawDbRecord","rawUserId","password"];
  for (const field of dangerFields) {
    assert.equal(isSensitiveFieldName(field), true, `should flag ${field}`);
  }
});

test("isSensitiveFieldName: allows safe fields", () => {
  const safeFields = ["bookId","chapterId","eventType","status","reasonCode","source","previewOnly","gateStatus","authReady","canAccessBook","canWriteProgress","blockedReasons","warnings","summary"];
  for (const field of safeFields) {
    assert.equal(isSensitiveFieldName(field), false, `should allow ${field}`);
  }
});

test("isSensitiveFieldName: case-insensitive and delimiter-insensitive", () => {
  assert.equal(isSensitiveFieldName("TOKEN"), true);
  assert.equal(isSensitiveFieldName("ApiKey"), true);
  assert.equal(isSensitiveFieldName("api_key"), true);
  assert.equal(isSensitiveFieldName("DATABASE_URL"), true);
  assert.equal(isSensitiveFieldName("raw-request"), true);
});

test("collectSensitiveFieldHits: returns empty for safe object", () => {
  const hits = collectSensitiveFieldHits({bookId:"book-001",chapterId:"chapter-010",status:"preview"});
  assert.equal(hits.length, 0);
});

test("collectSensitiveFieldHits: detects top-level danger fields", () => {
  const hits = collectSensitiveFieldHits({token:"secret-value",apiKey:"key-value",bookId:"book-001"});
  assert.equal(hits.length, 2);
  assert.equal(hits.includes("token"), true);
  assert.equal(hits.includes("apiKey"), true);
});

test("collectSensitiveFieldHits: detects nested danger fields", () => {
  const hits = collectSensitiveFieldHits({bookId:"book-001",meta:{token:"nested-secret",settings:{apiKey:"deep-secret"}},events:[{session:"event-session",status:"ok"}]});
  assert.equal(hits.length >= 3, true);
  assert.equal(hits.includes("meta.token"), true);
  assert.equal(hits.includes("meta.settings.apiKey"), true);
  assert.equal(hits.includes("events.0.session"), true);
});

test("collectSensitiveFieldHits: handles arrays", () => {
  const hits = collectSensitiveFieldHits([{token:"secret-1",id:1},{token:"secret-2",id:2}]);
  assert.equal(hits.length, 2);
});

test("collectSensitiveFieldHits: handles non-record/non-array gracefully", () => {
  assert.equal(collectSensitiveFieldHits("string").length, 0);
  assert.equal(collectSensitiveFieldHits(42).length, 0);
  assert.equal(collectSensitiveFieldHits(null).length, 0);
});

test("sanitizeSensitiveFields: replaces danger field values", () => {
  const s = sanitizeSensitiveFields({bookId:"book-001",token:"s",apiKey:"k"});
  assert.equal(s.bookId, "book-001");
  assert.equal(s.token, "[已过滤敏感字段]");
  assert.equal(s.apiKey, "[已过滤敏感字段]");
});

test("sanitizeSensitiveFields: handles nested danger fields", () => {
  const s = sanitizeSensitiveFields({bookId:"b",meta:{token:"n",settings:{apiKey:"d",count:5}}});
  assert.equal(s.bookId, "b");
  assert.equal(s.meta.token, "[已过滤敏感字段]");
  assert.equal(s.meta.settings.apiKey, "[已过滤敏感字段]");
  assert.equal(s.meta.settings.count, 5);
});

test("sanitizeSensitiveFields: handles arrays", () => {
  const s = sanitizeSensitiveFields([{token:"s1",id:1},{token:"s2",id:2}]);
  assert.equal(s[0].token, "[已过滤敏感字段]");
  assert.equal(s[0].id, 1);
});

test("safeReadLocalStorage: no key returns empty state", () => {
  const r = safeReadLocalStorage({getItem(_k){return null;}}, "k");
  assert.equal(r.stateKind, "empty");
});

test("safeReadLocalStorage: bad JSON returns safe error", () => {
  const r = safeReadLocalStorage({getItem(k){return k==="bad"?"{x":null;}}, "bad");
  assert.equal(r.stateKind, "bad_json");
});

test("safeReadLocalStorage: danger fields are detected and counted", () => {
  const d = JSON.stringify({bookId:"b",token:"t",accessToken:"a",cookie:"c",rawRequest:{body:"p"}});
  const r = safeReadLocalStorage({getItem(k){return k==="d"?d:null;}}, "d");
  assert.equal(r.stateKind, "ready");
  assert.equal(r.sensitiveFieldsFiltered, true);
  assert.equal(r.filteredFieldCount >= 3, true);
});

test("safeReadLocalStorage: handles nested danger fields", () => {
  const d = JSON.stringify({bookId:"b",config:{apiKey:"n",settings:{secret:"d",password:"p"}}});
  const r = safeReadLocalStorage({getItem(k){return k==="n"?d:null;}}, "n");
  assert.equal(r.stateKind, "ready");
  assert.equal(r.sensitiveFieldsFiltered, true);
});

test("safeReadLocalStorage: handles unavailable storage", () => {
  const r = safeReadLocalStorage(null, "k");
  assert.equal(r.stateKind, "unavailable");
});

test("safeReadLocalStorage: handles storage without getItem", () => {
  const r = safeReadLocalStorage({}, "k");
  assert.equal(r.stateKind, "unavailable");
});

test("safeReadLocalStorage: handles non-object/non-array parsed JSON", () => {
  const r = safeReadLocalStorage({getItem(k){return k==="s"?JSON.stringify("x"):null;}}, "s");
  assert.equal(r.stateKind, "ready");
  assert.equal(r.parsedValue, "x");
});

test("safeReadLocalStorage: does NOT write to localStorage", () => {
  const c = {setItem:0,getItem:0};
  safeReadLocalStorage({getItem(_k){c.getItem+=1;return null;},setItem(_k,_v){c.setItem+=1;}}, "k");
  assert.equal(c.setItem, 0, "should never write to localStorage");
});

test("isSensitiveFieldName: detects A367 new patterns fullIdempotencyKey and rawPayload", () => {
  assert.equal(isSensitiveFieldName("fullIdempotencyKey"), true);
  assert.equal(isSensitiveFieldName("full_idempotency_key"), true);
  assert.equal(isSensitiveFieldName("rawPayload"), true);
  assert.equal(isSensitiveFieldName("raw_payload"), true);
});

test("collectSensitiveFieldHits: detects fullIdempotencyKey and rawPayload", () => {
  const hits = collectSensitiveFieldHits({bookId:"b",fullIdempotencyKey:"x",rawPayload:{data:"y"},status:"p"});
  assert.equal(hits.length >= 2, true);
});

test("sanitizeSensitiveFields: replaces fullIdempotencyKey and rawPayload", () => {
  const s = sanitizeSensitiveFields({bookId:"b",fullIdempotencyKey:"x",rawPayload:{data:"y"},status:"p"});
  assert.equal(s.bookId, "b");
  assert.equal(s.fullIdempotencyKey, "[已过滤敏感字段]");
  assert.equal(s.rawPayload, "[已过滤敏感字段]");
});

test("isSensitiveFieldName: detects jwt and sessionToken patterns (A368)", () => {
  assert.equal(isSensitiveFieldName("jwt"), true);
  assert.equal(isSensitiveFieldName("JWT"), true);
  assert.equal(isSensitiveFieldName("jwt_token"), true);
  assert.equal(isSensitiveFieldName("sessionToken"), true);
  assert.equal(isSensitiveFieldName("idToken"), true);
});

test("collectSensitiveFieldHits: detects jwt in nested objects (A368)", () => {
  const hits = collectSensitiveFieldHits({bookId:"b",auth:{jwt:"eyJ...",sessionToken:"st",idToken:"id"},status:"p"});
  assert.equal(hits.length >= 3, true);
  assert.equal(hits.includes("auth.jwt"), true);
  assert.equal(hits.includes("auth.sessionToken"), true);
  assert.equal(hits.includes("auth.idToken"), true);
});

test("sanitizeSensitiveFields: replaces jwt, sessionToken, and idToken (A368)", () => {
  const s = sanitizeSensitiveFields({bookId:"b",jwt:"eyJ...",sessionToken:"st",idToken:"id",status:"p"});
  assert.equal(s.bookId, "b");
  assert.equal(s.jwt, "[已过滤敏感字段]");
  assert.equal(s.sessionToken, "[已过滤敏感字段]");
  assert.equal(s.idToken, "[已过滤敏感字段]");
  assert.equal(s.status, "p");
});

test("isSensitiveFieldName: detects repository, prisma, and connectionString (A369)", () => {
  assert.equal(isSensitiveFieldName("repository"), true);
  assert.equal(isSensitiveFieldName("prisma"), true);
  assert.equal(isSensitiveFieldName("connectionString"), true);
  assert.equal(isSensitiveFieldName("connection_string"), true);
  assert.equal(isSensitiveFieldName("ConnectionString"), true);
});

test("collectSensitiveFieldHits: detects repository, prisma, and connectionString in nested objects (A369)", () => {
  const hits = collectSensitiveFieldHits({bookId:"b",config:{repository:{type:"pg"},prisma:{url:"x"},connectionString:"postgres://..."},status:"p"});
  assert.equal(hits.length >= 3, true);
  assert.equal(hits.includes("config.repository"), true);
  assert.equal(hits.includes("config.prisma"), true);
  assert.equal(hits.includes("config.connectionString"), true);
});

test("sanitizeSensitiveFields: replaces repository, prisma, and connectionString (A369)", () => {
  const s = sanitizeSensitiveFields({bookId:"b",repository:"pg-obj",prisma:"client-obj",connectionString:"url",status:"p"});
  assert.equal(s.bookId, "b");
  assert.equal(s.repository, "[已过滤敏感字段]");
  assert.equal(s.prisma, "[已过滤敏感字段]");
  assert.equal(s.connectionString, "[已过滤敏感字段]");
  assert.equal(s.status, "p");
});
