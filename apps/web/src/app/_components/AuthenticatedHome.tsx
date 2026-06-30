import Link from "next/link";

import { HomeArticleStateCard, HomeRecentReadingMetric } from "./HomeArticleStateCard";
import { HomeHeroOrbit } from "./HomeHeroOrbit";
import type { HomeDashboardData, HeatmapDay, RatingPoint } from "../home-dashboard-loader";

interface AuthenticatedHomeProps {
  data: HomeDashboardData;
}

export function AuthenticatedHome({ data }: AuthenticatedHomeProps) {
  const cf = data.codeforces;
  const currentRating = cf.account?.currentRating ?? null;
  const rank = cf.account?.rank ?? "unrated";
  const solved = cf.stats?.solvedProblems ?? 0;
  const submissions = cf.stats?.totalSubmissions ?? 0;
  const accepted = cf.stats?.acceptedSubmissions ?? 0;
  const attempted = cf.stats?.attemptedProblems ?? 0;
  const maxRating = cf.account?.maxRating ?? currentRating ?? 0;
  const reportSummary = data.artifactSummaries.learningReportSummary || "生成学习分析后，这里会展示今日训练重点。";

  return (
    <main className="a519-dashboard-home">
      <div className="a519-page-ambient" aria-hidden="true">
        <img src="/a519/academic-knowledge-map.webp" alt="" />
        <HomeHeroOrbit />
      </div>
      <section className="a519-studio-hero" aria-labelledby="a519-home-title">
        <div className="a519-studio-copy">
          <p className="eyebrow a519-page-kicker">你的学习，正在被系统化推进</p>
          <h1 id="a519-home-title">
            <span>专注建模，</span>
            <span>持续成长</span>
          </h1>
          <p>
            欢迎回来，{data.emailLabel ?? data.displayName}。这里把 Codeforces 提交、rating 变化、复习计划、
            技术阅读和 AI 建议合成一个可以直接行动的学习工作台。
          </p>
          <div className="a519-studio-metrics" aria-label="首页概览">
            <HeroMetric href="/user" label="当前 Rating" value={currentRating ? currentRating.toString() : "未绑定"} />
            <HeroMetric href="/user" label="已解决题目" value={solved.toString()} />
            <HomeRecentReadingMetric dbRecentReadings={data.reading.recentReadings.items} />
            <HeroMetric href="/ai" label="学习报告" value={data.artifactSummaries.learningReportSummary ? "已生成" : "待生成"} />
          </div>
          <div className="homeActions a519-home-actions" aria-label="首页行动">
            <Link className="primaryLink" href="/problems">
              开始今日训练
            </Link>
            <Link className="secondaryLink" href="/user">
              刷新 Codeforces 数据
            </Link>
            <Link className="secondaryLink" href="/ai">
              问 AI 教练
            </Link>
          </div>
          <blockquote className="a519-quote">
            <p>算法的本质，是对模式的理解与抽象。</p>
            <cite>D. Knuth</cite>
          </blockquote>
        </div>

        <div className="a519-live-map" aria-label="动态学习路径">
          <Link className="a519-map-node a519-map-node--center" href="/problems">
            今日训练
          </Link>
          <Link className="a519-map-node a519-map-node--read" href="/articles">
            阅读
          </Link>
          <Link className="a519-map-node a519-map-node--ai" href="/ai">
            AI 总结
          </Link>
          <Link className="a519-map-node a519-map-node--review" href="/user">
            复习
          </Link>
          <Link className="a519-map-node a519-map-node--contest" href="/problems">
            比赛
          </Link>
        </div>
      </section>

      <section className="a519-dashboard-grid" aria-label="学习工作台">
        <Link className="a519-dashboard-card a519-dashboard-card--wide a519-cf-card" href="/user">
          <div className="a519-card-head">
            <h2>Codeforces 学习画像</h2>
            <span>{cf.sourceLabel}</span>
          </div>
          <div className="a519-cf-profile-v2">
            <div className="a519-cf-identity">
              <small>{cf.account?.canonicalHandle ?? "未绑定账号"}</small>
              <strong className={codeforcesRankClass(rank)}>{rank}</strong>
              <p>{currentRating ? `当前 ${currentRating} / 最高 ${maxRating}` : "绑定后显示公开 rating"}</p>
            </div>
            <div className="a519-cf-rating-band" aria-label="Codeforces rating 区间">
              <div>
                <span>0</span>
                <span>1200</span>
                <span>1600</span>
                <span>2100</span>
                <span>3000</span>
              </div>
              <i style={{ left: `${ratingBandPosition(currentRating)}%` }} />
            </div>
            <div className="a519-cf-tag-panel">
              {(cf.weakTags.length > 0 ? cf.weakTags : defaultWeakTags).slice(0, 4).map((tag) => (
                <div key={tag.tag} className="a519-cf-tag-row">
                  <span>{tag.tag}</span>
                  <em>{tag.solved}/{tag.attempted}</em>
                  <b style={{ width: `${Math.max(8, Math.round(tag.completionRate * 100))}%` }} />
                </div>
              ))}
            </div>
          </div>
          <div className="a519-mini-list a519-mini-list--cf">
            <span>提交 {submissions}</span>
            <span>通过 {accepted}</span>
            <span>已解决 {solved}</span>
            <span>尝试 {attempted}</span>
            <span>最近同步 {cf.lastSyncedLabel}</span>
          </div>
        </Link>

        <section className="a519-dashboard-card">
          <div className="a519-card-head">
            <h2>今日训练</h2>
            <span>{data.reviewPlan.source === "learning-report" ? "来自学习报告" : "来自训练数据"}</span>
          </div>
          <div className="a519-task-list">
            {data.todayTraining.map((task) => (
              <Link href={task.href} key={`${task.label}-${task.href}`}>
                <span>{task.label}</span>
                <small>{task.detail}</small>
                <strong>{task.status}</strong>
              </Link>
            ))}
          </div>
        </section>

        <Link className="a519-dashboard-card" href="/ai">
          <div className="a519-card-head">
            <h2>AI 学习教练</h2>
            <span>学习建议</span>
          </div>
          <p className="a519-card-copy">{reportSummary}</p>
          <strong className="a519-inline-action">打开 AI 助手</strong>
        </Link>

        <Link className="a519-dashboard-card" href="/articles">
          <div className="a519-card-head">
            <h2>技术文章与日报</h2>
            <span>查看全部</span>
          </div>
          <div className="a519-feed-list">
            {data.reading.latestArticles.length > 0 ? (
              data.reading.latestArticles.slice(0, 4).map((article) => (
                <span key={article.id}>
                  <strong>{article.title}</strong>
                  <small>{article.sourceName}</small>
                </span>
              ))
            ) : (
              <span>暂无可展示的技术文章标题</span>
            )}
          </div>
        </Link>

        <Link className="a519-dashboard-card a519-chart-card" href="/user">
          <div className="a519-card-head">
            <h2>能力成长</h2>
            <span>近 {cf.ratingCurve.length || 0} 场</span>
          </div>
          <RatingCurve points={cf.ratingCurve} />
        </Link>

        <Link className="a519-dashboard-card a519-heatmap-card" href="/user">
          <div className="a519-card-head">
            <h2>Codeforces 提交热力图</h2>
            <span>近 56 天</span>
          </div>
          <SubmissionHeatmap days={cf.heatmap} />
        </Link>

        <section className="a519-dashboard-card">
          <div className="a519-card-head">
            <h2>复习计划</h2>
            <span>今日复习 {data.reviewPlan.items.length}</span>
          </div>
          <div className="a519-review-list">
            {data.reviewPlan.items.map((item) => (
              <Link href={item.href} key={`${item.label}-${item.detail}`}>
                <span>{item.label}</span>
                <small>{item.detail}</small>
              </Link>
            ))}
          </div>
        </section>

        <HomeArticleStateCard
          dbFavorites={data.reading.favorites.items}
          dbRecentReadings={data.reading.recentReadings.items}
        />
      </section>

      <p className="a519-home-footnote">
        会话模式：{data.sessionMode} · 用户数据按数据库 User.id 隔离 · Codeforces 数据来自公开 API 同步后的服务端快照
      </p>
    </main>
  );
}

