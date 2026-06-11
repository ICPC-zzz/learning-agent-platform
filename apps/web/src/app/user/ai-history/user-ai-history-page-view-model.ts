export interface UserAiHistoryItemView {
  historyId: string; bookId: string; chapterId: string;
  bookTitle: string; chapterTitle: string;
  questionPreview: string; answerPreview: string;
  providerMode: string; realProviderCalled: boolean;
  codeBlockCount: number; createdAt: string;
  sourceLabel: string; readerLink: string;
}

export interface UserAiHistoryPageViewModel {
  hasHistory: boolean; items: readonly UserAiHistoryItemView[];
  totalCount: number; dbCount: number; localCount: number;
  dataSourceLabel: string; dataSourceNotice: string;
  safetyNotice: string; guardBlockedReasons: readonly string[];
}

export function buildUserAiHistoryPageViewModel(input: {
  dbItems: ReadonlyArray<{ id?: string; bookId: string; chapterId: string; bookTitle: string; chapterTitle: string; questionPreview: string; answerPreview: string; providerMode: string; realProviderCalled: boolean; codeBlockCount: number; createdAt: string; sourceType?: string }>;
  localItems: ReadonlyArray<{ historyId: string; bookId: string; chapterId: string; bookTitle: string; chapterTitle: string; questionPreview: string; answerPreview: string; providerMode: string; realProviderCalled: boolean; codeBlockCount: number; createdAt: string; sourceType?: string }>;
  dbGuardEnabled: boolean;
  blockedReasons: readonly string[];
}): UserAiHistoryPageViewModel {
  var allItems: UserAiHistoryItemView[] = [];
  for (var i=0;i<input.dbItems.length;i++) {
    var d=input.dbItems[i];
    allItems.push({historyId:d.id||"db-"+i,bookId:d.bookId,chapterId:d.chapterId,bookTitle:d.bookTitle,chapterTitle:d.chapterTitle,questionPreview:d.questionPreview,answerPreview:d.answerPreview,providerMode:d.providerMode,realProviderCalled:d.realProviderCalled,codeBlockCount:d.codeBlockCount,createdAt:d.createdAt,sourceLabel:"DB",readerLink:"/reader?bookId="+encodeURIComponent(d.bookId)+"&chapterId="+encodeURIComponent(d.chapterId)});
  }
  for (var j=0;j<input.localItems.length;j++) {
    var l=input.localItems[j];
    allItems.push({historyId:l.historyId,bookId:l.bookId,chapterId:l.chapterId,bookTitle:l.bookTitle,chapterTitle:l.chapterTitle,questionPreview:l.questionPreview,answerPreview:l.answerPreview,providerMode:l.providerMode,realProviderCalled:l.realProviderCalled,codeBlockCount:l.codeBlockCount,createdAt:l.createdAt,sourceLabel:"本地",readerLink:"/reader?bookId="+encodeURIComponent(l.bookId)+"&chapterId="+encodeURIComponent(l.chapterId)});
  }
  allItems.sort(function(a,b){if(a.createdAt>b.createdAt)return -1;if(a.createdAt<b.createdAt)return 1;return 0;});
  var label:string;var notice:string;
  if(input.dbGuardEnabled&&input.dbItems.length>0){label="开发 DB + 本地";notice="DB 数据优先 · localStorage 补充 · 未接生产账号";}
  else if(input.localItems.length>0){label="本地存储";notice="localStorage 本地数据 · 未连接 DB · 未接生产账号";}
  else{label="无数据";notice="暂无 AI 问答历史";}
  return {hasHistory:allItems.length>0,items:allItems,totalCount:allItems.length,dbCount:input.dbItems.length,localCount:input.localItems.length,dataSourceLabel:label,dataSourceNotice:notice,safetyNotice:"仅保存安全摘要 · 不保存原始 prompt/response · 默认 mock · dev-only · 未接生产 AI 服务",guardBlockedReasons:input.blockedReasons};
}

var FORBIDDEN=["生产 AI 已接入","真实 Agent 已运行","工具已执行","云端同步成功","已保存完整对话"];
export function aiHistoryPageSafe(view:UserAiHistoryPageViewModel):boolean {
  var t=JSON.stringify(view);
  for(var i=0;i<FORBIDDEN.length;i++){if(t.indexOf(FORBIDDEN[i])>=0)return false;}
  return true;
}
