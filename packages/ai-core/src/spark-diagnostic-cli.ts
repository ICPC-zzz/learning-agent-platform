import {
  createRedactedLlmProviderConfigSummary,
  loadLlmProviderConfigsFromEnv,
  type LlmProviderConfigPublicSummary,
  type LlmProviderEnvLike,
} from "./llm-provider-config";
import {
  createDefaultSparkDiagnosticPolicy,
  runSparkDiagnosticServerOnlyScaffold,
  type SparkDiagnosticPolicy,
  type SparkDiagnosticResult,
} from "./spark-diagnostic";
import {
  createDefaultSparkControlledDiagnosticCallPolicy,
  createSafeSparkDiagnosticConsoleSummary,
  runControlledSparkDiagnosticCall,
  type SparkControlledDiagnosticCallPolicy,
  type SparkControlledDiagnosticCallResult,
  type SparkControlledDiagnosticFetchLike,
  type SparkControlledDiagnosticSingleCallGuard,
} from "./spark-controlled-diagnostic-call";

export type SparkDiagnosticCliArgvLike = readonly string[];

export type SparkDiagnosticCliEnvLike = LlmProviderEnvLike;

export type SparkDiagnosticCliMode =
  | "disabled"
  | "dry_run"
  | "real_call"
  | "show_config"
  | "help";

export const SparkDiagnosticCliExitCode = {
  Success: 0,
  ValidationError: 1,
  DisabledOrBlocked: 2,
  UnsafeInput: 3,
  InternalError: 4,
} as const;

export type SparkDiagnosticCliExitCode =
  (typeof SparkDiagnosticCliExitCode)[keyof typeof SparkDiagnosticCliExitCode];

export type SparkDiagnosticCliIssueSeverity = "info" | "warning" | "error";

export type SparkDiagnosticCliIssueCode =
  | "a118_external_call_warning"
  | "a118_real_call_blocked"
  | "dangerous_cli_argument"
  | "diagnostic_disabled"
  | "internal_error"
  | "missing_purpose_value"
  | "unknown_cli_argument"
  | "unsafe_purpose_summary";

export interface SparkDiagnosticCliIssue {
  code: SparkDiagnosticCliIssueCode;
  message: string;
  severity: SparkDiagnosticCliIssueSeverity;
  argName?: string;
  safeForLogs: true;
}

export interface SparkDiagnosticCliParsedOptions {
  mode: SparkDiagnosticCliMode;
  helpRequested: boolean;
  json: boolean;
  showConfig: boolean;
  dryRun: boolean;
  allowRealCallRequested: boolean;
  purposeSummary: string;
  invocationKind: "cli_wrapper_scaffold";
  warnings: readonly SparkDiagnosticCliIssue[];
  errors: readonly SparkDiagnosticCliIssue[];
  unknownArgs: readonly string[];
  safeForLogs: true;
}

export interface SparkDiagnosticCliRunOptions {
  policy?: SparkDiagnosticPolicy;
  controlledPolicy?: SparkControlledDiagnosticCallPolicy;
  fetchLike?: SparkControlledDiagnosticFetchLike;
  singleCallGuard?: SparkControlledDiagnosticSingleCallGuard;
  typecheckVerifiedForRealCall?: boolean;
  now?: string | (() => string);
  forceText?: boolean;
  forceJson?: boolean;
  includeRedactedConfigSummary?: boolean;
}

export interface SparkDiagnosticCliDiagnosticSummary {
  diagnosticKind:
    | SparkDiagnosticResult["diagnosticKind"]
    | SparkControlledDiagnosticCallResult["diagnosticKind"];
  requestId?: string;
  invocationKind:
    | SparkDiagnosticResult["invocationKind"]
    | "cli_manual";
  mode: SparkDiagnosticResult["mode"] | "controlled_real_call";
  decisionKind?: SparkDiagnosticResult["decision"]["decisionKind"];
  status?: SparkControlledDiagnosticCallResult["status"];
  blockedReasons:
    | SparkDiagnosticResult["decision"]["blockedReasons"]
    | SparkControlledDiagnosticCallResult["blockedReasons"];
  requestPreviewCreated: boolean;
  requestPreviewMessageCount: number;
  redactedConfigSummary?: SparkDiagnosticResult["redactedConfigSummary"];
  safePromptSummary: SparkDiagnosticResult["safePromptSummary"];
  metadataSafetySummary?: SparkDiagnosticResult["metadataSafetySummary"];
  envConfigSafetySummary?: SparkDiagnosticResult["envConfigSafetySummary"];
  llmResultLikeSummary?: {
    ok: boolean;
    providerKey: string;
    modelLabel: string;
    finishReason?: string;
    errorKind?: string;
    rawProviderErrorStored: false;
  };
  responseSummary?: string;
  safeErrorSummary?: SparkControlledDiagnosticCallResult["safeErrorSummary"];
  usage?: SparkControlledDiagnosticCallResult["usage"];
  latencyMs?: number;
  retryCount?: number;
  externalRequestAttempted?: boolean;
  externalRequestCount?: number;
  possibleCostIncurred?: boolean;
  message: string;
  warnings: readonly string[];
  previewOnly: boolean;
  serverOnly: true;
  manualTriggerRequired: true;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  llmCallEnabled: boolean;
}

