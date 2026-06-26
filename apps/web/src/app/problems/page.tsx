import Link from "next/link";
import type { CSSProperties } from "react";

import { ContestCountdown } from "./ContestCountdown";
import {
  loadProblemLibraryPageData,
  type CodeforcesProblemListItem,
  type ProblemLibrarySearchParamsInput,
} from "./problem-library-page-data";
import { formatCodeforcesContestIndex } from "./codeforces-problem-metadata";

interface ProblemsPageProps {
  searchParams?: Promise<ProblemLibrarySearchParamsInput>;
}

export default async function ProblemsPage({ searchParams }: ProblemsPageProps) {
  const params = searchParams ? await searchParams : {};
  const data = await loadProblemLibraryPageData(params);

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">Codeforces Problem Center</p>
          <h1>题目中心</h1>
          <p className="status">
            本地 Codeforces 精选题池 · 只保存最小元数据 · 跳转原题练习 · 不提供本地判题
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            返回首页
          </Link>
          <Link className="secondaryLink" href="/articles">
            文章
          </Link>
          <Link className="secondaryLink" href="/ai">
            AI助手
          </Link>
          <Link className="secondaryLink" href="/user">
            个人
          </Link>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <section className="learningPanel" aria-labelledby="problem-list-title">
          <div className="panelHeader">
            <p className="eyebrow">Local Codeforces Pool</p>
            <h2 id="problem-list-title">精选题池</h2>
            <p className="panelNote">{data.sourceNote}</p>
          </div>

          <ProblemFilterForm data={data} />

          {data.dbError ? (
            <div style={noticeStyle("#fffbeb", "#fde68a", "#92400e")}>
              题库读取当前不可用：{data.dbError}。不会用示例题伪装为真实题池。
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
              margin: "14px 0",
            }}
          >
            <StatCard label="题池总量" value={data.totalCount.toLocaleString("zh-CN")} />
            <StatCard label="当前页" value={`${data.page} / ${data.totalPages}`} />
            <StatCard label="每页数量" value={data.pageSize.toString()} />
            <StatCard label="数据状态" value={data.dbLoaded ? "已读取" : "未读取"} />
          </div>

          {data.problems.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.problems.map((problem) => (
                <ProblemCard key={problem.id} problem={problem} />
              ))}
            </div>
          ) : (
            <div className="learningEmptyState" aria-live="polite">
              <strong>没有可展示的 Codeforces 题目</strong>
              <p>
                如果数据库读取已开启，请检查题库同步数量、Rating 范围或标签筛选条件。
              </p>
            </div>
          )}

          <Pagination data={data} />
        </section>

        <aside>
          <ContestCountdown />
          <div style={noticeStyle("#f8fafc", "#e2e8f0", "#475569")}>
            <strong>数据边界</strong>
            <p style={{ margin: "6px 0 0 0" }}>
              这里不保存完整题面、样例或题解。点击原题链接后在 Codeforces 页面完成练习。
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function ProblemFilterForm({ data }: { data: Awaited<ReturnType<typeof loadProblemLibraryPageData>> }) {
  return (
    <form
      action="/problems"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "8px",
        alignItems: "end",
        marginTop: "14px",
      }}
    >
      <label style={labelStyle}>
        搜索
        <input name="q" defaultValue={data.query} placeholder="题名或标签" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        标签
        <input name="tags" defaultValue={data.tagsText} placeholder="dp, graphs" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        最低
        <input name="minRating" defaultValue={data.minRating} placeholder="800" inputMode="numeric" style={inputStyle} />
      </label>
      <label style={labelStyle}>
        最高
        <input name="maxRating" defaultValue={data.maxRating} placeholder="1600" inputMode="numeric" style={inputStyle} />
      </label>
      <button type="submit" className="primaryLink" style={{ border: "none", height: "36px" }}>
        筛选
      </button>
    </form>
  );
}

function ProblemCard({ problem }: { problem: CodeforcesProblemListItem }) {
  return (
    <article
      style={{
        border: "1px solid #dbe4ee",
        borderRadius: "8px",
        padding: "14px 16px",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow" style={{ margin: "0 0 4px 0" }}>
            {formatCodeforcesContestIndex(problem.contestId, problem.index)}
          </p>
          <h3 style={{ fontSize: "16px", color: "#0f172a", margin: "0 0 8px 0" }}>
            {problem.title}
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {problem.tags.slice(0, 8).map((tag) => (
              <span key={tag} style={tagStyle}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: "13px", color: "#475569", fontWeight: 700, marginBottom: "8px" }}>
            Rating {problem.rating ?? "未知"}
          </div>
          {problem.originalUrl ? (
            <a className="primaryLink" href={problem.originalUrl} target="_blank" rel="noopener noreferrer">
              原题
            </a>
          ) : (
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>原题链接缺失</span>
          )}
        </div>
      </div>
    </article>
  );
}

function Pagination({ data }: { data: Awaited<ReturnType<typeof loadProblemLibraryPageData>> }) {
  if (data.totalPages <= 1) {
    return null;
  }

  const base = new URLSearchParams();
  if (data.query) base.set("q", data.query);
  if (data.tagsText) base.set("tags", data.tagsText);
  if (data.minRating) base.set("minRating", data.minRating);
  if (data.maxRating) base.set("maxRating", data.maxRating);
  base.set("pageSize", data.pageSize.toString());

  const makeHref = (page: number) => {
    const next = new URLSearchParams(base);
    next.set("page", page.toString());
    return `/problems?${next.toString()}`;
  };

  return (
    <nav style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "16px" }}>
      {data.page > 1 ? (
        <Link className="secondaryLink" href={makeHref(data.page - 1)}>
          上一页
        </Link>
      ) : (
        <span />
      )}
      {data.page < data.totalPages ? (
        <Link className="secondaryLink" href={makeHref(data.page + 1)}>
          下一页
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "10px 12px" }}>
      <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "18px", color: "#0f172a", fontWeight: 800, marginTop: "2px" }}>{value}</div>
    </div>
  );
}

function noticeStyle(background: string, border: string, color: string): CSSProperties {
  return {
    background,
    border: `1px solid ${border}`,
    borderRadius: "8px",
    color,
    fontSize: "12px",
    lineHeight: 1.6,
    padding: "10px 12px",
  };
}

const labelStyle: CSSProperties = {
  color: "#64748b",
  display: "flex",
  flexDirection: "column",
  fontSize: "11px",
  fontWeight: 700,
  gap: "4px",
};

const inputStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  color: "#0f172a",
  fontSize: "13px",
  height: "36px",
  padding: "0 10px",
};

const tagStyle: CSSProperties = {
  background: "#eef2ff",
  borderRadius: "4px",
  color: "#4f46e5",
  fontSize: "11px",
  padding: "2px 7px",
};
