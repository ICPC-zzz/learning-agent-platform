/**
 * SSRF Protection - validates model base URLs before the server connects to them.
 */

type SsrfCheckResult =
  | { allowed: true; normalizedUrl: string }
  | { allowed: false; reason: string };

const BLOCKED_PROTOCOLS = new Set([
  "file:", "ftp:", "data:", "javascript:", "vbscript:", "gopher:",
]);

const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "169.254.169.254",
  "metadata.tencentyun.com",
  "100.100.100.200",
]);

const BLOCKED_PORTS = new Set([22, 25, 53, 135, 137, 138, 139, 445, 3306, 5432, 6379, 27017, 11211]);

const MAX_REDIRECTS = 3;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024;

export interface SsrfOptions {
  allowHttp?: boolean;
  allowPrivateIps?: boolean;
  timeoutMs?: number;
}

export function validateBaseUrl(rawUrl: string, options: SsrfOptions = {}): SsrfCheckResult {
  const allowHttp = options.allowHttp ?? process.env.ALLOW_PRIVATE_MODEL_BASE_URLS === "true";
  const allowPrivateIps = options.allowPrivateIps ?? process.env.ALLOW_PRIVATE_MODEL_BASE_URLS === "true";

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "无效的 URL 格式" };
  }

  const protocol = url.protocol.toLowerCase();
  if (BLOCKED_PROTOCOLS.has(protocol)) {
    return { allowed: false, reason: "不支持的协议: " + protocol };
  }

  if (protocol === "http:" && !allowHttp) {
    return { allowed: false, reason: "仅支持 HTTPS 连接" };
  }

  if (protocol !== "https:" && protocol !== "http:") {
    return { allowed: false, reason: "不支持的协议: " + protocol };
  }

  if (url.username || url.password) {
    return { allowed: false, reason: "URL 中不允许包含用户名或密码" };
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(hostname)) {
    return { allowed: false, reason: "禁止访问此地址" };
  }

  const port = url.port ? parseInt(url.port, 10) : (protocol === "https:" ? 443 : 80);
  if (BLOCKED_PORTS.has(port) || port < 1 || port > 65535) {
    return { allowed: false, reason: "不允许的端口: " + port };
  }

  if (!allowPrivateIps) {
    const ipCheck = checkIpRestrictions(hostname);
    if (!ipCheck.allowed) return ipCheck;
  }

  url.search = "";
  url.hash = "";

  return { allowed: true, normalizedUrl: url.toString().replace(/\/$/, "") };
}

function checkIpRestrictions(hostname: string): SsrfCheckResult {
  if (isLocalhost(hostname)) {
    return { allowed: false, reason: "不允许连接到本地地址" };
  }
  return { allowed: true, normalizedUrl: hostname };
}

function isLocalhost(hostname: string): boolean {
  var lower = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1" || lower === "0.0.0.0") return true;
  if (/^127\.\d+\.\d+\.\d+$/.test(lower)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(lower)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(lower)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(lower)) return true;
  if (/^169\.254\.\d+\.\d+$/.test(lower)) return true;
  return false;
}

export var SSRF_DEFAULTS = Object.freeze({
  maxRedirects: MAX_REDIRECTS,
  maxResponseSize: MAX_RESPONSE_SIZE,
  defaultTimeoutMs: 30000,
  blockedProtocols: BLOCKED_PROTOCOLS,
  blockedHosts: BLOCKED_HOSTS,
  blockedPorts: BLOCKED_PORTS,
});
