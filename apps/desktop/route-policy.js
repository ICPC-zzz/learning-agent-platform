const ALLOWED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const DEFAULT_WEB_ROUTE = "/books";
const READER_ROUTE = "/reader";
const AGENT_ROUTE = "/agent";
const AGENT_PREVIEW_MODE = "preview";
const ALLOWED_WEB_ROUTES = new Set([
  DEFAULT_WEB_ROUTE,
  "/learning",
  READER_ROUTE,
  AGENT_ROUTE,
]);
const SAFE_READER_PARAM_PATTERN = /^[A-Za-z0-9_-]+$/;
const ROUTE_BASENAME_TO_ALLOWED_ROUTE = Object.freeze({
  books: "/books",
  learning: "/learning",
  reader: "/reader",
  agent: "/agent",
});

function tryNormalizeConvertedAllowedRoute(route) {
  var windowsLikePathPattern =
    /^[A-Za-z]:\/(?:[^\\?#\s/]+\/)*(books|learning|reader|agent)$/;
  var match = route.match(windowsLikePathPattern);
  if (!match) {
    return null;
  }

  var basename = match[1];
  if (!basename) {
    return null;
  }

  var normalized = ROUTE_BASENAME_TO_ALLOWED_ROUTE[basename];
  if (!normalized) {
    return null;
  }

  return normalized;
}

function getAllowedWebUrlFromValue(value) {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    return { url: null, error: null };
  }

  var parsed;
  try {
    parsed = new URL(value.trim());
  } catch (e) {
    return { url: null, error: "invalid_url" };
  }

  if (parsed.protocol !== "http:") {
    return { url: null, error: "protocol", detail: parsed.protocol };
  }

  if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
    return { url: null, error: "hostname", detail: parsed.hostname };
  }

  if (parsed.username || parsed.password) {
    return { url: null, error: "credentials" };
  }

  if (!parsed.port) {
    return { url: null, error: "port" };
  }

  return { url: parsed, error: null };
}

function getAllowedWebRouteFromValue(value) {
  if (!value || typeof value !== "string") {
    return { route: DEFAULT_WEB_ROUTE, error: null };
  }

  var route = value.trim();
  if (route.length === 0) {
    return { route: DEFAULT_WEB_ROUTE, error: null };
  }

  if (value !== route) {
    return { route: DEFAULT_WEB_ROUTE, error: "safety_rule" };
  }

  var hasWhitespace = /\s/.test(route);
  var hasBackslash = route.includes("\\");
  var hasQuery = route.includes("?");
  var hasHash = route.includes("#");
  var hasDoubleSlash = route.startsWith("//");
  var hasSchemePrefix = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(route);

  if (hasWhitespace || hasBackslash || hasQuery || hasHash || hasDoubleSlash || hasSchemePrefix) {
    var normalizedConvertedRoute = tryNormalizeConvertedAllowedRoute(route);
    if (normalizedConvertedRoute) {
      return { route: normalizedConvertedRoute, error: null };
    }

    return { route: DEFAULT_WEB_ROUTE, error: "safety_rule" };
  }

  if (!ALLOWED_WEB_ROUTES.has(route)) {
    return { route: DEFAULT_WEB_ROUTE, error: "not_allowed" };
  }

  return { route: route, error: null };
}

