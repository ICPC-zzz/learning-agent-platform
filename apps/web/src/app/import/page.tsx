import Link from "next/link";

import { BookImportPreviewClient } from "./BookImportPreviewClient";

export default function ImportPage() {
  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A133 文本导入最小闭环</p>
          <h1>文本导入</h1>
          <p className="status">
            输入标题和正文，先生成最小预览，再显式保存为可阅读的书籍和章节。
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
          当前仅支持粘贴文本导入。URL 导入和文件导入暂未启用；复杂章节识别仍是
          preview 边界，不会调用真实 LLM，也不会修改数据库 schema。
        </p>
      </section>

      <BookImportPreviewClient />
    </main>
  );
}
