import type { AssistantSource } from "../assistant-types.ts";
import type {
  AssistantCodeforcesProblemResult,
  CodeforcesRecommendInput,
  CodeforcesSearchInput,
} from "../providers/codeforces-read-provider.ts";
import type {
  LearnerTrainingProfile,
  PersonalizedCandidateResult,
  PersonalizedCodeforcesCandidate,
  UpcomingContestResult,
  UpcomingCodeforcesContest,
} from "../providers/codeforces-personalized-provider.ts";
import {
  recommendCodeforcesProblems,
  searchCodeforcesProblems,
} from "../providers/codeforces-read-provider.ts";
import {
  getPersonalizedCodeforcesCandidates,
  getUpcomingCodeforcesContests,
  resolveLearnerTrainingProfile,
} from "../providers/codeforces-personalized-provider.ts";
import type {
  AssistantToolDefinition,
  AssistantToolExecutionContext,
  AssistantToolExecutionResult,
} from "./tool-types.ts";

interface LimitOnlyInput {
  limit?: number;
}

export function createSearchCodeforcesProblemsDefinition(): AssistantToolDefinition<CodeforcesSearchInput, AssistantCodeforcesProblemResult> {
  return {
    name: "search_codeforces_problems",
    description: "按关键词、标签和 Rating 区间搜索 Codeforces 题目。",
    inputSchema: {
      type: "object",
      title: "搜索 Codeforces 题目输入",
      description: "按关键词、Rating 和标签筛选。",
      properties: {
        keyword: { type: "string", description: "用于匹配标题或标签的关键词。" },
        tags: { type: "array", description: "题目标签。", items: { type: "string", description: "单个标签。" } },
        minRating: { type: "number", description: "最低 Rating。" },
        maxRating: { type: "number", description: "最高 Rating。" },
        limit: { type: "number", description: "最多返回数量。" },
      },
      additionalProperties: false,
    },
    outputSchema: codeforcesOutputSchema(),
    timeoutMs: 8_000,
    maxResults: 10,
    maxSummaryChars: 900,
    sourceLabel: "Codeforces 题库读取",
    validateInput: isSearchCodeforcesProblemsInput,
    execute: (input, context) => executeSearchCodeforcesProblems(input, context),
  };
}

export function createResolveLearnerTrainingProfileDefinition(): AssistantToolDefinition<Record<string, never>, LearnerTrainingProfile> {
  return {
    name: "resolveLearnerTrainingProfile",
    description: "从只读学习档案和账号数据解析当前用户的 Codeforces 训练画像。",
    inputSchema: {
      type: "object",
      title: "解析训练画像输入",
      description: "不接受客户端控制字段。",
      properties: {},
      additionalProperties: false,
    },
    outputSchema: trainingProfileOutputSchema(),
    timeoutMs: 8_000,
    maxResults: 1,
    maxSummaryChars: 900,
    sourceLabel: "只读学习上下文",
    validateInput: isEmptyObjectInput,
    execute: (_input, context) => executeResolveLearnerTrainingProfile(context),
  };
}

export function createPersonalizedCodeforcesCandidatesDefinition(): AssistantToolDefinition<LimitOnlyInput, PersonalizedCodeforcesCandidate> {
  return {
    name: "getPersonalizedCodeforcesCandidates",
    description: "从本地精选题池读取个性化 Codeforces 候选题。",
    inputSchema: {
      type: "object",
      title: "个性化候选题输入",
      description: "用户身份由服务端解析，只接受 limit。",
      properties: {
        limit: { type: "number", description: "最多返回数量。" },
      },
      additionalProperties: false,
    },
    outputSchema: personalizedCandidateOutputSchema(),
    timeoutMs: 10_000,
    maxResults: 10,
    maxSummaryChars: 1100,
    sourceLabel: "本地精选 Codeforces 题池",
    validateInput: isLimitOnlyInput,
    execute: (input, context) => executePersonalizedCodeforcesCandidates(input, context),
  };
}

export function createUpcomingCodeforcesContestsDefinition(): AssistantToolDefinition<LimitOnlyInput, UpcomingCodeforcesContest> {
  return {
    name: "getUpcomingCodeforcesContests",
    description: "从官方 contest.list API 读取近期 Codeforces 比赛，支持短期缓存。",
    inputSchema: {
      type: "object",
      title: "近期 Codeforces 比赛输入",
      description: "只接受 limit。",
      properties: {
        limit: { type: "number", description: "最多返回数量。" },
      },
      additionalProperties: false,
    },
    outputSchema: upcomingContestOutputSchema(),
    timeoutMs: 10_000,
    maxResults: 10,
    maxSummaryChars: 1100,
    sourceLabel: "Codeforces 官方比赛列表",
    validateInput: isLimitOnlyInput,
    execute: (input, context) => executeUpcomingCodeforcesContests(input, context),
  };
}

