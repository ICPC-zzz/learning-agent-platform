"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "learning-agent-platform:reader-font-size";

interface FontSizeOption {
  value: string;
  label: string;
  className: string;
}

const FONT_SIZE_OPTIONS: FontSizeOption[] = [
  { value: "small", label: "小", className: "readerFontSmall" },
  { value: "medium", label: "中", className: "readerFontMedium" },
  { value: "large", label: "大", className: "readerFontLarge" },
  { value: "xlarge", label: "特大", className: "readerFontXLarge" },
];

const VALID_VALUES = new Set(FONT_SIZE_OPTIONS.map((o) => o.value));
const DEFAULT_SIZE = "medium";

function readStoredFontSize(): string {
  if (typeof window === "undefined") return DEFAULT_SIZE;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value !== null && VALID_VALUES.has(value)) {
      return value;
    }
  } catch {
    // localStorage unavailable — use default.
  }
  return DEFAULT_SIZE;
}

function writeStoredFontSize(value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage may be full or unavailable — silently ignore.
  }
}

function applyFontSize(value: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.readerFontSize = value;
}

export function ReaderFontSizeControl() {
  const [fontSize, setFontSize] = useState<string>(DEFAULT_SIZE);

  // Mount: read stored preference and apply
  useEffect(() => {
    const stored = readStoredFontSize();
    setFontSize(stored);
    applyFontSize(stored);
  }, []);

  const handleChange = useCallback((value: string) => {
    if (!VALID_VALUES.has(value)) return;
    setFontSize(value);
    writeStoredFontSize(value);
    applyFontSize(value);
  }, []);

  return (
    <section aria-label="阅读器字体大小" className="readerFontSizeControl">
      <h3 className="readerFontSizeControlTitle">字体大小</h3>
      <p className="readerFontSizeControlDisclaimer">
        开发预览 · 仅影响当前浏览器显示，不写入数据库，不发送给 AI。
      </p>
      <div className="readerFontSizeControlOptions" role="group" aria-label="字号选项">
        {FONT_SIZE_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`readerFontSizeBtn ${option.className} ${
              fontSize === option.value ? "readerFontSizeBtnActive" : ""
            }`}
            disabled={fontSize === option.value}
            onClick={() => handleChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="readerFontSizeControlStatus" aria-live="polite">
        当前：
        {FONT_SIZE_OPTIONS.find((o) => o.value === fontSize)?.label ?? "中"}
      </p>
    </section>
  );
}
