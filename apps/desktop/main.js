const { app, BrowserWindow } = require("electron");
const path = require("path");
const {
  resolveDesktopWebTarget,
  getAllowedWebUrlFromValue,
} = require("./route-policy");
const {
  buildLocalLearningStatusPanelScript,
} = require("./local-learning-status-panel");
const {
  buildReaderSyncHealthPanelScript,
} = require("./local-reader-sync-health-panel");

const PREVIEW_DEFAULT_WEB_URL = "http://localhost:3000";
const READER_PREVIEW_ROUTE = "/reader";
const READER_PREVIEW_BOOK_ID = "reader-db-sync-verification-book";
const READER_PREVIEW_CHAPTER_ID = "sample-chapter-long-scroll";
const AGENT_PREVIEW_ROUTE = "/agent";
const AGENT_PREVIEW_MODE = "preview";
const LEARNING_PREVIEW_ROUTE = "/learning";
const DESKTOP_HOME_ACTION = "desktop-home";
const DESKTOP_BACK_ACTION = "desktop-back";
const DESKTOP_REFRESH_ACTION = "desktop-refresh";
const DESKTOP_DIAGNOSTICS_ACTION = "open-diagnostics-preview";
const NAVIGATION_SHELL_SYNC_INTERVAL_MS = 1200;
const WEB_SERVICE_PROBE_TIMEOUT_MS = 1800;
const WEB_SERVICE_STATUS_CLASSES = [
  "status-checking",
  "status-online",
  "status-offline",
  "status-error",
];
const DB_PROBE_STATUS_LABELS = Object.freeze({
  checking: "检测中",
  available: "可用",
  unavailable: "不可用",
  unconfigured: "未配置",
});
const DEFAULT_DB_PROBE_MESSAGE = "正在执行只读探活检查...";
const READER_LOCAL_STORAGE_KEY_PREFIX = "lap.reader.";
const READER_SCROLL_STORAGE_KEY_PREFIX = "learning-agent-platform:reader-scroll:";
const LEARNING_LOCAL_STORAGE_KEY_PREFIX = "lap.learning.dailyTasks.";

var shouldFocusDiagnosticsOnNextStaticLoad = false;
var staticHomeViewKind = "home";
var lastWebServiceStatusKind = "checking";
var lastBlockedExternalNavigation = false;
var dbProbeSummary = {
  statusKind: "checking",
  message: DEFAULT_DB_PROBE_MESSAGE,
};

// Desktop skeleton - no Agent, no Tool, no LLM, no DB, no network.
// Security: nodeIntegration off, contextIsolation on, sandbox on, no preload, no remote.
//
// Two loading modes:
//   Default     -> loads local static apps/desktop/index.html (no network).
//   Dev preview -> when LAP_DESKTOP_WEB_URL is set to a whitelisted
//     http://localhost:<port> or http://127.0.0.1:<port> URL, loads that
//     local Web dev server entry page for development preview only.
//     Route can be selected by LAP_DESKTOP_WEB_ROUTE in a small allow-list.

// -------------------------------------------------
// 1. Desktop launch config resolution
// -------------------------------------------------
function resolveDesktopLaunchConfigFromEnv() {
  return resolveDesktopWebTarget({
    webUrlValue: process.env.LAP_DESKTOP_WEB_URL,
    routeValue: process.env.LAP_DESKTOP_WEB_ROUTE,
    readerBookIdValue: process.env.LAP_DESKTOP_READER_BOOK_ID,
    readerChapterIdValue: process.env.LAP_DESKTOP_READER_CHAPTER_ID,
    agentModeValue: process.env.LAP_DESKTOP_AGENT_MODE,
  });
}

function logWebUrlValidation(launchConfig) {
  if (launchConfig.allowedUrl) {
    return;
  }

  if (launchConfig.allowedUrlError === "invalid_url") {
    console.warn(
      "[desktop] LAP_DESKTOP_WEB_URL is not a valid URL - falling back to static index.html"
    );
  } else if (launchConfig.allowedUrlError === "protocol") {
    console.warn(
      "[desktop] LAP_DESKTOP_WEB_URL protocol rejected (only http allowed): " + launchConfig.allowedUrlErrorDetail
    );
  } else if (launchConfig.allowedUrlError === "hostname") {
    console.warn(
      "[desktop] LAP_DESKTOP_WEB_URL hostname rejected (only localhost/127.0.0.1/[::1] allowed): " + launchConfig.allowedUrlErrorDetail
    );
  } else if (launchConfig.allowedUrlError === "credentials") {
    console.warn(
      "[desktop] LAP_DESKTOP_WEB_URL contains credentials - rejected"
    );
  } else if (launchConfig.allowedUrlError === "port") {
    console.warn(
      "[desktop] LAP_DESKTOP_WEB_URL must include an explicit port - rejected"
    );
  }
}

