import type { ChapterQaAnswerMetadata } from "@learning-agent-platform/ai-core";

import type { ReaderQaActionProviderStatus } from "../../app/reader/reader-qa-action-types";

interface ReaderAiAnswerMetadataProps {
  metadata: ChapterQaAnswerMetadata;
  providerStatus: ReaderQaActionProviderStatus;
}

export function ReaderAiAnswerMetadata({
  metadata,
  providerStatus,
}: ReaderAiAnswerMetadataProps) {
  return (
    <dl className="aiContextList mockContextList" aria-label="回答元信息">
      <div>
        <dt>回答来源</dt>
        <dd>{metadata.answerSource}</dd>
      </div>
      <div>
        <dt>模型提供方</dt>
        <dd>{metadata.providerId}</dd>
      </div>
      <div>
        <dt>提供方标签</dt>
        <dd>{metadata.providerLabel}</dd>
      </div>
      <div>
        <dt>请求的提供方</dt>
        <dd>{metadata.requestedProviderMode}</dd>
      </div>
      <div>
        <dt>解析后的提供方</dt>
        <dd>{metadata.resolvedProviderMode}</dd>
      </div>
      <div>
        <dt>模型是否已配置</dt>
        <dd>{metadata.modelConfigured ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>模型状态</dt>
        <dd>{providerStatus.modelStatus}</dd>
      </div>
      <div>
        <dt>是否使用网络</dt>
        <dd>{metadata.networkUsed ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>是否使用回退</dt>
        <dd>{metadata.fallbackUsed ? "是" : "否"}</dd>
      </div>
      <div>
        <dt>回退原因</dt>
        <dd>{metadata.fallbackReason ?? "无"}</dd>
      </div>
      <div>
        <dt>错误分类</dt>
        <dd>{metadata.errorCategory ?? "无"}</dd>
      </div>
      <div>
        <dt>上下文分块范围</dt>
        <dd>{formatChunkRange(metadata)}</dd>
      </div>
    </dl>
  );
}

function formatChunkRange(metadata: ChapterQaAnswerMetadata): string {
  const { startChunkIndex, endChunkIndex, chunkIndexes } =
    metadata.contextChunkRange;

  if (chunkIndexes.length === 0 || startChunkIndex === null || endChunkIndex === null) {
    return "无";
  }

  if (startChunkIndex === endChunkIndex) {
    return `#${startChunkIndex}`;
  }

  return `#${startChunkIndex}-#${endChunkIndex}`;
}
