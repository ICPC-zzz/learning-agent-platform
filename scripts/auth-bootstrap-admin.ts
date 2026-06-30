import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

async function main() {
  const emails = parseEmailList(process.env.LAP_ADMIN_EMAILS);
  if (emails.length === 0) {
    console.log("未配置 LAP_ADMIN_EMAILS，未变更任何用户。");
    return;
  }

  const {
    disconnectPrismaClient,
    getPrismaClient,
    PrismaAuthAuditRepository,
    PrismaUserRepository,
  } = await loadDbPackage();

  const userRepository = new PrismaUserRepository(getPrismaClient());
  const auditRepository = new PrismaAuthAuditRepository(getPrismaClient());
  let promoted = 0;
  let missing = 0;

  for (const email of emails) {
    const user = await userRepository.getUserByEmail(email);
    if (!user) {
      missing += 1;
      console.log(`跳过不存在的白名单用户：${maskEmail(email)}`);
      continue;
    }
    if (user.role === "ADMIN") {
      console.log(`用户已是管理员，无需变更：${maskEmail(email)}`);
      continue;
    }
    await userRepository.updateUser(user.id, { role: "ADMIN" });
    promoted += 1;
    await auditRepository.recordEvent({
      userId: user.id,
      eventType: "auth_role_changed",
      result: "success",
      errorCode: null,
      sourceSummary: "bootstrap-admin",
    });
  }

  console.log(`管理员初始化完成。promoted=${promoted} missing=${missing}`);
  await disconnectPrismaClient().catch(() => undefined);
}

async function loadDbPackage() {
  const distIndex = resolve(dirname(fileURLToPath(import.meta.url)), "../packages/db/dist/index.js");
  const packageErrorMessage = [
    "无法加载已生成的 DB 包，管理员初始化已中止。",
    "请先停止正在运行的 Web 服务，再单独执行：pnpm --filter @learning-agent-platform/db build",
    "为避免 Windows Prisma Query Engine 文件锁，auth:bootstrap-admin 默认不会自动运行 prisma generate。",
  ].join("\n");

  try {
    return await import("@learning-agent-platform/db");
  } catch (error) {
    if (!isModuleNotFoundError(error)) throw error;
    if (!existsSync(distIndex)) {
      throw new Error(packageErrorMessage);
    }
    try {
      return await import(pathToFileURL(distIndex).href);
    } catch (fallbackError) {
      if (!isModuleNotFoundError(fallbackError)) throw fallbackError;
      throw new Error(packageErrorMessage);
    }
  }
}

function isModuleNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "MODULE_NOT_FOUND" || code === "ERR_MODULE_NOT_FOUND";
}

function parseEmailList(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(new Set(value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))));
}

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "[invalid-email]";
  const visible = name.length <= 2 ? name.slice(0, 1) : `${name.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