function logRouteValidation(launchConfig) {
  if (launchConfig.routeError === "safety_rule") {
    console.warn(
      "[desktop] LAP_DESKTOP_WEB_ROUTE rejected by safety rule - falling back to default /books"
    );
  } else if (launchConfig.routeError === "not_allowed") {
    console.warn(
      "[desktop] LAP_DESKTOP_WEB_ROUTE rejected (allowed: /books, /learning, /reader, /agent) - falling back to default /books"
    );
  }
}

function logReaderTargetValidation(launchConfig) {
  if (launchConfig.targetError === "reader_book_required") {
    console.warn(
      "[desktop] Reader route requires a valid LAP_DESKTOP_READER_BOOK_ID (pattern: [A-Za-z0-9_-]+) - falling back to /books"
    );
  } else if (launchConfig.targetError === "reader_chapter_invalid") {
    console.warn(
      "[desktop] LAP_DESKTOP_READER_CHAPTER_ID is invalid (pattern: [A-Za-z0-9_-]+) - falling back to /books"
    );
  }
}

function logAgentTargetValidation(launchConfig) {
  if (launchConfig.targetError === "agent_mode_required") {
    console.warn(
      "[desktop] Agent route requires fixed mode=preview - falling back to /books"
    );
  }
}

function logWebEntryConstruction(launchConfig) {
  if (launchConfig.targetUrlError === "construction_failed") {
    console.warn(
      "[desktop] Failed to construct safe web entry URL - falling back to static index.html"
    );
  }
}

function resolveDesktopViewKindFromLoadedUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return staticHomeViewKind;
  }

  var parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_error) {
    return "external";
  }

  if (parsed.protocol === "file:") {
    return staticHomeViewKind;
  }

  if (!currentAllowedOrigin || parsed.origin !== currentAllowedOrigin) {
    return "external";
  }

  if (parsed.pathname === READER_PREVIEW_ROUTE) {
    return "reader";
  }

  if (
    parsed.pathname === AGENT_PREVIEW_ROUTE &&
    parsed.searchParams.get("mode") === AGENT_PREVIEW_MODE
  ) {
    return "agent";
  }

  if (parsed.pathname === LEARNING_PREVIEW_ROUTE) {
    return "learning";
  }

  return "home";
}

function resolveDesktopPageStatusLabel(win) {
  if (lastBlockedExternalNavigation) {
    return "外部页面已拒绝";
  }

  var currentUrl =
    win && !win.isDestroyed() ? win.webContents.getURL() : "";
  var viewKind = resolveDesktopViewKindFromLoadedUrl(currentUrl);

  if (viewKind === "diagnostics") {
    return "系统诊断中心";
  }

  if (viewKind === "reader") {
    return "Reader";
  }

  if (viewKind === "agent") {
    return "Agent";
  }

  if (viewKind === "learning") {
    return "Learning";
  }

  if (
    viewKind === "home" &&
    (lastWebServiceStatusKind === "offline" || lastWebServiceStatusKind === "error")
  ) {
    return "Web 不可用";
  }

  return "Desktop 首页";
}

async function publishDesktopPageStatus(win, statusLabel) {
  if (!win || win.isDestroyed()) {
    return;
  }

  var safeStatusLabel =
    typeof statusLabel === "string" && statusLabel.trim().length > 0
      ? statusLabel.trim()
      : "Desktop 首页";

  var script = "(function () {" +
    "var body = document.body;" +
    "if (!body) { return false; }" +
    "var navRoot = document.getElementById('desktop-navigation-shell');" +
    "if (!navRoot) {" +
      "navRoot = document.createElement('div');" +
      "navRoot.id = 'desktop-navigation-shell';" +
      "navRoot.setAttribute('aria-live', 'polite');" +
      "var title = document.createElement('p');" +
      "title.textContent = '导航壳（开发预览）';" +
      "title.style.fontWeight = '600';" +
      "var status = document.createElement('p');" +
      "status.id = 'desktop-current-page-status';" +
      "status.style.marginTop = '6px';" +
      "var actions = document.createElement('div');" +
      "actions.style.display = 'flex';" +
      "actions.style.flexWrap = 'wrap';" +
      "actions.style.gap = '8px';" +
      "actions.style.marginTop = '8px';" +
      "var actionItems = [" +
        "{ label: '返回首页', href: 'lap://desktop-home' }," +
        "{ label: '后退', href: 'lap://desktop-back' }," +
        "{ label: '刷新当前预览', href: 'lap://desktop-refresh' }" +
      "];" +
      "for (var i = 0; i < actionItems.length; i += 1) {" +
        "var action = document.createElement('a');" +
        "action.textContent = actionItems[i].label;" +
        "action.href = actionItems[i].href;" +
        "action.style.display = 'inline-flex';" +
        "action.style.alignItems = 'center';" +
        "action.style.padding = '6px 10px';" +
        "action.style.border = '1px solid #d9dee7';" +
        "action.style.borderRadius = '8px';" +
        "action.style.color = '#1f2937';" +
        "action.style.textDecoration = 'none';" +
        "actions.appendChild(action);" +
      "}" +
      "navRoot.appendChild(title);" +
      "navRoot.appendChild(status);" +
      "navRoot.appendChild(actions);" +
      "if (body.firstChild) {" +
        "body.insertBefore(navRoot, body.firstChild);" +
      "} else {" +
        "body.appendChild(navRoot);" +
      "}" +
    "}" +
    "var statusNode = document.getElementById('desktop-current-page-status');" +
    "if (!statusNode) { return false; }" +
    "statusNode.textContent = '当前页面：' + " + JSON.stringify(safeStatusLabel) + ";" +
    "return true;" +
  "})();";

  try {
    await win.webContents.executeJavaScript(script, true);
  } catch (_error) {
    console.warn("[desktop] Failed to publish navigation shell status");
  }
}

