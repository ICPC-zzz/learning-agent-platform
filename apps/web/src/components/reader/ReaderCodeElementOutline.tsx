"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReaderCodeElementPreview } from "../../app/reader/reader-code-element-extractor";

interface ReaderCodeElementOutlineProps {
  elements: readonly ReaderCodeElementPreview[];
}

export interface ReaderCodeElementLanguageFilterOption {
  language: string;
  count: number;
}

export interface ReaderCodeElementViewportSnapshot {
  elementId: string;
  index: number;
  intersectionRatio: number;
  isIntersecting: boolean;
  top: number;
}

export interface ReaderCodeElementOutlineItemState {
  ariaCurrent?: "location";
  dataCurrent?: "true";
  isCurrent: boolean;
  itemClassName: string;
  linkClassName: string;
}

const CODE_ELEMENT_HIGHLIGHT_DURATION_MS = 1600;
const HIGHLIGHT_CLASS_NAME = "readerContentBlockHighlighted";
const CURRENT_ITEM_CLASS_NAME = "readerCodeElementItemCurrent";
const CURRENT_LINK_CLASS_NAME = "readerCodeElementLinkCurrent";
const OBSERVED_CONTENT_BLOCK_SELECTOR =
  ".readerContentBlock[data-reader-code-element-id]";
const ALL_LANGUAGE_FILTER_VALUE = "all";