function validateReaderParam(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  if (value !== value.trim()) {
    return null;
  }

  var trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (!SAFE_READER_PARAM_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function buildReaderTarget(route, readerParams) {
  if (route !== READER_ROUTE) {
    return { target: route, targetError: null };
  }

  var paramsInput = readerParams || {};
  var bookId = validateReaderParam(paramsInput.bookId);
  if (bookId === undefined || bookId === null) {
    return { target: DEFAULT_WEB_ROUTE, targetError: "reader_book_required" };
  }

  var chapterId = validateReaderParam(paramsInput.chapterId);
  if (chapterId === null) {
    return { target: DEFAULT_WEB_ROUTE, targetError: "reader_chapter_invalid" };
  }

  var params = new URLSearchParams();
  params.set("bookId", bookId);

  if (chapterId !== undefined) {
    params.set("chapterId", chapterId);
  }

  return { target: READER_ROUTE + "?" + params.toString(), targetError: null };
}

function buildAgentTarget(route, agentModeValue) {
  if (route !== AGENT_ROUTE) {
    return { target: route, targetError: null };
  }

  if (agentModeValue !== AGENT_PREVIEW_MODE) {
    return { target: DEFAULT_WEB_ROUTE, targetError: "agent_mode_required" };
  }

  return { target: AGENT_ROUTE + "?mode=" + AGENT_PREVIEW_MODE, targetError: null };
}

function isSafeReaderSearchParams(searchParams) {
  var allowedKeys = new Set(["bookId", "chapterId"]);

  for (const [key, value] of searchParams.entries()) {
    if (!allowedKeys.has(key)) {
      return false;
    }

    if (!SAFE_READER_PARAM_PATTERN.test(value)) {
      return false;
    }
  }

  var bookValues = searchParams.getAll("bookId");
  var chapterValues = searchParams.getAll("chapterId");

  if (bookValues.length !== 1) {
    return false;
  }

  if (chapterValues.length > 1) {
    return false;
  }

  return true;
}

function isSafeAgentSearchParams(searchParams) {
  var allowedKeys = new Set(["mode"]);

  for (const [key, value] of searchParams.entries()) {
    if (!allowedKeys.has(key)) {
      return false;
    }

    if (key === "mode" && value !== AGENT_PREVIEW_MODE) {
      return false;
    }
  }

  var modeValues = searchParams.getAll("mode");
  return modeValues.length === 1;
}

function buildWebEntryUrl(allowedWebUrl, route, readerParams, agentModeValue) {
  var targetResult = buildReaderTarget(route, readerParams);
  if (targetResult.target === route && route === AGENT_ROUTE) {
    targetResult = buildAgentTarget(route, agentModeValue);
  }

  try {
    var entryUrl = allowedWebUrl.origin + targetResult.target;
    var parsed = new URL(entryUrl);

    if (parsed.origin !== allowedWebUrl.origin || parsed.hash) {
      return { url: null, error: "construction_invalid", targetError: targetResult.targetError };
    }

    if (parsed.pathname === READER_ROUTE) {
      if (!isSafeReaderSearchParams(parsed.searchParams)) {
        return { url: null, error: "reader_search_invalid", targetError: targetResult.targetError };
      }
    } else if (parsed.pathname === AGENT_ROUTE) {
      if (!isSafeAgentSearchParams(parsed.searchParams)) {
        return { url: null, error: "agent_search_invalid", targetError: targetResult.targetError };
      }
    } else if (parsed.search || !ALLOWED_WEB_ROUTES.has(parsed.pathname) || parsed.pathname === READER_ROUTE) {
      return { url: null, error: "route_invalid", targetError: targetResult.targetError };
    }

    return { url: parsed.toString(), error: null, targetError: targetResult.targetError };
  } catch (e) {
    return { url: null, error: "construction_failed", targetError: targetResult.targetError };
  }
}

function resolveDesktopWebTarget(input) {
  var values = input || {};
  var allowedUrlResult = getAllowedWebUrlFromValue(values.webUrlValue);
  var routeResult = getAllowedWebRouteFromValue(values.routeValue);
  var isAllowedUrl = Boolean(allowedUrlResult.url);
  var fallbackReason = null;
  var targetUrl = null;
  var targetError = null;
  var targetUrlError = null;

  if (!isAllowedUrl) {
    fallbackReason = "static_no_allowed_url";
  } else {
    var webEntryResult = buildWebEntryUrl(allowedUrlResult.url, routeResult.route, {
      bookId: values.readerBookIdValue,
      chapterId: values.readerChapterIdValue,
    }, values.agentModeValue);

    targetUrl = webEntryResult.url;
    targetError = webEntryResult.targetError;
    targetUrlError = webEntryResult.error;

    if (!targetUrl) {
      fallbackReason = "static_web_entry_unavailable";
    }
  }

  return {
    isAllowedUrl: isAllowedUrl,
    allowedUrl: allowedUrlResult.url,
    allowedUrlError: allowedUrlResult.error,
    allowedUrlErrorDetail: allowedUrlResult.detail || null,
    route: routeResult.route,
    routeError: routeResult.error,
    routeDefaultedToBooks: routeResult.route === DEFAULT_WEB_ROUTE,
    targetUrl: targetUrl,
    targetError: targetError,
    targetUrlError: targetUrlError,
    fallbackReason: fallbackReason,
  };
}

module.exports = {
  DEFAULT_WEB_ROUTE,
  AGENT_ROUTE,
  READER_ROUTE,
  getAllowedWebUrlFromValue,
  getAllowedWebRouteFromValue,
  validateReaderParam,
  buildWebEntryUrl,
  resolveDesktopWebTarget,
};