async function publishLocalLearningStatusPanel(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  var script = buildLocalLearningStatusPanelScript({
    readerLocalStorageKeyPrefix: READER_LOCAL_STORAGE_KEY_PREFIX,
    readerScrollStorageKeyPrefix: READER_SCROLL_STORAGE_KEY_PREFIX,
    learningLocalStorageKeyPrefix: LEARNING_LOCAL_STORAGE_KEY_PREFIX,
  });

  try {
    await win.webContents.executeJavaScript(script, true);
  } catch (_error) {
    console.warn("[desktop] Failed to publish local learning status panel");
  }
}

async function publishReaderSyncHealthPanel(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  var script = buildReaderSyncHealthPanelScript();

  try {
    await win.webContents.executeJavaScript(script, true);
  } catch (_error) {
    console.warn("[desktop] Failed to publish reader sync health panel");
  }
}

function refreshDesktopPageStatus(win) {
  void publishDesktopPageStatus(win, resolveDesktopPageStatusLabel(win)).then(
    function () {
      return publishLocalLearningStatusPanel(win).then(function () {
        if (!currentAllowedOrigin) {
          return publishReaderSyncHealthPanel(win);
        }
        return null;
      });
    }
  );
}

// -------------------------------------------------
// 2. Load entry point
// -------------------------------------------------
/**
 * @param {import("electron").BrowserWindow} win
 * @param {ReturnType<typeof resolveDesktopLaunchConfigFromEnv>} launchConfig
 */
function loadDesktopEntry(win, launchConfig) {
  logWebUrlValidation(launchConfig);

  if (!launchConfig.allowedUrl) {
    console.log("[desktop] Loading static index.html (default mode)");
    win.loadFile(path.join(__dirname, "index.html"));
    return;
  }

  logRouteValidation(launchConfig);
  logReaderTargetValidation(launchConfig);
  logAgentTargetValidation(launchConfig);
  logWebEntryConstruction(launchConfig);

  if (launchConfig.targetUrl) {
    console.log(
      "[desktop] Loading local dev server entry: " + launchConfig.targetUrl +
      " (hostname=" + launchConfig.allowedUrl.hostname + ", port=" + launchConfig.allowedUrl.port + ")"
    );
    win.loadURL(launchConfig.targetUrl);
  } else {
    console.log(
      "[desktop] Web entry URL construction failed - falling back to static index.html"
    );
    win.loadFile(path.join(__dirname, "index.html"));
  }
}

function resolveReaderPreviewLaunchConfig() {
  var webUrlValue =
    typeof process.env.LAP_DESKTOP_WEB_URL === "string" &&
    process.env.LAP_DESKTOP_WEB_URL.trim().length > 0
      ? process.env.LAP_DESKTOP_WEB_URL
      : PREVIEW_DEFAULT_WEB_URL;

  return resolveDesktopWebTarget({
    webUrlValue: webUrlValue,
    routeValue: READER_PREVIEW_ROUTE,
    readerBookIdValue: READER_PREVIEW_BOOK_ID,
    readerChapterIdValue: READER_PREVIEW_CHAPTER_ID,
  });
}

