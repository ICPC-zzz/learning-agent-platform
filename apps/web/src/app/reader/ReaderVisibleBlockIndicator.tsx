"use client";

import { useEffect, useRef, useState } from "react";

export interface ReaderVisibleBlockIndicatorProps {
  /**
   * CSS selector used to locate trackable content blocks.
   * Defaults to `[data-reader-block]`.
   */
  selector?: string;
}

/**
 * Tracks which content block (paragraph) is currently most visible
 * in the viewport using IntersectionObserver.
 *
 * This component reads browser DOM visibility information only — it
 * DOES NOT write to localStorage, sessionStorage, IndexedDB, cookies,
 * or any database. The "current block" is a local estimation based on
 * the current page scroll position and does NOT represent server-synced
 * or database-tracked reading progress.
 *
 * When no trackable elements are found (selector yields zero matches),
 * a safe fallback message is displayed instead of an incorrect index.
 */
export function ReaderVisibleBlockIndicator({
  selector = "[data-reader-block]",
}: ReaderVisibleBlockIndicatorProps) {
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number | null>(
    null,
  );
  const [blockCount, setBlockCount] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const elements = document.querySelectorAll(selector);

    if (elements.length === 0) {
      setBlockCount(0);
      setCurrentBlockIndex(null);
      return;
    }

    setBlockCount(elements.length);

    // Track the intersection ratio for each element
    const visibilityMap = new Map<Element, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibilityMap.set(entry.target, entry.intersectionRatio);
        });

        // Find the element closest to the top of the viewport among
        // those with the highest intersection ratio.
        let bestElement: Element | null = null;
        let bestRatio = 0;
        let bestTop = Infinity;

        visibilityMap.forEach((ratio, element) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestTop = (element as HTMLElement).getBoundingClientRect().top;
            bestElement = element;
          } else if (ratio === bestRatio && ratio > 0) {
            const top = (element as HTMLElement).getBoundingClientRect().top;
            if (top < bestTop) {
              bestTop = top;
              bestElement = element;
            }
          }
        });

        if (bestElement !== null) {
          const index = (bestElement as HTMLElement).dataset.readerBlockIndex;
          setCurrentBlockIndex(index !== undefined ? Number(index) : null);
        }
      },
      {
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    elements.forEach((element) => {
      observerRef.current?.observe(element);
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [selector]);

  // No trackable blocks — show safe degradation message
  if (blockCount === 0) {
    return (
      <section
        aria-label="当前可见内容块提示"
        className="readerVisibleBlockIndicator"
      >
        <span className="readerVisibleBlockLabel">当前可见内容块：</span>
        <span className="readerVisibleBlockValue readerVisibleBlockFallback">
          当前预览内容未提供可追踪段落结构
        </span>
        <span className="readerVisibleBlockNote">
          仅基于当前页面 DOM 估算，不会写入数据库。
        </span>
      </section>
    );
  }

  return (
    <section
      aria-label="当前可见内容块提示"
      className="readerVisibleBlockIndicator"
    >
      <span className="readerVisibleBlockLabel">当前本地可见内容块：</span>
      <span className="readerVisibleBlockValue">
        {currentBlockIndex !== null
          ? `第 ${currentBlockIndex} 块`
          : "计算中…"}
      </span>
      <span className="readerVisibleBlockNote">
        仅基于当前页面 DOM 估算，不会写入数据库。
      </span>
    </section>
  );
}
