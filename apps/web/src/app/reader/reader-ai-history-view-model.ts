/**
 * Reader AI History View Model — computes UI state for chapter-level QA history.
 *
 * Provides recent history items and safety labels for display in Reader panel.
 *
 * Designation: **开发预览 · dev-only · local + DB fallback**
 *
 * @module reader-ai-history-view-model
 * @previewOnly
 */

export interface ReaderAiHistoryItemView {
  historyId: string;
  questionPreview: string;
  answerPreview: string;
  providerMode: string;
  realProviderCalled: boolean;
  codeBlockCount: number;
  createdAt: string;
  sourceLabel: string;
}

export interface ReaderAiHistoryPanelViewModel {
  hasHistory: boolean;
  recentItems: readonly ReaderAiHistoryItemView[];
  totalCount: number;
  dataSourceLabel: string;
  dataSourceNotice: string;
  safetyNotice: string;
}

export var MAX_RECENT_ITEMS = 3;

export function buildReaderAiHistoryPanelViewModel(input: {
  items: ReadonlyArray<{
    historyId: string;
    questionPreview: string;
    answerPreview: string;
    providerMode: string;
    realProviderCalled: boolean;
    codeBlockCount: number;
    createdAt: string;
    sourceType: string;
  }>;
  dataSource: "db" | "local" | "none";
  dbGuardEnabled: boolean;
}): ReaderAiHistoryPanelViewModel {
  var items = input.items;
  var limited = items.slice(0, MAX_RECENT_ITEMS);

  var viewItems: ReaderAiHistoryItemView[] = [];
  for (var i = 0; i < limited.length; i++) {
    var item = limited[i];
    viewItems.push({
      historyId: item.historyId,
      questionPreview: item.questionPreview,
      answerPreview: item.answerPreview,
      providerMode: item.providerMode,
      realProviderCalled: item.realProviderCalled,
      codeBlockCount: item.codeBlockCount,
      createdAt: item.createdAt,
      sourceLabel: item.sourceType === "db" ? "DB" : "本地",
    });
  }

  var dataSourceLabel: string;
  var dataSourceNotice: string;

  if (input.dataSource === "db") {
    dataSourceLabel = "开发 DB";
    dataSourceNotice = "仅保存安全摘要 · DB（dev-only）· 未接生产";
  } else if (input.dataSource === "local") {
    dataSourceLabel = "本地存储";
    dataSourceNotice = "仅保存安全摘要 · localStorage · 未同步 · 未接生产";
  } else {
    dataSourceLabel = "无";
    dataSourceNotice = "无历史记录";
  }

  return {
    hasHistory: viewItems.length > 0,
    recentItems: viewItems,
    totalCount: items.length,
    dataSourceLabel: dataSourceLabel,
    dataSourceNotice: dataSourceNotice,
    safetyNotice: "仅保存安全摘要 · 不保存原始 prompt/response · 默认 mock · dev-only · 未接生产 AI 服务",
  };
}
