import {
  EXPECTED_RESEND_FROM_DOMAIN,
  getEmailRuntimeConfig,
  getSafeEmailRuntimeSummary,
} from "../apps/web/src/lib/email/email-runtime-config.ts";
import {
  EMAIL_ENV_NAMES,
  inspectEmailEnvFiles,
  inspectSystemEmailEnv,
  loadEmailEnvFilesForCli,
} from "./email-env-loader.ts";

const filePresence = inspectEmailEnvFiles();
const systemEnv = inspectSystemEmailEnv();

loadEmailEnvFilesForCli();

const config = getEmailRuntimeConfig();
const summary = getSafeEmailRuntimeSummary(config);

console.log("Email runtime doctor");
console.log(`provider: ${summary.provider}`);
console.log(`nodeEnv: ${summary.nodeEnv}`);
console.log(`cwd: ${summary.cwd}`);
console.log(`expectedFromDomain: ${EXPECTED_RESEND_FROM_DOMAIN}`);
console.log("");

for (const file of filePresence) {
  console.log(`${file.file}: ${file.exists ? "exists" : "missing"}`);
  if (file.exists) {
    for (const name of EMAIL_ENV_NAMES) {
      console.log(`  ${name}: ${file.variables[name] ? "present" : "missing"}`);
    }
  }
}

console.log("system environment:");
for (const name of EMAIL_ENV_NAMES) {
  console.log(`  ${name}: ${systemEnv[name] ? "present" : "missing"}`);
}

console.log("");
console.log(`apiKeyPresent: ${summary.apiKeyPresent ? "present" : "missing"}`);
console.log(`apiKeySource: ${summary.apiKeySource ?? "none"}`);
console.log(`apiKeyFormat: ${summary.apiKeyFormat}`);
console.log(`fromPresent: ${summary.fromPresent ? "present" : "missing"}`);
console.log(`fromSource: ${summary.fromSource ?? "none"}`);
console.log(`fromDomain: ${summary.fromDomain ?? "none"}`);
console.log(`fromValid: ${summary.fromValid ? "true" : "false"}`);
console.log(`emailAuthEnabled: ${summary.emailAuthEnabled ? "true" : "false"}`);
console.log(`realSendAllowed: ${summary.realSendAllowed ? "true" : "false"}`);
console.log(`blockedReasons: ${summary.blockedReasons ?? "none"}`);

if (!config.realSendAllowed) {
  process.exitCode = 1;
}
