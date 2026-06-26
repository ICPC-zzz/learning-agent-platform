import Link from "next/link";

import type { LearningNextStepSuggestionViewModel } from "../learning-next-step-suggestion-types";
import {
  buildReaderHref,
  LEARNING_READER_LINK_PREVIEW_NOTE,
  LEARNING_READER_LINK_UNAVAILABLE_NOTE,
} from "../learning-reader-link";

interface LearningNextStepSuggestionPanelProps {
  suggestion: LearningNextStepSuggestionViewModel;
}

export function LearningNextStepSuggestionPanel({
  suggestion,
}: LearningNextStepSuggestionPanelProps) {
  const readerHref = buildReaderHref(
    suggestion.relatedBookId,
    suggestion.relatedChapterId,
  );

  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="learning-next-step-suggestion-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">开发预览 / 规则推断</p>
          <h2 id="learning-next-step-suggestion-title">
            下一步学习建议（开发预览）
          </h2>
        </div>
        <span className="difficultyBadge">{suggestion.confidenceLabel}</span>
      </div>

      <div className="recommendationSourceRow">
        <span>{suggestion.sourceLabel}</span>
        <p>{suggestion.reason}</p>
      </div>

      <h3>{suggestion.title}</h3>
      <p className="panelNote">{suggestion.description}</p>

      <dl className="eventStats">
        <div>
          <dt>数据来源</dt>
          <dd>{suggestion.source}</dd>
        </div>
        <div>
          <dt>关联 bookId</dt>
          <dd>{suggestion.relatedBookId ?? "暂无"}</dd>
        </div>
        <div>
          <dt>关联 chapterId</dt>
          <dd>{suggestion.relatedChapterId ?? "暂无"}</dd>
        </div>
        <div>
          <dt>进度百分比</dt>
          <dd>{suggestion.progressPercent ?? "暂无"}</dd>
        </div>
      </dl>

      <div className="warningBlock">
        <h3>生成依据</h3>
        <ul>
          <li>{suggestion.basis}</li>
          {suggestion.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>

      {suggestion.notes.length > 0 ? (
        <div className="warningBlock">
          <h3>补充说明</h3>
          <ul>
            {suggestion.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="panelNote">
        该建议仅用于开发预览，不调用模型，不执行工具，不写入数据库。
      </p>

      {readerHref === null ? (
        <p className="panelNote">
          操作建议：{suggestion.actionLabel}。暂无可跳转的 Reader 章节，请先在 Reader
          中产生并同步阅读进度。
        </p>
      ) : (
        <p className="panelNote">
          操作建议：{suggestion.actionLabel}。{" "}
          <Link className="secondaryLink" href={readerHref}>
            按建议继续阅读
          </Link>
        </p>
      )}

      <p className="panelNote">{LEARNING_READER_LINK_PREVIEW_NOTE}</p>
      <p className="panelNote">{LEARNING_READER_LINK_UNAVAILABLE_NOTE}</p>
    </section>
  );
}
