import assert from "node:assert/strict";
import test from "node:test";

test("识别部署期间的 Server Action 协议失配并提示刷新", async () => {
  let recovery: undefined | {
    getServerActionRecoveryMessage(error: unknown): string | null;
  };

  try {
    recovery = await import("../apps/web/src/app/ai/server-action-recovery.ts");
  } catch {
    recovery = undefined;
  }

  assert.equal(
    recovery?.getServerActionRecoveryMessage(new Error("An unexpected response was received from the server.")),
    "系统刚完成更新，正在刷新页面，请稍后重新提交代码分析。",
  );
});

test("不把普通代码分析异常误判为部署失配", async () => {
  let recovery: undefined | {
    getServerActionRecoveryMessage(error: unknown): string | null;
  };

  try {
    recovery = await import("../apps/web/src/app/ai/server-action-recovery.ts");
  } catch {
    recovery = undefined;
  }

  assert.equal(recovery?.getServerActionRecoveryMessage(new Error("模型请求超时")) ?? null, null);
});
