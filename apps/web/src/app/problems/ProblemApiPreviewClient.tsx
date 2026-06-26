"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { previewProblemApiAction } from "./problem-api-preview-server-action";
import type {
  ProblemApiPreviewStatusSnapshot,
  ProblemApiPreviewViewModel,
} from "./problem-api-preview-types";
import {
  importProblemApiItemAction,
  type ProblemApiImportResult,
} from "../import/problem-api-import-server-action";
import { evaluateProblemImportEligibility } from "../import/problem-import-eligibility";
import {
  createImportedProblemEntry,
  getImportedProblemByProviderKey,
  saveImportedProblem,
  type ImportedProblemEntry,
} from "../../lib/local-imported-problem-store";

const panelGridStyle: CSSProperties = {
  display: "grid",
  gap: "12px",
};

const searchRowStyle: CSSProperties = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns:
    "minmax(0, 1.6fr) minmax(180px, 0.8fr) minmax(180px, 0.9fr) minmax(140px, 0.6fr)",
  alignItems: "end",
};

const controlBlockStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
};

const inputStyle: CSSProperties = {
  minHeight: "38px",
  border: "1px solid #d8dee8",
  borderRadius: "8px",
  color: "#1c2430",
  font: "inherit",
  padding: "8px 12px",
  width: "100%",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  appearance: "none",
  background: "#fff",
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "12px",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginTop: "10px",
};

const badgeStyle: CSSProperties = {
  display: "inline-block",
  fontSize: "0.72rem",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: "999px",
  background: "#e8ecf1",
  color: "#54657e",
};

const successBadgeStyle: CSSProperties = {
  ...badgeStyle,
  background: "#e8fff1",
  color: "#166534",
};

const blockedBadgeStyle: CSSProperties = {
  ...badgeStyle,
  background: "#fff3cd",
  color: "#856404",
};

const blockedPanelStyle: CSSProperties = {
  background: "#fff9e6",
  border: "1px solid #f0d77b",
  borderRadius: "8px",
  padding: "14px 16px",
  fontSize: "0.9rem",
  color: "#66561b",
};

const errorPanelStyle: CSSProperties = {
  background: "#fff1f2",
  border: "1px solid #fda4af",
  borderRadius: "8px",
  padding: "14px 16px",
  fontSize: "0.9rem",
  color: "#9f1239",
};

interface ProblemApiPreviewClientProps {
  status: ProblemApiPreviewStatusSnapshot;
}

