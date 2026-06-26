/**
 * Auth Header Builder — constructs safe authentication headers for model providers.
 *
 * Supported auth modes: bearer, api_key_header, basic_auth, custom_headers, none.
 * Forbidden headers are blocked regardless of mode.
 */

export type ModelAuthMode =
  | "bearer"
  | "api_key_header"
  | "basic_auth"
  | "custom_headers"
  | "none";

export interface CredentialFieldDefinition {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  placeholder?: string;
}

export interface AuthHeaderInput {
  mode: ModelAuthMode;
  /** Bearer token or API Key value */
  token?: string;
  /** API Key Header: custom header name (default "api-key") */
  apiKeyHeaderName?: string;
  /** Basic Auth: username or appId */
  username?: string;
  /** Basic Auth: password or secret */
  password?: string;
  /** Custom Headers: limited number of key-value pairs */
  customHeaders?: Array<{ name: string; value: string; sensitive?: boolean }>;
}

export interface AuthHeaderResult {
  headers: Record<string, string>;
  errors: string[];  // safe error messages only
}

const FORBIDDEN_HEADER_NAMES = new Set([
  "host", "content-length", "connection", "transfer-encoding",
  "cookie", "set-cookie",
  "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto",
  "x-forwarded-port", "x-forwarded-prefix",
  "x-real-ip", "forwarded",
]);

const MAX_CUSTOM_HEADERS = 10;
const MAX_HEADER_NAME_LENGTH = 128;
const MAX_HEADER_VALUE_LENGTH = 4096;
const VALID_HEADER_NAME_RE = /^[a-zA-Z0-9\-_]+$/;

export function getCredentialFieldsForAuthMode(mode: ModelAuthMode): CredentialFieldDefinition[] {
  switch (mode) {
    case "bearer":
      return [
        { key: "token", label: "Token / API Key", secret: true, required: true, placeholder: "sk-..." },
      ];
    case "api_key_header":
      return [
        { key: "apiKeyHeaderName", label: "Header 名称", secret: false, required: false, placeholder: "api-key" },
        { key: "token", label: "Secret 值", secret: true, required: true, placeholder: "your-secret-key" },
      ];
    case "basic_auth":
      return [
        { key: "username", label: "用户名 / AppId", secret: false, required: true, placeholder: "username or appId" },
        { key: "password", label: "密码 / Secret", secret: true, required: true, placeholder: "password" },
      ];
    case "custom_headers":
      return []; // dynamic, handled separately
    case "none":
      return [];
  }
}

export function buildAuthHeaders(input: AuthHeaderInput): AuthHeaderResult {
  const headers: Record<string, string> = {};
  const errors: string[] = [];

  switch (input.mode) {
    case "bearer": {
      if (input.token && input.token.trim().length > 0) {
        headers["Authorization"] = `Bearer ${input.token}`;
      } else {
        errors.push("Bearer token 未提供");
      }
      break;
    }

    case "api_key_header": {
      const headerName = sanitizeHeaderName(input.apiKeyHeaderName || "api-key");
      if (!headerName) {
        errors.push("API Key Header 名称无效");
        break;
      }
      if (isForbiddenHeader(headerName)) {
        errors.push(`不允许的 Header 名称: ${headerName}`);
        break;
      }
      if (input.token && input.token.trim().length > 0) {
        headers[headerName] = input.token;
      } else {
        errors.push("API Key 值未提供");
      }
      break;
    }

    case "basic_auth": {
      if (!input.username || input.username.trim().length === 0) {
        errors.push("用户名未提供");
        break;
      }
      if (!input.password || input.password.trim().length === 0) {
        errors.push("密码未提供");
        break;
      }
      if (input.username && input.password) {
        const encoded = Buffer.from(`${input.username}:${input.password}`).toString("base64");
        headers["Authorization"] = `Basic ${encoded}`;
      }
      break;
    }

    case "custom_headers": {
      if (!input.customHeaders || input.customHeaders.length === 0) {
        break;
      }
      if (input.customHeaders.length > MAX_CUSTOM_HEADERS) {
        errors.push(`自定义 Header 数量不能超过 ${MAX_CUSTOM_HEADERS} 项`);
        break;
      }

      for (const h of input.customHeaders) {
        const name = sanitizeHeaderName(h.name);
        if (!name) {
          errors.push(`自定义 Header 名称无效: ${h.name.slice(0, 20)}`);
          continue;
        }
        if (isForbiddenHeader(name)) {
          errors.push(`不允许的 Header 名称: ${name}`);
          continue;
        }
        if (h.value.length > MAX_HEADER_VALUE_LENGTH) {
          errors.push(`Header ${name} 值过长`);
          continue;
        }
        headers[name] = h.value;
      }
      break;
    }

    case "none":
      break;
  }

  return { headers, errors };
}

function sanitizeHeaderName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_HEADER_NAME_LENGTH) return null;
  if (!VALID_HEADER_NAME_RE.test(trimmed)) return null;
  return trimmed;
}

function isForbiddenHeader(name: string): boolean {
  return FORBIDDEN_HEADER_NAMES.has(name.toLowerCase());
}

/**
 * Build a safe description of auth headers for logging (no secret values).
 */
export function describeAuthHeaders(input: AuthHeaderInput): string {
  switch (input.mode) {
    case "bearer": return input.token ? "Bearer [已配置]" : "Bearer [未配置]";
    case "api_key_header": {
      const name = input.apiKeyHeaderName || "api-key";
      return input.token ? `${name} [已配置]` : `${name} [未配置]`;
    }
    case "basic_auth": return input.username ? "Basic Auth [已配置]" : "Basic Auth [未配置]";
    case "custom_headers": return `Custom Headers (${input.customHeaders?.length ?? 0} 项)`;
    case "none": return "无鉴权";
  }
}
