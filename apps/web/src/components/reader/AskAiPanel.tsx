"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import type { ChapterQaAnswer } from "@learning-agent-platform/ai-core";

import { askChapterQuestionAction } from "../../app/reader/reader-qa-actions";
import { ReaderQaHistorySaveStatus } from "../../app/reader/components/ReaderQaHistorySaveStatus";
import type {
  AskChapterQuestionActionFailure,
  ReaderQaActionProviderStatus,
} from "../../app/reader/reader-qa-action-types";
import type { ReaderQaHistorySaveResult } from "../../app/reader/reader-qa-history-save-types";
import type {
  MockAbilityProfile,
  MockReadingProgress,
} from "../../lib/mock-learning-context";
import { buildReaderChapterQaContext } from "../../lib/reader-qa-context";
import type {
  MockQaMessage,
  ReaderContentChunk,
  ReaderDataSource,
} from "../../lib/reader-types";
import { ReaderAiAnswerMetadata } from "./ReaderAiAnswerMetadata";
import { ReaderAiFallbackNotice } from "./ReaderAiFallbackNotice";
import { ReaderAiProviderNotice } from "./ReaderAiProviderNotice";

interface AskAiPanelProps {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterTitle: string;
  chapterText: string;
  chunks: readonly ReaderContentChunk[];
  initialProviderStatus: ReaderQaActionProviderStatus;
  readingProgress: MockReadingProgress;
  abilityProfile: MockAbilityProfile;
  readerDataSource: ReaderDataSource;
}

interface MockQaExchange {
  id: string;
  userMessage: MockQaMessage;
  assistantMessage: MockQaMessage;
  answer: ChapterQaAnswer;
  providerStatus: ReaderQaActionProviderStatus;
  historySaveResult: ReaderQaHistorySaveResult;
}

function formatChunkIndexes(indexes: readonly number[]): string {
  if (indexes.length === 0) {
    return "没有直接匹配的分块";
  }

  return indexes.map((index) => `#${index}`).join(", ");
}

function formatAnswerLabel(answer: ChapterQaAnswer): string {
  if (answer.metadata.answerSource === "real_openai") {
    return "真实模型回答（当前 reader 预览不应出现）";
  }

  if (answer.metadata.answerSource === "fallback_mock") {
    return "模拟回退回答";
  }

  return "模拟回答";
}