export interface SparkDiagnosticCliJsonOutput {
  ok: boolean;
  exitCode: SparkDiagnosticCliExitCode;
  mode: SparkDiagnosticCliMode;
  parsedOptions: {
    helpRequested: boolean;
    json: boolean;
    showConfig: boolean;
    dryRun: boolean;
    allowRealCallRequested: boolean;
    purposeSummaryProvided: boolean;
    unknownArgs: readonly string[];
    safeForLogs: true;
  };
  diagnostics?: SparkDiagnosticCliDiagnosticSummary;
  redactedConfigSummary?: LlmProviderConfigPublicSummary;
  warnings: readonly SparkDiagnosticCliIssue[];
  errors: readonly SparkDiagnosticCliIssue[];
  secretSafe: true;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  llmCallEnabled: boolean;
  safeForLogs: true;
}

export interface SparkDiagnosticCliOutput {
  ok: boolean;
  exitCode: SparkDiagnosticCliExitCode;
  mode: SparkDiagnosticCliMode;
  text: string;
  json?: SparkDiagnosticCliJsonOutput;
  diagnostics?: SparkDiagnosticCliDiagnosticSummary;
  redactedConfigSummary?: LlmProviderConfigPublicSummary;
  parsedOptions: SparkDiagnosticCliParsedOptions;
  warnings: readonly SparkDiagnosticCliIssue[];
  errors: readonly SparkDiagnosticCliIssue[];
  secretSafe: true;
  realProviderCalled: boolean;
  networkAccessed: boolean;
  rawPromptStored: false;
  rawMessagesStored: false;
  rawResponseStored: false;
  llmCallEnabled: boolean;
}

export interface SparkDiagnosticCliFormatOptions {
  forceText?: boolean;
  forceJson?: boolean;
  includeRedactedConfigSummary?: boolean;
}

const DEFAULT_PURPOSE_SUMMARY =
  "手动 Spark 诊断 CLI scaffold dry-run";

const DANGEROUS_CLI_ARGUMENT_NAMES = [
  "--api-key",
  "--apikey",
  "--apiSecret",
  "--api-secret",
  "--secret",
  "--token",
  "--access-token",
  "--authorization",
  "--password",
  "--credential",
  "--credentials",
  "--headers",
  "--rawHeaders",
  "--cookie",
  "--private-key",
  "--client-secret",
  "--raw-prompt",
  "--raw-messages",
  "--raw-response",
  "--prompt",
  "--stream",
  "--tool-call",
] as const;

const DANGEROUS_CLI_ARGUMENT_NAME_SET = new Set(
  DANGEROUS_CLI_ARGUMENT_NAMES.map(normalizeCliArgumentName),
);

