"use client";

import { useState, useTransition } from "react";

import type {
  LearningDashboardFallbackReason,
  LearningRecommendationDisplaySource,
  LearningRecommendedProblemView,
} from "../../../lib/learning-types";
import { saveRecommendedProblemAttemptAction } from "../actions";
import type {
  LearningProblemAttemptFeedbackResult,
  LearningProblemAttemptSaveInput,
  LearningProblemAttemptSaveResult,
} from "../learning-problem-attempt-save-types";

interface LearningProblemAttemptSaveControlsProps {
  recommendedProblems: readonly LearningRecommendedProblemView[];
  recommendationSource: LearningRecommendationDisplaySource;
  fallbackReason?: LearningDashboardFallbackReason;
}

interface PendingRequest {
  problemId: string;
  result: LearningProblemAttemptFeedbackResult;
}

const feedbackOptions: readonly {
  result: LearningProblemAttemptFeedbackResult;
  label: string;
}[] = [
  { result: "attempted", label: "标记已尝试" },
  { result: "solved", label: "已解决" },
  { result: "failed", label: "失败" },
];

export function LearningProblemAttemptSaveControls({
  recommendedProblems,
  recommendationSource,
  fallbackReason,
}: LearningProblemAttemptSaveControlsProps) {
  const blockingResult = createBlockingResult({
    recommendedProblemCount: recommendedProblems.length,
    recommendationSource,
    fallbackReason,
  });
  const [result, setResult] =
    useState<LearningProblemAttemptSaveResult | null>(blockingResult);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const displayedResult = result ?? blockingResult;
  const isBlocked = blockingResult !== null;

  function handleSave(
    item: LearningRecommendedProblemView,
    feedbackResult: LearningProblemAttemptFeedbackResult,
  ) {
    const actionInput = createActionInput({
      item,
      result: feedbackResult,
      recommendationSource,
    });

    if (actionInput === null) {
      setResult(
        createLocalResult({
          status: "validation_error",
          message:
            "题目尝试未保存，因为此推荐题目没有可用标识符。",
          problemTitle: item.problem.title,
          result: feedbackResult,
        }),
      );
      return;
    }

    setPendingRequest({
      problemId: actionInput.problemId ?? actionInput.externalProblemId ?? "",
      result: feedbackResult,
    });
    startTransition(async () => {
      try {
        const nextResult =
          await saveRecommendedProblemAttemptAction(actionInput);

        setResult(nextResult);
      } catch {
        setResult(
          createLocalResult({
            status: "save_failed",
            message:
              "题目尝试未保存，因为 server action 执行失败。",
            problemId: actionInput.problemId,
            externalProblemId: actionInput.externalProblemId,
            problemTitle: actionInput.problemTitle,
            result: feedbackResult,
          }),
        );
      } finally {
        setPendingRequest(null);
      }
    });
  }

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="problem-attempt-save-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">手动反馈</p>
          <h2 id="problem-attempt-save-title">题目尝试保存</h2>
        </div>
        <span className="difficultyBadge">
          {isPending ? "保存中" : formatProblemAttemptSaveStatus(displayedResult?.status)}
        </span>
      </div>

      <div className="recommendationSourceRow" aria-live="polite">
        <span>
          {isPending ? "保存中" : formatProblemAttemptSaveStatus(displayedResult?.status)}
        </span>
        <p>
          {isPending
            ? "正在为选中的推荐题目保存一条手动 ProblemAttempt。"
            : displayedResult?.message ??
              "为一个推荐题目选择手动结果。"}
        </p>
      </div>

      <dl className="eventStats">
        <div>
          <dt>尝试保存状态</dt>
          <dd>{isPending ? "保存中" : formatProblemAttemptSaveStatus(displayedResult?.status)}</dd>
        </div>
        <div>
          <dt>已保存</dt>
          <dd>{displayedResult?.saved === true ? "是" : "否"}</dd>
        </div>
        <div>
          <dt>题目</dt>
          <dd>
            {displayedResult?.problemId ??
              displayedResult?.externalProblemId ??
              "无"}
          </dd>
        </div>
        <div>
          <dt>结果</dt>
          <dd>{formatFeedbackResult(displayedResult?.result)}</dd>
        </div>
        <div>
          <dt>尝试 ID</dt>
          <dd>{displayedResult?.attemptId ?? "无"}</dd>
        </div>
      </dl>

      {displayedResult?.problemTitle !== undefined ? (
        <p className="panelNote">
          最近题目：{displayedResult.problemTitle}
          {displayedResult.savedAt !== undefined
            ? `；保存时间 ${displayedResult.savedAt}`
            : ""}
        </p>
      ) : null}

      {recommendedProblems.length > 0 ? (
        <ol className="problemList">
          {recommendedProblems.map((item) => {
            const problem = item.problem;
            const hasProblemIdentifier = problem.id.trim().length > 0;

            return (
              <li className="problemItem" key={problem.id}>
                <div className="problemHeader">
                  <div>
                    <h3>{problem.title}</h3>
                    <p>
                      {problem.id} - {problem.difficulty}
                    </p>
                  </div>
                  <strong>{problem.source ?? "recommendation"}</strong>
                </div>

                <ul className="tagList" aria-label={`${problem.title} tags`}>
                  {problem.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>

                {hasProblemIdentifier ? (
                  <div className="recommendationContext">
                    {feedbackOptions.map((option) => {
                      const isCurrentPending =
                        pendingRequest?.problemId === problem.id &&
                        pendingRequest.result === option.result;

                      return (
                        <button
                          className="secondaryLink"
                          disabled={isBlocked || isPending}
                          key={`${problem.id}-${option.result}`}
                          onClick={() => handleSave(item, option.result)}
                          type="button"
                        >
                          {isCurrentPending ? "保存中..." : option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="panelNote">
                    反馈不可用：缺少题目标识符。
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="panelNote recommendationEmptyState">
          当前没有可用于 ProblemAttempt 反馈的推荐题目。
        </p>
      )}

      <div className="warningBlock">
        <h3>保存边界</h3>
        <ul>
          <li>通过 server action 保存一条 ProblemAttempt。</li>
          <li>使用演示用户和当前推荐题目 ID。</li>
          <li>不会评判代码，也不会重新计算能力或推荐。</li>
        </ul>
      </div>
    </section>
  );
}

function createActionInput({
  item,
  result,
  recommendationSource,
}: {
  item: LearningRecommendedProblemView;
  result: LearningProblemAttemptFeedbackResult;
  recommendationSource: LearningRecommendationDisplaySource;
}): LearningProblemAttemptSaveInput | null {
  const problem = item.problem;
  const problemId = problem.id.trim();

  if (problemId.length === 0) {
    return null;
  }

  return {
    problemId,
    problemTitle: problem.title,
    difficulty: problem.difficulty,
    topicTags: problem.tags,
    recommendationSource,
    result,
  };
}

function createBlockingResult({
  recommendedProblemCount,
  recommendationSource,
  fallbackReason,
}: {
  recommendedProblemCount: number;
  recommendationSource: LearningRecommendationDisplaySource;
  fallbackReason?: LearningDashboardFallbackReason;
}): LearningProblemAttemptSaveResult | null {
  if (recommendationSource === "mock_fallback") {
    if (fallbackReason === "missing_database_url") {
      return createLocalResult({
        status: "database_unavailable",
        message:
          "ProblemAttempt 保存不可用，因为 DATABASE_URL 未配置。",
      });
    }

    if (fallbackReason === "no_demo_user_found") {
      return createLocalResult({
        status: "demo_user_missing",
        message:
          "ProblemAttempt 保存不可用，因为未找到 demo@example.com。",
      });
    }

    return createLocalResult({
      status: "recommendation_unavailable",
      message:
        "仪表盘正在显示模拟回退推荐，ProblemAttempt 保存不可用。",
    });
  }

  if (recommendationSource === "unavailable" || recommendedProblemCount <= 0) {
    return createLocalResult({
      status: "recommendation_unavailable",
      message:
        "在推荐题目可用前，ProblemAttempt 保存不可用。",
    });
  }

  return null;
}

function formatProblemAttemptSaveStatus(
  status: LearningProblemAttemptSaveResult["status"] | undefined,
): string {
  if (status === undefined) {
    return "就绪";
  }

  const labels: Record<LearningProblemAttemptSaveResult["status"], string> = {
    database_unavailable: "数据库不可用",
    demo_user_missing: "缺少演示用户",
    problem_unavailable: "题目不可用",
    recommendation_unavailable: "推荐不可用",
    save_failed: "保存失败",
    saved: "已保存",
    validation_error: "校验失败",
  };

  return labels[status];
}

function formatFeedbackResult(
  result: LearningProblemAttemptFeedbackResult | undefined,
): string {
  if (result === undefined) {
    return "无";
  }

  const labels: Record<LearningProblemAttemptFeedbackResult, string> = {
    attempted: "已尝试",
    failed: "失败",
    solved: "已解决",
  };

  return labels[result];
}

function createLocalResult(
  input: Pick<LearningProblemAttemptSaveResult, "status" | "message"> &
    Partial<
      Pick<
        LearningProblemAttemptSaveResult,
        | "problemId"
        | "externalProblemId"
        | "problemTitle"
        | "result"
        | "correctness"
      >
    >,
): LearningProblemAttemptSaveResult {
  return {
    ...input,
    saved: false,
    source: "daily_recommendation",
  };
}