function resolveAgentPreviewLaunchConfig() {
  var webUrlValue =
    typeof process.env.LAP_DESKTOP_WEB_URL === "string" &&
    process.env.LAP_DESKTOP_WEB_URL.trim().length > 0
      ? process.env.LAP_DESKTOP_WEB_URL
      : PREVIEW_DEFAULT_WEB_URL;

  return resolveDesktopWebTarget({
    webUrlValue: webUrlValue,
    routeValue: AGENT_PREVIEW_ROUTE,
    agentModeValue: AGENT_PREVIEW_MODE,
  });
}

function resolveLearningPreviewLaunchConfig() {
  var webUrlValue =
    typeof process.env.LAP_DESKTOP_WEB_URL === "string" &&
    process.env.LAP_DESKTOP_WEB_URL.trim().length > 0
      ? process.env.LAP_DESKTOP_WEB_URL
      : PREVIEW_DEFAULT_WEB_URL;

  return resolveDesktopWebTarget({
    webUrlValue: webUrlValue,
    routeValue: LEARNING_PREVIEW_ROUTE,
  });
}

/**
 * Open the fixed Reader development preview target through existing route-policy checks.
 *
 * @param {import("electron").BrowserWindow} win
 * @returns {boolean}
 */
function openReaderPreview(win) {
  var previewLaunchConfig = resolveReaderPreviewLaunchConfig();
  logWebUrlValidation(previewLaunchConfig);
  logRouteValidation(previewLaunchConfig);
  logReaderTargetValidation(previewLaunchConfig);
  logWebEntryConstruction(previewLaunchConfig);

  if (!previewLaunchConfig.allowedUrl || !previewLaunchConfig.targetUrl) {
    console.warn(
      "[desktop] Reader preview entry unavailable. Ensure local web dev server is running at " +
        PREVIEW_DEFAULT_WEB_URL
    );
    return false;
  }

  lastBlockedExternalNavigation = false;
  staticHomeViewKind = "home";
  currentAllowedOrigin = previewLaunchConfig.allowedUrl.origin;
  console.log(
    "[desktop] Opening Reader preview route: " + previewLaunchConfig.targetUrl
  );
  win.loadURL(previewLaunchConfig.targetUrl);
  return true;
}

/**
 * Open the fixed Agent development preview target through existing route-policy checks.
 *
 * @param {import("electron").BrowserWindow} win
 * @returns {boolean}
 */
function openAgentPreview(win) {
  var previewLaunchConfig = resolveAgentPreviewLaunchConfig();
  logWebUrlValidation(previewLaunchConfig);
  logRouteValidation(previewLaunchConfig);
  logAgentTargetValidation(previewLaunchConfig);
  logWebEntryConstruction(previewLaunchConfig);

  if (!previewLaunchConfig.allowedUrl || !previewLaunchConfig.targetUrl) {
    console.warn(
      "[desktop] Agent preview entry unavailable. Ensure local web dev server is running at " +
        PREVIEW_DEFAULT_WEB_URL
    );
    return false;
  }

  lastBlockedExternalNavigation = false;
  staticHomeViewKind = "home";
  currentAllowedOrigin = previewLaunchConfig.allowedUrl.origin;
  console.log(
    "[desktop] Opening Agent preview route: " + previewLaunchConfig.targetUrl
  );
  win.loadURL(previewLaunchConfig.targetUrl);
  return true;
}

/**
 * Open the fixed Learning development preview target through existing route-policy checks.
 *
 * @param {import("electron").BrowserWindow} win
 * @returns {boolean}
 */
function openLearningPreview(win) {
  var previewLaunchConfig = resolveLearningPreviewLaunchConfig();
  logWebUrlValidation(previewLaunchConfig);
  logRouteValidation(previewLaunchConfig);
  logWebEntryConstruction(previewLaunchConfig);

  if (!previewLaunchConfig.allowedUrl || !previewLaunchConfig.targetUrl) {
    console.warn(
      "[desktop] Learning preview entry unavailable. Ensure local web dev server is running at " +
        PREVIEW_DEFAULT_WEB_URL
    );
    return false;
  }

  lastBlockedExternalNavigation = false;
  staticHomeViewKind = "home";
  currentAllowedOrigin = previewLaunchConfig.allowedUrl.origin;
  console.log(
    "[desktop] Opening Learning preview route: " + previewLaunchConfig.targetUrl
  );
  win.loadURL(previewLaunchConfig.targetUrl);
  return true;
}

function openDesktopHome(win) {
  if (!win || win.isDestroyed()) {
    return false;
  }

  console.log("[desktop] Returning to Desktop static home");
  shouldFocusDiagnosticsOnNextStaticLoad = false;
  staticHomeViewKind = "home";
  lastBlockedExternalNavigation = false;
  currentAllowedOrigin = null;
  win
    .loadFile(path.join(__dirname, "index.html"))
    .catch(function () {
      console.warn("[desktop] Failed to open Desktop static home");
    });
  return true;
}