function HeroMetric({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Link href={href}>
      <strong>{value}</strong>
      <span>{label}</span>
    </Link>
  );
}

function SubmissionHeatmap({ days }: { days: HeatmapDay[] }) {
  const weeks = buildHeatmapWeeks(days);
  const totalSubmissions = days.reduce((sum, day) => sum + day.count, 0);
  const totalSolved = days.reduce((sum, day) => sum + day.solved, 0);

  return (
    <div className="a519-heatmap-shell">
      <div className="a519-heatmap-summary">
        <strong>{totalSubmissions}</strong>
        <span>次提交</span>
        <strong>{totalSolved}</strong>
        <span>通过记录</span>
      </div>
      <div className="a519-heatmap-calendar" aria-label="Codeforces 提交热力图">
        <div className="a519-heatmap-weekdays" aria-hidden="true">
          <span>一</span>
          <span>三</span>
          <span>五</span>
        </div>
        <div className="a519-heatmap-weeks">
          {weeks.map((week, weekIndex) => (
            <div className="a519-heatmap-week" key={`week-${weekIndex}`}>
              {week.map((day, dayIndex) =>
                day ? (
                  <span
                    key={day.date}
                    className={`a519-heat-${day.level}`}
                    title={`${day.date}: ${day.count} 次提交，${day.solved} 题通过`}
                  />
                ) : (
                  <i key={`empty-${weekIndex}-${dayIndex}`} aria-hidden="true" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="a519-heatmap-legend" aria-hidden="true">
        <span>少</span>
        <i className="a519-heat-0" />
        <i className="a519-heat-1" />
        <i className="a519-heat-2" />
        <i className="a519-heat-3" />
        <i className="a519-heat-4" />
        <span>多</span>
      </div>
    </div>
  );
}

function RatingCurve({ points }: { points: RatingPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="a519-empty-chart">
        绑定并同步 Codeforces 后显示 rating 曲线。
      </div>
    );
  }

  const ratings = points.map((point) => point.rating);
  const min = Math.max(0, Math.min(...ratings) - 80);
  const max = Math.max(...ratings) + 80;
  const spread = Math.max(1, max - min);
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 8 : 8 + (index / (points.length - 1)) * 84;
    const y = 82 - ((point.rating - min) / spread) * 58;
    return { point, x, y };
  });
  const path = coords.map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const areaPath = `${path} L ${coords[coords.length - 1].x.toFixed(2)} 88 L ${coords[0].x.toFixed(2)} 88 Z`;
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.rating - first.rating;
  const yTicks = [max, Math.round((max + min) / 2), min];

  return (
    <div className="a519-rating-chart">
      <div className="a519-rating-statline">
        <div>
          <strong>{last.rating}</strong>
          <small>当前 rating</small>
        </div>
        <span>{delta >= 0 ? "+" : ""}{delta}</span>
      </div>
      <svg viewBox="0 0 100 96" role="img" aria-label="Codeforces rating 曲线">
        <defs>
          <linearGradient id="a519-rating-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0f6b48" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#0f6b48" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((tick, index) => {
          const y = 82 - ((tick - min) / spread) * 58;
          return (
            <g key={tick}>
              <line className="a519-rating-gridline" x1="8" x2="94" y1={y} y2={y} />
              <text className="a519-rating-axis" x="1.5" y={y + 3}>
                {index === 1 ? "" : tick}
              </text>
            </g>
          );
        })}
        <path className="a519-rating-area" d={areaPath} />
        <path className="a519-rating-line" d={path} />
        {coords.map(({ point, x, y }, index) => (
          <circle
            key={`${point.label}-${point.rating}-${index}`}
            className={point.delta >= 0 ? "a519-rating-dot a519-rating-dot--up" : "a519-rating-dot a519-rating-dot--down"}
            cx={x}
            cy={y}
            r={index === coords.length - 1 ? 2.6 : 1.8}
          />
        ))}
      </svg>
      <div className="a519-rating-caption">
        <span>{first.label}</span>
        <strong title={last.contestName}>{last.contestName}</strong>
        <span>{last.label}</span>
      </div>
    </div>
  );
}

