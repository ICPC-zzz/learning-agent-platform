export const WebAgentMcpTransport = {
  Http: "http",
  Sse: "sse",
  Stdio: "stdio",
} as const;

export type WebAgentMcpTransport =
  (typeof WebAgentMcpTransport)[keyof typeof WebAgentMcpTransport];

export interface WebAgentMcpConnectionSchemaField {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
  example?: string;
}

export interface WebAgentMcpConnectionDefinition {
  connectionId: string;
  providerName: string;
  transport: WebAgentMcpTransport;
  description: string;
  permission: "disabled" | "previewOnly" | "readOnly" | "requiresUserApproval" | "devOnlyLive" | "forbidden";
  previewOnly: true;
  devOnly: true;
  liveConnectionEnabled: false;
  toolIds: readonly string[];
  connectionSchema: {
    readonly fields: readonly WebAgentMcpConnectionSchemaField[];
  };
  notes: readonly string[];
}

const mcpRegistry: readonly WebAgentMcpConnectionDefinition[] = [
  {
    connectionId: "github",
    providerName: "GitHub",
    transport: WebAgentMcpTransport.Http,
    description:
      "Metadata-only GitHub MCP connection preview. The connector stays disabled until every guard is enabled.",
    permission: "readOnly",
    previewOnly: true,
    devOnly: true,
    liveConnectionEnabled: false,
    toolIds: ["githubListIssues", "githubGetRepoSummary"],
    connectionSchema: {
      fields: [
        {
          name: "baseUrl",
          type: "string",
          required: true,
          description: "GitHub API base URL.",
          example: "https://api.github.com",
        },
        {
          name: "tokenRef",
          type: "string",
          required: false,
          description: "Reference label for a secret handle, not a raw token.",
          example: "github-token-ref",
        },
      ],
    },
    notes: [
      "No GitHub request is sent.",
      "Only the connection schema is previewed.",
    ],
  },
  {
    connectionId: "slack",
    providerName: "Slack",
    transport: WebAgentMcpTransport.Http,
    description:
      "Metadata-only Slack MCP connection preview. No workspace handshake is started.",
    permission: "previewOnly",
    previewOnly: true,
    devOnly: true,
    liveConnectionEnabled: false,
    toolIds: [],
    connectionSchema: {
      fields: [
        {
          name: "workspaceId",
          type: "string",
          required: true,
          description: "Slack workspace identifier.",
          example: "T12345678",
        },
        {
          name: "channelId",
          type: "string",
          required: false,
          description: "Optional preview channel reference.",
          example: "C12345678",
        },
        {
          name: "tokenRef",
          type: "string",
          required: false,
          description: "Reference label for a secret handle, not a raw token.",
          example: "slack-bot-token-ref",
        },
      ],
    },
    notes: [
      "No Slack API call is sent.",
      "Only schema and preview notes are visible.",
    ],
  },
] as const;

export function getWebAgentMcpRegistry(): readonly WebAgentMcpConnectionDefinition[] {
  return mcpRegistry.map((connection) => cloneWebAgentMcpConnectionDefinition(connection));
}

export function createWebAgentMcpRegistryPreview(): readonly WebAgentMcpConnectionDefinition[] {
  return getWebAgentMcpRegistry();
}

function cloneWebAgentMcpConnectionDefinition(
  connection: WebAgentMcpConnectionDefinition,
): WebAgentMcpConnectionDefinition {
  return {
    ...connection,
    connectionSchema: {
      fields: connection.connectionSchema.fields.map((field) => ({ ...field })),
    },
    notes: [...connection.notes],
  };
}