function openDesktopBack(win) {
  if (!win || win.isDestroyed()) {
    return false;
  }

  var navigationHistory = win.webContents.navigationHistory;
  var canGoBack =
    navigationHistory &&
    typeof navigationHistory.canGoBack === "function"
      ? navigationHistory.canGoBack()
      : win.webContents.canGoBack();

  if (!canGoBack) {
    console.log("[desktop] Back navigation ignored (no history entry)");
    refreshDesktopPageStatus(win);
    return true;
  }

  lastBlockedExternalNavigation = false;
  if (
    navigationHistory &&
    typeof navigationHistory.goBack === "function"
  ) {
    navigationHistory.goBack();
  } else {
    win.webContents.goBack();
  }
  return true;
}

function refreshDesktopPreview(win) {
  if (!win || win.isDestroyed()) {
    return false;
  }

  if (!win.webContents.getURL()) {
    return openDesktopHome(win);
  }

  lastBlockedExternalNavigation = false;
  win.webContents.reload();
  return true;
}

async function focusDiagnosticsPanel(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  var script = "(function () {" +
    "var panel = document.getElementById('desktop-diagnostics-panel');" +
    "if (!panel) { return false; }" +
    "panel.scrollIntoView({ behavior: 'smooth', block: 'start' });" +
    "panel.style.outline = '2px solid #0f6ccf';" +
    "setTimeout(function () { panel.style.outline = 'none'; }, 900);" +
    "return true;" +
  "})();";

  try {
    await win.webContents.executeJavaScript(script, true);
  } catch (_error) {
    console.warn("[desktop] Failed to focus diagnostics panel");
  }
}

function openDiagnosticsPreview(win) {
  if (!win || win.isDestroyed()) {
    return false;
  }

  console.log("[desktop] Opening diagnostics center (dev preview)");
  staticHomeViewKind = "diagnostics";
  lastBlockedExternalNavigation = false;
  shouldFocusDiagnosticsOnNextStaticLoad = true;

  if (currentAllowedOrigin) {
    currentAllowedOrigin = null;
    win
      .loadFile(path.join(__dirname, "index.html"))
      .catch(function () {
        console.warn("[desktop] Failed to open diagnostics center static home fallback");
      });
    return true;
  }

  void focusDiagnosticsPanel(win);
  refreshDesktopPageStatus(win);
  return true;
}

// -------------------------------------------------
// 3. Local web-service status diagnosis (static home only)
// -------------------------------------------------
var webServiceProbeSequence = 0;

function resolveWebServiceProbeTargetFromEnv() {
  var rawTarget =
    typeof process.env.LAP_DESKTOP_WEB_URL === "string" &&
    process.env.LAP_DESKTOP_WEB_URL.trim().length > 0
      ? process.env.LAP_DESKTOP_WEB_URL.trim()
      : PREVIEW_DEFAULT_WEB_URL;

  var allowedTarget = getAllowedWebUrlFromValue(rawTarget);
  if (!allowedTarget.url) {
    return {
      probeTargetOrigin: null,
      displayTarget: rawTarget,
    };
  }

  return {
    probeTargetOrigin: allowedTarget.url.origin,
    displayTarget: allowedTarget.url.origin,
  };
}

/**
 * @param {import("electron").BrowserWindow} win
 * @param {"checking"|"online"|"offline"|"error"} statusKind
 * @param {string} message
 * @param {string} displayTarget
 */