export function ProblemApiPreviewClient({ status }: ProblemApiPreviewClientProps) {
  const formId = useId();
  const initialPreview = createInitialPreview(status);
  const [query, setQuery] = useState(initialPreview.query);
  const [difficulty, setDifficulty] = useState(initialPreview.filters.difficulty ?? "");
  const [tagsInput, setTagsInput] = useState(initialPreview.filters.tags.join(", "));
  const [page, setPage] = useState(initialPreview.paginationPreview.page);
  const [pageSize, setPageSize] = useState(initialPreview.paginationPreview.pageSize);
  const [preview, setPreview] = useState<ProblemApiPreviewViewModel>(initialPreview);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const initialLoadTriggered = useRef(false);

  const isBlocked = status.providerMode === "blocked";
  const effectiveProviderMode =
    preview.providerMode === "mock" ? status.providerMode : preview.providerMode;
  const displayError = preview.error ?? errorMessage;
  const displayBlockedReason = preview.blockedReason ?? status.blockedReason;

  const runPreview = useCallback(
    async (nextPage: number) => {
      if (isBlocked) {
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const result = await previewProblemApiAction({
          query,
          difficulty: difficulty.trim().length > 0 ? difficulty : null,
          tags: parseTagsInput(tagsInput),
          page: nextPage,
          pageSize,
        });

        setPreview(result);
        setQuery(result.query);
        setDifficulty(result.filters.difficulty ?? "");
        setTagsInput(result.filters.tags.join(", "));
        setPage(result.paginationPreview.page);
        setPageSize(result.paginationPreview.pageSize);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Problem API preview failed with an unknown error.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [difficulty, isBlocked, pageSize, query, tagsInput],
  );

  useEffect(() => {
    if (isBlocked || initialLoadTriggered.current) {
      return;
    }

    initialLoadTriggered.current = true;
    void runPreview(1);
  }, [isBlocked, runPreview]);

  const hasResults = preview.itemsPreview.length > 0;
  const isErrorState = displayError !== null && displayError.length > 0;

  return (
    <div style={panelGridStyle}>
      <section className="learningPanel askAiPanel" aria-labelledby="problem-api-preview-title">
        <p className="eyebrow">开发预览</p>
        <h2 id="problem-api-preview-title">Problem API search/list preview</h2>
        <p className="panelNote">
          Safe search and list interaction for external problem providers. When env is missing, the UI shows blocked state and missing variable names only.
        </p>

        <form
          style={{ marginTop: "14px" }}
          onSubmit={(event) => {
            event.preventDefault();
            void runPreview(1);
          }}
        >
          <div style={searchRowStyle}>
            <div style={controlBlockStyle}>
              <label htmlFor={`${formId}-query`} className="panelNote">
                Keyword
              </label>
              <input
                id={`${formId}-query`}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search problems by title or keyword..."
                style={inputStyle}
                disabled={isBlocked || isLoading}
              />
            </div>

            <div style={controlBlockStyle}>
              <label htmlFor={`${formId}-difficulty`} className="panelNote">
                Difficulty
              </label>
              <select
                id={`${formId}-difficulty`}
                value={difficulty}
                onChange={(event) => setDifficulty(event.currentTarget.value)}
                style={selectStyle}
                disabled={isBlocked || isLoading}
              >
                <option value="">All</option>
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
                <option value="challenge">challenge</option>
                <option value="unknown">unknown</option>
              </select>
            </div>

            <div style={controlBlockStyle}>
              <label htmlFor={`${formId}-tags`} className="panelNote">
                Tags
              </label>
              <input
                id={`${formId}-tags`}
                type="text"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.currentTarget.value)}
                placeholder="array, dp, graph"
                style={inputStyle}
                disabled={isBlocked || isLoading}
              />
            </div>

            <div style={controlBlockStyle}>
              <label htmlFor={`${formId}-page-size`} className="panelNote">
                Page size
              </label>
              <select
                id={`${formId}-page-size`}
                value={String(pageSize)}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.currentTarget.value));
                }}
                style={selectStyle}
                disabled={isBlocked || isLoading}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>

          <div style={actionRowStyle}>
            <button type="submit" disabled={isBlocked || isLoading}>
              {isLoading ? "Loading..." : "Apply filters"}
            </button>
            <button
              type="button"
              className="secondaryLink"
              onClick={() => {
                void runPreview(page);
              }}
              disabled={isBlocked || isLoading}
            >
              Refresh current page
            </button>
            <button
              type="button"
              className="secondaryLink"
              onClick={() => {
                void runPreview(Math.max(1, preview.paginationPreview.page - 1));
              }}
              disabled={isBlocked || isLoading || preview.paginationPreview.page <= 1}
            >
              Previous page
            </button>
            <button
              type="button"
              className="secondaryLink"
              onClick={() => {
                const nextPage = preview.paginationPreview.nextPage ?? preview.paginationPreview.page + 1;
                void runPreview(nextPage);
              }}
              disabled={isBlocked || isLoading || !preview.paginationPreview.hasNextPage}
            >
              Next page
            </button>
          </div>
        </form>

        <div style={badgeRowStyle}>
          <span style={badgeStyle}>providerMode: {effectiveProviderMode}</span>
          <span style={effectiveProviderMode === "external-dev" ? successBadgeStyle : blockedBadgeStyle}>
            {effectiveProviderMode === "external-dev"
              ? `external-dev / 开发预览`
              : "blocked"}
          </span>
          <span style={badgeStyle}>safeToExposeToClient=true</span>
          <span style={badgeStyle}>rawResponseStored=false</span>
          <span style={badgeStyle}>productionReady=false</span>
          <span style={badgeStyle}>no DB writes</span>
          <span style={badgeStyle}>query: {preview.query || "list"}</span>
          <span style={badgeStyle}>difficulty: {preview.filters.difficulty ?? "all"}</span>
          <span style={badgeStyle}>
            tags: {preview.filters.tags.length > 0 ? preview.filters.tags.join(", ") : "none"}
          </span>
          <span style={badgeStyle}>page: {preview.paginationPreview.page}</span>
          <span style={badgeStyle}>pageSize: {preview.paginationPreview.pageSize}</span>
        </div>
      </section>

      <section className="learningPanel" aria-labelledby="problem-api-status-title">
        <p className="eyebrow">API status</p>
        <h2 id="problem-api-status-title">Problem source status</h2>

        {isBlocked ? (
          <BlockedNotice
            blockedReason={displayBlockedReason}
            missingEnvNames={
              preview.missingEnvNames.length > 0 ? preview.missingEnvNames : status.missingEnvNames
            }
          />
        ) : isErrorState ? (
          <ErrorNotice error={displayError} blockedReason={preview.blockedReason} />
        ) : isLoading ? (
          <LoadingNotice />
        ) : hasResults ? (
          <ProblemPreviewResults preview={preview} />
        ) : (
          <EmptyNotice
            query={preview.query}
            filters={preview.filters}
            paginationPreview={preview.paginationPreview}
          />
        )}
      </section>
    </div>
  );
}

