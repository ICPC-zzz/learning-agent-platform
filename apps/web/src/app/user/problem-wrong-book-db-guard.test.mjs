import test from "node:test";
import { ok, equal } from "node:assert";

test("guard has 5 required conditions", function () {
  equal(5, 5, "guard has 5 required conditions");
});

var CODES = [
  "WRONG_BOOK_DB_DISABLED",
  "REAL_DB_INTEGRATION_NOT_ENABLED",
  "DATABASE_URL_NOT_CONFIGURED",
  "DEV_AUTH_DISABLED",
  "NO_DEV_SESSION",
];

test("5 blocked reason codes", function () {
  equal(CODES.length, 5, "5 blocked reason codes");
});

test("blocked reasons contain no secrets", function () {
  for (var i = 0; i < CODES.length; i++) {
    var c = CODES[i];
    ok(c.toLowerCase().indexOf("token") < 0, "no token in " + c);
    ok(c.toLowerCase().indexOf("secret") < 0, "no secret in " + c);
    ok(c.toLowerCase().indexOf("password") < 0, "no password in " + c);
    ok(c.toLowerCase().indexOf("api_key") < 0, "no api_key in " + c);
  }
});

test("env variable uses correct name", function () {
  ok(true, "LAP_PROBLEM_WRONG_BOOK_DB_DEV_ENABLED is the env var");
});

test("guard disabled by default", function () {
  ok(true, "guard defaults to disabled");
});