async function publishWebServiceStatus(win, statusKind, message, displayTarget) {
  if (!win || win.isDestroyed()) {
    return;
  }

  var safeStatusKind = ["checking", "online", "offline", "error"].includes(statusKind)
    ? statusKind
    : "error";
  var safeMessage =
    typeof message === "string"
      ? message
      : "检测失败，Desktop 仍可显示本地首页。";
  var safeTarget =
    typeof displayTarget === "string" && displayTarget.length > 0
      ? displayTarget
      : PREVIEW_DEFAULT_WEB_URL;
  var diagnosticsStatusLabel = {
    checking: "检测中",
    online: "在线",
    offline: "不可用",
    error: "检测失败",
  }[safeStatusKind] || "检测失败";
  lastWebServiceStatusKind = safeStatusKind;

  var script = "(function () {" +
    "var root = document.getElementById('web-service-status');" +
    "var target = document.getElementById('web-service-target');" +
    "var messageNode = document.getElementById('web-service-status-message');" +
    "if (!root || !target || !messageNode) { return false; }" +
    "var classes = " + JSON.stringify(WEB_SERVICE_STATUS_CLASSES) + ";" +
    "for (var i = 0; i < classes.length; i += 1) { root.classList.remove(classes[i]); }" +
    "root.classList.add('status-' + " + JSON.stringify(safeStatusKind) + ");" +
    "target.textContent = '检测目标：' + " + JSON.stringify(safeTarget) + ";" +
    "messageNode.textContent = " + JSON.stringify(safeMessage) + ";" +
    "var diagnosticsStatus = document.getElementById('diagnostics-web-service-status');" +
    "var diagnosticsMessage = document.getElementById('diagnostics-web-service-message');" +
    "var diagnosticsTarget = document.getElementById('diagnostics-web-service-target');" +
    "if (diagnosticsStatus) { diagnosticsStatus.textContent = " + JSON.stringify(diagnosticsStatusLabel) + "; }" +
    "if (diagnosticsMessage) { diagnosticsMessage.textContent = " + JSON.stringify(safeMessage) + "; }" +
    "if (diagnosticsTarget) { diagnosticsTarget.textContent = '检测目标：' + " + JSON.stringify(safeTarget) + "; }" +
    "return true;" +
  "})();";

  try {
    await win.webContents.executeJavaScript(script, true);
  } catch (_error) {
    console.warn("[desktop] Failed to update static home web-service status UI");
  }

  refreshDesktopPageStatus(win);
}

function getDbProbeLabel(statusKind) {
  if (statusKind in DB_PROBE_STATUS_LABELS) {
    return DB_PROBE_STATUS_LABELS[statusKind];
  }

  return DB_PROBE_STATUS_LABELS.unavailable;
}

async function publishDbProbeStatus(win) {
  if (!win || win.isDestroyed()) {
    return;
  }

  var safeStatusKind = dbProbeSummary.statusKind;
  var safeMessage =
    typeof dbProbeSummary.message === "string" && dbProbeSummary.message.length > 0
      ? dbProbeSummary.message
      : DEFAULT_DB_PROBE_MESSAGE;
  var statusLabel = getDbProbeLabel(safeStatusKind);

  var script = "(function () {" +
    "var statusNode = document.getElementById('diagnostics-db-status');" +
    "var messageNode = document.getElementById('diagnostics-db-message');" +
    "if (!statusNode || !messageNode) { return false; }" +
    "statusNode.textContent = " + JSON.stringify(statusLabel) + ";" +
    "messageNode.textContent = " + JSON.stringify(safeMessage) + ";" +
    "return true;" +
  "})();";

  try {
    await win.webContents.executeJavaScript(script, true);
  } catch (_error) {
    console.warn("[desktop] Failed to update diagnostics DB probe status UI");
  }
}

function publishDbProbeStatusToOpenWindows() {
  var windows = BrowserWindow.getAllWindows();
  for (var i = 0; i < windows.length; i += 1) {
    void publishDbProbeStatus(windows[i]);
  }
}

function setDbProbeSummary(statusKind, message) {
  dbProbeSummary = {
    statusKind: statusKind,
    message: message,
  };
  publishDbProbeStatusToOpenWindows();
}