export function parseSparkDiagnosticCliArgs(
  argv: SparkDiagnosticCliArgvLike,
): SparkDiagnosticCliParsedOptions {
  const warnings: SparkDiagnosticCliIssue[] = [];
  const errors: SparkDiagnosticCliIssue[] = [];
  const unknownArgs: string[] = [];
  let helpRequested = false;
  let json = false;
  let showConfig = false;
  let dryRun = false;
  let allowRealCallRequested = false;
  let purposeSummary = DEFAULT_PURPOSE_SUMMARY;

  for (let index = 0; index < argv.length; index += 1) {
    const rawArg = normalizeRawArg(argv[index]);

    if (rawArg === undefined) {
      continue;
    }

    if (isDangerousCliArgument(rawArg)) {
      const argName = sanitizeCliArgumentName(rawArg);

      errors.push(
        createCliIssue({
          code: "dangerous_cli_argument",
          severity: "error",
          argName,
          message:
            "检测到禁止的 CLI 参数；A117 不接收 secret、prompt、raw payload、streaming 或 tool calling 参数，且不会回显参数值。",
        }),
      );

      if (!rawArg.includes("=") && hasFollowingValue(argv, index)) {
        index += 1;
      }

      continue;
    }

    if (rawArg === "--help" || rawArg === "-h") {
      helpRequested = true;
      continue;
    }

    if (rawArg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (rawArg === "--show-config") {
      showConfig = true;
      continue;
    }

    if (rawArg === "--json") {
      json = true;
      continue;
    }

    if (rawArg === "--allow-real-call") {
      allowRealCallRequested = true;
      warnings.push(
        createCliIssue({
          code: "a118_external_call_warning",
          severity: "warning",
          argName: "--allow-real-call",
          message:
            "本次将发起一次外部 Spark 测试请求，可能产生费用；只有 A118 安全门全部满足时才会真实访问网络。",
        }),
      );
      continue;
    }

    if (rawArg === "--purpose") {
      const rawPurpose = argv[index + 1];

      if (rawPurpose === undefined || normalizeRawArg(rawPurpose)?.startsWith("-")) {
        errors.push(
          createCliIssue({
            code: "missing_purpose_value",
            severity: "error",
            argName: "--purpose",
            message:
              "--purpose 需要一个非敏感用途摘要；未提供值，因此未执行诊断。",
          }),
        );
        continue;
      }

      const parsedPurpose = parsePurposeSummary(rawPurpose);

      if (parsedPurpose.error !== undefined) {
        errors.push(parsedPurpose.error);
      } else if (parsedPurpose.value !== undefined) {
        purposeSummary = parsedPurpose.value;
      }

      index += 1;
      continue;
    }

    if (rawArg.startsWith("--purpose=")) {
      const parsedPurpose = parsePurposeSummary(
        rawArg.slice("--purpose=".length),
      );

      if (parsedPurpose.error !== undefined) {
        errors.push(parsedPurpose.error);
      } else if (parsedPurpose.value !== undefined) {
        purposeSummary = parsedPurpose.value;
      }

      continue;
    }

    if (rawArg.startsWith("-")) {
      const argName = sanitizeCliArgumentName(rawArg);

      unknownArgs.push(argName);
      errors.push(
        createCliIssue({
          code: "unknown_cli_argument",
          severity: "error",
          argName,
          message:
            "检测到未知 CLI 参数；A117 只支持 --help、--dry-run、--show-config、--json、--purpose 和 --allow-real-call。",
        }),
      );
      continue;
    }

    unknownArgs.push("positional_arg");
    errors.push(
      createCliIssue({
        code: "unknown_cli_argument",
        severity: "error",
        argName: "positional_arg",
        message:
          "检测到未命名 positional 参数；A117 不回显其值，也不会把它作为 prompt 或 secret 处理。",
      }),
    );
  }

  return {
    mode: getCliMode({ helpRequested, showConfig, dryRun }),
    helpRequested,
    json,
    showConfig,
    dryRun,
    allowRealCallRequested,
    purposeSummary,
    invocationKind: "cli_wrapper_scaffold",
    warnings: normalizeCliIssues(warnings),
    errors: normalizeCliIssues(errors),
    unknownArgs: normalizeUniqueStrings(unknownArgs),
    safeForLogs: true,
  };
}

export function createSparkDiagnosticCliHelpText(): string {
  return [
    "Spark diagnostic CLI wrapper scaffold (A117)",
    "",
    "说明：",
    "- 这是手动 CLI wrapper scaffold，不是真实可执行 bin。",
    "- 默认 disabled / dry-run only，不会真实调用 Spark。",
    "- --allow-real-call 只有在显式 A118 controlled policy、typecheckVerified、推荐 env secret 和手动确认都满足时才会触发一次请求。",
    "- 不会读取 .env 或 .env.example。",
    "- 不会读取、输出、打印或硬编码 API key、token、authorization、cookie 或 private key。",
    "- 真实调用固定使用安全 prompt，non-streaming，无 tool calling，不接 UI，不进入 Agent loop。",
    "",
    "支持的安全参数：",
    "- --help",
    "- --dry-run",
    "- --show-config",
    "- --json",
    "- --purpose <text>",
    "- --allow-real-call (A118 controlled gate，默认仍阻断)",
    "",
    "未来 CLI wrapper 示例：",
    "- spark diagnostic --dry-run",
    "- spark diagnostic --show-config --json",
  ].join("\n");
}

export function createSparkDiagnosticCliJsonOutput(
  output: Omit<SparkDiagnosticCliOutput, "json" | "text">,
): SparkDiagnosticCliJsonOutput {
  return {
    ok: output.ok,
    exitCode: output.exitCode,
    mode: output.mode,
    parsedOptions: {
      helpRequested: output.parsedOptions.helpRequested,
      json: output.parsedOptions.json,
      showConfig: output.parsedOptions.showConfig,
      dryRun: output.parsedOptions.dryRun,
      allowRealCallRequested:
        output.parsedOptions.allowRealCallRequested,
      purposeSummaryProvided:
        output.parsedOptions.purposeSummary.trim().length > 0,
      unknownArgs: output.parsedOptions.unknownArgs,
      safeForLogs: true,
    },
    diagnostics: output.diagnostics,
    redactedConfigSummary: output.redactedConfigSummary,
    warnings: output.warnings,
    errors: output.errors,
    secretSafe: true,
    realProviderCalled: output.realProviderCalled,
    networkAccessed: output.networkAccessed,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    llmCallEnabled: output.llmCallEnabled,
    safeForLogs: true,
  };
}

export function formatSparkDiagnosticCliOutput(
  output: SparkDiagnosticCliOutput,
  options: SparkDiagnosticCliFormatOptions = {},
): string {
  if (shouldRenderJson(output, options)) {
    return JSON.stringify(output.json ?? createSparkDiagnosticCliJsonOutput(output), null, 2);
  }

  if (output.mode === "help") {
    return createSparkDiagnosticCliHelpText();
  }

  const lines = [
    `Spark diagnostic CLI wrapper scaffold: ${output.ok ? "ok" : "blocked"}`,
    `mode=${output.mode}`,
    `exitCode=${output.exitCode}`,
    "secretSafe=true",
    `realProviderCalled=${output.realProviderCalled}`,
    `networkAccessed=${output.networkAccessed}`,
    "rawPromptStored=false",
    "rawMessagesStored=false",
    "rawResponseStored=false",
    `llmCallEnabled=${output.llmCallEnabled}`,
  ];

  if (output.diagnostics !== undefined) {
    lines.push(
      `diagnosticDecision=${output.diagnostics.decisionKind}`,
      `diagnosticMessage=${output.diagnostics.message}`,
      `requestPreviewCreated=${output.diagnostics.requestPreviewCreated}`,
    );

    if (output.diagnostics.status !== undefined) {
      lines.push(`controlledStatus=${output.diagnostics.status}`);
    }

    if (output.diagnostics.externalRequestCount !== undefined) {
      lines.push(
        `externalRequestCount=${output.diagnostics.externalRequestCount}`,
        `possibleCostIncurred=${output.diagnostics.possibleCostIncurred}`,
      );
    }

    if (output.diagnostics.latencyMs !== undefined) {
      lines.push(`latencyMs=${output.diagnostics.latencyMs}`);
    }

    if (output.diagnostics.responseSummary !== undefined) {
      lines.push(`responseSummary=${output.diagnostics.responseSummary}`);
    }

    if (output.diagnostics.safeErrorSummary !== undefined) {
      lines.push(
        `safeErrorSummary=${output.diagnostics.safeErrorSummary.message}`,
      );
    }

    if (output.diagnostics.blockedReasons.length > 0) {
      lines.push(
        `blockedReasons=${output.diagnostics.blockedReasons.join(", ")}`,
      );
    }
  }

  if (
    options.includeRedactedConfigSummary === true &&
    output.redactedConfigSummary !== undefined
  ) {
    lines.push(...formatConfigSummaryLines(output.redactedConfigSummary));
  }

  if (output.errors.length > 0) {
    lines.push("errors:");
    lines.push(...output.errors.map(formatCliIssue));
  }

  if (output.warnings.length > 0) {
    lines.push("warnings:");
    lines.push(...output.warnings.map(formatCliIssue));
  }

  return lines.join("\n");
}

export async function runSparkDiagnosticCliWrapper(
  argv: SparkDiagnosticCliArgvLike,
  envLike: SparkDiagnosticCliEnvLike,
  options: SparkDiagnosticCliRunOptions = {},
): Promise<SparkDiagnosticCliOutput> {
  try {
    const parsedOptions = parseSparkDiagnosticCliArgs(argv);
    const hasUnsafeInput = parsedOptions.errors.some(
      (error) =>
        error.code === "dangerous_cli_argument" ||
        error.code === "unsafe_purpose_summary",
    );

    if (hasUnsafeInput) {
      return createFinalCliOutput({
        ok: false,
        exitCode: SparkDiagnosticCliExitCode.UnsafeInput,
        mode: "disabled",
        parsedOptions,
        warnings: parsedOptions.warnings,
        errors: parsedOptions.errors,
        formatOptions: options,
      });
    }

    if (parsedOptions.errors.length > 0) {
      return createFinalCliOutput({
        ok: false,
        exitCode: SparkDiagnosticCliExitCode.ValidationError,
        mode: parsedOptions.mode,
        parsedOptions,
        warnings: parsedOptions.warnings,
        errors: parsedOptions.errors,
        formatOptions: options,
      });
    }

    if (parsedOptions.helpRequested) {
      return createFinalCliOutput({
        ok: true,
        exitCode: SparkDiagnosticCliExitCode.Success,
        mode: "help",
        parsedOptions,
        warnings: parsedOptions.warnings,
        errors: [],
        formatOptions: options,
      });
    }

    if (parsedOptions.allowRealCallRequested) {
      const controlledPolicy =
        options.controlledPolicy ??
        createDefaultSparkControlledDiagnosticCallPolicy();
      const controlledResult = await runControlledSparkDiagnosticCall(
        {
          invocationKind: "cli_manual",
          purposeSummary: parsedOptions.purposeSummary,
          envLike,
          policy: controlledPolicy,
          allowRealCallConfirmation: true,
          typecheckVerified: options.typecheckVerifiedForRealCall === true,
          now: resolveNow(options.now),
          metadata: {
            cliWrapper: "spark-diagnostic-cli",
            manualTrigger: true,
            uiInvocation: false,
            agentLoopInvocation: false,
          },
        },
        {
          fetchLike: options.fetchLike,
          now: options.now,
          singleCallGuard: options.singleCallGuard,
        },
      );
      const diagnostics =
        createSparkControlledDiagnosticCliDiagnosticSummary(
          controlledResult,
        );
      const errors =
        controlledResult.ok
          ? []
          : [
              createCliIssue({
                code: "a118_real_call_blocked",
                severity: "error",
                argName: "--allow-real-call",
                message:
                  controlledResult.safeErrorSummary?.message ??
                  "A118 controlled Spark diagnostic call was blocked or failed safely.",
              }),
            ];

      return createFinalCliOutput({
        ok: controlledResult.ok,
        exitCode: controlledResult.ok
          ? SparkDiagnosticCliExitCode.Success
          : SparkDiagnosticCliExitCode.DisabledOrBlocked,
        mode: "real_call",
        parsedOptions,
        diagnostics,
        warnings: normalizeCliIssues([
          ...parsedOptions.warnings,
          ...controlledResult.warnings.map(diagnosticWarningToCliIssue),
        ]),
        errors,
        realProviderCalled: controlledResult.realProviderCalled,
        networkAccessed: controlledResult.networkAccessed,
        llmCallEnabled: controlledResult.llmResultLike.llmCallEnabled,
        formatOptions: options,
      });
    }

    if (parsedOptions.showConfig) {
      const configSummary = loadRedactedConfigSummary(envLike);

      return createFinalCliOutput({
        ok: true,
        exitCode: SparkDiagnosticCliExitCode.Success,
        mode: "show_config",
        parsedOptions,
        redactedConfigSummary: configSummary,
        warnings: normalizeCliIssues([
          ...parsedOptions.warnings,
          ...configSummary.warnings.map(configWarningToCliIssue),
        ]),
        errors: [],
        formatOptions: {
          ...options,
          includeRedactedConfigSummary:
            options.includeRedactedConfigSummary ?? true,
        },
      });
    }

    if (parsedOptions.dryRun) {
      const configLoadResult = loadLlmProviderConfigsFromEnv(envLike);
      const configSummary =
        createRedactedLlmProviderConfigSummary(configLoadResult);
      const policy =
        options.policy ??
        createDefaultSparkDiagnosticPolicy({
          diagnosticEnabled: true,
          mode: "dry_run_only",
        });
      const diagnosticResult = runSparkDiagnosticServerOnlyScaffold(
        {
          invocationKind: "server_only_scaffold",
          purposeSummary: parsedOptions.purposeSummary,
          envConfigSummary: configLoadResult.sparkConfig.redactedSummary,
          providerConfig: configLoadResult.sparkConfig.config,
          now: resolveNow(options.now),
        },
        {
          policy,
          createRequestPreview: true,
        },
      );
      const diagnostics =
        createSparkDiagnosticCliDiagnosticSummary(diagnosticResult);

      return createFinalCliOutput({
        ok: diagnosticResult.ok,
        exitCode: diagnosticResult.ok
          ? SparkDiagnosticCliExitCode.Success
          : SparkDiagnosticCliExitCode.DisabledOrBlocked,
        mode: "dry_run",
        parsedOptions,
        diagnostics,
        redactedConfigSummary:
          options.includeRedactedConfigSummary === true
            ? configSummary
            : undefined,
        warnings: normalizeCliIssues([
          ...parsedOptions.warnings,
          ...configSummary.warnings.map(configWarningToCliIssue),
          ...diagnosticResult.warnings.map(diagnosticWarningToCliIssue),
        ]),
        errors: [],
        formatOptions: options,
      });
    }

    return createFinalCliOutput({
      ok: false,
      exitCode: SparkDiagnosticCliExitCode.DisabledOrBlocked,
      mode: "disabled",
      parsedOptions,
      warnings: [
        ...parsedOptions.warnings,
        createCliIssue({
          code: "diagnostic_disabled",
          severity: "info",
          message:
            "未提供 --dry-run、--show-config 或 --help；A117 默认 disabled，未调用 diagnostic scaffold。",
        }),
      ],
      errors: [],
      formatOptions: options,
    });
  } catch {
    const parsedOptions = parseSparkDiagnosticCliArgs([]);

    return createFinalCliOutput({
      ok: false,
      exitCode: SparkDiagnosticCliExitCode.InternalError,
      mode: "disabled",
      parsedOptions,
      warnings: [],
      errors: [
        createCliIssue({
          code: "internal_error",
          severity: "error",
          message:
            "Spark diagnostic CLI wrapper scaffold encountered an internal error. No raw error stack, secret, network response, prompt, or message was output.",
        }),
      ],
      formatOptions: options,
    });
  }
}

export function toSparkDiagnosticCliExitCode(
  output: Pick<SparkDiagnosticCliOutput, "exitCode">,
): SparkDiagnosticCliExitCode {
  return output.exitCode;
}

function createSparkDiagnosticCliDiagnosticSummary(
  result: SparkDiagnosticResult,
): SparkDiagnosticCliDiagnosticSummary {
  return {
    diagnosticKind: result.diagnosticKind,
    requestId: result.requestId,
    invocationKind: result.invocationKind,
    mode: result.mode,
    decisionKind: result.decision.decisionKind,
    blockedReasons: result.decision.blockedReasons,
    requestPreviewCreated: result.requestPreview !== undefined,
    requestPreviewMessageCount:
      result.requestPreview?.requestPreview.messages.length ?? 0,
    redactedConfigSummary: result.redactedConfigSummary,
    safePromptSummary: result.safePromptSummary,
    metadataSafetySummary: result.metadataSafetySummary,
    envConfigSafetySummary: result.envConfigSafetySummary,
    llmResultLikeSummary:
      result.llmResultLike === undefined
        ? undefined
        : {
            ok: result.llmResultLike.ok,
            providerKey: result.llmResultLike.providerKey,
            modelLabel: result.llmResultLike.modelLabel,
            finishReason: result.llmResultLike.finishReason,
            errorKind: result.llmResultLike.error?.errorKind,
            rawProviderErrorStored: false,
          },
    message: result.message,
    warnings: result.warnings,
    previewOnly: true,
    serverOnly: true,
    manualTriggerRequired: true,
    realProviderCalled: false,
    networkAccessed: false,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    llmCallEnabled: false,
  };
}

function createSparkControlledDiagnosticCliDiagnosticSummary(
  result: SparkControlledDiagnosticCallResult,
): SparkDiagnosticCliDiagnosticSummary {
  const consoleSummary = createSafeSparkDiagnosticConsoleSummary(result);

  return {
    diagnosticKind: result.diagnosticKind,
    requestId: result.requestId,
    invocationKind: "cli_manual",
    mode: "controlled_real_call",
    status: result.status,
    blockedReasons: result.blockedReasons,
    requestPreviewCreated: result.requestSummary !== undefined,
    requestPreviewMessageCount: result.requestSummary?.messageCount ?? 0,
    safePromptSummary: {
      promptKind: "fixed_diagnostic_prompt",
      contentSummary:
        "Fixed safe Spark diagnostic prompt. It contains no user private data, project secret, file content, raw conversation, raw tool input, or authorization data.",
      contentLength: result.requestSummary?.promptLength ?? 0,
      containsUserPrivateData: false,
      containsProjectSecret: false,
      containsRawConversation: false,
      containsFileContent: false,
      safeForDiagnostic: true,
    },
    llmResultLikeSummary: {
      ok: result.llmResultLike.ok,
      providerKey: result.llmResultLike.providerKey,
      modelLabel: result.llmResultLike.modelLabel,
      finishReason: result.llmResultLike.finishReason,
      errorKind: result.llmResultLike.error?.errorKind,
      rawProviderErrorStored: false,
    },
    responseSummary: result.responseSummary,
    safeErrorSummary: result.safeErrorSummary,
    usage: result.usage,
    latencyMs: result.latencyMs,
    retryCount: result.retryCount,
    externalRequestAttempted: result.externalRequestAttempted,
    externalRequestCount: result.externalRequestCount,
    possibleCostIncurred: result.possibleCostIncurred,
    message: consoleSummary.json.safeErrorSummary?.message ?? consoleSummary.text,
    warnings: result.warnings,
    previewOnly: false,
    serverOnly: true,
    manualTriggerRequired: true,
    realProviderCalled: result.realProviderCalled,
    networkAccessed: result.networkAccessed,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    llmCallEnabled: result.llmResultLike.llmCallEnabled,
  };
}

function createFinalCliOutput(input: {
  readonly ok: boolean;
  readonly exitCode: SparkDiagnosticCliExitCode;
  readonly mode: SparkDiagnosticCliMode;
  readonly parsedOptions: SparkDiagnosticCliParsedOptions;
  readonly diagnostics?: SparkDiagnosticCliDiagnosticSummary;
  readonly redactedConfigSummary?: LlmProviderConfigPublicSummary;
  readonly warnings: readonly SparkDiagnosticCliIssue[];
  readonly errors: readonly SparkDiagnosticCliIssue[];
  readonly realProviderCalled?: boolean;
  readonly networkAccessed?: boolean;
  readonly llmCallEnabled?: boolean;
  readonly formatOptions: SparkDiagnosticCliFormatOptions;
}): SparkDiagnosticCliOutput {
  const outputWithoutTextAndJson: Omit<
    SparkDiagnosticCliOutput,
    "text" | "json"
  > = {
    ok: input.ok,
    exitCode: input.exitCode,
    mode: input.mode,
    diagnostics: input.diagnostics,
    redactedConfigSummary: input.redactedConfigSummary,
    parsedOptions: input.parsedOptions,
    warnings: normalizeCliIssues(input.warnings),
    errors: normalizeCliIssues(input.errors),
    secretSafe: true,
    realProviderCalled: input.realProviderCalled ?? false,
    networkAccessed: input.networkAccessed ?? false,
    rawPromptStored: false,
    rawMessagesStored: false,
    rawResponseStored: false,
    llmCallEnabled: input.llmCallEnabled ?? false,
  };
  const json =
    input.parsedOptions.json || input.formatOptions.forceJson === true
      ? createSparkDiagnosticCliJsonOutput(outputWithoutTextAndJson)
      : undefined;
  const output: SparkDiagnosticCliOutput = {
    ...outputWithoutTextAndJson,
    text: "",
    json,
  };

  return {
    ...output,
    text: formatSparkDiagnosticCliOutput(output, input.formatOptions),
  };
}

function loadRedactedConfigSummary(
  envLike: SparkDiagnosticCliEnvLike,
): LlmProviderConfigPublicSummary {
  return createRedactedLlmProviderConfigSummary(
    loadLlmProviderConfigsFromEnv(envLike),
  );
}

function configWarningToCliIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity: string;
}): SparkDiagnosticCliIssue {
  return createCliIssue({
    code: "diagnostic_disabled",
    severity: input.severity === "error" ? "error" : "warning",
    message: input.message,
  });
}

