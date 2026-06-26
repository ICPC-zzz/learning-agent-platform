"use client";

import type { CSSProperties } from "react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { useAssistantPageContextUpdater } from "../../_components/AssistantPageContextProvider.tsx";
import { ARTICLE_SOURCE_PLATFORM_LABELS, type AggregatedArticle } from "../article-library-types.ts";
import {
  ARTICLE_CATEGORY_FILTERS,
  ARTICLE_SOURCE_FILTERS,
  filterAndSortArticles,
} from "../article-library-filter.ts";
import { FavoriteArticleButton } from "../../../components/articles/FavoriteArticleButton";
import {
  loadRecentArticleReadings,
  markArticleRead,
  persistRecentArticleReadings,
} from "../../../lib/local-user-article-store";
import { recordArticleReadingDbAction } from "../../user/article-recent-reading-db-server-action";

interface ArticleLibraryClientProps {
  articles: AggregatedArticle[];
}

const PAGE_SIZE = 24;

export function ArticleLibraryClient({ articles }: ArticleLibraryClientProps) {
  const updateAssistantPageContext = useAssistantPageContextUpdater();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "cnblogs" | "csdn">("all");
  const [category, setCategory] = useState<string>("all");
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  const visibleArticles = filterAndSortArticles(articles, { query: deferredQuery, source, category });
  const resultCount = visibleArticles.length;
  const totalPages = Math.max(1, Math.ceil(resultCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageArticles = visibleArticles.slice(pageStart, pageStart + PAGE_SIZE);

  const assistantVisibleItems = useMemo(
    () =>
      pageArticles.slice(0, 8).map((article) => ({
        id: article.id,
        title: article.title,
        summary: article.summary.slice(0, 120),
      })),
    [pageArticles],
  );

  useEffect(() => {
    setPage(1);
  }, [query, source, category]);

  useEffect(() => {
    updateAssistantPageContext({
      pageType: "articles",
      title: "Technical Articles",
      summary: `Filtered articles: ${resultCount}. Current page shows ${assistantVisibleItems.length}.`,
      visibleItems: assistantVisibleItems,
    });
  }, [assistantVisibleItems, resultCount, updateAssistantPageContext]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--lap-space-5)" }}>
      <div
        className="lap-card"
        style={{ padding: "var(--lap-space-4)", display: "grid", gap: "var(--lap-space-4)" }}
      >
        <label style={{ display: "grid", gap: "8px" }}>
          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--lap-text-primary)" }}>
            搜索
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索标题、摘要、作者、来源或分类"
            aria-label="search articles"
            style={{
              width: "100%",
              minHeight: "42px",
              padding: "10px 12px",
              borderRadius: "var(--lap-radius-md)",
              border: "1px solid #d8dee8",
              background: "#fff",
              color: "var(--lap-text-primary)",
              fontSize: "0.875rem",
              boxSizing: "border-box",
            }}
          />
        </label>

        <FilterRow
          label="来源"
          options={ARTICLE_SOURCE_FILTERS}
          value={source}
          onChange={(next) => setSource(next as "all" | "cnblogs" | "csdn")}
        />

        <FilterRow
          label="基础分类"
          options={ARTICLE_CATEGORY_FILTERS.map((item) => ({
            value: item === "全部" ? "all" : item,
            label: item,
          }))}
          value={category}
          onChange={(next) => setCategory(next)}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <span
            className="lap-dev-badge"
            style={{ background: "#eef2ff", color: "#3730a3", borderColor: "#c7d2fe" }}
          >
            最新优先
          </span>
          <span style={{ fontSize: "0.75rem", color: "var(--lap-text-muted)" }}>
            当前显示 {pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, resultCount)} / {resultCount} 篇
          </span>
        </div>
      </div>

      {visibleArticles.length === 0 ? (
        <div className="lap-empty-state" role="status">
          <strong style={{ display: "block", marginBottom: "var(--lap-space-2)", color: "var(--lap-text-primary)" }}>
            没有匹配的文章
          </strong>
          <p style={{ margin: 0, lineHeight: 1.6 }}>试试清空搜索或切换来源、分类筛选。</p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--lap-space-4)",
            }}
          >
            {pageArticles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {totalPages > 1 ? (
            <PaginationBar page={safePage} totalPages={totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: "8px" }}>
      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--lap-text-primary)" }}>
        {label}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              style={{
                minHeight: "34px",
                padding: "0 12px",
                borderRadius: "999px",
                border: active ? "1px solid #1e293b" : "1px solid #d8dee8",
                background: active ? "#1e293b" : "#fff",
                color: active ? "#fff" : "var(--lap-text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
}) {
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;
  const pages = buildVisiblePages(page, totalPages);

  return (
    <div
      className="lap-card"
      style={{
        padding: "var(--lap-space-4)",
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center",
        justifyContent: "space-between",
      }}
      aria-label="文章分页"
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={!canGoPrev}
          aria-label="上一页"
          style={paginationButtonStyle(!canGoPrev)}
        >
          上一页
        </button>

        {pages.map((item, index) =>
          item === "ellipsis" ? (
            <span key={`ellipsis-${index}`} style={paginationEllipsisStyle}>
              ...
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-pressed={item === page}
              style={paginationButtonStyle(item === page)}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={!canGoNext}
          aria-label="下一页"
          style={paginationButtonStyle(!canGoNext)}
        >
          下一页
        </button>
      </div>

      <span style={{ fontSize: "0.75rem", color: "var(--lap-text-muted)" }}>
        第 {page} / {totalPages} 页
      </span>
    </div>
  );
}

function buildVisiblePages(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const left = Math.max(2, page - 1);
  const right = Math.min(totalPages - 1, page + 1);

  if (left > 2) {
    pages.push("ellipsis");
  }

  for (let current = left; current <= right; current += 1) {
    pages.push(current);
  }

  if (right < totalPages - 1) {
    pages.push("ellipsis");
  }

  pages.push(totalPages);
  return pages;
}

function paginationButtonStyle(active: boolean): CSSProperties {
  return {
    minHeight: "34px",
    minWidth: "34px",
    padding: "0 12px",
    borderRadius: "999px",
    border: active ? "1px solid #1e293b" : "1px solid #d8dee8",
    background: active ? "#1e293b" : "#fff",
    color: active ? "#fff" : "var(--lap-text-secondary)",
    fontSize: "0.8125rem",
    fontWeight: active ? 700 : 500,
    cursor: active ? "default" : "pointer",
  };
}

const paginationEllipsisStyle: CSSProperties = {
  minWidth: "24px",
  textAlign: "center",
  color: "var(--lap-text-subtle)",
  fontSize: "0.875rem",
};

function ArticleCard({ article }: { article: AggregatedArticle }) {
  const publishedAtLabel = formatPublishedAtLabel(article.publishedAt);

  return (
    <article
      className="lap-card lap-card--hover"
      onClick={() => {
        const current = loadRecentArticleReadings();
        const next = markArticleRead(current, {
          articleId: article.id,
          title: article.title,
          sourcePlatform: article.sourcePlatform,
          sourceName: article.sourceName,
          originalUrl: article.originalUrl,
          lastReadAt: new Date().toISOString(),
        });
        persistRecentArticleReadings(next);
        recordArticleReadingDbAction(
          article.id,
          article.title,
          article.sourcePlatform,
          article.sourceName,
          article.originalUrl,
        ).catch(() => {
          // localStorage already updated; DB is best effort here.
        });
      }}
      style={{ padding: "var(--lap-space-4)", display: "flex", flexDirection: "column", gap: "var(--lap-space-3)", cursor: "pointer" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--lap-space-3)", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "1rem", lineHeight: 1.35, color: "var(--lap-text-primary)" }}>
            {article.title}
          </h3>
          <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <PlatformBadge platform={article.sourcePlatform} />
            {article.sourceName ? <span style={badgeStyle("#eef2ff", "#3730a3")}>{article.sourceName}</span> : null}
          </div>
        </div>
        <span className="lap-dev-badge" style={{ whiteSpace: "nowrap" }}>
          {publishedAtLabel}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.65, color: "var(--lap-text-muted)" }}>
        {article.summary}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {article.author ? <span style={badgeStyle("#f8fafc", "#475569")}>作者：{article.author}</span> : null}
        {article.categories.map((categoryItem) => (
          <span key={categoryItem} style={badgeStyle("#f1f5f9", "#334155")}>
            {categoryItem}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginTop: "auto" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}>
          来源：{ARTICLE_SOURCE_PLATFORM_LABELS[article.sourcePlatform]}
        </span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <FavoriteArticleButton
            articleId={article.id}
            title={article.title}
            sourcePlatform={article.sourcePlatform}
            sourceName={article.sourceName}
            originalUrl={article.originalUrl}
          />
          <a
            href={article.originalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="secondaryLink"
            style={{ marginTop: 0, whiteSpace: "nowrap" }}
          >
            阅读原文
          </a>
        </div>
      </div>
    </article>
  );
}

function PlatformBadge({ platform }: { platform: AggregatedArticle["sourcePlatform"] }) {
  const label = ARTICLE_SOURCE_PLATFORM_LABELS[platform];
  const palette = platform === "cnblogs"
    ? { bg: "#eff6ff", text: "#1d4ed8" }
    : { bg: "#fff7ed", text: "#c2410c" };
  return <span style={badgeStyle(palette.bg, palette.text)}>{label}</span>;
}

function badgeStyle(background: string, color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "24px",
    padding: "0 8px",
    borderRadius: "999px",
    background,
    color,
    fontSize: "0.75rem",
    fontWeight: 600,
  };
}

function formatPublishedAtLabel(value: string | null | undefined): string {
  if (!value) return "发布时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "发布时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