async function probeLocalWebService(probeTargetOrigin) {
  var controller = new AbortController();
  var timeoutHandle = setTimeout(function () {
    controller.abort();
  }, WEB_SERVICE_PROBE_TIMEOUT_MS);

  try {
    var response = await fetch(probeTargetOrigin, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });

    return Boolean(response);
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

/**
 * Runs a one-shot, local-only status probe for static index.html.
 *
 * @param {import("electron").BrowserWindow} win
 */
async function runWebServiceDiagnosisForStaticHome(win) {
  var probeId = webServiceProbeSequence + 1;
  webServiceProbeSequence = probeId;

  var probeTarget = resolveWebServiceProbeTargetFromEnv();
  console.log("[desktop] Diagnosing local web-service status for " + probeTarget.displayTarget);
  await publishWebServiceStatus(
    win,
    "checking",
    "正在检测本地 Web 服务...",
    probeTarget.displayTarget
  );

  if (probeId !== webServiceProbeSequence || win.isDestroyed()) {
    return;
  }

  if (!probeTarget.probeTargetOrigin) {
    console.warn(
      "[desktop] Web-service diagnosis skipped because LAP_DESKTOP_WEB_URL is not a safe local target"
    );
    await publishWebServiceStatus(
      win,
      "error",
      "检测失败，Desktop 仍可显示本地首页。",
      probeTarget.displayTarget
    );
    console.log("[desktop] Web-service status: error");
    return;
  }

  try {
    var isOnline = await probeLocalWebService(probeTarget.probeTargetOrigin);
    if (probeId !== webServiceProbeSequence || win.isDestroyed()) {
      return;
    }

    if (isOnline) {
      await publishWebServiceStatus(
        win,
        "online",
        "Web 服务在线，Reader / Agent / Learning 入口可尝试打开。",
        probeTarget.displayTarget
      );
      console.log("[desktop] Web-service status: online");
      return;
    }

    await publishWebServiceStatus(
      win,
      "offline",
      "Web 服务不可用，请先启动 Web 开发服务。",
      probeTarget.displayTarget
    );
    console.log("[desktop] Web-service status: offline");
  } catch (_error) {
    console.warn("[desktop] Web-service diagnosis failed. Static home remains available.");
    await publishWebServiceStatus(
      win,
      "error",
      "检测失败，Desktop 仍可显示本地首页。",
      probeTarget.displayTarget
    );
    console.log("[desktop] Web-service status: error");
  }
}

// -------------------------------------------------
// 4. Navigation guard helpers
// -------------------------------------------------
var currentAllowedOrigin = null;

/**
 * Returns true when `url` is navigation-safe:
 *  - If we are in static mode, no external navigation at all.
 *  - If we are in dev-preview mode, only same-origin navigation is allowed.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isNavigationAllowed(url) {
  // Static mode: block everything
  if (!currentAllowedOrigin) {
    return false;
  }

  // Dev preview mode: only same-origin
  try {
    var parsed = new URL(url);
    return parsed.origin === currentAllowedOrigin;
  } catch (e) {
    return false;
  }
}

/**
 * Handle internal desktop actions routed through custom lap:// links.
 *
 * @param {import("electron").BrowserWindow} win
 * @param {string} url
 * @returns {boolean}
 */
function handleInternalDesktopNavigation(win, url) {
  var parsed;
  try {
    parsed = new URL(url);
  } catch (_error) {
    return false;
  }

  if (parsed.protocol !== "lap:") {
    return false;
  }

  var isRootPath = parsed.pathname === "/" || parsed.pathname === "";
  var hasNoSearchOrHash = parsed.search === "" && parsed.hash === "";

  if (!isRootPath || !hasNoSearchOrHash) {
    console.warn("[desktop] Blocked malformed internal action URL");
    return true;
  }

  if (parsed.hostname === DESKTOP_HOME_ACTION) {
    return openDesktopHome(win);
  }

  if (parsed.hostname === DESKTOP_BACK_ACTION) {
    return openDesktopBack(win);
  }

  if (parsed.hostname === DESKTOP_REFRESH_ACTION) {
    return refreshDesktopPreview(win);
  }

  if (
    parsed.hostname === "open-reader-preview"
  ) {
    return openReaderPreview(win);
  }

  if (
    parsed.hostname === "open-agent-preview"
  ) {
    return openAgentPreview(win);
  }

  if (
    parsed.hostname === "open-learning-preview"
  ) {
    return openLearningPreview(win);
  }

  if (
    parsed.hostname === DESKTOP_DIAGNOSTICS_ACTION
  ) {
    return openDiagnosticsPreview(win);
  }

  console.warn("[desktop] Blocked unknown internal action: " + parsed.hostname);
  return true;
}

// -------------------------------------------------
// 5. Create window
// -------------------------------------------------
function createWindow() {
  var win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Program Learning Desktop - Dev Preview",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      // No preload script - renderer is fully isolated.
      // No remote module, no shell, no file system access.
    },
  });

  // Set allowed origin before loading
  var launchConfig = resolveDesktopLaunchConfigFromEnv();
  currentAllowedOrigin = launchConfig.allowedUrl ? launchConfig.allowedUrl.origin : null;
  staticHomeViewKind = "home";
  lastBlockedExternalNavigation = false;
  lastWebServiceStatusKind = "checking";

  // Load the entry
  loadDesktopEntry(win, launchConfig);

  // Keep the navigation shell present on web preview pages where framework re-render can remove injected nodes.
  var navigationShellSyncTimer = setInterval(function () {
    if (!win || win.isDestroyed()) {
      clearInterval(navigationShellSyncTimer);
      return;
    }

    refreshDesktopPageStatus(win);
  }, NAVIGATION_SHELL_SYNC_INTERVAL_MS);

  win.on("closed", function () {
    clearInterval(navigationShellSyncTimer);
  });

  win.webContents.on("did-finish-load", function () {
    lastBlockedExternalNavigation = false;
    refreshDesktopPageStatus(win);

    // Only static home renders the diagnosis card.
    if (currentAllowedOrigin) {
      return;
    }

    void runWebServiceDiagnosisForStaticHome(win);
    void publishDbProbeStatus(win);
    void publishReaderSyncHealthPanel(win);

    if (shouldFocusDiagnosticsOnNextStaticLoad) {
      shouldFocusDiagnosticsOnNextStaticLoad = false;
      void focusDiagnosticsPanel(win);
    }

    refreshDesktopPageStatus(win);
  });

  // Navigation guard: prevent navigation to non-allowed URLs
  win.webContents.on("will-navigate", function (event, url) {
    if (handleInternalDesktopNavigation(win, url)) {
      event.preventDefault();
      return;
    }

    if (!isNavigationAllowed(url)) {
      // Safe log - only origin, no query/hash/full path
      var logDetail;
      try {
        logDetail = new URL(url).origin;
      } catch (e) {
        logDetail = "<unparseable>";
      }
      console.warn(
        "[desktop] Navigation blocked (not in allowed origin): " + logDetail
      );
      event.preventDefault();
      lastBlockedExternalNavigation = true;
      refreshDesktopPageStatus(win);
    }
  });

  // Prevent all new windows
  win.webContents.setWindowOpenHandler(function () {
    return { action: "deny" };
  });

  // Fallback: if loading a local dev server URL fails, revert to static
  var webLoadAttempted = false;
  win.webContents.on("did-fail-load", function (event, errorCode, errorDescription, validatedURL, isMainFrame) {
    // Only intervene for the main frame; sub-frame failures are ignored.
    if (!isMainFrame) return;
    // Ignore cancellation during route transitions (for example Next.js client-side navigation).
    if (errorCode === -3) return;
    // Avoid infinite loop - only one fallback attempt.
    if (webLoadAttempted) return;

    var target = currentAllowedOrigin
      ? currentAllowedOrigin + " (dev preview)"
      : "static index.html";

    console.warn(
      "[desktop] Main frame load failed: " + errorDescription +
      " (code=" + errorCode + ") for " + target
    );

    // If we were trying to load a dev server URL, fall back to static.
    if (currentAllowedOrigin) {
      webLoadAttempted = true;
      console.log("[desktop] Falling back to static index.html");
      staticHomeViewKind = "home";
      lastWebServiceStatusKind = "offline";
      lastBlockedExternalNavigation = false;
      currentAllowedOrigin = null;
      win.loadFile(path.join(__dirname, "index.html"));
    }
  });

  return win;
}

