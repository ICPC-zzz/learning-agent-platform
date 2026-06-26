"use client";

/**
 * UserUiComponents — Shared user-facing UI components for learning platform pages.
 *
 * Designed for user variant only (light mode, learning-product feel).
 * Uses A450/A451 CSS tokens. All text in Chinese.
 * Dev-only / preview / imported-dev identifiers retained.
 * No heavy UI library dependency.
 *
 * @previewOnly — UI components only, no data access
 */

import type { ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type StatusValue =
  | "enabled"
  | "blocked"
  | "missing-env"
  | "preview-only"
  | "unavailable";

export interface UserStatusBadgeProps {
  label: string;
  status: StatusValue;
  /** Optional tooltip override */
  title?: string;
}

export interface PageHeroProps {
  /** Small label above the heading, e.g. "A152 书库预览边界" */
  eyebrow: string;
  /** Main heading */
  title: string;
  /** Subtitle / status line */
  subtitle?: string;
  /** Optional action buttons row */
  children?: ReactNode;
}

export interface PageSectionProps {
  /** Accessible label for the section */
  label?: string;
  /** Section heading */
  title?: string;
  /** Optional eyebrow text above the heading */
  eyebrow?: string;
  /** Optional note below the heading */
  note?: string;
  /** Section content */
  children: ReactNode;
  /** Extra class for the outer card */
  className?: string;
}

export interface FeatureCardProps {
  title: string;
  description: string;
  href: string;
  /** Small label badge (e.g. "A399 每日挑战") */
  badgeLabel?: string;
  /** Accent color for the CTA button */
  accent?: string;
  /** Link text override, defaults to "进入 →" */
  linkText?: string;
}

export interface DataStatePanelProps {
  /** Panel type determines the visual treatment */
  variant: "dev-preview" | "dev-warning" | "info" | "empty" | "success";
  /** Main message */
  message: string;
  /** Optional secondary description */
  description?: string;
  /** Optional action/CTA */
  children?: ReactNode;
}

export interface PreviewNoticeProps {
  /** The key identifiers to display, e.g. ["imported-dev", "productionReady=false"] */
  identifiers: string[];
  /** Optional context message */
  message?: string;
}

export interface ActionCardProps {
  title: string;
  description: string;
  href: string;
  /** CTA button text */
  ctaText?: string;
  /** Optional count badge */
  count?: number;
  /** Whether this card represents a disabled/impossible action */
  disabled?: boolean;
  /** Disabled reason shown as tooltip */
  disabledReason?: string;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export interface MetricPillProps {
  label: string;
  value: string | number;
  /** Optional status color */
  status?: "success" | "warning" | "error" | "info" | "muted";
}

// ── Status color maps ──────────────────────────────────────────────────────

const USER_STATUS_COLORS: Record<StatusValue, { bg: string; text: string }> = {
  enabled: { bg: "var(--lap-status-success-bg)", text: "var(--lap-status-success-text)" },
  blocked: { bg: "var(--lap-status-error-bg)", text: "var(--lap-status-error-text)" },
  "missing-env": { bg: "var(--lap-status-dev-bg)", text: "var(--lap-status-dev-text)" },
  "preview-only": { bg: "#e8edf4", text: "#445064" },
  unavailable: { bg: "var(--lap-bg-muted)", text: "var(--lap-text-muted)" },
};

const STATUS_LABELS: Record<StatusValue, string> = {
  enabled: "已启用",
  blocked: "已阻止",
  "missing-env": "缺少环境变量",
  "preview-only": "开发预览",
  unavailable: "不可用",
};

const VARIANT_COLORS: Record<DataStatePanelProps["variant"], { bg: string; border: string; text: string; badgeBg: string; badgeText: string }> = {
  "dev-preview": {
    bg: "#fffbeb",
    border: "#fde68a",
    text: "#92400e",
    badgeBg: "#f59e0b",
    badgeText: "#ffffff",
  },
  "dev-warning": {
    bg: "#fef2f2",
    border: "#fecaca",
    text: "#991b1b",
    badgeBg: "#ef4444",
    badgeText: "#ffffff",
  },
  info: {
    bg: "#f0f9ff",
    border: "#bae6fd",
    text: "#075985",
    badgeBg: "#0ea5e9",
    badgeText: "#ffffff",
  },
  empty: {
    bg: "var(--lap-bg-muted)",
    border: "#d8dee8",
    text: "var(--lap-text-muted)",
    badgeBg: "#94a3b8",
    badgeText: "#ffffff",
  },
  success: {
    bg: "var(--lap-status-success-bg)",
    border: "#c9d8ca",
    text: "var(--lap-status-success-text)",
    badgeBg: "var(--lap-accent-green)",
    badgeText: "#ffffff",
  },
};

const VARIANT_LABELS: Record<DataStatePanelProps["variant"], string> = {
  "dev-preview": "开发预览",
  "dev-warning": "警告",
  info: "信息",
  empty: "暂无数据",
  success: "就绪",
};

// ── UserStatusBadge ────────────────────────────────────────────────────────

/**
 * Lightweight user-facing status badge.
 * Shows a label with color-coded background based on guard status.
 */
export function UserStatusBadge({ label, status, title }: UserStatusBadgeProps) {
  const colors = USER_STATUS_COLORS[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "1px 8px",
        borderRadius: "var(--lap-radius-sm)",
        background: colors.bg,
        color: colors.text,
        fontSize: "0.625rem",
        fontWeight: 600,
        border: `1px solid ${colors.text}30`,
        whiteSpace: "nowrap",
      }}
      title={title ?? `${label}: ${STATUS_LABELS[status]}`}
    >
      <StatusDot status={status} />
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: StatusValue }) {
  const colorMap: Record<StatusValue, string> = {
    enabled: "#16a34a",
    blocked: "#dc2626",
    "missing-env": "#d97706",
    "preview-only": "#6366f1",
    unavailable: "#94a3b8",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: colorMap[status],
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  );
}

