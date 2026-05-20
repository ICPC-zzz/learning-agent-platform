import Link from "next/link";

import { BookImportPreviewClient } from "./BookImportPreviewClient";

export default function ImportPage() {
  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A24 书籍导入数据库保存边界 MVP</p>
          <h1>书籍导入预览</h1>
          <p className="status">
            先生成本地纯文本预览，再按需通过服务端数据库边界保存同一份输入。
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
          预览生成仅在本地页面状态中完成。保存必须显式触发，并通过服务端 action
          在数据库已配置时只写入 Book、Chapter 和 Chunk 数据。
        </p>
      </section>

      <BookImportPreviewClient />
    </main>
  );
}