export function createRecommendCodeforcesProblemsDefinition(): AssistantToolDefinition<CodeforcesRecommendInput, AssistantCodeforcesProblemResult> {
  return {
    name: "recommend_codeforces_problems",
    description: "基于学习信号为当前用户推荐 Codeforces 题目。",
    inputSchema: {
      type: "object",
      title: "推荐 Codeforces 题目输入",
      description: "用户身份由服务端解析，只接受 limit。",
      properties: {
        limit: { type: "number", description: "最多返回数量。" },
      },
      additionalProperties: false,
    },
    outputSchema: codeforcesOutputSchema(),
    timeoutMs: 10_000,
    maxResults: 10,
    maxSummaryChars: 900,
    sourceLabel: "Codeforces 题库读取",
    validateInput: isRecommendCodeforcesProblemsInput,
    execute: (input, context) => executeRecommendCodeforcesProblems(input, context),
  };
}

export async function executeSearchCodeforcesProblems(
  input: CodeforcesSearchInput,
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<AssistantCodeforcesProblemResult>> {
  const items = await searchCodeforcesProblems(
    {
      keyword: input.keyword,
      tags: input.tags,
      minRating: input.minRating,
      maxRating: input.maxRating,
      limit: input.limit,
    },
    { customFetch: context.customFetch },
  );

  return {
    name: "search_codeforces_problems",
    ok: items.length > 0,
    summary: summarizeProblems(items, "Codeforces 题目搜索结果"),
    items,
    sources: toAssistantSources(items),
    warnings: items.length > 0 ? [] : ["未找到匹配的 Codeforces 题目"],
    timedOut: false,
    rawResponseStored: false,
    errorCode: items.length > 0 ? undefined : "empty",
    errorMessage: items.length > 0 ? undefined : "未找到符合筛选条件的 Codeforces 题目。",
  };
}

export async function executeRecommendCodeforcesProblems(
  input: CodeforcesRecommendInput,
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<AssistantCodeforcesProblemResult>> {
  const recommendation = await recommendCodeforcesProblems(
    {
      userId: context.userId,
      limit: input.limit,
    },
    { customFetch: context.customFetch },
  );

  return {
    name: "recommend_codeforces_problems",
    ok: recommendation.items.length > 0,
    summary: summarizeRecommendation(
      recommendation.items,
      recommendation.ratingRange,
      recommendation.tagHints,
      recommendation.dataLimited,
    ),
    items: recommendation.items,
    sources: toAssistantSources(recommendation.items),
    warnings: recommendation.warnings,
    timedOut: false,
    rawResponseStored: false,
    errorCode: recommendation.items.length > 0 ? undefined : "empty",
    errorMessage: recommendation.items.length > 0 ? undefined : "No Codeforces recommendations could be produced.",
  };
}

export async function executeResolveLearnerTrainingProfile(
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<LearnerTrainingProfile>> {
  if (!context.userId) {
    return {
      name: "resolveLearnerTrainingProfile",
      ok: false,
      summary: "训练画像需要可信服务端用户会话。",
      items: [],
      sources: [],
      warnings: ["session_required"],
      errorCode: "session_required",
      errorMessage: "当前请求没有可信服务端用户身份。",
      timedOut: false,
      rawResponseStored: false,
    };
  }

  const profile = await resolveLearnerTrainingProfile({ userId: context.userId, signal: context.signal });
  const ok = profile.effectiveTrainingRating !== null;
  return {
    name: "resolveLearnerTrainingProfile",
    ok,
    summary: summarizeTrainingProfile(profile),
    items: [profile],
    sources: trainingProfileSources(profile),
    warnings: profile.rejectedReportReason ? [profile.rejectedReportReason] : [],
    errorCode: ok ? undefined : "insufficient_training_profile",
    errorMessage: ok ? undefined : "当前无法解析 Codeforces 训练画像。",
    timedOut: false,
    rawResponseStored: false,
  };
}

export async function executePersonalizedCodeforcesCandidates(
  input: LimitOnlyInput,
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<PersonalizedCodeforcesCandidate>> {
  if (!context.userId) {
    return {
      name: "getPersonalizedCodeforcesCandidates",
      ok: false,
      summary: "个性化候选题需要可信服务端用户会话。",
      items: [],
      sources: [],
      warnings: ["session_required"],
      errorCode: "session_required",
      errorMessage: "当前请求没有可信服务端用户身份。",
      timedOut: false,
      rawResponseStored: false,
    };
  }

  const result = await getPersonalizedCodeforcesCandidates({
    userId: context.userId,
    limit: input.limit,
    signal: context.signal,
  });

  return {
    name: "getPersonalizedCodeforcesCandidates",
    ok: result.candidates.length > 0,
    summary: summarizePersonalizedCandidates(result),
    items: result.candidates,
    sources: personalizedCandidateSources(result.candidates),
    warnings: result.warnings,
    errorCode: result.candidates.length > 0 ? undefined : "empty",
    errorMessage: result.candidates.length > 0
      ? undefined
      : result.warnings[0] ?? "未找到符合条件且未完成的题目。",
    timedOut: false,
    rawResponseStored: false,
  };
}

export async function executeUpcomingCodeforcesContests(
  input: LimitOnlyInput,
  context: AssistantToolExecutionContext,
): Promise<AssistantToolExecutionResult<UpcomingCodeforcesContest>> {
  const result = await getUpcomingCodeforcesContests({
    limit: input.limit,
    env: context.guardEnv,
    customFetch: context.customFetch,
    signal: context.signal,
  });

  return {
    name: "getUpcomingCodeforcesContests",
    ok: result.contests.length > 0,
    summary: summarizeUpcomingContests(result),
    items: result.contests,
    sources: upcomingContestSources(result.contests),
    warnings: result.warnings,
    errorCode: result.contests.length > 0 ? undefined : result.errorCode ?? "empty",
    errorMessage: result.contests.length > 0 ? undefined : result.errorMessage ?? "未返回未来 Codeforces 比赛。",
    timedOut: false,
    rawResponseStored: false,
  };
}

function isSearchCodeforcesProblemsInput(value: unknown): value is CodeforcesSearchInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.keyword === undefined || typeof record.keyword === "string") &&
    (record.limit === undefined || (typeof record.limit === "number" && Number.isFinite(record.limit))) &&
    (record.minRating === undefined || (typeof record.minRating === "number" && Number.isFinite(record.minRating))) &&
    (record.maxRating === undefined || (typeof record.maxRating === "number" && Number.isFinite(record.maxRating))) &&
    (record.tags === undefined || (Array.isArray(record.tags) && record.tags.every((tag) => typeof tag === "string")))
  );
}

function isRecommendCodeforcesProblemsInput(value: unknown): value is CodeforcesRecommendInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.limit === undefined || (typeof record.limit === "number" && Number.isFinite(record.limit));
}

