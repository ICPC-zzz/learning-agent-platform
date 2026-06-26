import test from "node:test";
import { ok } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var d = dirname(fileURLToPath(import.meta.url));
var src = readFileSync(resolve(d, "problem-favorites-db-actions.ts"), "utf-8");

test("exports doAddFavoriteProblem", function () { ok(src.indexOf("doAddFavoriteProblem") >= 0); });
test("exports doRemoveFavoriteProblem", function () { ok(src.indexOf("doRemoveFavoriteProblem") >= 0); });
test("exports doIsFavoriteProblem", function () { ok(src.indexOf("doIsFavoriteProblem") >= 0); });
test("uses PrismaProblemFavoriteRepository", function () {
  ok(src.indexOf("PrismaProblemFavoriteRepository") >= 0);
  ok(src.indexOf("new PrismaProblemFavoriteRepository") >= 0);
});
test("checks guard.enabled", function () { ok(src.indexOf("guard.enabled") >= 0); });
test("has writesDatabase field", function () { ok(src.indexOf("writesDatabase") >= 0); });
test("has reasonCode field", function () { ok(src.indexOf("reasonCode") >= 0); });
test("has validateFavoriteInput", function () { ok(src.indexOf("validateFavoriteInput") >= 0); });
test("has DANGEROUS_FIELD_PATTERNS", function () { ok(src.indexOf("DANGEROUS_FIELD_PATTERNS") >= 0); });
test("has mapActionError", function () { ok(src.indexOf("mapActionError") >= 0); });
test("always productionReady false", function () {
  ok(src.indexOf("productionReady: false") >= 0);
  ok(src.indexOf("productionReady: true") < 0);
});
test("always devOnly true", function () { ok(src.indexOf("devOnly: true") >= 0); });
test("has normalizeTags", function () { ok(src.indexOf("normalizeTags") >= 0); });
test("has safeDifficulty", function () { ok(src.indexOf("safeDifficulty") >= 0); });
test("no production labels", function () {
  var q = (src.match(/"([^"]*)"/g) || []).join(" ");
  ok(q.indexOf("生产收藏已保存") < 0);
  ok(q.indexOf("云端同步成功") < 0);
  ok(q.indexOf("真实判题已接入") < 0);
});
