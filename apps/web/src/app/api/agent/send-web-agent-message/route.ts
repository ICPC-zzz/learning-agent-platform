import { NextResponse } from "next/server";

import { sendWebAgentMessageCore } from "../../../agent/web-agent-message-core";
import type { WebAgentReadOnlyToolName } from "@learning-agent-platform/ai-core/agent/web-agent-readonly-tool-registry";

interface SendWebAgentMessageBody {
  message?: string;
  useExternalLlmDev?: boolean;
  toolPreviewEnabled?: boolean;
  requestedToolName?: WebAgentReadOnlyToolName | null;
  requestedToolInput?: Record<string, unknown>;
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: SendWebAgentMessageBody;

  try {
    body = (await request.json()) as SendWebAgentMessageBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        mode: "blocked",
        answerPreview: "[blocked] Invalid request payload.",
      },
      { status: 400 },
    );
  }

  const result = await sendWebAgentMessageCore({
    message: body.message ?? "",
    useExternalLlmDev: body.useExternalLlmDev === true,
    toolPreviewEnabled: body.toolPreviewEnabled === true,
    requestedToolName: body.requestedToolName ?? null,
    requestedToolInput: body.requestedToolInput ?? undefined,
  });

  return NextResponse.json(result);
}
