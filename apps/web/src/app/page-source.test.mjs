import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("home page imports the login entry and authenticated shell", function () {
  const filePath = fileURLToPath(new URL("./page.tsx", import.meta.url));
  const source = fs.readFileSync(filePath, "utf8");

  assert.equal(source.includes("HomeLoginEntry"), true);
  assert.equal(source.includes("AuthenticatedHome"), true);
  assert.equal(source.includes("hasSession"), true);
  assert.equal(source.includes("books"), false);
});