function diagnosticWarningToCliIssue(message: string): SparkDiagnosticCliIssue {
  return createCliIssue({
    code: "diagnostic_disabled",
    severity: "info",
    message,
  });
}

function shouldRenderJson(
  output: SparkDiagnosticCliOutput,
  options: SparkDiagnosticCliFormatOptions,
): boolean {
  return (
    options.forceText !== true &&
    (options.forceJson === true || output.parsedOptions.json)
  );
}

function formatConfigSummaryLines(
  summary: LlmProviderConfigPublicSummary,
): string[] {
  return [
    "redactedConfigSummary:",
    `defaultProviderKey=${summary.defaultProviderKey}`,
    `mode=${summary.mode}`,
    `readDotEnvFile=${summary.readDotEnvFile}`,
    `readDotEnvExampleFile=${summary.readDotEnvExampleFile}`,
    `realProviderCallsEnabled=${summary.realProviderCallsEnabled}`,
    `networkAccessEnabled=${summary.networkAccessEnabled}`,
    `sparkProviderEnabled=${summary.redactedSummaries.spark.enabled}`,
    `sparkSecretPreview=${summary.redactedSummaries.spark.secretPreview}`,
    `sparkSecretConfigured=${summary.redactedSummaries.spark.secretConfigured}`,
    `legacyTestApi=${summary.redactedSummaries.sparkSecrets.legacyTestApi.preview}`,
  ];
}

