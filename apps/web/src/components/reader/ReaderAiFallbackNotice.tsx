import type { ChapterQaAnswerMetadata } from "@learning-agent-platform/ai-core";

interface ReaderAiFallbackNoticeProps {
  metadata: ChapterQaAnswerMetadata;
}

export function ReaderAiFallbackNotice({
  metadata,
}: ReaderAiFallbackNoticeProps) {
  if (metadata.answerSource === "fallback_mock") {
    return (
      <p className="askAiLimit">
        当前回答来自模拟回退。请求的真实模型提供方失败，错误分类为{" "}
        {metadata.errorCategory ?? "unknown"}；该响应不会被呈现为真实模型回答。
      </p>
    );
  }

  if (metadata.answerSource === "real_openai") {
    return (
      <p className="askAiLimit">
        当前回答标记为真实模型来源；reader 预览默认不应出现此状态，请按安全边界复核。
      </p>
    );
  }

  return (
    <p className="askAiLimit">
      当前回答来自确定性的模拟模型提供方。
    </p>
  );
}