export function AskAiPanel({
  bookId,
  bookTitle,
  chapterId,
  chapterTitle,
  chapterText,
  chunks,
  initialProviderStatus,
  readingProgress,
  abilityProfile,
  readerDataSource,
}: AskAiPanelProps) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<MockQaExchange[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorResult, setErrorResult] =
    useState<AskChapterQuestionActionFailure | null>(null);
  const [currentProviderStatus, setCurrentProviderStatus] =
    useState<ReaderQaActionProviderStatus>(initialProviderStatus);
  const [isAsking, setIsAsking] = useState(false);
  const trimmedQuestion = question.trim();
  const isAskDisabled = trimmedQuestion.length === 0 || isAsking;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (trimmedQuestion.length === 0) {
      return;
    }

    const askedQuestion = trimmedQuestion;
    const context = buildReaderChapterQaContext({
      question: askedQuestion,
      bookTitle,
      chapterTitle,
      chapterText,
      chunks,
      readingProgress,
      abilityProfile,
    });
    setErrorMessage(null);
    setErrorResult(null);
    setIsAsking(true);

    try {
      const result = await askChapterQuestionAction({
        question: askedQuestion,
        context,
        readerIdentity: {
          bookId,
          chapterId,
          readerDataSource,
        },
      });
      setCurrentProviderStatus(result.providerStatus);

      if (!result.ok) {
        setErrorMessage(result.message);
        setErrorResult(result);
        return;
      }

      const answer = result.answer;

      setHistory((currentHistory) => {
        const exchangeNumber = currentHistory.length + 1;
        const exchangeId = `mock-server-qa-${exchangeNumber}`;

        return [
          {
            id: exchangeId,
            userMessage: {
              id: `${exchangeId}-user`,
              role: "user",
              content: askedQuestion,
            },
            assistantMessage: {
              id: `${exchangeId}-assistant`,
              role: "assistant",
              content: answer.content,
            },
            answer,
            providerStatus: result.providerStatus,
            historySaveResult: result.historySaveResult,
          },
          ...currentHistory,
        ];
      });
      setQuestion("");
    } catch {
      setErrorMessage(
        "模拟问答预览未能返回结构化结果，未调用真实模型。",
      );
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <section className="askAiPanel" aria-labelledby="ask-ai-title">
      <p className="eyebrow">{currentProviderStatus.providerKind} 模式</p>
      <h2 id="ask-ai-title">章节问答预览</h2>
      <p>
        当前 reader 问答保持 mock-only 预览，不会调用真实模型、RAG 或工具。
      </p>
      <ReaderAiProviderNotice status={currentProviderStatus} />

      <form className="askAiForm" onSubmit={handleSubmit}>
        <label className="visuallyHidden" htmlFor="mock-ai-question">
          输入章节问答预览问题
        </label>
        <textarea
          id="mock-ai-question"
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="仅用于模拟问答预览，不会发送到真实模型"
          rows={4}
          value={question}
        />
        <button disabled={isAskDisabled} type="submit">
          {isAsking ? "正在生成模拟回答..." : "生成模拟回答"}
        </button>
      </form>

      <p aria-live="polite" className="askAiLimit">
        {isAsking
          ? "正在使用当前阅读上下文生成模拟回答。"
          : "当前只允许模拟提供方；真实模型、RAG 和工具调用未启用。"}
      </p>
      {errorMessage === null ? null : (
        <p className="askAiLimit" role="alert">
          {errorMessage}
        </p>
      )}
      {errorResult === null ? null : (
        <dl className="aiProviderNotice" aria-label="AI 提问错误元数据">
          <div>
            <dt>错误分类 (error_category)</dt>
            <dd>{errorResult.errorCategory ?? "无"}</dd>
          </div>
          <div>
            <dt>是否使用回退 (fallback_used)</dt>
            <dd>{errorResult.fallbackUsed ? "是" : "否"}</dd>
          </div>
          <div>
            <dt>回退原因 (fallback_reason)</dt>
            <dd>{errorResult.fallbackReason ?? "无"}</dd>
          </div>
          <div>
            <dt>是否使用网络 (network_used)</dt>
            <dd>{errorResult.providerStatus.networkUsed ? "是" : "否"}</dd>
          </div>
          <div>
            <dt>历史保存状态 (history_save_status)</dt>
            <dd>{errorResult.historySaveResult.status}</dd>
          </div>
          <div>
            <dt>历史保存消息 (history_save_message)</dt>
            <dd>{errorResult.historySaveResult.message}</dd>
          </div>
        </dl>
      )}

      <div className="mockQaHistory" aria-live="polite">
        {history.length === 0 ? (
          <p className="mockQaEmpty">提出一个问题以查看模拟问答预览。</p>
        ) : (
          history.map((exchange) => (
            <article className="mockQaCard" key={exchange.id}>
              <div className="mockQaMessage mockQaQuestion">
                <span>问题</span>
                <p>{exchange.userMessage.content}</p>
              </div>
              <div className="mockQaMessage mockQaAnswer">
                <span>{formatAnswerLabel(exchange.answer)}</span>
                {exchange.assistantMessage.content.split("\n\n").map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <ReaderAiFallbackNotice metadata={exchange.answer.metadata} />
              <ReaderAiAnswerMetadata
                metadata={exchange.answer.metadata}
                providerStatus={exchange.providerStatus}
              />
              <ReaderQaHistorySaveStatus result={exchange.historySaveResult} />
              <dl className="aiContextList mockContextList">
                <div>
                  <dt>书籍</dt>
                  <dd>{exchange.answer.contextSummary.bookTitle}</dd>
                </div>
                <div>
                  <dt>章节</dt>
                  <dd>{exchange.answer.contextSummary.chapterTitle}</dd>
                </div>
                <div>
                  <dt>分块</dt>
                  <dd>{formatChunkIndexes(exchange.answer.usedChunkIndexes)}</dd>
                </div>
                <div>
                  <dt>进度</dt>
                  <dd>{exchange.answer.contextSummary.readingProgress}</dd>
                </div>
                <div>
                  <dt>能力</dt>
                  <dd>{exchange.answer.contextSummary.abilityProfile}</dd>
                </div>
                <div>
                  <dt>请求的模型提供方</dt>
                  <dd>{exchange.providerStatus.requestedProviderMode}</dd>
                </div>
                <div>
                  <dt>解析后的模型提供方</dt>
                  <dd>{exchange.providerStatus.resolvedProviderMode}</dd>
                </div>
                <div>
                  <dt>模型提供方</dt>
                  <dd>{exchange.providerStatus.provider}</dd>
                </div>
                <div>
                  <dt>选择策略</dt>
                  <dd>{exchange.providerStatus.selection}</dd>
                </div>
                <div>
                  <dt>运行状态</dt>
                  <dd>{exchange.providerStatus.runtimeStatus}</dd>
                </div>
                <div>
                  <dt>密钥状态</dt>
                  <dd>{exchange.providerStatus.secretStatus}</dd>
                </div>
                <div>
                  <dt>模型状态</dt>
                  <dd>{exchange.providerStatus.modelStatus}</dd>
                </div>
                <div>
                  <dt>提供方状态</dt>
                  <dd>{exchange.providerStatus.status}</dd>
                </div>
                <div>
                  <dt>真实模型状态</dt>
                  <dd>
                    {exchange.providerStatus.realAi} (
                    {exchange.providerStatus.realAiEnabled ? "已启用" : "已禁用"})
                  </dd>
                </div>
                <div>
                  <dt>禁用原因</dt>
                  <dd>{exchange.providerStatus.disabledReason ?? "无"}</dd>
                </div>
                <div>
                  <dt>网络使用情况</dt>
                  <dd>
                    {exchange.providerStatus.network} (
                    {exchange.providerStatus.networkUsed ? "已使用" : "未使用"})
                  </dd>
                </div>
                <div>
                  <dt>网络是否启用</dt>
                  <dd>{exchange.providerStatus.networkEnabled ? "是" : "否"}</dd>
                </div>
                <div>
                  <dt>网络是否允许</dt>
                  <dd>{exchange.providerStatus.networkAllowed ? "是" : "否"}</dd>
                </div>
                <div>
                  <dt>可使用真实提供方</dt>
                  <dd>{exchange.providerStatus.canUseRealProvider ? "是" : "否"}</dd>
                </div>
                <div>
                  <dt>传输方式</dt>
                  <dd>{exchange.providerStatus.transport}</dd>
                </div>
                <div>
                  <dt>上下文来源</dt>
                  <dd>{exchange.providerStatus.contextSource}</dd>
                </div>
              </dl>
              <ul className="mockLimitations">
                {exchange.answer.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