function formatCliIssue(issue: SparkDiagnosticCliIssue): string {
  return `- [${issue.severity}] ${issue.code}${issue.argName === undefined ? "" : ` (${issue.argName})`}: ${issue.message}`;
}

function createCliIssue(input: {
  readonly code: SparkDiagnosticCliIssueCode;
  readonly message: string;
  readonly severity: SparkDiagnosticCliIssueSeverity;
  readonly argName?: string;
}): SparkDiagnosticCliIssue {
  return {
    code: input.code,
    message: input.message,
    severity: input.severity,
    argName: input.argName,
    safeForLogs: true,
  };
}

function getCliMode(input: {
  readonly helpRequested: boolean;
  readonly showConfig: boolean;
  readonly dryRun: boolean;
}): SparkDiagnosticCliMode {
  if (input.helpRequested) {
    return "help";
  }

  if (input.showConfig) {
    return "show_config";
  }

  if (input.dryRun) {
    return "dry_run";
  }

  return "disabled";
}

function parsePurposeSummary(
  value: string,
): {
  readonly value?: string;
  readonly error?: SparkDiagnosticCliIssue;
} {
  const normalized = normalizePurposeSummary(value);

  if (normalized === undefined) {
    return {
      error: createCliIssue({
        code: "missing_purpose_value",
        severity: "error",
        argName: "--purpose",
        message:
          "--purpose 需要一个非空、非敏感用途摘要；未执行诊断。",
      }),
    };
  }

  if (looksLikeSensitiveText(normalized)) {
    return {
      error: createCliIssue({
        code: "unsafe_purpose_summary",
        severity: "error",
        argName: "--purpose",
        message:
          "--purpose 疑似包含 secret、authorization、token 或 raw payload；A117 不回显该值，也不会执行诊断。",
      }),
    };
  }

  return { value: normalized };
}

