import type { ReaderContentChunk } from "../../lib/reader-types";

interface ChunkListProps {
  chunks: ReaderContentChunk[];
}

function createChunkPreview(plainText: string): string {
  const compactText = plainText.replace(/\s+/g, " ").trim();

  if (compactText.length <= 160) {
    return compactText;
  }

  return `${compactText.slice(0, 157)}...`;
}

export function ChunkList({ chunks }: ChunkListProps) {
  return (
    <section className="chunkPanel" aria-labelledby="chunk-panel-title">
      <div className="panelHeader">
        <p className="eyebrow">上下文分块</p>
        <h2 id="chunk-panel-title">分块信息</h2>
      </div>
      <div className="chunkList">
        {chunks.map((chunk) => (
          <article className="chunkItem" key={chunk.id}>
            <div className="chunkMeta">
              <span>#{chunk.orderIndex}</span>
              <span>{chunk.charCount} 字符</span>
            </div>
            <p>{createChunkPreview(chunk.plainText)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
