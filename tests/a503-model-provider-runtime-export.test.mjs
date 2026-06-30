import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dbRoot = await import("../packages/db/src/index.ts");
const modelProviderModule = await import("../packages/db/src/repositories/model-provider-repository.ts");

test("PrismaModelProviderRepository is a runtime class from the db root export", () => {
  assert.equal(typeof dbRoot.PrismaModelProviderRepository, "function");
  assert.equal(
    dbRoot.PrismaModelProviderRepository,
    modelProviderModule.PrismaModelProviderRepository,
  );

  const instance = new dbRoot.PrismaModelProviderRepository({});
  assert.ok(instance instanceof modelProviderModule.PrismaModelProviderRepository);
});

test("model provider repository source keeps credential reads server-safe", () => {
  const source = readFileSync(
    new URL("../packages/db/src/repositories/model-provider-repository.ts", import.meta.url),
    "utf8",
  );

  assert.ok(source.includes("export class PrismaModelProviderRepository"));
  assert.ok(source.includes("getCredential(providerId"));
  assert.ok(source.includes("encryptedPayload"));
  assert.ok(source.includes("authTag"));
  assert.ok(source.includes("maskedHintsJson"));
  assert.equal(source.includes("as unknown as"), false);
});

test("db package exposes model provider repository root and subpath entries", () => {
  const packageJson = JSON.parse(
    readFileSync(new URL("../packages/db/package.json", import.meta.url), "utf8"),
  );

  assert.ok(packageJson.exports["."]);
  assert.equal(
    packageJson.exports["./repositories/model-provider-repository"].import,
    "./dist/repositories/model-provider-repository.js",
  );
});

test("model configuration action imports the runtime repository value", () => {
  const source = readFileSync(
    new URL("../apps/web/src/app/agent/models/model-config-actions.ts", import.meta.url),
    "utf8",
  );

  assert.ok(source.includes("PrismaModelProviderRepository"));
  assert.ok(source.includes("new PrismaModelProviderRepository(prisma)"));
  assert.equal(source.includes("import type { getPrismaClient, PrismaModelProviderRepository"), false);
});