function isEmptyObjectInput(value: unknown): value is Record<string, never> {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).length === 0;
}

function isLimitOnlyInput(value: unknown): value is LimitOnlyInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.every((key) => key === "limit")
    && (record.limit === undefined || (typeof record.limit === "number" && Number.isFinite(record.limit)));
}

function summarizeProblems(
  items: readonly AssistantCodeforcesProblemResult[],
  prefix: string,
): string {
  if (items.length === 0) {
    return `${prefix}：没有结果。`;
  }

  const lines = [prefix];
  for (const item of items.slice(0, 5)) {
    const rating = typeof item.rating === "number" ? ` | ${item.rating}` : "";
    lines.push(`- ${item.contestId}${item.index} ${item.title}${rating}`);
  }
  return lines.join("\n");
}

function summarizeRecommendation(
  items: readonly AssistantCodeforcesProblemResult[],
  ratingRange: [number, number],
  tagHints: string[],
  dataLimited: boolean,
): string {
  if (items.length === 0) {
    return "Codeforces 推荐结果：当前没有可用题目。";
  }

  const lines = [
    `Codeforces 推荐区间：${ratingRange[0]}-${ratingRange[1]}${dataLimited ? "（学习数据有限）" : ""}`,
  ];
  if (tagHints.length > 0) {
    lines.push(`- 标签线索：${tagHints.slice(0, 6).join(", ")}`);
  }
  for (const item of items.slice(0, 5)) {
    const rating = typeof item.rating === "number" ? ` | ${item.rating}` : "";
    lines.push(`- ${item.contestId}${item.index} ${item.title}${rating}`);
  }
  return lines.join("\n");
}