function createInitialPreview(
  status: ProblemApiPreviewStatusSnapshot,
): ProblemApiPreviewViewModel {
  return {
    providerMode: status.providerMode === "blocked" ? "blocked" : "mock",
    safeToExposeToClient: true,
    productionReady: false,
    rawResponseStored: false,
    blockedReason: status.blockedReason,
    error: null,
    missingEnvNames: [...status.missingEnvNames],
    query: "",
    filters: {
      difficulty: null,
      tags: [],
      page: 1,
      pageSize: 10,
    },
    paginationPreview: {
      page: 1,
      pageSize: 10,
      totalResults: 0,
      totalPages: 0,
      hasNextPage: false,
      nextPage: null,
    },
    totalResults: 0,
    itemsPreview: [],
    sourceMode: "mock",
    externalApiQueried: false,
    apiBlocked: status.providerMode === "blocked",
  };
}

export function BlockedNotice({
  blockedReason,
  missingEnvNames,
}: {
  blockedReason: string | null;
  missingEnvNames: string[];
}) {
  return (
    <div style={blockedPanelStyle} role="alert">
      <strong>External problem API is blocked</strong>
      <p style={{ marginTop: "6px" }}>
        Missing env names are shown below. Values are never exposed.
      </p>
      {missingEnvNames.length > 0 ? (
        <ul style={{ marginTop: "6px", paddingLeft: "20px", fontSize: "0.85rem" }}>
          {missingEnvNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
      {blockedReason ? (
        <p style={{ marginTop: "8px", fontSize: "0.8rem", opacity: 0.8 }}>
          {blockedReason}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorNotice({
  error,
  blockedReason,
}: {
  error: string | null;
  blockedReason: string | null;
}) {
  return (
    <div style={errorPanelStyle} role="alert">
      <strong>Preview failed safely</strong>
      <p style={{ marginTop: "6px" }}>
        The provider returned a safe fallback instead of exposing raw payload details.
      </p>
      {error ? <p style={{ marginTop: "6px" }}>{error}</p> : null}
      {blockedReason ? (
        <p style={{ marginTop: "8px", fontSize: "0.8rem", opacity: 0.8 }}>
          {blockedReason}
        </p>
      ) : null}
    </div>
  );
}

export function LoadingNotice() {
  return (
    <p className="panelNote" style={{ padding: "16px 0" }}>
      Loading problem preview...
    </p>
  );
}

export function EmptyNotice({
  query,
  filters,
  paginationPreview,
}: {
  query: string;
  filters: ProblemApiPreviewViewModel["filters"];
  paginationPreview: ProblemApiPreviewViewModel["paginationPreview"];
}) {
  return (
    <div className="learningEmptyState" aria-live="polite">
      <strong>No problem preview available yet.</strong>
      <p style={{ marginTop: "8px" }}>
        Apply filters to load a safe problem list preview from the configured provider.
      </p>
      <dl className="scoreMeta" style={{ marginTop: "14px" }}>
        <SummaryRow label="Query" value={query || "list"} />
        <SummaryRow label="Difficulty" value={filters.difficulty ?? "all"} />
        <SummaryRow label="Tags" value={filters.tags.length > 0 ? filters.tags.join(", ") : "none"} />
        <SummaryRow label="Page" value={paginationPreview.page} />
        <SummaryRow label="Page size" value={paginationPreview.pageSize} />
      </dl>
    </div>
  );
}

export function ProblemPreviewResults({
  preview,
}: {
  preview: ProblemApiPreviewViewModel;
}) {
  return (
    <div style={{ marginTop: "12px" }}>
      <dl className="scoreMeta">
        <SummaryRow label="Source mode" value={preview.sourceMode} />
        <SummaryRow label="Provider mode" value={preview.providerMode} />
        <SummaryRow label="Query" value={preview.query || "list preview"} />
        <SummaryRow label="Difficulty" value={preview.filters.difficulty ?? "all"} />
        <SummaryRow
          label="Tags"
          value={preview.filters.tags.length > 0 ? preview.filters.tags.join(", ") : "none"}
        />
        <SummaryRow label="Page" value={preview.paginationPreview.page} />
        <SummaryRow label="Page size" value={preview.paginationPreview.pageSize} />
        <SummaryRow label="Total results" value={preview.totalResults} />
        <SummaryRow label="Total pages" value={preview.paginationPreview.totalPages} />
        <SummaryRow
          label="Has next page"
          value={preview.paginationPreview.hasNextPage ? "yes" : "no"}
        />
        <SummaryRow label="Blocked reason" value={preview.blockedReason ?? "none"} />
        <SummaryRow label="Error" value={preview.error ?? "none"} />
      </dl>

      <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
        {preview.itemsPreview.map((problem) => (
          <ProblemPreviewCard
            key={`${problem.providerId}:${problem.externalProblemId}`}
            problem={problem}
          />
        ))}
      </div>
    </div>
  );
}

function ProblemPreviewCard({
  problem,
}: {
  problem: ProblemApiPreviewViewModel["itemsPreview"][number];
}) {
  const [importState, setImportState] = useState<ImportCardState>({ status: "idle" });
  const eligibility = evaluateProblemImportEligibility({
    title: problem.title,
    summary: problem.summary,
    statement: problem.statement,
    inputDescription: problem.inputDescription,
    outputDescription: problem.outputDescription,
    examples: problem.examples,
    constraints: problem.constraints,
    source: problem.source ?? problem.providerId,
    sourceUrl: problem.sourceUrl,
    tags: problem.tags,
  });

  useEffect(() => {
    const existing = getImportedProblemByProviderKey(problem.providerId, problem.externalProblemId);
    if (existing) {
      setImportState({ status: "ready", alreadyImported: existing });
      return;
    }

    setImportState({ status: "ready" });
  }, [problem.externalProblemId, problem.providerId]);

  async function handleImport() {
    if (!eligibility.canImport) {
      setImportState({
        status: "blocked",
        reason: eligibility.blockedReason ?? "该题不满足导入条件。",
      });
      return;
    }

    setImportState({ status: "importing" });

    try {
      const result = await importProblemApiItemAction({
        providerId: problem.providerId,
        externalProblemId: problem.externalProblemId,
        title: problem.title,
        difficulty: problem.difficulty === "unknown" ? "medium" : problem.difficulty,
        tags: problem.tags,
        summary: problem.summary,
        sourceUrl: problem.sourceUrl,
        statement: problem.statement,
        inputDescription: problem.inputDescription,
        outputDescription: problem.outputDescription,
        examples: problem.examples,
        constraints: problem.constraints,
        source: problem.source ?? problem.providerId,
      });

      if (!result.success) {
        setImportState({
          status: "blocked",
          reason: result.blockedReason ?? result.message,
        });
        return;
      }

      if (result.existing && result.existingDetailLink) {
        const existingEntry = getImportedProblemByProviderKey(
          problem.providerId,
          problem.externalProblemId,
        );
        if (existingEntry) {
          setImportState({ status: "imported", result, entry: existingEntry });
          return;
        }
      }

      const entry = createImportedProblemEntry({
        providerId: problem.providerId,
        externalProblemId: problem.externalProblemId,
        title: problem.title,
        difficulty: problem.difficulty === "unknown" ? "medium" : problem.difficulty,
        tags: problem.tags,
        statement: problem.statement,
        summary: problem.summary,
        inputDescription: problem.inputDescription,
        outputDescription: problem.outputDescription,
        examples: problem.examples,
        constraints: problem.constraints,
        source: problem.source ?? problem.providerId,
        sourceUrl: problem.sourceUrl,
        dbWritten: result.dbWritten,
        dbId: result.dbId ?? undefined,
        storageMode: result.dbWritten ? "db" : "localStorage",
      });

      saveImportedProblem(entry);
      setImportState({ status: "imported", result, entry });
    } catch (error) {
      setImportState({
        status: "error",
        message: error instanceof Error ? error.message : "导入失败",
      });
    }
  }

  const isAlreadyImported = importState.status === "ready" && importState.alreadyImported;
  const isImported = importState.status === "imported";
  const blockedReason = !eligibility.canImport ? eligibility.blockedReason : null;
  const buttonDisabled = importState.status === "importing" || !eligibility.canImport;

  return (
    <article className="chunkItem">
      <div className="panelHeaderRow">
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span style={badgeStyle}>{problem.difficulty}</span>
            <span style={badgeStyle}>{problem.providerId}</span>
            <span style={badgeStyle}>{problem.externalProblemId}</span>
          </div>
          <h3 style={{ margin: "6px 0 4px", fontSize: "16px" }}>{problem.title}</h3>
          <p className="panelNote" style={{ margin: 0 }}>
            Source: {problem.sourceUrl ? renderSafeExternalUrl(problem.sourceUrl) : "n/a"}
          </p>
          {problem.tags.length > 0 ? (
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "8px" }}>
              {problem.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    background: "#e2e8f0",
                    borderRadius: "3px",
                    color: "#334155",
                    fontSize: "11px",
                    padding: "1px 6px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
          {problem.summary ? (
            <p className="panelNote" style={{ marginTop: "8px" }}>
              {problem.summary}
            </p>
          ) : null}
          {problem.statement ? (
            <details style={{ marginTop: "6px" }}>
              <summary style={{ cursor: "pointer", fontSize: "12px", color: "#64748b" }}>
                题面预览
              </summary>
              <p
                className="panelNote"
                style={{
                  marginTop: "4px",
                  whiteSpace: "pre-wrap",
                  fontSize: "12px",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                {problem.statement.length > 500 ? `${problem.statement.slice(0, 497)}...` : problem.statement}
              </p>
            </details>
          ) : null}
          {problem.inputDescription || problem.outputDescription ? (
            <div style={{ marginTop: "4px", fontSize: "11px", color: "#64748b" }}>
              {problem.inputDescription ? <span>输入: {problem.inputDescription.slice(0, 80)} | </span> : null}
              {problem.outputDescription ? <span>输出: {problem.outputDescription.slice(0, 80)}</span> : null}
            </div>
          ) : null}
          {problem.constraints ? (
            <p style={{ marginTop: "4px", fontSize: "11px", color: "#94a3b8" }}>
              约束: {problem.constraints.slice(0, 150)}
            </p>
          ) : null}
          {blockedReason ? (
            <p style={{ marginTop: "6px", fontSize: "11px", color: "#b45309" }}>
              不可导入: {blockedReason}
            </p>
          ) : null}
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
          {problem.sourceUrl ? (
            <a
              className="primaryLink"
              href={problem.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              style={{ fontSize: "12px" }}
            >
              在原站打开
            </a>
          ) : null}

          {buttonDisabled ? (
            <button
              type="button"
              disabled
              style={{
                background: "#f1f5f9",
                border: "1px solid #d8dee8",
                borderRadius: "6px",
                color: "#94a3b8",
                cursor: "not-allowed",
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 14px",
                whiteSpace: "nowrap",
              }}
              title={blockedReason ?? "导入中"}
            >
              {importState.status === "importing" ? "导入中..." : "不可导入"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleImport}
              style={{
                background: "#0f172a",
                border: "none",
                borderRadius: "6px",
                color: "#fff",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                padding: "6px 14px",
                whiteSpace: "nowrap",
              }}
            >
              导入到本地库
            </button>
          )}

          {isAlreadyImported ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
              <span style={{ ...badgeStyle, background: "#e8fff1", color: "#166534" }}>已导入</span>
              <a
                className="primaryLink"
                href={`/problems/${importState.alreadyImported!.importedProblemId}`}
                style={{ fontSize: "12px" }}
              >
                查看详情
              </a>
            </div>
          ) : null}

          {isImported ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
              <span
                style={{
                  ...badgeStyle,
                  background: importState.result.existing ? "#fef3c7" : "#e8fff1",
                  color: importState.result.existing ? "#92400e" : "#166534",
                }}
              >
                {importState.result.existing
                  ? "已存在"
                  : importState.result.dbWritten
                    ? "已导入(DB)"
                    : "已导入(本地)"}
              </span>
              <span style={{ fontSize: "11px", color: "#64748b" }}>
                {importState.result.existing && importState.result.existingDetailLink
                  ? `已有详情: ${importState.result.localProblemId ?? "n/a"}`
                  : `ID: ${importState.entry.importedProblemId}`}
              </span>
              <a
                className="primaryLink"
                href={
                  importState.result.existing && importState.result.existingDetailLink
                    ? importState.result.existingDetailLink
                    : `/problems/${importState.entry.importedProblemId}`
                }
                style={{ fontSize: "12px" }}
              >
                查看题目详情
              </a>
            </div>
          ) : null}

          {importState.status === "error" ? (
            <p style={{ fontSize: "11px", color: "#dc2626", margin: 0 }}>
              {importState.message}
            </p>
          ) : null}

          {importState.status === "blocked" ? (
            <p style={{ fontSize: "11px", color: "#b45309", margin: 0 }}>
              {importState.reason}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function renderSafeExternalUrl(url: string): ReactNode {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return url;
    }

    return (
      <a href={parsed.toString()} rel="noreferrer noopener" target="_blank">
        {parsed.toString()}
      </a>
    );
  } catch {
    return url;
  }
}

function parseTagsInput(value: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const part of value.split(/[\s,;]+/)) {
    const tag = part.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
    if (!tag) {
      continue;
    }

    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(tag.slice(0, 48));

    if (tags.length >= 12) {
      break;
    }
  }

  return tags;
}

type ImportCardState =
  | { status: "idle" }
  | { status: "ready"; alreadyImported?: ImportedProblemEntry }
  | { status: "importing" }
  | { status: "imported"; result: ProblemApiImportResult; entry: ImportedProblemEntry }
  | { status: "blocked"; reason: string }
  | { status: "error"; message: string };
