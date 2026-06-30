import {
  getEmailRuntimeConfig,
} from "../apps/web/src/lib/email/email-runtime-config.ts";
import { sendResendEmail } from "../apps/web/src/lib/email/resend-provider.ts";
import { loadEmailEnvFilesForCli } from "./email-env-loader.ts";

loadEmailEnvFilesForCli();

const to = parseToAddress(process.argv.slice(2));
if (!to) {
  console.error("Usage: pnpm email:smoke --to <test-email>");
  process.exit(1);
}

const config = getEmailRuntimeConfig();
if (!config.realSendAllowed) {
  console.error(`Email smoke blocked: ${config.blockedReasons.join(",") || "provider_not_configured"}`);
  process.exit(1);
}

const sent = await sendResendEmail({
  config,
  to,
  subject: "CF Agent 邮件发送测试",
  html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111827;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">CF Agent 邮件发送测试</h1>
  <p style="font-size: 15px; margin: 0;">这是一封普通测试邮件，用于验证 Resend 发送链路。它不是登录验证码。</p>
</div>`,
  text: "CF Agent 邮件发送测试\n\n这是一封普通测试邮件，用于验证 Resend 发送链路。它不是登录验证码。",
});

if (!sent.ok) {
  console.error(
    `Email smoke failed: provider=${sent.provider} status=${sent.status ?? "none"} errorCode=${sent.errorCode ?? "unknown"} requestId=${sent.requestId ?? "none"}`,
  );
  process.exit(1);
}

console.log(
  `Email smoke accepted: provider=${sent.provider} messageId=${sent.messageId ?? "present"} requestId=${sent.requestId ?? "none"}`,
);

function parseToAddress(args: string[]): string | null {
  const toIndex = args.indexOf("--to");
  const candidate = toIndex >= 0 ? args[toIndex + 1] : null;
  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}
