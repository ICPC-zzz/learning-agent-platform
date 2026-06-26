import Link from "next/link";
import { DemoModeNotice } from "./DemoModeNotice";
import { ReaderReadingStateSourceNotice } from "./ReaderReadingStateSourceNotice";

interface ReaderEmptyStateProps {
  message: string;
}

export function ReaderEmptyState({ message }: ReaderEmptyStateProps) {
  return (
    <main className="readerPage">
      <DemoModeNotice />
      <header className="readerHeader">
        <div>
          <p className="eyebrow">阅读器预览</p>
          <h1>阅读器需要书籍参数</h1>
          <p className="status">请从书库选择一本书，再从章节列表进入阅读器。</p>
        </div>
        <Link className="secondaryLink" href="/books">
          返回书库
        </Link>
      </header>
      <ReaderReadingStateSourceNotice source="local_fallback" />
      <section
        aria-label="阅读器错误提示"
        className="readerDataSourceNotice readerDataSourceNoticeFallback"
      >
        <span className="readerDataSourceBadge">不可阅读</span>
        <p>{message}</p>
      </section>
    </main>
  );
}