// ── PageHero ───────────────────────────────────────────────────────────────

/**
 * Page hero section with eyebrow, title, subtitle, and optional action buttons.
 * Replaces the inline learningHero pattern used across pages.
 */
export function PageHero({ eyebrow, title, subtitle, children }: PageHeroProps) {
  return (
    <header className="learningHero">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? <p className="status">{subtitle}</p> : null}
      </div>
      {children ? <div className="homeActions">{children}</div> : null}
    </header>
  );
}

// ── PageSection ────────────────────────────────────────────────────────────

/**
 * Standard page section card used across user-facing pages.
 * Wraps content in a .learningPanel with optional header.
 */
export function PageSection({
  label,
  title,
  eyebrow,
  note,
  children,
  className,
}: PageSectionProps) {
  const labeledBy = title ? label?.replace(/\s+/g, "-").toLowerCase() ?? "section-title" : undefined;
  return (
    <section
      className={`learningPanel${className ? " " + className : ""}`}
      aria-labelledby={labeledBy}
      aria-label={!title ? label : undefined}
    >
      {title || eyebrow || note ? (
        <div className="panelHeader">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          {title ? <h2 id={labeledBy}>{title}</h2> : null}
          {note ? <p className="panelNote">{note}</p> : null}
        </div>
      ) : null}
      <div style={{ marginTop: title || eyebrow ? "14px" : 0 }}>{children}</div>
    </section>
  );
}

// ── FeatureCard ────────────────────────────────────────────────────────────

/**
 * Card linking to a learning feature module.
 * Used in /learning and /user hub pages.
 */
export function FeatureCard({
  title,
  description,
  href,
  badgeLabel,
  accent = "var(--lap-accent-primary)",
  linkText = "进入 →",
}: FeatureCardProps) {
  return (
    <div
      className="lap-card lap-card--hover"
      style={{
        padding: "var(--lap-space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-2)",
      }}
    >
      {badgeLabel ? (
        <span style={{ fontSize: "0.6875rem", color: "var(--lap-text-subtle)", fontWeight: 600 }}>
          {badgeLabel}
        </span>
      ) : null}
      <h3 style={{ fontSize: "0.9375rem", color: "var(--lap-text-primary)", margin: 0, lineHeight: 1.35 }}>
        {title}
      </h3>
      <p style={{
        fontSize: "0.8125rem",
        color: "var(--lap-text-muted)",
        margin: 0,
        lineHeight: 1.6,
        flex: 1,
      }}>
        {description}
      </p>
      <a
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "32px",
          padding: "0 14px",
          fontSize: "0.8125rem",
          fontWeight: 600,
          color: "var(--lap-text-inverse)",
          backgroundColor: accent,
          borderRadius: "var(--lap-radius-sm)",
          textDecoration: "none",
          alignSelf: "flex-start",
          marginTop: "auto",
          transition: "opacity var(--lap-transition-fast)",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.88"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        {linkText}
      </a>
    </div>
  );
}

