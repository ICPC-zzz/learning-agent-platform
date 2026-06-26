import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mod = require("./local-reader-auth-session-preview-panel.js");
const AUTH_SESSION_STORAGE_KEY = mod.AUTH_SESSION_STORAGE_KEY;
const SAFE_AUTH_SESSION_COPY = mod.SAFE_AUTH_SESSION_COPY;
const maskServerUserIdPreview = mod.maskServerUserIdPreview;
const resolveAuthSourceLabel = mod.resolveAuthSourceLabel;
const resolveSessionStatusLabel = mod.resolveSessionStatusLabel;
const normalizeAuthSessionPreviewRecord = mod.normalizeAuthSessionPreviewRecord;
const readAuthSessionPreviewFromStorage = mod.readAuthSessionPreviewFromStorage;
const buildLocalReaderAuthSessionPreviewPanelScript = mod.buildLocalReaderAuthSessionPreviewPanelScript;

// --- maskServerUserIdPreview ---

test("maskServerUserIdPreview: masks long userId", () => {
  assert.equal(maskServerUserIdPreview("usr_abc123xyz"), "usr***（预览掩码）");
});

test("maskServerUserIdPreview: masks short userId", () => {
  assert.equal(maskServerUserIdPreview("ab"), "***（预览掩码）");
});

test("maskServerUserIdPreview: handles empty/whitespace", () => {
  assert.equal(maskServerUserIdPreview(""), "未提供（预览掩码）");
  assert.equal(maskServerUserIdPreview("   "), "未提供（预览掩码）");
});

// --- resolveAuthSourceLabel ---

test("resolveAuthSourceLabel: resolves known sources", () => {
  assert.equal(resolveAuthSourceLabel("blocked-by-default"), "默认阻断（blocked-by-default）");
  assert.equal(resolveAuthSourceLabel("trusted-server-context"), "可信服务端上下文（仅本地预览）");
  assert.equal(resolveAuthSourceLabel("local-mock"), "本地 mock");
  assert.equal(resolveAuthSourceLabel("preview"), "预览");
});

test("resolveAuthSourceLabel: passes through unknown", () => {
  assert.equal(resolveAuthSourceLabel("custom-source"), "custom-source");
});

// --- resolveSessionStatusLabel ---

test("resolveSessionStatusLabel: resolves known statuses", () => {
  assert.equal(resolveSessionStatusLabel("blocked"), "已阻断");
  assert.equal(resolveSessionStatusLabel("preview"), "预览");
  assert.equal(resolveSessionStatusLabel("ready"), "就绪（仅本地预览）");
  assert.equal(resolveSessionStatusLabel("unavailable"), "不可用");
});

// --- normalizeAuthSessionPreviewRecord ---

test("normalizeAuthSessionPreviewRecord: returns null for non-record", () => {
  assert.equal(normalizeAuthSessionPreviewRecord(null), null);
  assert.equal(normalizeAuthSessionPreviewRecord("string"), null);
  assert.equal(normalizeAuthSessionPreviewRecord(42), null);
  assert.equal(normalizeAuthSessionPreviewRecord([]), null);
});

test("normalizeAuthSessionPreviewRecord: blocks when safeToExposeToClient is false", () => {
  var r = normalizeAuthSessionPreviewRecord({ authenticated: true, safeToExposeToClient: false });
  assert.equal(r.sk, "blocked");
  assert.ok(r.bs.includes("safeToExposeToClient=false"));
});