const defaultWeakTags = [
  { tag: "dp", attempted: 0, solved: 0, completionRate: 0 },
  { tag: "graphs", attempted: 0, solved: 0, completionRate: 0 },
  { tag: "math", attempted: 0, solved: 0, completionRate: 0 },
  { tag: "greedy", attempted: 0, solved: 0, completionRate: 0 },
];

function codeforcesRankClass(rank: string): string {
  const normalized = rank.toLowerCase();
  if (normalized.includes("pupil")) return "a519-rank-pupil";
  if (normalized.includes("specialist")) return "a519-rank-specialist";
  if (normalized.includes("expert")) return "a519-rank-expert";
  if (normalized.includes("candidate") || normalized.includes("master")) return "a519-rank-master";
  return "a519-rank-default";
}

function ratingBandPosition(rating: number | null): number {
  if (!rating) return 2;
  return Math.min(98, Math.max(2, (rating / 3000) * 100));
}

function buildHeatmapWeeks(days: HeatmapDay[]): Array<Array<HeatmapDay | null>> {
  const weeks: Array<Array<HeatmapDay | null>> = [];
  let currentWeek: Array<HeatmapDay | null> = [];

  days.forEach((day, index) => {
    const weekday = new Date(`${day.date}T00:00:00`).getDay();
    const mondayIndex = weekday === 0 ? 6 : weekday - 1;
    if (index === 0) {
      currentWeek = Array.from({ length: mondayIndex }, () => null);
    }
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}
