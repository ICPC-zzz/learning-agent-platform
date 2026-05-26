const { app, BrowserWindow } = require("electron");
const path = require("path");
const { resolveDesktopWebTarget } = require("./route-policy");

const PREVIEW_DEFAULT_WEB_URL = "http://localhost:3000";
const READER_PREVIEW_ROUTE = "/reader";
const READER_PREVIEW_BOOK_ID = "reader-db-sync-verification-book";
const READER_PREVIEW_CHAPTER_ID = "sample-chapter-long-scroll";
const AGENT_PREVIEW_ROUTE = "/agent";
const AGENT_PREVIEW_MODE = "preview";

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

  currentAllowedOrigin = previewLaunchConfig.allowedUrl.origin;
  console.log(
    "[desktop] Opening Agent preview route: " + previewLaunchConfig.targetUrl
  );
  win.loadURL(previewLaunchConfig.targetUrl);
  return true;
}

// -------------------------------------------------
// 3. Navigation guard helpers
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

  if (
    parsed.hostname === "open-reader-preview" &&
    (parsed.pathname === "/" || parsed.pathname === "")
  ) {
    return openReaderPreview(win);
  }

  if (
    parsed.hostname === "open-agent-preview" &&
    (parsed.pathname === "/" || parsed.pathname === "")
  ) {
    return openAgentPreview(win);
  }

  console.warn("[desktop] Blocked unknown internal action: " + parsed.hostname);
  return true;
}

// -------------------------------------------------
// 4. Create window
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

  // Load the entry
  loadDesktopEntry(win, launchConfig);

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
      currentAllowedOrigin = null;
      win.loadFile(path.join(__dirname, "index.html"));
    }
  });

  return win;
}

// -------------------------------------------------
// 5. Preview DB probe (lazy + non-blocking)
// -------------------------------------------------
async function probePreviewDatabase() {
  var disconnectPrismaClient = null;

  try {
    var dbModule = await import("@learning-agent-platform/db");
    disconnectPrismaClient =
      dbModule && typeof dbModule.disconnectPrismaClient === "function"
        ? dbModule.disconnectPrismaClient
        : null;

    if (!dbModule || typeof dbModule.getPrismaClient !== "function") {
      console.warn("[desktop] 棰勮鏁版嵁搴撲笉鍙敤锛岀户缁湰鍦板洖閫€");
      return;
    }

    var prisma = dbModule.getPrismaClient();
    if (
      !prisma ||
      !prisma.readingProgress ||
      typeof prisma.readingProgress.findFirst !== "function"
    ) {
      console.warn("[desktop] 棰勮鏁版嵁搴撲笉鍙敤锛岀户缁湰鍦板洖閫€");
      return;
    }

    await prisma.readingProgress.findFirst({
      select: { id: true },
    });
    console.log("[desktop] 棰勮鏁版嵁搴撳彲鐢?);
  } catch (_error) {
    console.warn("[desktop] 棰勮鏁版嵁搴撲笉鍙敤锛岀户缁湰鍦板洖閫€");
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
// 6. App lifecycle
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
