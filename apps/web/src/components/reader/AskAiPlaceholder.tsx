interface AskAiPlaceholderProps {
  bookTitle: string;
  chapterTitle: string;
  chunkCount: number;
}

export function AskAiPlaceholder({
  bookTitle,
  chapterTitle,
  chunkCount
}: AskAiPlaceholderProps) {
  return (
    <section className="askAiPanel" aria-labelledby="ask-ai-title">
      <p className="eyebrow">即将提供</p>
      <h2 id="ask-ai-title">向 AI 提问本章内容</h2>
      <p>
        后续回答会结合当前书籍、章节、附近分块和学习者能力分数。当前 MVP 只展示入口。
      </p>
      <dl className="aiContextList">
        <div>
          <dt>书籍</dt>
          <dd>{bookTitle}</dd>
        </div>
        <div>
          <dt>章节</dt>
          <dd>{chapterTitle}</dd>
        </div>
        <div>
          <dt>可用分块</dt>
          <dd>{chunkCount}</dd>
        </div>
      </dl>
      <textarea disabled placeholder="AI 提问输入即将提供" rows={4} />
      <button disabled type="button">
        向 AI 提问
      </button>
    </section>
  );
}