function normalizePurposeSummary(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  return normalized.length === 0 ? undefined : normalized.slice(0, 160);
}

function normalizeRawArg(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? undefined : normalized;
}

function hasFollowingValue(
  argv: SparkDiagnosticCliArgvLike,
  index: number,
): boolean {
  const next = normalizeRawArg(argv[index + 1]);

  return next !== undefined && !next.startsWith("-");
}

function isDangerousCliArgument(value: string): boolean {
  return DANGEROUS_CLI_ARGUMENT_NAME_SET.has(
    normalizeCliArgumentName(value),
  );
}

function normalizeCliArgumentName(value: string): string {
  const [name] = value.split("=");

  return name.replace(/^-+/u, "").replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function sanitizeCliArgumentName(value: string): string {
  const [name] = value.split("=");
  const normalizedName = name.startsWith("-") ? name : "positional_arg";

  return normalizedName.replace(/[^\w-]/gu, "_").slice(0, 64);
}

function looksLikeSensitiveText(value: string): boolean {
  return [
    /\bauthorization\s*[:=]/iu,
    /\bbearer\s+\S+/iu,
    /\bapi[-_ ]?key\s*[:=]/iu,
    /\btoken\s*[:=]/iu,
    /\bsecret\s*[:=]/iu,
    /\bpassword\s*[:=]/iu,
    /\bcredential\s*[:=]/iu,
    /\braw[-_ ]?(prompt|messages|response)\s*[:=]/iu,
  ].some((pattern) => pattern.test(value));
}

function resolveNow(
  now: SparkDiagnosticCliRunOptions["now"],
): string | undefined {
  if (typeof now === "function") {
    return now();
  }

  return now;
}

function normalizeCliIssues(
  issues: readonly SparkDiagnosticCliIssue[],
): SparkDiagnosticCliIssue[] {
  const normalizedIssues: SparkDiagnosticCliIssue[] = [];
  const seen = new Set<string>();

  for (const issue of issues) {
    const key = [
      issue.code,
      issue.severity,
      issue.argName ?? "",
      issue.message,
    ].join("|");

    if (!seen.has(key)) {
      seen.add(key);
      normalizedIssues.push(issue);
    }
  }

  return normalizedIssues;
}

function normalizeUniqueStrings(values: readonly string[]): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    const key = normalized.toLowerCase();

    if (normalized.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalizedValues.push(normalized);
    }
  }

  return normalizedValues;
}
