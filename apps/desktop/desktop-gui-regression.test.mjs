import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import {
  isConsoleNoise,
  isLocalUrl,
  isSuspiciousRequest,
} from "./desktop-gui-security-filter.mjs";

const TEST_TIMEOUT_MS = 240_000;
const WAIT_TIMEOUT_MS = 45_000;
const POLL_INTERVAL_MS = 200;
const WEB_BASE_URL = "http://localhost:3000";
const REQUIRED_HOME_ACTIONS = [
  "lap://open-reader-preview",
  "lap://open-agent-preview",
  "lap://open-learning-preview",
  "lap://open-diagnostics-preview",
];
const REQUIRED_SHELL_ACTIONS = [
  "lap://desktop-home",
  "lap://desktop-back",
  "lap://desktop-refresh",
];
// --- SkipTestError (not in filter module — CDP-specific) ---

class SkipTestError extends Error {
  constructor(message) {
    super(message);
    this.name = "SkipTestError";
  }
}

class CdpClient {
  constructor() {
    this.ws = null;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
  }

  async connect(wsUrl) {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      const onOpen = () => {
        ws.removeEventListener("error", onError);
        resolve();
      };

      const onError = (event) => {
        ws.removeEventListener("open", onOpen);
        reject(new Error(`CDP websocket connect failed: ${String(event?.message ?? "unknown error")}`));
      };

      ws.addEventListener("open", onOpen, { once: true });
      ws.addEventListener("error", onError, { once: true });
      ws.addEventListener("message", (event) => {
        this.#handleMessage(event.data);
      });
      ws.addEventListener("close", () => {
        const pendingEntries = Array.from(this.pending.values());
        this.pending.clear();
        for (const pending of pendingEntries) {
          pending.reject(new Error("CDP websocket closed"));
        }
      });
    });
  }

  on(method, handler) {
    const existing = this.handlers.get(method) ?? [];
    existing.push(handler);
    this.handlers.set(method, existing);
  }

  async send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("CDP websocket is not open");
    }

    const id = ++this.nextId;
    const payload = { id, method, params };
    const responsePromise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    this.ws.send(JSON.stringify(payload));
    const response = await responsePromise;

    if (response.error) {
      throw new Error(
        `${method} failed: ${response.error.message ?? "unknown error"}`
      );
    }

    return response.result ?? {};
  }

  async close() {
    if (!this.ws) {
      return;
    }

    const ws = this.ws;
    this.ws = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }

  #handleMessage(data) {
    let parsed = null;
    try {
      parsed = JSON.parse(String(data));
    } catch (_error) {
      return;
    }

    if (typeof parsed.id === "number") {
      const pending = this.pending.get(parsed.id);
      if (!pending) {
        return;
      }

      this.pending.delete(parsed.id);
      pending.resolve(parsed);
      return;
    }

    if (!parsed.method) {
      return;
    }

    const methodHandlers = this.handlers.get(parsed.method);
    if (!methodHandlers) {
      return;
    }

    for (const handler of methodHandlers) {
      try {
        handler(parsed.params ?? {});
      } catch (_error) {
        // Ignore handler exceptions to avoid blocking the test event loop.
      }
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createTimeoutController(ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, ms);
  return { controller, timeoutId };
}

function getRepoRootDir() {
  const currentFile = fileURLToPath(import.meta.url);
  const desktopDir = path.dirname(currentFile);
  return path.resolve(desktopDir, "..", "..");
}

function getElectronBinary(repoRoot) {
  return process.platform === "win32"
    ? path.join(repoRoot, "node_modules", ".bin", "electron.cmd")
    : path.join(repoRoot, "node_modules", ".bin", "electron");
}

function spawnCrossPlatformCommand(command, options) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", command], options);
  }

  return spawn("sh", ["-lc", command], options);
}

