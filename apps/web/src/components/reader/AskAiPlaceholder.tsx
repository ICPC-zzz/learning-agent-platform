interface AskAiPlaceholderProps {
  bookTitle: string;
  chapterTitle: string;
  chunkCount: number;
}

export function AskAiPlaceholder({
  bookTitle,
  chapterTitle,
  chunkCount,
}: AskAiPlaceholderProps) {
  return (
    <section className="askAiPanel" aria-labelledby="ask-ai-title">
      <p className="eyebrow">AI 问答未启用</p>
      <h2 id="ask-ai-title">章节问答占位入口</h2>
      <p>
        当前只展示 preview-only 占位，不会调用真实模型、RAG、工具或保存问答历史。
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
      <textarea disabled placeholder="AI 问答未启用，此处仅为占位" rows={4} />
      <button disabled type="button">
        AI 问答未启用
      </button>
    </section>
  );
}