export function ReaderCodeElementOutline({
  elements,
}: ReaderCodeElementOutlineProps) {
  const [currentElementId, setCurrentElementId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    ALL_LANGUAGE_FILTER_VALUE,
  );
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightedElementIdRef = useRef<string | null>(null);

  const elementOrder = useMemo(() => {
    return new Map(
      elements.map((element, index) => [element.elementId, index] as const),
    );
  }, [elements]);

  const languageFilterOptions = useMemo(() => {
    return buildReaderCodeElementLanguageFilterOptions(elements);
  }, [elements]);

  const filteredElements = useMemo(() => {
    return filterReaderCodeElementOutlineElements(elements, selectedLanguage);
  }, [elements, selectedLanguage]);

  useEffect(() => {
    if (selectedLanguage === ALL_LANGUAGE_FILTER_VALUE) {
      return;
    }

    const isSelectedLanguageAvailable = languageFilterOptions.some(
      (option) => option.language === selectedLanguage,
    );

    if (!isSelectedLanguageAvailable) {
      setSelectedLanguage(ALL_LANGUAGE_FILTER_VALUE);
    }
  }, [languageFilterOptions, selectedLanguage]);

  const clearReaderCodeElementHighlight = useCallback(() => {
    if (highlightTimeoutRef.current !== null) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }

    updateReaderCodeElementHighlightState(
      document,
      highlightedElementIdRef.current,
      null,
    );
    highlightedElementIdRef.current = null;
  }, []);

  const flashReaderCodeElementHighlight = useCallback((elementId: string) => {
    clearReaderCodeElementHighlight();
    highlightedElementIdRef.current = elementId;
    updateReaderCodeElementHighlightState(document, null, elementId);
    highlightTimeoutRef.current = setTimeout(() => {
      highlightTimeoutRef.current = null;
      updateReaderCodeElementHighlightState(
        document,
        highlightedElementIdRef.current,
        null,
      );
      highlightedElementIdRef.current = null;
    }, CODE_ELEMENT_HIGHLIGHT_DURATION_MS);
  }, [clearReaderCodeElementHighlight]);

  const activateReaderCodeElement = useCallback(
    (elementId: string) => {
      const targetElement = document.getElementById(elementId);
      setCurrentElementId(elementId);
      targetElement?.scrollIntoView({ block: "start", behavior: "auto" });
      window.location.hash = elementId;
      flashReaderCodeElementHighlight(elementId);
    },
    [flashReaderCodeElementHighlight],
  );

  useEffect(() => {
    if (elements.length === 0) {
      setCurrentElementId(null);
      return;
    }

    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observedBlocks = Array.from(
      document.querySelectorAll<HTMLElement>(OBSERVED_CONTENT_BLOCK_SELECTOR),
    ).filter((block) => {
      const elementId = block.dataset.readerCodeElementId;
      return elementId !== undefined && elementOrder.has(elementId);
    });

    if (observedBlocks.length === 0) {
      setCurrentElementId(null);
      return;
    }

    const visibilitySnapshots = new Map<string, ReaderCodeElementViewportSnapshot>();

    const syncCurrentElementId = () => {
      setCurrentElementId(
        resolveReaderCodeElementCurrentId(Array.from(visibilitySnapshots.values())),
      );
    };

    const seedCurrentVisibility = () => {
      const viewportHeight =
        window.innerHeight || document.documentElement.clientHeight || 0;

      for (const block of observedBlocks) {
        const elementId = block.dataset.readerCodeElementId;
        if (elementId === undefined) {
          continue;
        }

        const index = elementOrder.get(elementId);
        if (index === undefined) {
          continue;
        }

        const rect = block.getBoundingClientRect();
        const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
        const intersectionRatio =
          rect.height > 0
            ? Math.max(0, Math.min(visibleHeight / rect.height, 1))
            : rect.bottom > 0 && rect.top < viewportHeight
              ? 1
              : 0;

        visibilitySnapshots.set(elementId, {
          elementId,
          index,
          intersectionRatio,
          isIntersecting: intersectionRatio > 0,
          top: rect.top,
        });
      }
    };

    const observer = new IntersectionObserver((entries) => {
      let didChange = false;

      for (const entry of entries) {
        const block = entry.target as HTMLElement;
        const elementId = block.dataset.readerCodeElementId;
        if (elementId === undefined) {
          continue;
        }

        const index = elementOrder.get(elementId);
        if (index === undefined) {
          continue;
        }

        visibilitySnapshots.set(elementId, {
          elementId,
          index,
          intersectionRatio: entry.intersectionRatio,
          isIntersecting: entry.isIntersecting,
          top: entry.boundingClientRect.top,
        });
        didChange = true;
      }

      if (didChange) {
        syncCurrentElementId();
      }
    }, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    for (const block of observedBlocks) {
      observer.observe(block);
    }

    seedCurrentVisibility();
    syncCurrentElementId();

    return () => {
      observer.disconnect();
    };
  }, [elementOrder, elements]);

  useEffect(() => {
    const syncHighlightFromHash = () => {
      const targetCodeElementId = resolveReaderCodeElementHashTarget(
        window.location.hash,
      );

      if (targetCodeElementId === null) {
        clearReaderCodeElementHighlight();
        return;
      }

      setCurrentElementId(targetCodeElementId);
      flashReaderCodeElementHighlight(targetCodeElementId);
    };

    syncHighlightFromHash();
    window.addEventListener("hashchange", syncHighlightFromHash);

    return () => {
      window.removeEventListener("hashchange", syncHighlightFromHash);
      clearReaderCodeElementHighlight();
    };
  }, [clearReaderCodeElementHighlight, flashReaderCodeElementHighlight]);

  if (elements.length === 0) {
    return null;
  }

  const languageSummary = buildLanguageSummary(elements);
  const isLanguageFiltered = selectedLanguage !== ALL_LANGUAGE_FILTER_VALUE;
  const visibleElementCount = filteredElements.length;
  const visibleCountLabel = isLanguageFiltered
    ? `${visibleElementCount}/${elements.length}`
    : String(elements.length);

  return (
    <section
      aria-label="代码块目录，只读识别结果"
      className="readerCodeElementOutline"
      data-testid="reader-code-element-outline"
    >
      <div className="readerCodeElementOutlineHeader">
        <div>
          <p className="readerCodeElementOutlineKicker">只读识别结果</p>
          <h3 className="readerCodeElementOutlineTitle">代码块目录</h3>
        </div>
        <span className="readerCodeElementOutlineCount">
          {visibleCountLabel} 个代码块
        </span>
      </div>
      <div
        aria-label="按语言筛选代码块"
        className="readerCodeElementFilters"
        role="toolbar"
      >
        <button
          aria-pressed={selectedLanguage === ALL_LANGUAGE_FILTER_VALUE}
          className={
            selectedLanguage === ALL_LANGUAGE_FILTER_VALUE
              ? "readerCodeElementFilterButton readerCodeElementFilterButtonActive"
              : "readerCodeElementFilterButton"
          }
          type="button"
          onClick={() => {
            setSelectedLanguage(ALL_LANGUAGE_FILTER_VALUE);
          }}
        >
          <span className="readerCodeElementFilterLabel">全部</span>
          <span className="readerCodeElementFilterCount">{elements.length}</span>
        </button>
        {languageFilterOptions.map((option) => {
          const isSelected = selectedLanguage === option.language;

          return (
            <button
              key={option.language}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "readerCodeElementFilterButton readerCodeElementFilterButtonActive"
                  : "readerCodeElementFilterButton"
              }
              type="button"
              onClick={() => {
                setSelectedLanguage(option.language);
              }}
            >
              <span className="readerCodeElementFilterLabel">
                {option.language}
              </span>
              <span className="readerCodeElementFilterCount">{option.count}</span>
            </button>
          );
        })}
      </div>
      <p className="readerCodeElementOutlineSummary">
        本章识别到 {elements.length} 个代码块，可按语言快速筛选。语言分布：
        {languageSummary}
      </p>
      {isLanguageFiltered ? (
        <p className="readerCodeElementOutlineFilterNote">
          当前筛选为 {selectedLanguage}，显示 {visibleElementCount} / {elements.length} 个代码块。
        </p>
      ) : null}
      <ol className="readerCodeElementList">
        {filteredElements.map((element, index) => {
          const itemState = resolveReaderCodeElementOutlineItemState(
            element.elementId,
            currentElementId,
          );

          return (
            <li
              key={element.elementId}
              className={itemState.itemClassName}
              data-reader-code-element-current={itemState.dataCurrent}
              data-testid="reader-code-element-item"
            >
              <a
                aria-current={itemState.ariaCurrent}
                aria-label={`跳转到第 ${formatLineRange(
                  element.startLine,
                  element.endLine,
                )} 行的 ${element.language} 代码块，只读识别结果`}
                aria-keyshortcuts="Enter Space"
                className={itemState.linkClassName}
                href={`#${element.elementId}`}
                onClick={() => {
                  setCurrentElementId(element.elementId);
                  flashReaderCodeElementHighlight(element.elementId);
                }}
                onKeyDown={(event) => {
                  handleReaderCodeElementLinkKeyDown(
                    event,
                    element.elementId,
                    activateReaderCodeElement,
                  );
                }}
              >
                <div className="readerCodeElementItemMeta">
                  <span className="readerCodeElementLanguage">
                    {element.language}
                  </span>
                  <span className="readerCodeElementLineRange">
                    第 {formatLineRange(element.startLine, element.endLine)} 行
                  </span>
                  <span className="readerCodeElementLineCount">
                    {element.lineCount} 行
                  </span>
                  {itemState.isCurrent ? (
                    <span className="readerCodeElementCurrentBadge">当前</span>
                  ) : null}
                  <span className="readerCodeElementOrder">第 {index + 1} 条</span>
                </div>
                <p className="readerCodeElementPreviewText">
                  {element.previewText.length > 0
                    ? element.previewText
                    : "（未生成简短预览）"}
                </p>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function resolveReaderCodeElementCurrentId(
  snapshots: readonly ReaderCodeElementViewportSnapshot[],
): string | null {
  let currentSnapshot: ReaderCodeElementViewportSnapshot | null = null;

  for (const snapshot of snapshots) {
    if (!snapshot.isIntersecting || snapshot.intersectionRatio <= 0) {
      continue;
    }

    if (
      currentSnapshot === null ||
      isReaderCodeElementViewportSnapshotPreferred(snapshot, currentSnapshot)
    ) {
      currentSnapshot = snapshot;
    }
  }

  return currentSnapshot?.elementId ?? null;
}

export function resolveReaderCodeElementOutlineItemState(
  elementId: string,
  currentElementId: string | null,
): ReaderCodeElementOutlineItemState {
  const isCurrent = elementId === currentElementId;

  return {
    ariaCurrent: isCurrent ? "location" : undefined,
    dataCurrent: isCurrent ? "true" : undefined,
    isCurrent,
    itemClassName: isCurrent
      ? `readerCodeElementItem ${CURRENT_ITEM_CLASS_NAME}`
      : "readerCodeElementItem",
    linkClassName: isCurrent
      ? `readerCodeElementLink ${CURRENT_LINK_CLASS_NAME}`
      : "readerCodeElementLink",
  };
}

export function shouldActivateReaderCodeElementLinkKey(key: string): boolean {
  return key === "Enter" || key === " " || key === "Spacebar";
}

export function handleReaderCodeElementLinkKeyDown(
  event: Pick<React.KeyboardEvent<HTMLAnchorElement>, "key" | "preventDefault">,
  elementId: string,
  onCodeElementKeyActivate?: (elementId: string) => void,
): void {
  if (!shouldActivateReaderCodeElementLinkKey(event.key)) {
    return;
  }

  event.preventDefault();
  onCodeElementKeyActivate?.(elementId);
}

export function resolveReaderCodeElementHashTarget(
  hash: string | null | undefined,
): string | null {
  if (typeof hash !== "string" || hash.length === 0) {
    return null;
  }

  const normalizedHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (normalizedHash.length === 0) {
    return null;
  }

  try {
    return decodeURIComponent(normalizedHash);
  } catch {
    return normalizedHash;
  }
}

export function updateReaderCodeElementHighlightState(
  root: Pick<Document, "getElementById">,
  previousElementId: string | null,
  nextElementId: string | null,
): void {
  if (previousElementId !== null) {
    const previousAnchor = root.getElementById(previousElementId);
    const previousBlock = previousAnchor?.closest?.(".readerContentBlock");
    previousBlock?.classList.remove(HIGHLIGHT_CLASS_NAME);
    previousBlock?.removeAttribute?.("data-reader-code-element-highlighted");
  }

  if (nextElementId === null) {
    return;
  }

  const targetAnchor = root.getElementById(nextElementId);
  const targetBlock = targetAnchor?.closest?.(".readerContentBlock");
  targetBlock?.classList.add(HIGHLIGHT_CLASS_NAME);
  targetBlock?.setAttribute?.("data-reader-code-element-highlighted", "true");
}

function isReaderCodeElementViewportSnapshotPreferred(
  candidate: ReaderCodeElementViewportSnapshot,
  current: ReaderCodeElementViewportSnapshot,
): boolean {
  const ratioDelta = candidate.intersectionRatio - current.intersectionRatio;
  if (Math.abs(ratioDelta) > 0.001) {
    return ratioDelta > 0;
  }

  const candidateTopDistance = Math.abs(candidate.top);
  const currentTopDistance = Math.abs(current.top);
  const topDistanceDelta = currentTopDistance - candidateTopDistance;
  if (Math.abs(topDistanceDelta) > 0.5) {
    return topDistanceDelta > 0;
  }

  return candidate.index < current.index;
}

function buildLanguageSummary(
  elements: readonly ReaderCodeElementPreview[],
): string {
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const element of elements) {
    if (!counts.has(element.language)) {
      order.push(element.language);
      counts.set(element.language, 0);
    }

    counts.set(element.language, (counts.get(element.language) ?? 0) + 1);
  }

  return order
    .map((language) => `${language} x ${counts.get(language) ?? 0}`)
    .join(", ");
}

export function buildReaderCodeElementLanguageFilterOptions(
  elements: readonly ReaderCodeElementPreview[],
): ReaderCodeElementLanguageFilterOption[] {
  const counts = new Map<string, number>();
  const order: string[] = [];

  for (const element of elements) {
    if (!counts.has(element.language)) {
      order.push(element.language);
      counts.set(element.language, 0);
    }

    counts.set(element.language, (counts.get(element.language) ?? 0) + 1);
  }

  return order.map((language) => ({
    language,
    count: counts.get(language) ?? 0,
  }));
}

export function filterReaderCodeElementOutlineElements(
  elements: readonly ReaderCodeElementPreview[],
  selectedLanguage: string,
): ReaderCodeElementPreview[] {
  if (selectedLanguage === ALL_LANGUAGE_FILTER_VALUE) {
    return [...elements];
  }

  return elements.filter((element) => element.language === selectedLanguage);
}

function formatLineRange(startLine: number, endLine: number): string {
  if (startLine === endLine) {
    return String(startLine);
  }

  return `${startLine}-${endLine}`;
}
