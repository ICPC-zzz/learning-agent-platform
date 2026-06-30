import Link from "next/link";

import type { ReaderProgressResumeView } from "./reader-progress-resume-view-model.ts";

interface ReaderProgressResumePanelProps {
  resume: ReaderProgressResumeView;
  emptyPrimaryHref?: string;
}

export function ReaderProgressResumePanel({
  resume,
  emptyPrimaryHref = "/reader",
}: ReaderProgressResumePanelProps) {
  if (!resume.hasContinueReading) {
    return (
      <section className="learningPanel" aria-labelledby="reader-resume-title">
        <div className="panelHeader">
          <p className="eyebrow">dev-only resume</p>
          <h2 id="reader-resume-title">{resume.title}</h2>
          <p className="panelNote">{resume.message}</p>
        </div>
        <div className="learningEmptyState" aria-live="polite" style={{ marginTop: "14px" }}>
          <strong>安全空态</strong>
          <p>
            {resume.status === "blocked"
              ? "只读恢复未启用，页面不会触碰数据库。"
              : "当前没有可继续阅读的 dev-only 进度。"}
          </p>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link className="primaryLink" href={emptyPrimaryHref}>
              Open Reader
            </Link>
            <Link className="secondaryLink" href="/books">
              Browse Books
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="learningPanel" aria-labelledby="reader-resume-title">
      <div className="panelHeader">
        <p className="eyebrow">dev-only resume</p>
        <h2 id="reader-resume-title">{resume.title}</h2>
        <p className="panelNote">{resume.message}</p>
      </div>
      <div className="chunkList" style={{ marginTop: "14px" }}>
        {resume.items.map((item) => (
          <article className="chunkItem" key={`${item.bookId}-${item.chapterId}`}>
            <div className="panelHeaderRow">
              <div>
                <p className="eyebrow">
                  {resume.sourceLabel} 路 {item.progressPercent}%
                </p>
                <h3>{item.bookTitle}</h3>
                <p className="panelNote">
                  {item.chapterTitle} 路 chapterId: <code>{item.chapterId}</code>
                </p>
              </div>
              <div className="homeActions" style={{ alignItems: "flex-end" }}>
                <Link className="primaryLink" href={item.continueReadingHref}>
                  继续阅读
                </Link>
                <Link className="secondaryLink" href={item.detailHref}>
                  书籍详情
                </Link>
              </div>
            </div>
            <dl className="scoreMeta" style={{ marginTop: "14px" }}>
              <div>
                <dt>progressPercent</dt>
                <dd>{item.progressPercent}%</dd>
              </div>
              <div>
                <dt>chapterId</dt>
                <dd>
                  <code>{item.chapterId}</code>
                </dd>
              </div>
              <div>
                <dt>updatedAt</dt>
                <dd>{item.updatedAtLabel}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