test("normalizeAuthSessionPreviewRecord: shows safe fields for valid data", () => {
  var r = normalizeAuthSessionPreviewRecord({
    authenticated: false, authReady: false, serverTrusted: false,
    serverUserIdPreview: null, authSource: "blocked-by-default",
    sessionStatus: "blocked", blockedReasons: ["REASON_1", "REASON_2"],
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.equal(r.sk, "ready");
  assert.equal(r.at, "false");
  assert.equal(r.art, "false");
  assert.equal(r.stt, "false");
  assert.equal(r.uid, "未提供（预览掩码）");
  assert.equal(r.stx, "默认阻断（blocked-by-default）");
  assert.equal(r.sst, "已阻断");
  assert.ok(r.brt.includes("REASON_1"));
  assert.equal(r.pot, "true");
});

test("normalizeAuthSessionPreviewRecord: masks serverUserIdPreview", () => {
  var r = normalizeAuthSessionPreviewRecord({
    authenticated: true, serverTrusted: true,
    serverUserIdPreview: "user_real_id_12345",
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.equal(r.sk, "ready");
  assert.ok(r.uid.includes("***"));
  assert.equal(r.uid.includes("user_real_id_12345"), false);
});

test("normalizeAuthSessionPreviewRecord: warns when authenticated=true", () => {
  var r = normalizeAuthSessionPreviewRecord({
    authenticated: true, serverTrusted: true,
    serverUserIdPreview: "user_abc",
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.equal(r.sk, "ready");
  assert.ok(r.swt.includes("仅本地 mock 字段，不代表真实登录已接入"));
});

test("normalizeAuthSessionPreviewRecord: security warning when authenticated=true but serverTrusted=false", () => {
  var r = normalizeAuthSessionPreviewRecord({
    authenticated: true, serverTrusted: false,
    serverUserIdPreview: "user_abc",
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.equal(r.sk, "ready");
  assert.ok(r.swt.includes("authenticated=true 但 serverTrusted=false"));
  assert.ok(r.swt.includes("不代表真实服务端信任"));
});

test("normalizeAuthSessionPreviewRecord: handles blockedReasons not array", () => {
  var r = normalizeAuthSessionPreviewRecord({
    authenticated: false, serverTrusted: false,
    blockedReasons: "not-an-array",
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.equal(r.brt, "（类型错误）");
});

test("normalizeAuthSessionPreviewRecord: handles writesDatabase and callsRepository anomaly", () => {
  var r = normalizeAuthSessionPreviewRecord({
    authenticated: false, serverTrusted: false,
    writesDatabase: true, callsRepository: true,
    previewOnly: true, safeToExposeToClient: true,
  });
  assert.ok(r.swt.includes("writesDatabase=true"));
  assert.ok(r.swt.includes("callsRepository=true"));
});

// --- Mock safe storage for filtering test ---

test("normalizeAuthSessionPreviewRecord: filters danger fields via safe storage", () => {
  var mockFilter = {
    collectHits: function (value) {
      var h = [];
      if (value && typeof value === "object") {
        Object.keys(value).forEach(function(k) {
          if (k === "token" || k === "jwt" || k === "sessionToken") h.push(k);
        });
      }
      return h;
    },
    sanitize: function (value) { return value; },
  };
  var r = normalizeAuthSessionPreviewRecord({
    authenticated: false, serverTrusted: false,
    token: "secret-should-not-appear",
    jwt: "eyJhbGci.should.be.hidden",
    sessionToken: "session-secret-hide",
    previewOnly: true, safeToExposeToClient: true,
  }, mockFilter);
  assert.equal(r.ft, "已过滤敏感字段");
  assert.equal(r.sk, "ready");
});

// --- readAuthSessionPreviewFromStorage ---

test("readAuthSessionPreviewFromStorage: no key returns empty state", () => {
  var s = { getItem: function () { return null; } };
  var r = readAuthSessionPreviewFromStorage(s);
  assert.equal(r.sk, "empty");
  assert.equal(r.st, "暂无本地 Auth Session 预览");
  assert.equal(r.rc, null);
});

test("readAuthSessionPreviewFromStorage: bad JSON returns degraded", () => {
  var s = { getItem: function (k) { return k === AUTH_SESSION_STORAGE_KEY ? "{bad json!!" : null; } };
  var r = readAuthSessionPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.ok(r.ht.includes("JSON 不可解析"));
});

test("readAuthSessionPreviewFromStorage: non-object JSON returns degraded", () => {
  var s = { getItem: function (k) { return k === AUTH_SESSION_STORAGE_KEY ? JSON.stringify("x") : null; } };
  var r = readAuthSessionPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
});

test("readAuthSessionPreviewFromStorage: valid mock data is parsed", () => {
  var d = { authenticated: false, authReady: false, serverTrusted: false,
    serverUserIdPreview: null, authSource: "blocked-by-default",
    sessionStatus: "blocked", blockedReasons: ["DEFAULT_BLOCKED"],
    previewOnly: true, safeToExposeToClient: true };
  var s = { getItem: function (k) { return k === AUTH_SESSION_STORAGE_KEY ? JSON.stringify(d) : null; } };
  var r = readAuthSessionPreviewFromStorage(s);
  assert.equal(r.sk, "ready");
  assert.equal(r.rc.sk, "ready");
  assert.equal(r.rc.at, "false");
  assert.equal(r.rc.stx, "默认阻断（blocked-by-default）");
});

test("readAuthSessionPreviewFromStorage: safeToExposeToClient=false blocks display", () => {
  var d = { authenticated: true, serverTrusted: true, serverUserIdPreview: "user_12345",
    previewOnly: true, safeToExposeToClient: false };
  var s = { getItem: function (k) { return k === AUTH_SESSION_STORAGE_KEY ? JSON.stringify(d) : null; } };
  var r = readAuthSessionPreviewFromStorage(s);
  assert.equal(r.sk, "degraded");
  assert.equal(r.rc, null);
  assert.ok(r.ht.includes("safeToExposeToClient=false"));
});

test("readAuthSessionPreviewFromStorage: unavailable storage", () => {
  assert.equal(readAuthSessionPreviewFromStorage(null).sk, "unavailable");
});

test("readAuthSessionPreviewFromStorage: storage without getItem", () => {
  assert.equal(readAuthSessionPreviewFromStorage({}).sk, "unavailable");
});

// --- SAFE_AUTH_SESSION_COPY text checks ---

test("SAFE_AUTH_SESSION_COPY contains required text", () => {
  assert.ok(SAFE_AUTH_SESSION_COPY.includes("开发预览"));
  assert.ok(SAFE_AUTH_SESSION_COPY.includes("只读"));
  assert.ok(SAFE_AUTH_SESSION_COPY.includes("真实 auth 未连接"));
  assert.ok(SAFE_AUTH_SESSION_COPY.includes("真实 session 未注入"));
  assert.ok(SAFE_AUTH_SESSION_COPY.includes("生产默认 blocked"));
  assert.ok(SAFE_AUTH_SESSION_COPY.includes("不会写入数据库"));
  assert.ok(SAFE_AUTH_SESSION_COPY.includes("不会调用 repository"));
});

// --- Forbidden misleading text ---

test("snapshot text never contains misleading phrases", () => {
  var d = { authenticated: true, serverTrusted: true, serverUserIdPreview: "user_xyz",
    previewOnly: true, safeToExposeToClient: true };
  var s = { getItem: function (k) { return k === AUTH_SESSION_STORAGE_KEY ? JSON.stringify(d) : null; } };
  var r = readAuthSessionPreviewFromStorage(s);
  var allText = JSON.stringify(r);
  var forbidden = ["登录成功", "真实 auth 已接入", "真实 session 已注入", "生产可用", "已写入数据库", "已调用 repository"];
  for (var i = 0; i < forbidden.length; i++) {
    assert.equal(allText.includes(forbidden[i]), false, 'must not contain "' + forbidden[i] + '"');
  }
});

// --- buildLocalReaderAuthSessionPreviewPanelScript ---

test("buildLocalReaderAuthSessionPreviewPanelScript: returns string with required content", () => {
  var s = buildLocalReaderAuthSessionPreviewPanelScript();
  assert.equal(typeof s, "string");
  assert.ok(s.length > 500);
  assert.ok(s.includes("Reader Auth Session（本地预览）"));
  assert.ok(s.includes("刷新本地 Auth 预览"));
  assert.ok(s.includes("desktop-reader-auth-session-preview-panel"));
  assert.ok(s.includes("开发预览"));
  assert.ok(s.includes("真实 auth 未连接"));
});

// --- Refresh button does not write ---

test("refresh button script does not contain setItem calls", () => {
  var s = buildLocalReaderAuthSessionPreviewPanelScript();
  assert.equal(s.includes("setItem"), false);
});

// --- AUTH_SESSION_STORAGE_KEY ---

test("AUTH_SESSION_STORAGE_KEY is correct", () => {
  assert.equal(AUTH_SESSION_STORAGE_KEY, "lap.reader.authSession.preview");
});
