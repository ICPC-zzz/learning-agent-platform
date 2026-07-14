const TAG_LABELS: Record<string, string> = {
  dp: "动态规划（dp）",
  greedy: "贪心（greedy）",
  math: "数学（math）",
  graphs: "图论（graphs）",
  trees: "树（trees）",
  strings: "字符串（strings）",
  sorting: "排序（sorting）",
  binary_search: "二分查找（binary search）",
  data_structures: "数据结构（data structures）",
  shortest_paths: "最短路（shortest paths）",
  constructive_algorithms: "构造算法（constructive algorithms）",
  implementation: "实现（implementation）",
  brute_force: "暴力枚举（brute force）",
  combinatorics: "组合数学（combinatorics）",
  number_theory: "数论（number theory）",
  bitmasks: "位运算（bitmasks）",
  two_pointers: "双指针（two pointers）",
  prefix_sums: "前缀和（prefix sums）",
};

const TEXT_LABELS: Record<string, string> = {
  "Rule estimate from constraints, tags, and common Codeforces difficulty distribution.":
    "根据约束、标签和常见 Codeforces 难度分布进行规则估算。",
  "This fallback is used when the model profiler is slow or unavailable.":
    "模型画像响应较慢或不可用时使用此备用估算。",
  "Problem rating is rule-estimated. It is suitable for recommendation bands; enter a rating manually for exact matching.":
    "题目 Rating 为规则估算值，适合用于推荐难度区间；如需精确匹配，请手动填写 Rating。",
  "multiple test cases": "多组测试数据",
  "User-provided rating.": "用户填写的 Rating。",
  "User-provided tag.": "用户填写的标签。",
  "Keyword-based tag estimate.": "根据题面关键词估算的标签。",
  "Model-inferred tag.": "模型推断的标签。",
};

/** Formats canonical Codeforces tags for Chinese UI display without changing matching keys. */
export function formatProblemProfileTag(tag: string): string {
  const normalized = tag.trim().toLowerCase();
  return TAG_LABELS[normalized] ?? tag;
}

/** Translates known profiler/fallback phrases while preserving technical expressions and proper nouns. */
export function formatProblemProfileText(text: string): string {
  return TEXT_LABELS[text.trim()] ?? text;
}
