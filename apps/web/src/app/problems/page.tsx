import Link from "next/link";
import type { CSSProperties } from "react";

import { MetricPill, PageHero } from "../_components/UserUiComponents";
import { ContestCountdown } from "./ContestCountdown";
import { formatCodeforcesContestIndex } from "./codeforces-problem-metadata";
import {
  loadProblemLibraryPageData,
  type CodeforcesProblemListItem,
  type ProblemLibrarySearchParamsInput,
} from "./problem-library-page-data";

interface ProblemsPageProps {
  searchParams?: Promise<ProblemLibrarySearchParamsInput>;
}

export default async function ProblemsPage({ searchParams }: ProblemsPageProps) {
  const params = searchParams ? await searchParams : {};
  const data = await loadProblemLibraryPageData(params);

  return (
    <main className="learningPage">
      <PageHero
        eyebrow="Codeforces 训练"
        title="题目中心"
        subtitle="本地 Codeforces 精选题池，只保存最小元数据；按 Rating、标签和训练状态扫描后跳转原题练习。"
      >
        <MetricPill label="题池总量" value={data.totalCount.toLocaleString("zh-CN")} status="info" />
        <MetricPill label="当前页" value={`${data.page} / ${data.totalPages}`} status="muted" />
        <MetricPill label="数据状态" value={data.dbLoaded ? "已读取" : "未读取"} status={data.dbLoaded ? "success" : "warning"} />
      </PageHero>

      <div style={pageGridStyle}>
        <section className="learningPanel" aria-label="Codeforces 比赛">
          <ContestCountdown />
          <div style={noticeStyle("#f7faf7", "#d9e1d7", "#3c4a42")}>
            <strong>数据边界</strong>
            <p style={{ margin: "6px 0 0" }}>
              这里不保存完整题面、样例或题解。点击原题链接后在 Codeforces 页面完成训练。
            </p>
          </div>
        </section>

        <section className="learningPanel" aria-labelledby="problem-list-title">
          <div className="panelHeader">
            <p className="eyebrow">训练题池</p>
            <h2 id="problem-list-title">精选题目</h2>
            <p className="panelNote">{data.sourceNote}</p>
          </div>

          <ProblemFilterForm data={data} />

          {data.dbError ? (
            <div style={noticeStyle("#fff8e6", "#f1dfaa", "#8a5a12")}>
              题库读取当前不可用：{data.dbError}。不会用示例题伪装为真实题池。
            </div>
          ) : null}

          <div style={statGridStyle}>
            <StatCard label="题池总量" value={data.totalCount.toLocaleString("zh-CN")} />
            <StatCard label="当前页" value={`${data.page} / ${data.totalPages}`} />
            <StatCard label="每页数量" value={data.pageSize.toString()} />
            <StatCard label="数据状态" value={data.dbLoaded ? "已读取" : "未读取"} />
          </div>

          {data.problems.length > 0 ? (
            <div style={{ display: "grid", gap: "10px" }}>
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
      </div>
    </main>
  );
}

function ProblemFilterForm({ data }: { data: Awaited<ReturnType<typeof loadProblemLibraryPageData>> }) {
  return (
    <form action="/problems" style={filterFormStyle}>
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
      <button type="submit" className="primaryLink" style={{ border: "none", height: 40 }}>
        筛选
      </button>
    </form>
  );
}

function ProblemCard({ problem }: { problem: CodeforcesProblemListItem }) {
  return (
    <article className="lap-card" style={problemCardStyle}>
      <div style={{ minWidth: 0 }}>
        <p className="eyebrow" style={{ margin: "0 0 4px" }}>
          {formatCodeforcesContestIndex(problem.contestId, problem.index)}
        </p>
        <h3 style={{ fontSize: "1rem", color: "#152234", margin: "0 0 8px" }}>
          {problem.title}
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {problem.tags.slice(0, 8).map((tag) => (
            <span key={tag} style={tagStyle}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 13, color: "#526171", fontWeight: 800, marginBottom: 8 }}>
          Rating {problem.rating ?? "未知"}
        </div>
        {problem.originalUrl ? (
          <a className="primaryLink" href={problem.originalUrl} target="_blank" rel="noopener noreferrer">
            原题
          </a>
        ) : (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>原题链接缺失</span>
        )}
      </div>
    </article>
  );
}

function Pagination({ data }: { data: Awaited<ReturnType<typeof loadProblemLibraryPageData>> }) {
  if (data.totalPages <= 1) return null;

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
    <nav style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 16 }}>
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
    <div style={{ background: "#f7faf7", border: "1px solid #dfe7dc", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "#75818e", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 18, color: "#152234", fontWeight: 900, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function noticeStyle(background: string, border: string, color: string): CSSProperties {
  return {
    background,
    border: `1px solid ${border}`,
    borderRadius: 8,
    color,
    fontSize: 13,
    lineHeight: 1.7,
    padding: "12px 14px",
  };
}

const pageGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 16,
  alignItems: "start",
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))",
  gap: 10,
  margin: "14px 0",
};

const filterFormStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 128px), 1fr))",
  gap: 8,
  alignItems: "end",
  marginTop: 14,
};

const problemCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 16,
  alignItems: "start",
  padding: "14px 16px",
};

const labelStyle: CSSProperties = {
  color: "#647181",
  display: "flex",
  flexDirection: "column",
  fontSize: 12,
  fontWeight: 800,
  gap: 4,
};

const inputStyle: CSSProperties = {
  border: "1px solid var(--lap-border-default)",
  borderRadius: 8,
  color: "#152234",
  fontSize: 13,
  height: 40,
  padding: "0 10px",
  background: "#fffefa",
};

const tagStyle: CSSProperties = {
  background: "#eef3ed",
  borderRadius: 999,
  color: "#315c45",
  fontSize: 11,
  padding: "2px 8px",
};
