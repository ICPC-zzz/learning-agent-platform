"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DbItem {
  id: string; bookId: string; chapterId: string;
  bookTitle: string; chapterTitle: string;
  questionPreview: string; answerPreview: string;
  providerMode: string; realProviderCalled: boolean;
  codeBlockCount: number; createdAt: string;
}

interface LocalItem {
  historyId: string; bookId: string; chapterId: string;
  bookTitle: string; chapterTitle: string;
  questionPreview: string; answerPreview: string;
  providerMode: string; realProviderCalled: boolean;
  codeBlockCount: number; createdAt: string;
}

export function UserAiHistoryClientHydration(props: {
  dbItems: DbItem[];
}) {
  var [localItems, setLocalItems] = useState<LocalItem[]>([]);

  useEffect(function () {
    try {
      var raw = window.localStorage.getItem("lap.web.reader.aiHistory");
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      var items: LocalItem[] = [];
      for (var i = 0; i < parsed.length; i++) {
        var e = parsed[i];
        if (e && e.historyId && e.bookId && e.questionPreview && e.answerPreview) {
          items.push({
            historyId: e.historyId,
            bookId: e.bookId,
            chapterId: e.chapterId || "",
            bookTitle: e.bookTitle || "",
            chapterTitle: e.chapterTitle || "",
            questionPreview: String(e.questionPreview).slice(0, 200),
            answerPreview: String(e.answerPreview).slice(0, 500),
            providerMode: e.providerMode || "mock",
            realProviderCalled: Boolean(e.realProviderCalled),
            codeBlockCount: Number(e.codeBlockCount) || 0,
            createdAt: e.createdAt || "",
          });
        }
      }
      setLocalItems(items);
    } catch {
      // Silently ignore
    }
  }, []);

  if (localItems.length === 0) return null;

  return (
    <section className="learningPanel" aria-labelledby="local-history-title">
      <div className="panelHeader">
        <p className="eyebrow">Local History</p>
        <h2 id="local-history-title">本地问答记录（localStorage）</h2>
        <p className="panelNote">
          {localItems.length} 条记录 · 仅保存安全摘要 · localStorage 本地存储
        </p>
      </div>
      <div className="chunkList" style={{ marginTop: "14px" }}>
        {localItems.map(function (item) {
          var link = "/reader?bookId=" + encodeURIComponent(item.bookId) +
            "&chapterId=" + encodeURIComponent(item.chapterId);
          return (
            <article className="chunkItem" key={item.historyId}>
              <div className="panelHeaderRow">
                <div>
                  <p className="eyebrow">
                    {item.providerMode} · 本地 · {item.codeBlockCount} 代码块
                  </p>
                  <h3>{item.bookTitle}</h3>
                  <p className="panelNote">{item.chapterTitle}</p>
                </div>
                <Link className="primaryLink" href={link}>
                  返回阅读
                </Link>
              </div>
              <div style={{ marginTop: "8px" }}>
                <p style={{ fontSize: "12px", color: "#64748b" }}>
                  <strong>Q:</strong> {item.questionPreview}
                </p>
                <p style={{ fontSize: "12px", color: "#334155", marginTop: "4px" }}>
                  <strong>A:</strong> {item.answerPreview}
                </p>
              </div>
              <p style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
                {item.createdAt}
                {item.realProviderCalled ? " · 真实 API 调用" : " · mock"}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