// ── DataStatePanel ─────────────────────────────────────────────────────────

/**
 * Colored notice panel for data/source state communication.
 * Replaces the inline readerDataSourceNotice pattern.
 */
export function DataStatePanel({
  variant,
  message,
  description,
  children,
}: DataStatePanelProps) {
  const colors = VARIANT_COLORS[variant];
  return (
    <section
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--lap-space-3)",
        alignItems: "flex-start",
        padding: "var(--lap-space-4)",
        border: `1px solid ${colors.border}`,
        borderRadius: "var(--lap-radius-lg)",
        background: colors.bg,
        color: colors.text,
        marginTop: "var(--lap-space-3)",
      }}
      aria-label={`${VARIANT_LABELS[variant]} 状态面板`}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: "28px",
          padding: "0 10px",
          borderRadius: "var(--lap-radius-sm)",
          background: colors.badgeBg,
          color: colors.badgeText,
          fontSize: "0.75rem",
          fontWeight: 700,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {VARIANT_LABELS[variant]}
      </span>
      <div style={{ flex: "1 1 300px" }}>
        <p style={{ margin: 0, fontWeight: 600, lineHeight: 1.5 }}>{message}</p>
        {description ? (
          <p style={{ margin: "var(--lap-space-2) 0 0", color: "var(--lap-text-secondary)", fontSize: "0.8125rem", lineHeight: 1.6 }}>
            {description}
          </p>
        ) : null}
        {children ? <div style={{ marginTop: "var(--lap-space-3)" }}>{children}</div> : null}
      </div>
    </section>
  );
}

// ── PreviewNotice ──────────────────────────────────────────────────────────

/**
 * Compact footer notice showing dev-only identifiers.
 * Replaces the inline footer div pattern used across pages.
 */
export function PreviewNotice({ identifiers, message }: PreviewNoticeProps) {
  return (
    <div
      style={{
        marginTop: "var(--lap-space-5)",
        padding: "var(--lap-space-2) var(--lap-space-4)",
        background: "var(--lap-bg-card-alt)",
        border: "var(--lap-border-light)",
        borderRadius: "var(--lap-radius-md)",
        fontSize: "0.75rem",
        color: "var(--lap-text-muted)",
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--lap-space-2)",
        alignItems: "center",
      }}
    >
      {message ? <span style={{ fontWeight: 600 }}>{message}</span> : null}
      {identifiers.map((id) => (
        <code
          key={id}
          style={{
            fontSize: "0.6875rem",
            padding: "1px 6px",
            borderRadius: "var(--lap-radius-sm)",
            background: "var(--lap-bg-muted)",
            color: "var(--lap-text-muted)",
            fontFamily: "var(--lap-font-mono)",
          }}
        >
          {id}
        </code>
      ))}
    </div>
  );
}

// ── ActionCard ─────────────────────────────────────────────────────────────

/**
 * Card with a clear CTA for a specific action (read, practice, import, etc.).
 * Shows count badge when available.
 */
export function ActionCard({
  title,
  description,
  href,
  ctaText = "进入",
  count,
  disabled = false,
  disabledReason,
}: ActionCardProps) {
  return (
    <div
      className="lap-card"
      style={{
        padding: "var(--lap-space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--lap-space-2)",
        opacity: disabled ? 0.6 : 1,
      }}
      title={disabled ? disabledReason : undefined}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--lap-space-3)" }}>
        <h3 style={{ fontSize: "1rem", color: "var(--lap-text-primary)", margin: 0, lineHeight: 1.3 }}>
          {title}
          {count !== undefined ? (
            <span style={{
              marginLeft: "var(--lap-space-2)",
              fontSize: "0.8125rem",
              color: "var(--lap-accent-purple)",
              fontWeight: 600,
            }}>
              ({count})
            </span>
          ) : null}
        </h3>
        <a
          href={disabled ? undefined : href}
          className="secondaryLink"
          style={{
            marginTop: 0,
            fontSize: "0.8125rem",
            minHeight: "32px",
            padding: "0 14px",
            pointerEvents: disabled ? "none" : "auto",
          }}
          aria-disabled={disabled}
        >
          {ctaText}
        </a>
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--lap-text-muted)", margin: 0, lineHeight: 1.6 }}>
        {description}
      </p>
      {disabled && disabledReason ? (
        <p style={{ fontSize: "0.6875rem", color: "var(--lap-status-dev-text)", margin: 0, fontStyle: "italic" }}>
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────

/**
 * Standard empty state placeholder with dashed border.
 */
export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="lap-empty-state" role="status">
      <strong style={{ display: "block", marginBottom: "var(--lap-space-2)", color: "var(--lap-text-primary)" }}>
        {title}
      </strong>
      {description ? (
        <p style={{ margin: 0, lineHeight: 1.6 }}>{description}</p>
      ) : null}
      {children ? <div style={{ marginTop: "var(--lap-space-3)" }}>{children}</div> : null}
    </div>
  );
}