function killProcessTree(pid) {
  if (!pid) {
    return;
  }

  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
      });
      return;
    }

    process.kill(pid, "SIGTERM");
  } catch (_error) {
    // Ignore cleanup failures in test teardown.
  }
}

async function isHttpReachable(url, timeoutMs = 2_000) {
  const { controller, timeoutId } = createTimeoutController(timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.status >= 200 && response.status < 600;
  } catch (_error) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function waitForHttpReachable(url, timeoutMs = WAIT_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isHttpReachable(url)) {
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for reachable URL: ${url}`);
}

function captureChildOutput(proc, bucket) {
  if (proc.stdout) {
    proc.stdout.on("data", (chunk) => {
      bucket.push(String(chunk));
      trimOutputBucket(bucket);
    });
  }

  if (proc.stderr) {
    proc.stderr.on("data", (chunk) => {
      bucket.push(String(chunk));
      trimOutputBucket(bucket);
    });
  }
}

function trimOutputBucket(bucket) {
  const maxLines = 120;
  if (bucket.length > maxLines) {
    bucket.splice(0, bucket.length - maxLines);
  }
}

function renderOutputTail(bucket) {
  return bucket.join("").trim();
}

async function ensureWebServerForPreview(t, repoRoot) {
  const alreadyOnline = await isHttpReachable(WEB_BASE_URL, 2_000);
  if (alreadyOnline) {
    return { ownedProcess: null, reusedExisting: true };
  }

  const output = [];
  const child = spawnCrossPlatformCommand(
    "npm -w @learning-agent-platform/web run dev -- -p 3000",
    {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  captureChildOutput(child, output);
  t.after(() => {
    killProcessTree(child.pid);
  });

  try {
    await waitForHttpReachable(WEB_BASE_URL, 120_000);
    return { ownedProcess: child, reusedExisting: false };
  } catch (_error) {
    child.kill();
    throw new SkipTestError(
      `无法启动本地 Web 开发服务（${WEB_BASE_URL}）。请先确认 GUI/CDP 环境与 Next dev 可用。输出尾部：${renderOutputTail(output)}`
    );
  }
}

async function getFreePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve free port")));
        return;
      }

      const freePort = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(freePort);
      });
    });
    server.on("error", reject);
  });
}

async function waitForCdpTarget(cdpPort, timeoutMs = WAIT_TIMEOUT_MS) {
  const targetListUrl = `http://127.0.0.1:${cdpPort}/json/list`;
  const startedAt = Date.now();
  let fallbackTarget = null;

  while (Date.now() - startedAt < timeoutMs) {
    const { controller, timeoutId } = createTimeoutController(2_000);
    try {
      const response = await fetch(targetListUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const targets = await response.json();
      if (Array.isArray(targets)) {
        const pageTargets = targets.filter(
          (target) =>
            target?.type === "page" &&
            typeof target?.webSocketDebuggerUrl === "string"
        );
        if (pageTargets.length > 0 && !fallbackTarget) {
          fallbackTarget = pageTargets[0];
        }
        const pageTarget = pageTargets.find((target) => {
          const url = String(target?.url ?? "");
          return url.length > 0 && url !== "about:blank" && !url.startsWith("devtools://");
        });
        if (pageTarget?.webSocketDebuggerUrl) {
          return pageTarget.webSocketDebuggerUrl;
        }
      }
    } catch (_error) {
      // Keep polling until timeout.
    } finally {
      clearTimeout(timeoutId);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  if (fallbackTarget?.webSocketDebuggerUrl) {
    return fallbackTarget.webSocketDebuggerUrl;
  }

  throw new Error(`Timed out waiting for Electron CDP target on port ${cdpPort}`);
}

async function launchElectronPreview(t, repoRoot, options) {
  const {
    cdpPort,
    webUrl,
  } = options;
  const electronBinary = getElectronBinary(repoRoot);
  const output = [];
  const desktopEntry = path.join("apps", "desktop");
  const env = {
    ...process.env,
  };
  if (typeof webUrl === "string" && webUrl.trim().length > 0) {
    env.LAP_DESKTOP_WEB_URL = webUrl;
  } else {
    delete env.LAP_DESKTOP_WEB_URL;
  }
  const electronCommand =
    process.platform === "win32"
      ? `${electronBinary} ${desktopEntry} --remote-debugging-port=${cdpPort}`
      : `"${electronBinary}" ${desktopEntry} --remote-debugging-port=${cdpPort}`;
  const child = spawnCrossPlatformCommand(electronCommand, {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  captureChildOutput(child, output);
  t.after(() => {
    killProcessTree(child.pid);
  });

  // Platform-aware GUI availability check.
  // Linux: requires DISPLAY or WAYLAND_DISPLAY.
  // Windows/macOS: Electron will attempt window creation; if it fails,
  // the CDP polling below will time out and throw SkipTestError.
  // We do NOT check process.env.DISPLAY on non-Linux because Windows
  // and macOS use native windowing systems that don't set DISPLAY.
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    child.kill();
    throw new SkipTestError(
      "当前 Linux 环境缺少图形显示（DISPLAY/WAYLAND_DISPLAY），跳过 Desktop GUI 回归。"
    );
  }

  let cdpWsUrl = null;
  try {
    cdpWsUrl = await waitForCdpTarget(cdpPort, WAIT_TIMEOUT_MS);
  } catch (error) {
    if (!child.killed) {
      child.kill();
    }
    throw new SkipTestError(
      `Electron/CDP 启动不可用，跳过 GUI 回归。原因：${error.message}。输出尾部：${renderOutputTail(output)}`
    );
  }

  const client = new CdpClient();
  await client.connect(cdpWsUrl);
  t.after(async () => {
    await client.close();
  });

  return { child, client, output };
}

async function evaluateValue(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return result?.result?.value;
}

async function waitForCondition(client, description, expression, timeoutMs = WAIT_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const passed = await evaluateValue(client, expression);
      if (passed) {
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Inspected target navigated or closed")) {
        throw error;
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Timed out waiting for condition: ${description}`);
}

async function getPageSnapshot(client) {
  return await evaluateValue(
    client,
    `(function () {
      var shell = document.getElementById("desktop-navigation-shell");
      var statusNode = document.getElementById("desktop-current-page-status");
      var readerSyncPanel = document.getElementById("desktop-reader-sync-health-panel");
      var readerSyncSummary = document.getElementById("desktop-reader-sync-health-summary");
      var fixedEntries = Array.from(document.querySelectorAll(".entry-action[href^='lap://']")).map(function (node) {
        return node.getAttribute("href");
      });
      var shellActions = shell
        ? Array.from(shell.querySelectorAll("a[href]")).map(function (node) {
            return node.getAttribute("href");
          })
        : [];
      return {
        href: location.href,
        hasShell: Boolean(shell),
        statusText: statusNode ? statusNode.textContent.trim() : "",
        hasReaderSyncPanel: Boolean(readerSyncPanel),
        readerSyncSummaryText: readerSyncSummary ? readerSyncSummary.textContent.trim() : "",
        fixedEntries: fixedEntries,
        shellActions: shellActions
      };
    })();`
  );
}

async function clickLapAction(client, href) {
  try {
    const clicked = await evaluateValue(
      client,
      `(function () {
        var targetHref = ${JSON.stringify(href)};
        var links = Array.from(document.querySelectorAll("a[href]"));
        for (var i = 0; i < links.length; i += 1) {
          if (links[i].getAttribute("href") === targetHref) {
            links[i].click();
            return true;
          }
        }
        return false;
      })();`
    );

    assert.equal(clicked, true, `expected clickable action ${href}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // The click triggered a navigation that closed the CDP execution context
    // before the evaluate response could return. The click DID happen — the
    // page just navigated away. This is expected CDP behavior for lap:// links
    // that cause Electron to switch between file:// and http:// contexts.
    if (message.includes("Inspected target navigated or closed")) {
      return;
    }
    throw error;
  }
}

function createSecurityCollector(webUrl) {
  const allowedOrigin = new URL(webUrl).origin;
  const securityState = {
    consoleErrors: [],
    runtimeExceptions: [],
    suspiciousRequests: [],
    blockedRequests: [],
  };

  // Thin wrappers that bind the collector's allowedOrigin to the
  // imported filter functions (A279: extracted for unit-testability).
  function localUrlCheck(rawUrl) {
    return isLocalUrl(rawUrl, allowedOrigin);
  }

  function suspiciousCheck(url, method) {
    return isSuspiciousRequest(url, method, allowedOrigin);
  }

  return {
    state: securityState,
    handleConsole(params) {
      if (params.type === "error") {
        const renderedArgs = Array.isArray(params.args)
          ? params.args.map((arg) => arg?.value ?? arg?.description ?? "").join(" ")
          : "";
        const trimmed = renderedArgs.trim();
        // Filter out Next.js / React / webpack dev-mode noise that is
        // NOT an application error. Real runtime errors are still captured.
        if (!isConsoleNoise(trimmed)) {
          securityState.consoleErrors.push(trimmed);
        }
      }
    },
    handleRuntimeException(params) {
      const description =
        params?.exceptionDetails?.exception?.description ??
        params?.exceptionDetails?.text ??
        "Runtime exception";
      // Filter out dev-infrastructure exceptions (e.g. Next.js overlay
      // stack-frame resolution failures). Real runtime exceptions are
      // still captured.
      if (!isConsoleNoise(description)) {
        securityState.runtimeExceptions.push(description);
      }
    },
    handleLogEntry(params) {
      const entry = params?.entry;
      if (entry && entry.level === "error") {
        const text = String(entry.text ?? "").trim();
        // Filter out dev-infrastructure noise (same policy as console errors).
        if (!isConsoleNoise(text)) {
          securityState.consoleErrors.push(text);
        }
      }
    },
    handleRequest(params) {
      const request = params?.request ?? {};
      const url = String(request.url ?? "");
      const method = String(request.method ?? "GET");
      if (!localUrlCheck(url)) {
        securityState.blockedRequests.push(`${method} ${url}`);
      }
      if (suspiciousCheck(url, method)) {
        securityState.suspiciousRequests.push(`${method} ${url}`);
      }
    },
  };
}

async function assertShellAndEntriesOnHome(client) {
  await waitForCondition(
    client,
    "reader sync health panel should be present on desktop home",
    "(function () { return Boolean(document.getElementById('desktop-reader-sync-health-panel')) && Boolean(document.getElementById('desktop-reader-sync-health-summary')); })();"
  );
  const snapshot = await getPageSnapshot(client);
  assert.equal(snapshot.hasShell, true, "desktop navigation shell should exist");
  assert.equal(snapshot.hasReaderSyncPanel, true, "desktop home should include reader sync health panel");
  assert.equal(
    snapshot.readerSyncSummaryText.includes("开发预览"),
    true,
    "reader sync health panel should stay preview-only"
  );
  assert.equal(
    snapshot.readerSyncSummaryText.includes("真实同步未连接"),
    true,
    "reader sync health panel should expose the read-only status"
  );
  for (const action of REQUIRED_SHELL_ACTIONS) {
    assert.equal(
      snapshot.shellActions.includes(action),
      true,
      `shell should include ${action}`
    );
  }
  for (const action of REQUIRED_HOME_ACTIONS) {
    assert.equal(
      snapshot.fixedEntries.includes(action),
      true,
      `home should include fixed entry ${action}`
    );
  }
}

async function clickLearningReaderLink(client) {
  const clickedResult = await evaluateValue(
    client,
    `(function () {
      var links = Array.from(document.querySelectorAll("a[href]"));
      for (var i = 0; i < links.length; i += 1) {
        var href = links[i].getAttribute("href");
        if (!href) {
          continue;
        }

        var resolved;
        try {
          resolved = new URL(href, location.href);
        } catch (_error) {
          continue;
        }

        if (
          resolved.origin === location.origin &&
          resolved.pathname === "/reader" &&
          resolved.searchParams.get("bookId") &&
          resolved.searchParams.get("chapterId")
        ) {
          links[i].click();
          return { clicked: true, href: resolved.toString() };
        }
      }

      return { clicked: false, href: null };
    })();`
  );

  assert.equal(clickedResult?.clicked, true, "expected a Learning -> Reader link");
}

async function waitForPathname(client, pathname) {
  await waitForCondition(
    client,
    `pathname should be ${pathname}`,
    `(function () {
      try {
        return new URL(location.href).pathname === ${JSON.stringify(pathname)};
      } catch (_error) {
        return false;
      }
    })();`
  );
}

async function waitForStatusContains(client, expected) {
  await waitForCondition(
    client,
    `status should include ${expected}`,
    `(function () {
      var node = document.getElementById("desktop-current-page-status");
      if (!node) {
        return false;
      }
      return String(node.textContent || "").includes(${JSON.stringify(expected)});
    })();`
  );
}

async function runOnlineRegressionFlow(client, securityCollector) {
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Network.enable");
  await client.send("Log.enable");

  client.on("Runtime.consoleAPICalled", (params) => {
    securityCollector.handleConsole(params);
  });
  client.on("Runtime.exceptionThrown", (params) => {
    securityCollector.handleRuntimeException(params);
  });
  client.on("Log.entryAdded", (params) => {
    securityCollector.handleLogEntry(params);
  });
  client.on("Network.requestWillBeSent", (params) => {
    securityCollector.handleRequest(params);
  });

  await waitForCondition(
    client,
    "desktop static home should load",
    "(function () { try { return new URL(location.href).protocol === 'file:'; } catch (_error) { return false; } })();"
  );
  await assertShellAndEntriesOnHome(client);

  await clickLapAction(client, "lap://open-reader-preview");
  await waitForPathname(client, "/reader");
  await waitForStatusContains(client, "Reader");

  await clickLapAction(client, "lap://desktop-home");
  await waitForCondition(
    client,
    "return to static home",
    "(function () { try { return new URL(location.href).protocol === 'file:'; } catch (_error) { return false; } })();"
  );
  await assertShellAndEntriesOnHome(client);

  await clickLapAction(client, "lap://open-agent-preview");
  await waitForCondition(
    client,
    "open fixed agent preview route",
    "(function () { try { var parsed = new URL(location.href); return parsed.pathname === '/agent' && parsed.searchParams.get('mode') === 'preview'; } catch (_error) { return false; } })();"
  );
  await waitForStatusContains(client, "Agent");

  await clickLapAction(client, "lap://desktop-back");
  await waitForCondition(
    client,
    "go back to static home",
    "(function () { try { return new URL(location.href).protocol === 'file:'; } catch (_error) { return false; } })();"
  );
  await waitForStatusContains(client, "Desktop 首页");

  await clickLapAction(client, "lap://open-learning-preview");
  await waitForPathname(client, "/learning");
  await waitForStatusContains(client, "Learning");

  await clickLearningReaderLink(client);
  await waitForPathname(client, "/reader");
  await waitForStatusContains(client, "Reader");

  await clickLapAction(client, "lap://desktop-back");
  await waitForPathname(client, "/learning");
  await waitForStatusContains(client, "Learning");

  const beforeRefreshUrl = await evaluateValue(client, "location.href");
  await clickLapAction(client, "lap://desktop-refresh");
  await waitForCondition(
    client,
    "refresh keeps preview route",
    `(function () { return location.href === ${JSON.stringify(beforeRefreshUrl)}; })();`
  );
  await waitForStatusContains(client, "Learning");

  await clickLapAction(client, "lap://desktop-home");
  await waitForCondition(
    client,
    "back to static home before diagnostics",
    "(function () { try { return new URL(location.href).protocol === 'file:'; } catch (_error) { return false; } })();"
  );
  await assertShellAndEntriesOnHome(client);

  await clickLapAction(client, "lap://open-diagnostics-preview");
  await waitForStatusContains(client, "系统诊断中心");
  const diagnosticsState = await getPageSnapshot(client);
  assert.equal(diagnosticsState.hasShell, true, "diagnostics page should keep shell");

  await clickLapAction(client, "lap://desktop-home");
  await waitForCondition(
    client,
    "diagnostics can return home",
    "(function () { try { return new URL(location.href).protocol === 'file:'; } catch (_error) { return false; } })();"
  );
  await assertShellAndEntriesOnHome(client);
}

function assertSecurityCollectorState(securityCollector) {
  const state = securityCollector.state;
  assert.deepEqual(
    state.blockedRequests,
    [],
    `unexpected external request(s): ${state.blockedRequests.join(" | ")}`
  );
  assert.deepEqual(
    state.suspiciousRequests,
    [],
    `unexpected sensitive request(s): ${state.suspiciousRequests.join(" | ")}`
  );
  assert.deepEqual(
    state.consoleErrors,
    [],
    `unexpected console error(s): ${state.consoleErrors.join(" | ")}`
  );
  assert.deepEqual(
    state.runtimeExceptions,
    [],
    `unexpected runtime exception(s): ${state.runtimeExceptions.join(" | ")}`
  );
}

test(
  "desktop GUI regression (online preview): fixed entries, shell actions, learning->reader flow, and safety guard",
  { timeout: TEST_TIMEOUT_MS },
  async (t) => {
    const repoRoot = getRepoRootDir();
    const webServer = await ensureWebServerForPreview(t, repoRoot);
    if (webServer.ownedProcess) {
      t.after(() => {
        if (!webServer.ownedProcess.killed) {
          webServer.ownedProcess.kill();
        }
      });
    }

    const cdpPort = await getFreePort();
    let launched = null;
    try {
      launched = await launchElectronPreview(t, repoRoot, {
        cdpPort,
        webUrl: "",
      });
    } catch (error) {
      if (error instanceof SkipTestError) {
        t.skip(error.message);
        return;
      }
      throw error;
    }

    const securityCollector = createSecurityCollector(WEB_BASE_URL);
    await runOnlineRegressionFlow(launched.client, securityCollector);
    assertSecurityCollectorState(securityCollector);
  }
);

test(
  "desktop GUI regression (offline fallback): no blank screen and shell remains available",
  { timeout: TEST_TIMEOUT_MS },
  async (t) => {
    const repoRoot = getRepoRootDir();
    const cdpPort = await getFreePort();
    const offlinePort = await getFreePort();
    const offlineWebUrl = `http://localhost:${offlinePort}`;

    let launched = null;
    try {
      launched = await launchElectronPreview(t, repoRoot, {
        cdpPort,
        webUrl: offlineWebUrl,
      });
    } catch (error) {
      if (error instanceof SkipTestError) {
        t.skip(error.message);
        return;
      }
      throw error;
    }

    await launched.client.send("Page.enable");
    await launched.client.send("Runtime.enable");

    await waitForCondition(
      launched.client,
      "fallback returns to static home",
      "(function () { try { return new URL(location.href).protocol === 'file:'; } catch (_error) { return false; } })();"
    );
    await waitForStatusContains(launched.client, "Web 不可用");
    await assertShellAndEntriesOnHome(launched.client);

    const fallbackSnapshot = await getPageSnapshot(launched.client);
    assert.equal(
      fallbackSnapshot.statusText.includes("Web 不可用"),
      true,
      "fallback status should stay visible on shell"
    );
  }
);
