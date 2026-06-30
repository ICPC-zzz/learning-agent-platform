import {
  classifyCodeforcesAssistantIntent,
  type CodeforcesAssistantIntent,
} from "./providers/codeforces-personalized-provider.ts";

export type AssistantIntent =
  | { type: "TASK_CONTROL"; action: "cancel" | "retry" }
  | { type: "MEMORY_WRITE"; normalizedMemory: string; confirmationText: string }
  | { type: "MEMORY_READ" }
  | { type: "CONVERSATION_MANAGEMENT" }
  | { type: "CODE_ANALYSIS_FOLLOWUP" }
  | { type: "CODEFORCES"; codeforcesIntent: CodeforcesAssistantIntent }
  | { type: "CHAT" };

export function resolveAssistantIntent(question: string): AssistantIntent {
  const text = normalizeText(question);
  const lower = text.toLowerCase();

  if (isTaskControlIntent(lower)) {
    return {
      type: "TASK_CONTROL",
      action: isRetryIntent(lower) ? "retry" : "cancel",
    };
  }

  const memoryWrite = extractExplicitLongTermMemory(text);
  if (memoryWrite) {
    return {
      type: "MEMORY_WRITE",
      normalizedMemory: memoryWrite.normalizedMemory,
      confirmationText: memoryWrite.confirmationText,
    };
  }

  if (isMemoryReadIntent(lower)) {
    return { type: "MEMORY_READ" };
  }

  if (isConversationManagementIntent(lower)) {
    return { type: "CONVERSATION_MANAGEMENT" };
  }

  if (isCodeAnalysisFollowup(lower)) {
    return { type: "CODE_ANALYSIS_FOLLOWUP" };
  }

  const codeforcesIntent = classifyCodeforcesAssistantIntent(text);
  if (codeforcesIntent) {
    return { type: "CODEFORCES", codeforcesIntent };
  }

  return { type: "CHAT" };
}

export function extractExplicitLongTermMemory(question: string): {
  normalizedMemory: string;
  confirmationText: string;
} | null {
  const text = normalizeText(question);
  const lower = text.toLowerCase();
  if (text.length === 0) {
    return null;
  }

  if (isMemoryReadIntent(lower) || isMemoryConceptQuestion(lower)) {
    return null;
  }

  const hasExplicitMemoryVerb = [
    "更新一下记忆",
    "更新记忆",
    "记住",
    "请记住",
    "帮我记住",
    "保存为长期记忆",
    "保存到长期记忆",
    "加入长期记忆",
    "写入长期记忆",
  ].some((phrase) => lower.includes(phrase.toLowerCase()));
  const hasFutureRule = /以后|今后|往后|以后每次|每次|回答时|下次/.test(text);
  const hasInstructionMarker = /记得|先|都要|请提醒|提醒我|提醒你|当我|如果我/.test(text);

  if (!hasExplicitMemoryVerb && !(hasFutureRule && hasInstructionMarker)) {
    return null;
  }

  const cfRefreshRule = extractCodeforcesRefreshReminderMemory(text);
  if (cfRefreshRule) {
    return cfRefreshRule;
  }

  const generic = cleanupGenericMemoryContent(text);
  if (generic.length < 4) {
    return null;
  }

  const normalizedMemory = limitText(generic, 480);
  return {
    normalizedMemory,
    confirmationText: `已更新长期记忆。\n\n已记住：${normalizedMemory}`,
  };
}

export function isCodeforcesRefreshReminderMemory(content: string): boolean {
  const lower = normalizeText(content).toLowerCase();
  return (
    (lower.includes("codeforces") || /\bcf\b/.test(lower) || content.includes("刷题") || content.includes("推荐题目"))
    && (content.includes("学习分析报告") || content.includes("学习报告"))
    && (content.includes("复习报告") || content.includes("复习计划"))
  );
}

function extractCodeforcesRefreshReminderMemory(text: string): {
  normalizedMemory: string;
  confirmationText: string;
} | null {
  if (!isCodeforcesRefreshReminderMemory(text)) {
    return null;
  }

  const normalizedMemory = "当用户请求推荐 Codeforces 题目、比赛或制定训练计划时，系统先检查学习分析报告、复习计划和 Codeforces 快照的新鲜度；数据新鲜则直接使用，数据过期则由 Agent 自动刷新，只有自动刷新失败时才提醒用户。";
  return {
    normalizedMemory,
    confirmationText: [
      "已更新长期记忆。",
      "",
      "以后当你让我推荐 Codeforces 题目、比赛或制定训练计划时，",
      "系统会先检查数据新鲜度：新鲜则直接使用，过期则自动刷新；只有自动刷新失败时才提醒你。",
    ].join("\n"),
  };
}

function cleanupGenericMemoryContent(text: string): string {
  return text
    .replace(/^(请|帮我)?(更新一下记忆|更新记忆|记住|请记住|帮我记住)[，,:：\s]*/u, "")
    .replace(/^(把)?/u, "")
    .replace(/(保存为长期记忆|保存到长期记忆|加入长期记忆|写入长期记忆)[。.!！\s]*$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTaskControlIntent(lower: string): boolean {
  return isRetryIntent(lower) || /取消(任务|执行|请求)|停止(任务|执行)|中止/.test(lower);
}

function isRetryIntent(lower: string): boolean {
  return /重试(任务|agent|执行|请求)?|再试一次/.test(lower);
}

function isMemoryReadIntent(lower: string): boolean {
  return /你记得我什么|你还记得什么|查看.*记忆|读取.*记忆|我的.*长期记忆/.test(lower);
}

function isMemoryConceptQuestion(lower: string): boolean {
  return /长期记忆是什么|什么是长期记忆|如何管理记忆|为什么没有更新记忆|记忆是什么/.test(lower);
}

function isConversationManagementIntent(lower: string): boolean {
  return /新建会话|归档会话|删除会话|恢复会话|压缩上下文|压缩会话/.test(lower);
}

function isCodeAnalysisFollowup(lower: string): boolean {
  return /代码分析|报错分析|上次分析|复盘记录|错因/.test(lower);
}

function normalizeText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function limitText(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 3).trimEnd()}...`;
}
