import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mod = require("./local-reader-service-contract-preview-panel.js");
const SERVICE_CONTRACT_STORAGE_KEY = mod.SERVICE_CONTRACT_STORAGE_KEY;
const SAFE_SERVICE_CONTRACT_COPY = mod.SAFE_SERVICE_CONTRACT_COPY;
const resolveStatusLabel = mod.resolveStatusLabel;
const normalizeServiceContractRecord = mod.normalizeServiceContractRecord;
const readServiceContractPreviewFromStorage = mod.readServiceContractPreviewFromStorage;
const buildLocalReaderServiceContractPreviewPanelScript = mod.buildLocalReaderServiceContractPreviewPanelScript;

test("resolveStatusLabel: resolves known statuses", () => {
  assert.equal(resolveStatusLabel("blocked"), "已阻断");
  assert.equal(resolveStatusLabel("ready_preview"), "预览就绪（本地预览）");
  assert.equal(resolveStatusLabel("preview"), "预览");
});

test("resolveStatusLabel: passes through unknown", () => {
  assert.equal(resolveStatusLabel("custom"), "custom");
});

test("normalizeServiceContractRecord: returns null for non-record", () => {
  assert.equal(normalizeServiceContractRecord(null), null);
  assert.equal(normalizeServiceContractRecord("string"), null);
  assert.equal(normalizeServiceContractRecord(42), null);
  assert.equal(normalizeServiceContractRecord([]), null);
});

test("normalizeServiceContractRecord: blocks when safeToExposeToClient is false", () => {
  var r = normalizeServiceContractRecord({ authReady: true, safeToExposeToClient: false });
  assert.equal(r.sk, "blocked");
  assert.ok(r.bs.includes("safeToExposeToClient=false"));
});

test("normalizeServiceContractRecord: shows safe fields for valid blocked data", () => {
  var r = normalizeServiceContractRecord({
    authReady: false, serverTrusted: false, permissionGateReady: false,
    idempotencyKeyReady: false, idempotencyConflictClear: false,
    auditReady: false, writePreflightReady: false,
    repositoryWriteAllowed: false, productionWriteReady: false,
    implemented: false, previewOnly: true, writesDatabase: false,
    callsRepository: false, safeToExposeToClient: true,
    status: "blocked", blockedReasons: ["AUTH_READY_REQUIRED"],
    summary: "contract is blocked", warnings: ["preview warning"],
  });
  assert.equal(r.sk, "ready");
  assert.equal(r.authReadyText, "false");
  assert.equal(r.serverTrustedText, "false");
  assert.equal(r.permissionGateReadyText, "false");
  assert.equal(r.idempotencyKeyReadyText, "false");
  assert.equal(r.idempotencyConflictClearText, "false");
  assert.equal(r.auditReadyText, "false");
  assert.equal(r.writePreflightReadyText, "false");
  assert.equal(r.repositoryWriteAllowedText, "false");
  assert.equal(r.productionWriteReadyText, "false");
  assert.equal(r.implementedText, "false");
  assert.equal(r.statusText, "已阻断");
  assert.ok(r.blockedReasonsText.includes("AUTH_READY_REQUIRED"));
  assert.equal(r.summaryText, "contract is blocked");
  assert.ok(r.warningsText.includes("preview warning"));
});