function toAssistantSources(items: readonly AssistantCodeforcesProblemResult[]): AssistantSource[] {
  return items.map((item) => ({
    title: `${item.contestId}${item.index} ${item.title}`,
    source: item.localProblemId ? "platform problem library" : "Codeforces",
    url: item.localProblemId ? `/problems/${item.localProblemId}` : item.originalUrl,
  }));
}

function summarizeTrainingProfile(profile: LearnerTrainingProfile): string {
  const lines = [
    `训练画像来源：${formatProfileSource(profile.source)}`,
    `依据摘要：${profile.evidenceSummary}`,
  ];
  if (profile.officialRating !== null) {
    lines.push(`官方 Rating：${profile.officialRating}`);
  }
  if (profile.estimatedRealRating !== null) {
    lines.push(`真实水平估计：${profile.estimatedRealRating}`);
  }
  if (profile.effectiveTrainingRating !== null) {
    lines.push(`本次采用训练 Rating：${profile.effectiveTrainingRating}`);
  }
  if (profile.recommendedMinRating !== null && profile.recommendedMaxRating !== null) {
    lines.push(`推荐题目区间：${profile.recommendedMinRating}-${profile.recommendedMaxRating}`);
  }
  if (profile.weakTags.length > 0) {
    lines.push(`薄弱标签：${profile.weakTags.slice(0, 6).join(", ")}`);
  }
  return lines.join("\n");
}

function summarizePersonalizedCandidates(result: PersonalizedCandidateResult): string {
  const lines = [
    `本地候选题来源：${formatCandidateDataSource(result.dataSource)}`,
    `本次采用 Rating：${result.profile.effectiveTrainingRating ?? "暂无"}`,
    `推荐题目区间：${result.profile.recommendedMinRating ?? "暂无"}-${result.profile.recommendedMaxRating ?? "暂无"}`,
    `已完成并排除题数：${result.excludedCompletedCount}`,
  ];
  if (result.candidates.length === 0) {
    lines.push(result.warnings[0] ?? "未找到符合条件且未完成的题目。");
    return lines.join("\n");
  }
  for (const item of result.candidates.slice(0, 5)) {
    lines.push(`- ${item.problemKey} ${item.name}｜Rating ${item.rating}｜层级：${formatCandidateLevel(item.candidateLevel)}｜${item.recommendationReason}`);
  }
  return lines.join("\n");
}

function summarizeUpcomingContests(result: UpcomingContestResult): string {
  const lines = [
    `Codeforces 比赛来源：${formatContestSource(result.source)}`,
    `获取时间：${result.fetchedAt ?? "不可用"}`,
  ];
  if (result.contests.length === 0) {
    lines.push("未返回未来比赛；不会用历史比赛数据替代近期比赛。");
    return lines.join("\n");
  }
  for (const contest of result.contests.slice(0, 5)) {
    lines.push(`- ${contest.name} | ${contest.startTime} | ${contest.relativeStart}`);
  }
  return lines.join("\n");
}

function trainingProfileSources(profile: LearnerTrainingProfile): AssistantSource[] {
  if (profile.source === "learning_report") {
    return [{
      title: "Codeforces 学习分析报告",
      source: "只读学习档案",
      url: "/user",
    }];
  }
  if (profile.source === "derived_estimate" || profile.source === "official_rating") {
    return [{
      title: "Codeforces 账号与练习统计",
      source: "本地用户学习数据",
      url: "/user",
    }];
  }
  return [];
}

function personalizedCandidateSources(items: readonly PersonalizedCodeforcesCandidate[]): AssistantSource[] {
  return items.map((item) => ({
    title: `${item.problemKey} ${item.name}`,
    source: "本地精选 Codeforces 题池",
    url: item.originalUrl,
  }));
}

function upcomingContestSources(items: readonly UpcomingCodeforcesContest[]): AssistantSource[] {
  return items.map((item) => ({
    title: item.name,
    source: item.source === "codeforces_api" ? "Codeforces 官方比赛列表" : formatContestSource(item.source),
    url: item.officialUrl,
  }));
}

function formatProfileSource(source: LearnerTrainingProfile["source"]): string {
  switch (source) {
    case "learning_report":
      return "学习分析报告";
    case "derived_estimate":
      return "练习数据估计";
    case "official_rating":
      return "官方 Rating";
    case "insufficient_data":
      return "资料不足";
  }
}

