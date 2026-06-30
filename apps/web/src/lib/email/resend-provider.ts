import type { EmailRuntimeConfig } from "./email-runtime-config";

export interface ResendEmailInput {
  config: EmailRuntimeConfig;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface ResendEmailResult {
  ok: boolean;
  provider: "resend";
  messageId: string | null;
  status: number | null;
  errorCode: string | null;
  requestId: string | null;
}

export async function sendResendEmail(input: ResendEmailInput): Promise<ResendEmailResult> {
  if (!input.config.realSendAllowed || !input.config.apiKey.value || !input.config.from.value) {
    return failure(null, "provider_not_configured", null);
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.config.apiKey.value}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.config.from.value,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    const requestId = safeHeader(response, "x-request-id") ?? safeHeader(response, "cf-ray");
    const safeBody = await readSafeResponseJson(response);

    if (!response.ok) {
      return {
        ok: false,
        provider: "resend",
        messageId: null,
        status: response.status,
        errorCode: sanitizeCode(safeBody?.code ?? safeBody?.name ?? response.statusText) ?? "provider_http_error",
        requestId,
      };
    }

    return {
      ok: true,
      provider: "resend",
      messageId: sanitizeCode(safeBody?.id ?? null),
      status: response.status,
      errorCode: null,
      requestId,
    };
  } catch {
    return failure(null, "network_error", null);
  }
}

export function buildOtpEmail(input: {
  code: string;
  expiryMinutes: number;
}): { subject: string; html: string; text: string } {
  const subject = "CF Agent 邮箱验证码";
  const text = [
    "CF Agent 邮箱验证码",
    "",
    `验证码：${input.code}`,
    `有效时间：${input.expiryMinutes} 分钟。`,
    "如果不是你本人操作，请忽略这封邮件。",
    "不要向他人透露验证码。",
  ].join("\n");
  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111827;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">CF Agent 邮箱验证码</h1>
  <p style="font-size: 15px; margin: 0 0 12px;">你的验证码是：</p>
  <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 14px 16px; background: #f3f4f6; border-radius: 8px; display: inline-block;">${input.code}</div>
  <p style="font-size: 14px; margin: 18px 0 0;">此验证码 ${input.expiryMinutes} 分钟内有效。</p>
  <p style="font-size: 14px; margin: 8px 0 0;">如果不是你本人操作，请忽略这封邮件。不要向他人透露验证码。</p>
</div>`;
  return { subject, html, text };
}

function failure(status: number | null, errorCode: string, requestId: string | null): ResendEmailResult {
  return {
    ok: false,
    provider: "resend",
    messageId: null,
    status,
    errorCode,
    requestId,
  };
}

async function readSafeResponseJson(response: Response): Promise<Record<string, string> | null> {
  try {
    const value = await response.json();
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    return {
      id: typeof record.id === "string" ? record.id : "",
      name: typeof record.name === "string" ? record.name : "",
      code: typeof record.code === "string" ? record.code : "",
    };
  } catch {
    return null;
  }
}

function safeHeader(response: Response, name: string): string | null {
  return sanitizeCode(response.headers.get(name));
}

function sanitizeCode(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 80);
  return normalized.length > 0 ? normalized : null;
}
