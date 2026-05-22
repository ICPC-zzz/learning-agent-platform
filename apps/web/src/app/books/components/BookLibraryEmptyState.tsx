import Link from "next/link";

interface BookLibraryEmptyStateProps {
  message: string;
}

export function BookLibraryEmptyState({ message }: BookLibraryEmptyStateProps) {
  return (
    <section className="learningEmptyState" aria-label="空书库">
      <strong>当前开发数据源暂无可显示的已保存书籍。</strong>
      <p>{message}</p>
      <Link className="secondaryLink" href="/import">
        打开文本导入预览
      </Link>
    </section>
  );
}
