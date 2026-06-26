"use client";

/**
 * ArticleCenterTabs — Client-side tab navigation for the article center.
 *
 * Three tabs: 每日热点, GitHub日报, 技术文章
 * 技术文章 Tab 内部保留原有的来源筛选（博客园/CSDN） + 分类筛选 + 搜索。
 * Date switcher for daily content tabs (last 7 days).
 * Responsive layout with skeleton, empty, and error states.
 */

import type { CSSProperties } from "react";
import { useState } from "react";
import type { AggregatedArticle } from "../article-library-types";
import type {
  DailyContentPageData,
  DailyHotspotItem,
  GitHubDailyItem,
} from "../daily-content-json-loader";
import { ArticleLibraryClient } from "./ArticleLibraryClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArticleTab = "hotspots" | "github" | "articles";

interface ArticleCenterTabsProps {
  /** All articles from the JSON loader (blog园 + CSDN) */
  articles: AggregatedArticle[];
  /** Daily content from DB (hotspots + GitHub) */
  dailyContent: DailyContentPageData | null;
  dailyError?: string;
}

const TAB_LABELS: Record<ArticleTab, string> = {
  hotspots: "每日热点",
  github: "GitHub 日报",
  articles: "技术文章",
};

const TAB_DESCRIPTIONS: Record<ArticleTab, string> = {
  hotspots:
    "来自 Hacker News 和 DEV Community 的今日技术热点，保留原文链接，不做 AI 摘要。",
  github:
    "根据 GitHub 公开仓库数据生成的每日开源项目快照，非官方 Trending。",
  articles:
    "聚合博客园与 CSDN 的公开 RSS/Atom 元数据，只展示标题、摘要、来源、时间和分类。版权归原作者和原平台所有。",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArticleCenterTabs({
  articles,
  dailyContent,
  dailyError,
}: ArticleCenterTabsProps) {
  const [activeTab, setActiveTab] = useState<ArticleTab>("hotspots");

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--lap-space-5)" }}
    >
      {/* Tab bar */}
      <nav
        role="tablist"
        aria-label="文章中心分类"
        style={{
          display: "flex",
          flexWrap: "wrap",
          borderBottom: "1px solid #e2e8f0",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {(Object.keys(TAB_LABELS) as ArticleTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            style={{
              minHeight: "42px",
              padding: "10px 18px",
              border: "none",
              borderBottom:
                activeTab === tab
                  ? "2px solid var(--lap-accent-primary, #1e293b)"
                  : "2px solid transparent",
              background: "transparent",
              color:
                activeTab === tab
                  ? "var(--lap-text-primary)"
                  : "var(--lap-text-muted)",
              fontSize: "0.875rem",
              fontWeight: activeTab === tab ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition:
                "color var(--lap-transition-fast), border-color var(--lap-transition-fast)",
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      {/* Tab description */}
      <p
        style={{
          margin: 0,
          fontSize: "0.8125rem",
          color: "var(--lap-text-muted)",
          lineHeight: 1.5,
        }}
      >
        {TAB_DESCRIPTIONS[activeTab]}
      </p>

      {/* Tab content */}
      <TabContent
        activeTab={activeTab}
        articles={articles}
        dailyContent={dailyContent}
        dailyError={dailyError}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab Content
// ---------------------------------------------------------------------------

function TabContent({
  activeTab,
  articles,
  dailyContent,
  dailyError,
}: {
  activeTab: ArticleTab;
  articles: AggregatedArticle[];
  dailyContent: DailyContentPageData | null;
  dailyError?: string;
}) {
  switch (activeTab) {
    case "hotspots":
      return (
        <HotspotTab dailyContent={dailyContent} dailyError={dailyError} />
      );
    case "github":
      return (
        <GitHubTab dailyContent={dailyContent} dailyError={dailyError} />
      );
    case "articles":
      return <ArticleLibraryClient articles={articles} />;
  }
}

// ---------------------------------------------------------------------------
// Hotspot Tab
// ---------------------------------------------------------------------------

function HotspotTab({
  dailyContent,
  dailyError,
}: {
  dailyContent: DailyContentPageData | null;
  dailyError?: string;
}) {
  if (dailyError) {
    return (
      <div className="lap-empty-state" role="status">
        <strong
          style={{
            display: "block",
            marginBottom: "var(--lap-space-2)",
            color: "var(--lap-text-primary)",
          }}
        >
          每日热点尚未同步
        </strong>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          每日热点由系统定时同步生成，首次使用需要在管理后台手动触发一次。
          <br />
          访问 /admin/sync 页面，点击"刷新每日热点"即可。
        </p>
      </div>
    );
  }

  if (!dailyContent || dailyContent.hotspots.length === 0) {
    return (
      <div className="lap-empty-state" role="status">
        <strong
          style={{
            display: "block",
            marginBottom: "var(--lap-space-2)",
            color: "var(--lap-text-primary)",
          }}
        >
          暂无今日热点
        </strong>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          今日热点数据为空。如果今天尚未同步，请稍后再来或前往管理后台手动刷新。
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "var(--lap-space-4)",
      }}
    >
      {dailyContent.hotspots.map((item) => (
        <HotspotCard key={item.id} item={item} />
      ))}
    </div>
  );
}

function HotspotCard({ item }: { item: DailyHotspotItem }) {
  const publishedLabel = item.publishedAt
    ? new Date(item.publishedAt).toLocaleDateString("zh-CN")
    : null;

  return (
    <article
      className="lap-card lap-card--hover"
      style={{
        padding: "var(--lap-space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-3)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
          alignItems: "flex-start",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
            lineHeight: 1.35,
            color: "var(--lap-text-primary)",
            flex: 1,
          }}
        >
          {item.title}
        </h3>
        {publishedLabel ? (
          <span
            className="lap-dev-badge"
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {publishedLabel}
          </span>
        ) : null}
      </div>

      {item.summary ? (
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            lineHeight: 1.65,
            color: "var(--lap-text-muted)",
          }}
        >
          {item.summary.slice(0, 200)}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          alignItems: "center",
        }}
      >
        <span style={badgeStyle("#eef2ff", "#3730a3")}>
          {item.sourceLabel}
        </span>
        {item.author && item.author !== "unknown" ? (
          <span style={badgeStyle("#f8fafc", "#475569")}>{item.author}</span>
        ) : null}
        <span
          style={{ fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}
        >
          ⭐ {item.score} · 💬 {item.commentCount}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          marginTop: "auto",
        }}
      >
        {item.originalUrl ? (
          <a
            href={item.originalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="secondaryLink"
          >
            原文
          </a>
        ) : null}
        {item.discussionUrl ? (
          <a
            href={item.discussionUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="secondaryLink"
          >
            HN 讨论
          </a>
        ) : null}
        {item.tags.length > 0 ? (
          <span
            style={{ fontSize: "0.7rem", color: "var(--lap-text-subtle)" }}
          >
            {item.tags.slice(0, 3).join(" · ")}
          </span>
        ) : null}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// GitHub Tab
// ---------------------------------------------------------------------------

function GitHubTab({
  dailyContent,
  dailyError,
}: {
  dailyContent: DailyContentPageData | null;
  dailyError?: string;
}) {
  if (dailyError) {
    return (
      <div className="lap-empty-state" role="status">
        <strong
          style={{
            display: "block",
            marginBottom: "var(--lap-space-2)",
            color: "var(--lap-text-primary)",
          }}
        >
          GitHub 日报尚未同步
        </strong>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          GitHub 日报由系统定时同步生成，首次使用需要在管理后台手动触发一次。
          <br />
          访问 /admin/sync 页面，点击"刷新 GitHub 日报"即可。
        </p>
      </div>
    );
  }

  if (!dailyContent || dailyContent.githubRepos.length === 0) {
    return (
      <div className="lap-empty-state" role="status">
        <strong
          style={{
            display: "block",
            marginBottom: "var(--lap-space-2)",
            color: "var(--lap-text-primary)",
          }}
        >
          暂无 GitHub 日报
        </strong>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          GitHub 日报根据公开仓库数据生成，非官方 Trending。
          如果今天尚未同步，请稍后再来或前往管理后台手动刷新。
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "var(--lap-space-4)",
      }}
    >
      {dailyContent.githubRepos.map((repo) => (
        <GitHubCard key={repo.id} repo={repo} />
      ))}
    </div>
  );
}

function GitHubCard({ repo }: { repo: GitHubDailyItem }) {
  return (
    <article
      className="lap-card lap-card--hover"
      style={{
        padding: "var(--lap-space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-3)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "8px",
          alignItems: "flex-start",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "1rem",
            lineHeight: 1.35,
            wordBreak: "break-all",
          }}
        >
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            style={{
              color: "var(--lap-text-primary)",
              textDecoration: "none",
            }}
          >
            {repo.fullName}
          </a>
        </h3>
        <span
          className="lap-dev-badge"
          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
        >
          ⭐ {repo.stars.toLocaleString()}
        </span>
      </div>

      {repo.description ? (
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            lineHeight: 1.65,
            color: "var(--lap-text-muted)",
          }}
        >
          {repo.description.slice(0, 180)}
        </p>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          alignItems: "center",
        }}
      >
        {repo.primaryLanguage ? (
          <span style={badgeStyle("#f0fdf4", "#166534")}>
            {repo.primaryLanguage}
          </span>
        ) : null}
        {repo.license ? (
          <span style={badgeStyle("#f8fafc", "#475569")}>{repo.license}</span>
        ) : null}
        {repo.starDelta24h !== null ? (
          <span style={badgeStyle("#fef9c3", "#854d0e")}>
            +{repo.starDelta24h} ⭐ / 24h
          </span>
        ) : null}
        {repo.isFirstDay ? (
          <span style={badgeStyle("#f1f5f9", "#64748b")}>首次收录</span>
        ) : null}
        <span
          style={{ fontSize: "0.75rem", color: "var(--lap-text-subtle)" }}
        >
          🍴 {repo.forks.toLocaleString()}
        </span>
      </div>

      {repo.topics.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {repo.topics.slice(0, 6).map((topic) => (
            <span
              key={topic}
              style={{
                display: "inline-block",
                padding: "1px 7px",
                borderRadius: "999px",
                background: "#eef2ff",
                color: "#3730a3",
                fontSize: "0.7rem",
                fontWeight: 500,
              }}
            >
              {topic}
            </span>
          ))}
        </div>
      ) : null}

      {repo.reasons.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {repo.reasons.map((reason, i) => (
            <span key={i} style={badgeStyle("#fff7ed", "#c2410c")}>
              {reason}
            </span>
          ))}
        </div>
      ) : null}

      {repo.latestReleaseTag ? (
        <a
          href={`${repo.htmlUrl}/releases`}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{
            fontSize: "0.8rem",
            color: "var(--lap-accent-primary)",
          }}
        >
          🏷 {repo.latestReleaseTag}
        </a>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function badgeStyle(background: string, color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "22px",
    padding: "0 8px",
    borderRadius: "999px",
    background,
    color,
    fontSize: "0.7rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}
