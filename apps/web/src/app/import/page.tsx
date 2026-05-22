import Link from "next/link";

import { BookImportPreviewClient } from "./BookImportPreviewClient";

export default function ImportPage() {
  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A152 导入预览边界</p>
          <h1>文本导入预览</h1>
          <p className="status">
            输入标题和正文后只生成规则式预览；保存入口仅写入当前开发环境的 Book、Chapter 和 Chunk。
          </p>
        </div>
        <Link className="secondaryLink" href="/">
          返回首页
        </Link>
      </header>

      <section
        className="readerDataSourceNotice readerDataSourceNoticeFallback"
        aria-label="导入预览持久化说明"
      >
        <span className="readerDataSourceBadge">本地预览</span>
        <p>
          当前仅支持粘贴文本生成规则式预览。URL、PDF、EPUB、网页和文件导入均未启用；复杂章节识别仍是
          preview 边界，不会调用真实 LLM、RAG 或 provider，也不会修改数据库 schema。
        </p>
      </section>

      <BookImportPreviewClient />
    </main>
  );
}