// ── MetricPill ─────────────────────────────────────────────────────────────

/**
 * Small metric display pill (e.g. chapter count, difficulty).
 */
export function MetricPill({ label, value, status = "muted" }: MetricPillProps) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    success: { bg: "var(--lap-status-success-bg)", text: "var(--lap-status-success-text)" },
    warning: { bg: "var(--lap-status-dev-bg)", text: "var(--lap-status-dev-text)" },
    error: { bg: "var(--lap-status-error-bg)", text: "var(--lap-status-error-text)" },
    info: { bg: "#e0e7ff", text: "#3730a3" },
    muted: { bg: "var(--lap-bg-card-alt)", text: "var(--lap-text-muted)" },
  };
  const c = statusColors[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        borderRadius: "var(--lap-radius-sm)",
        background: c.bg,
        color: c.text,
        fontSize: "0.6875rem",
        fontWeight: 600,
        border: `1px solid ${c.text}20`,
        whiteSpace: "nowrap",
      }}
    >
      {label}: {value}
    </span>
  );
}

// ── StatusBadgeRow ─────────────────────────────────────────────────────────

/**
 * Row of UserStatusBadge items with a label prefix.
 * Used at the top of pages to show API guard status.
 */
export function StatusBadgeRow({
  label,
  badges,
}: {
  label: string;
  badges: UserStatusBadgeProps[];
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--lap-space-2)",
        alignItems: "center",
        marginTop: "var(--lap-space-3)",
        marginBottom: "var(--lap-space-3)",
        padding: "var(--lap-space-2) var(--lap-space-3)",
        background: "var(--lap-bg-muted)",
        borderRadius: "var(--lap-radius-md)",
        border: "var(--lap-border-light)",
      }}
    >
      <span style={{ fontSize: "0.6875rem", color: "var(--lap-text-subtle)", fontWeight: 600 }}>
        {label}
      </span>
      {badges.map((b) => (
        <UserStatusBadge key={b.label} {...b} />
      ))}
    </div>
  );
}

// ── GridCardLayout ─────────────────────────────────────────────────────────

/**
 * Responsive card grid layout.
 */
export function GridCardLayout({
  children,
  minCardWidth = "240px",
}: {
  children: ReactNode;
  minCardWidth?: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}, 1fr))`,
        gap: "var(--lap-space-3)",
      }}
    >
      {children}
    </div>
  );
}

// ── BookSourceBadge ────────────────────────────────────────────────────────

/**
 * Badge showing book source type (builtin vs imported-dev).
 */
export function BookSourceBadge({
  sourceType,
  sourceLabel,
}: {
  sourceType?: string | null;
  sourceLabel?: string | null;
}) {
  const isBuiltin = sourceType === "builtin";
  const isImported = sourceType === "IMPORTED_TEXT" || sourceType === "IMPORTED_MARKDOWN" || (sourceType ?? "").startsWith("dev-");
  const label = sourceLabel ?? sourceType ?? "unknown";

  let bg = "var(--lap-bg-card-alt)";
  let text = "var(--lap-text-muted)";

  if (isBuiltin) {
    bg = "#eef5ef";
    text = "#243b27";
  } else if (isImported) {
    bg = "var(--lap-status-dev-bg)";
    text = "var(--lap-status-dev-text)";
  }

  return (
    <span
      className="lap-dev-badge"
      style={{ background: bg, color: text, borderColor: text + "30" }}
    >
      {isBuiltin ? "内置" : isImported ? "imported-dev" : label}
    </span>
  );
}