function formatCandidateDataSource(source: PersonalizedCandidateResult["dataSource"]): string {
  return source === "local_curated_codeforces_pool"
    ? "本地精选 Codeforces 题池"
    : "未知题池";
}

function formatCandidateLevel(level: PersonalizedCodeforcesCandidate["candidateLevel"]): string {
  switch (level) {
    case "target_range_weak_tag":
      return "目标区间且命中薄弱标签";
    case "target_range_any_tag":
      return "目标区间补足";
    case "expanded_range":
      return "放宽 Rating 区间";
    case "nearest_rating":
      return "最接近目标 Rating";
  }
}

function formatContestSource(source: UpcomingContestResult["source"] | UpcomingCodeforcesContest["source"]): string {
  switch (source) {
    case "codeforces_api":
      return "Codeforces 官方实时接口";
    case "fresh_cache":
      return "短期缓存";
    case "stale_cache":
      return "过期缓存";
    case "unavailable":
      return "不可用";
  }
}

function codeforcesOutputSchema() {
  return {
    type: "object" as const,
    title: "Codeforces 题目条目",
    description: "安全的 Codeforces 题目预览结果。",
    properties: {
      contestId: { type: "number" as const, description: "比赛编号。" },
      index: { type: "string" as const, description: "题目编号。" },
      title: { type: "string" as const, description: "题目标题。" },
      rating: { type: "number" as const, description: "Rating." },
      tags: { type: "array" as const, description: "题目标签。", items: { type: "string" as const, description: "单个标签。" } },
      originalUrl: { type: "string" as const, description: "Codeforces 原题 URL。" },
      localProblemId: { type: "string" as const, description: "可选的本地题目路由 ID。" },
    },
    additionalProperties: false as const,
  };
}

function trainingProfileOutputSchema() {
  return {
    type: "object" as const,
    title: "用户训练画像",
    description: "服务端解析出的只读 Codeforces 训练画像。",
    properties: {
      officialRating: { type: "number" as const, description: "Codeforces 官方 Rating。" },
      estimatedRealRating: { type: "number" as const, description: "真实水平估计。" },
      effectiveTrainingRating: { type: "number" as const, description: "本次采用训练 Rating。" },
      recommendedMinRating: { type: "number" as const, description: "推荐最低题目 Rating。" },
      recommendedMaxRating: { type: "number" as const, description: "推荐最高题目 Rating。" },
      source: { type: "string" as const, description: "画像来源。" },
      evidenceSummary: { type: "string" as const, description: "依据摘要。" },
    },
    additionalProperties: false as const,
  };
}

function personalizedCandidateOutputSchema() {
  return {
    type: "object" as const,
    title: "个性化 Codeforces 候选题",
    description: "来自本地精选题池的一道只读候选题。",
    properties: {
      problemId: { type: "string" as const, description: "本地题目 ID。" },
      problemKey: { type: "string" as const, description: "Codeforces 题目键。" },
      contestId: { type: "number" as const, description: "比赛编号。" },
      index: { type: "string" as const, description: "题目编号。" },
      name: { type: "string" as const, description: "题目名称。" },
      rating: { type: "number" as const, description: "题目 Rating。" },
      tags: { type: "array" as const, description: "题目标签。", items: { type: "string" as const, description: "单个标签。" } },
      originalUrl: { type: "string" as const, description: "Codeforces 原题 URL。" },
      recommendationReason: { type: "string" as const, description: "有依据的推荐理由。" },
      candidateLevel: { type: "string" as const, description: "候选题放宽层级。" },
    },
    additionalProperties: false as const,
  };
}

function upcomingContestOutputSchema() {
  return {
    type: "object" as const,
    title: "近期 Codeforces 比赛",
    description: "来自官方 contest.list 或缓存的一场未来比赛。",
    properties: {
      contestId: { type: "number" as const, description: "比赛编号。" },
      name: { type: "string" as const, description: "比赛名称。" },
      phase: { type: "string" as const, description: "比赛阶段。" },
      startTime: { type: "string" as const, description: "格式化开始时间。" },
      relativeStart: { type: "string" as const, description: "相对开始时间。" },
      officialUrl: { type: "string" as const, description: "Codeforces 官方比赛 URL。" },
      source: { type: "string" as const, description: "数据来源。" },
    },
    additionalProperties: false as const,
  };
}