// -------------------------------------------------
// 6. Preview DB probe (lazy + non-blocking)
// -------------------------------------------------
async function probePreviewDatabase() {
  var disconnectPrismaClient = null;

  if (
    typeof process.env.DATABASE_URL !== "string" ||
    process.env.DATABASE_URL.trim().length === 0
  ) {
    setDbProbeSummary(
      "unconfigured",
      "未启用 DB 探活，本轮不新增数据库访问。"
    );
    console.log("[desktop] Preview DB probe skipped (DATABASE_URL is not configured)");
    return;
  }

  setDbProbeSummary("checking", DEFAULT_DB_PROBE_MESSAGE);

  try {
    var dbModule = await import("@learning-agent-platform/db");
    disconnectPrismaClient =
      dbModule && typeof dbModule.disconnectPrismaClient === "function"
        ? dbModule.disconnectPrismaClient
        : null;

    if (!dbModule || typeof dbModule.getPrismaClient !== "function") {
      console.warn("[desktop] Preview DB is unavailable; continuing with local fallback");
      setDbProbeSummary("unavailable", "只读 DB 探活不可用，保持本地预览模式。");
      return;
    }

    var prisma = dbModule.getPrismaClient();
    if (
      !prisma ||
      !prisma.readingProgress ||
      typeof prisma.readingProgress.findFirst !== "function"
    ) {
      console.warn("[desktop] Preview DB is unavailable; continuing with local fallback");
      setDbProbeSummary("unavailable", "只读 DB 探活不可用，保持本地预览模式。");
      return;
    }

    await prisma.readingProgress.findFirst({
      select: { id: true },
    });
    console.log("[desktop] Preview DB probe reachable");
    setDbProbeSummary("available", "只读 DB 探活可用（未执行写入操作）。");
  } catch (_error) {
    console.warn("[desktop] Preview DB is unavailable; continuing with local fallback");
    setDbProbeSummary("unavailable", "只读 DB 探活不可用，保持本地预览模式。");
  } finally {
    if (disconnectPrismaClient) {
      try {
        await disconnectPrismaClient();
      } catch (_disconnectError) {
        // Silent fallback only; never block desktop startup.
      }
    }
  }
}

// -------------------------------------------------
// 7. App lifecycle
// -------------------------------------------------
app.whenReady().then(function () {
  // Fire-and-forget preview DB probe.
  void probePreviewDatabase();

  createWindow();

  // macOS: re-create window when dock icon clicked and no windows open.
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except on macOS).
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
