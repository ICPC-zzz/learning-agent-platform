import type { ReaderQaActionProviderStatus } from "../../app/reader/reader-qa-action-types";

interface ReaderAiProviderNoticeProps {
  status: ReaderQaActionProviderStatus;
}

export function ReaderAiProviderNotice({
  status,
}: ReaderAiProviderNoticeProps) {
  return (
    <dl className="aiProviderNotice" aria-label="AI 模型提供方状态">
      <div>
        <dt>请求的提供方 (requested_provider)</dt>
        <dd>{status.requestedProviderMode}</dd>
      </div>
      <div>
        <dt>解析后的提供方 (resolved_provider)</dt>
        <dd>{status.resolvedProviderMode}</dd>
      </div>
      <div>
        <dt>模型提供方 (provider)</dt>
        <dd>{status.provider}</dd>
      </div>
      <div>
        <dt>提供方标签 (provider_label)</dt>
        <dd>{status.providerLabel}</dd>
      </div>
      <div>
        <dt>选择策略 (selection)</dt>
        <dd>{status.selection}</dd>
      </div>
      <div>
        <dt>提供方类型 (provider_kind)</dt>
        <dd>{status.providerKind}</dd>
      </div>
      <div>
        <dt>运行状态 (runtime_status)</dt>
        <dd>{status.runtimeStatus}</dd>
      </div>
      <div>
        <dt>提供方状态 (provider_status)</dt>
        <dd>{status.status}</dd>
      </div>
      <div>
        <dt>密钥状态 (secret_status)</dt>
        <dd>{status.secretStatus}</dd>
      </div>
      <div>
        <dt>模型状态 (model_status)</dt>
        <dd>{status.modelStatus}</dd>
      </div>
      <div>
        <dt>真实模型状态 (real_ai)</dt>
        <dd>{status.realAi}</dd>
      </div>
      <div>
        <dt>真实模型是否启用 (real_ai_enabled)</dt>
        <dd>{status.realAiEnabled ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>禁用原因 (disabled_reason)</dt>
        <dd>{status.disabledReason ?? "无"}</dd>
      </div>
      <div>
        <dt>网络 (network)</dt>
        <dd>{status.network}</dd>
      </div>
      <div>
        <dt>网络是否启用 (network_enabled)</dt>
        <dd>{status.networkEnabled ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>网络是否允许 (network_allowed)</dt>
        <dd>{status.networkAllowed ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>是否使用网络 (network_used)</dt>
        <dd>{status.networkUsed ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>可使用真实提供方 (can_use_real_provider)</dt>
        <dd>{status.canUseRealProvider ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>是否启用模拟回退 (fallback_to_mock_enabled)</dt>
        <dd>{status.fallbackToMockEnabled ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>传输方式 (transport)</dt>
        <dd>{status.transport}</dd>
      </div>
      <div>
        <dt>上下文来源 (context_source)</dt>
        <dd>{status.contextSource}</dd>
      </div>
    </dl>
  );
}