test("normalizeServiceContractRecord: repositoryWriteAllowed=true shows mock warning", () => {
  var r = normalizeServiceContractRecord({
    authReady: true, serverTrusted: true,
    repositoryWriteAllowed: true,
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.ok(r.repositoryWriteAllowedText.includes("仅本地 mock"));
  assert.ok(r.repositoryWriteAllowedText.includes("不代表真实 service/repository"));
  assert.equal(r.hasSafetyWarnings, true);
  assert.ok(r.safetyWarningsText.includes("repositoryWriteAllowed=true"));
});

test("normalizeServiceContractRecord: productionWriteReady=true shows mock warning", () => {
  var r = normalizeServiceContractRecord({
    authReady: true, serverTrusted: true,
    productionWriteReady: true,
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.ok(r.productionWriteReadyText.includes("仅本地 mock"));
  assert.ok(r.productionWriteReadyText.includes("不代表生产写入"));
  assert.equal(r.hasSafetyWarnings, true);
  assert.ok(r.safetyWarningsText.includes("productionWriteReady=true"));
});

test("normalizeServiceContractRecord: writesDatabase=true shows safety warning", () => {
  var r = normalizeServiceContractRecord({
    authReady: true, serverTrusted: true,
    writesDatabase: true,
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.ok(r.writesDatabaseText.includes("真实写入未启用"));
  assert.equal(r.hasSafetyWarnings, true);
  assert.ok(r.safetyWarningsText.includes("writesDatabase=true"));
});

test("normalizeServiceContractRecord: callsRepository=true shows safety warning", () => {
  var r = normalizeServiceContractRecord({
    authReady: true, serverTrusted: true,
    callsRepository: true,
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.ok(r.callsRepositoryText.includes("真实 repository 未调用"));
  assert.equal(r.hasSafetyWarnings, true);
  assert.ok(r.safetyWarningsText.includes("callsRepository=true"));
});

test("normalizeServiceContractRecord: implemented=true shows safety warning", () => {
  var r = normalizeServiceContractRecord({
    authReady: true, serverTrusted: true,
    implemented: true,
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.ok(r.implementedText.includes("真实 service 未连接"));
  assert.equal(r.hasSafetyWarnings, true);
  assert.ok(r.safetyWarningsText.includes("implemented=true"));
});

test("readServiceContractPreviewFromStorage: no key returns empty state", () => {
  var s = { getItem: function () { return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "empty");
  assert.equal(r.st, "暂无本地 Service Contract 预览");
  assert.equal(r.rc, null);
});

test("readServiceContractPreviewFromStorage: bad JSON returns degraded", () => {
  var bad = "{bad json!!";
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return bad; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.ok(r.ht.includes("JSON 不可解析"));
});

test("readServiceContractPreviewFromStorage: non-object JSON returns degraded", () => {
  var raw = JSON.stringify("x");
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
});

test("readServiceContractPreviewFromStorage: valid mock data is parsed", () => {
  var d = {
    authReady: false, serverTrusted: false, permissionGateReady: false,
    idempotencyKeyReady: false, idempotencyConflictClear: false,
    auditReady: false, writePreflightReady: false,
    repositoryWriteAllowed: false, productionWriteReady: false,
    implemented: false, previewOnly: true, writesDatabase: false,
    callsRepository: false, safeToExposeToClient: true,
    status: "blocked", blockedReasons: ["AUTH_READY_REQUIRED"],
    summary: "blocked contract", warnings: ["preview warning"],
  };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "ready");
  assert.equal(r.rc.sk, "ready");
  assert.equal(r.rc.authReadyText, "false");
  assert.equal(r.rc.statusText, "已阻断");
});

test("readServiceContractPreviewFromStorage: safeToExposeToClient=false blocks", () => {
  var d = { authReady: true, serverTrusted: true, previewOnly: true, safeToExposeToClient: false };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.equal(r.rc, null);
  assert.ok(r.ht.includes("safeToExposeToClient=false"));
});

test("readServiceContractPreviewFromStorage: repositoryWriteAllowed=true warns", () => {
  var d = { authReady: true, serverTrusted: true, repositoryWriteAllowed: true, previewOnly: true, safeToExposeToClient: true };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.equal(r.rc.hasSafetyWarnings, true);
  assert.ok(r.rc.safetyWarningsText.includes("repositoryWriteAllowed=true"));
  assert.ok(r.rc.safetyWarningsText.includes("不代表真实 service/repository"));
});

test("readServiceContractPreviewFromStorage: productionWriteReady=true warns", () => {
  var d = { authReady: true, serverTrusted: true, productionWriteReady: true, previewOnly: true, safeToExposeToClient: true };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.ok(r.rc.safetyWarningsText.includes("productionWriteReady=true"));
  assert.ok(r.rc.safetyWarningsText.includes("不代表生产写入"));
});

test("readServiceContractPreviewFromStorage: writesDatabase=true warns", () => {
  var d = { authReady: true, serverTrusted: true, writesDatabase: true, previewOnly: true, safeToExposeToClient: true };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.ok(r.rc.safetyWarningsText.includes("writesDatabase=true"));
  assert.ok(r.rc.safetyWarningsText.includes("真实写入仍未启用"));
});

test("readServiceContractPreviewFromStorage: callsRepository=true warns", () => {
  var d = { authReady: true, serverTrusted: true, callsRepository: true, previewOnly: true, safeToExposeToClient: true };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.ok(r.rc.safetyWarningsText.includes("callsRepository=true"));
  assert.ok(r.rc.safetyWarningsText.includes("真实 repository 未被调用"));
});

test("readServiceContractPreviewFromStorage: implemented=true warns", () => {
  var d = { authReady: true, serverTrusted: true, implemented: true, previewOnly: true, safeToExposeToClient: true };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.ok(r.rc.safetyWarningsText.includes("implemented=true"));
  assert.ok(r.rc.safetyWarningsText.includes("真实 service 未连接"));
});

test("normalizeServiceContractRecord: filters danger fields via safe storage", () => {
  var mockFilter = {
    collectHits: function (value) {
      var h = [];
      if (value && typeof value === "object") {
        Object.keys(value).forEach(function (k) {
          if (k === "token" || k === "jwt" || k === "secret" || k === "connectionString") h.push(k);
        });
      }
      return h;
    },
    sanitize: function (value) { return value; },
  };
  var r = normalizeServiceContractRecord({
    authReady: false, serverTrusted: false,
    token: "secret-should-not-appear",
    jwt: "eyJhbGci.should.be.hidden",
    secret: "s3cr3t",
    connectionString: "postgres://user:pass@localhost/db",
    previewOnly: true, safeToExposeToClient: true,
  }, mockFilter);
  assert.equal(r.filteredText, "已过滤敏感字段");
  assert.equal(r.sk, "ready");
});

test("readServiceContractPreviewFromStorage: unavailable storage", () => {
  assert.equal(readServiceContractPreviewFromStorage(null).sk, "unavailable");
});

test("readServiceContractPreviewFromStorage: storage without getItem", () => {
  assert.equal(readServiceContractPreviewFromStorage({}).sk, "unavailable");
});

test("SAFE_SERVICE_CONTRACT_COPY contains required text", () => {
  assert.ok(SAFE_SERVICE_CONTRACT_COPY.includes("开发预览"));
  assert.ok(SAFE_SERVICE_CONTRACT_COPY.includes("只读"));
  assert.ok(SAFE_SERVICE_CONTRACT_COPY.includes("真实 service 未连接"));
  assert.ok(SAFE_SERVICE_CONTRACT_COPY.includes("真实 repository 未调用"));
  assert.ok(SAFE_SERVICE_CONTRACT_COPY.includes("生产默认 blocked"));
  assert.ok(SAFE_SERVICE_CONTRACT_COPY.includes("不会写入数据库"));
  assert.ok(SAFE_SERVICE_CONTRACT_COPY.includes("不会调用 repository"));
});

test("snapshot text never contains misleading phrases", () => {
  var d = {
    authReady: true, serverTrusted: true, permissionGateReady: true,
    idempotencyKeyReady: true, idempotencyConflictClear: true,
    auditReady: true, writePreflightReady: true,
    repositoryWriteAllowed: false, productionWriteReady: false,
    implemented: false, previewOnly: true, writesDatabase: false,
    callsRepository: false, safeToExposeToClient: true,
    status: "ready_preview", blockedReasons: [],
    summary: "contract ready in preview", warnings: [],
  };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  var allText = JSON.stringify(r);
  var forbidden = ["服务已启用","repository 已接入","生产可用","已写入数据库","同步成功","真实 service 已连接"];
  for (var i = 0; i < forbidden.length; i++) {
    assert.equal(allText.includes(forbidden[i]), false, 'must not contain "' + forbidden[i] + '"');
  }
});

test("buildLocalReaderServiceContractPreviewPanelScript: returns string with required content", () => {
  var s = buildLocalReaderServiceContractPreviewPanelScript();
  assert.equal(typeof s, "string");
  assert.ok(s.length > 500);
  assert.ok(s.includes("Reader Sync Service Contract"));
  assert.ok(s.includes("刷新本地 Service Contract 预览"));
  assert.ok(s.includes("desktop-reader-service-contract-preview-panel"));
  assert.ok(s.includes("开发预览"));
  assert.ok(s.includes("真实 service 未连接"));
  assert.ok(s.includes("生产默认 blocked"));
});

test("refresh button script does not contain setItem calls", () => {
  var s = buildLocalReaderServiceContractPreviewPanelScript();
  assert.equal(s.includes("setItem"), false);
});

test("SERVICE_CONTRACT_STORAGE_KEY is correct", () => {
  assert.equal(SERVICE_CONTRACT_STORAGE_KEY, "lap.reader.serviceContract.preview");
});

test("normalizeServiceContractRecord: handles blockedReasons not array", () => {
  var r = normalizeServiceContractRecord({
    authReady: false, serverTrusted: false,
    blockedReasons: "not-an-array",
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.equal(r.blockedReasonsText, "（类型错误）");
});

test("readServiceContractPreviewFromStorage: handles empty blockedReasons array", () => {
  var d = { authReady: false, serverTrusted: false, blockedReasons: [], previewOnly: true, safeToExposeToClient: true };
  var raw = JSON.stringify(d);
  var s = { getItem: function (k) { if (k === SERVICE_CONTRACT_STORAGE_KEY) return raw; return null; } };
  var r = readServiceContractPreviewFromStorage(s);
  assert.equal(r.sk, "ready");
  assert.equal(r.rc.blockedReasonsText, "（空数组）");
});
