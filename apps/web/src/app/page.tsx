import Link from "next/link";

const placeholders = [
  "静态阅读器 MVP 已可用",
  "已保存书库只读边界已可用",
  "纯文本导入保存边界已可用",
  "AI 提问入口仍保持禁用",
  "Skill 社区仍是占位入口",
];

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">当前状态</p>
        <h1>Learning Agent Platform</h1>
        <p className="status">A40 书库数据库只读边界 MVP</p>
        <div className="homeActions">
          <Link className="primaryLink" href="/books">
            打开已保存书库
          </Link>
          <Link className="primaryLink" href="/reader">
            打开阅读器
          </Link>
          <Link className="secondaryLink" href="/learning">
            打开学习面板
          </Link>
          <Link className="secondaryLink" href="/import">
            打开书籍导入
          </Link>
          <Link className="secondaryLink" href="/agent">
            打开智能体工作台
          </Link>
        </div>
      </section>

      <section className="placeholderGrid" aria-label="项目占位状态">
        {placeholders.map((label) => (
          <div className="placeholder" key={label}>
            {label}
          </div>
        ))}
      </section>
    </main>
  );
}
