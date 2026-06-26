export interface ProblemSourceOption {
  value: string;
  label: string;
}

export const PROBLEM_SOURCE_OPTIONS: ProblemSourceOption[] = [
  { value: "codeforces", label: "Codeforces" },
  { value: "leetcode", label: "LeetCode" },
  { value: "nowcoder", label: "牛客" },
  { value: "atcoder", label: "AtCoder" },
  { value: "lanqiao", label: "蓝桥杯" },
  { value: "pta", label: "PTA" },
  { value: "luogu", label: "洛谷" },
  { value: "acwing", label: "AcWing" },
  { value: "hdu", label: "HDU" },
  { value: "poj", label: "POJ" },
  { value: "uva", label: "UVA" },
  { value: "kattis", label: "Kattis" },
  { value: "other", label: "其他平台" },
];

const SOURCE_LABELS: Record<string, string> = {
  codeforces: "Codeforces",
  leetcode: "LeetCode",
  nowcoder: "牛客",
  atcoder: "AtCoder",
  lanqiao: "蓝桥杯",
  pta: "PTA",
  luogu: "洛谷",
  acwing: "AcWing",
  hdu: "HDU",
  poj: "POJ",
  uva: "UVA",
  kattis: "Kattis",
  vjudge: "VJudge",
  hustoj: "HUSTOJ",
  other: "其他平台",
};

const SOURCE_ALIASES: Array<{ key: string; aliases: string[] }> = [
  { key: "codeforces", aliases: ["codeforces"] },
  { key: "leetcode", aliases: ["leetcode", "力扣"] },
  { key: "nowcoder", aliases: ["nowcoder", "niuke", "牛客", "牛客网"] },
  { key: "atcoder", aliases: ["atcoder"] },
  { key: "lanqiao", aliases: ["lanqiao", "蓝桥杯", "蓝桥"] },
  { key: "pta", aliases: ["pta", "pintia"] },
  { key: "luogu", aliases: ["luogu", "洛谷"] },
  { key: "acwing", aliases: ["acwing"] },
  { key: "hdu", aliases: ["hdu", "杭电"] },
  { key: "poj", aliases: ["poj"] },
  { key: "uva", aliases: ["uva"] },
  { key: "kattis", aliases: ["kattis"] },
  { key: "vjudge", aliases: ["vjudge"] },
  { key: "hustoj", aliases: ["hustoj"] },
  { key: "other", aliases: ["other", "其他平台", "其他"] },
];

const HOST_TO_SOURCE_KEY: Array<[string, string]> = [
  ["codeforces.com", "codeforces"],
  ["leetcode.com", "leetcode"],
  ["leetcode.cn", "leetcode"],
  ["nowcoder.com", "nowcoder"],
  ["ac.nowcoder.com", "nowcoder"],
  ["atcoder.jp", "atcoder"],
  ["lanqiao.cn", "lanqiao"],
  ["lanqiaocup.com", "lanqiao"],
  ["pintia.cn", "pta"],
  ["pta.edu.cn", "pta"],
  ["luogu.com.cn", "luogu"],
  ["acwing.com", "acwing"],
  ["vjudge.net", "vjudge"],
  ["acm.hdu.edu.cn", "hdu"],
  ["poj.org", "poj"],
  ["uva.onlinejudge.org", "uva"],
  ["onlinejudge.org", "uva"],
  ["open.kattis.com", "kattis"],
];

export function normalizeProblemSourceKey(
  source: string | null | undefined,
  sourceUrl?: string | null,
): string | null {
  const fromText = normalizeSourceKeyFromText(source);
  if (fromText) {
    return fromText;
  }

  const fromUrl = normalizeSourceKeyFromUrl(sourceUrl);
  if (fromUrl) {
    return fromUrl;
  }

  return null;
}

export function formatProblemSourceLabel(
  source: string | null | undefined,
  sourceUrl?: string | null,
): string {
  const key = normalizeProblemSourceKey(source, sourceUrl);
  if (key && SOURCE_LABELS[key]) {
    return SOURCE_LABELS[key];
  }

  const normalizedText = normalizeText(source);
  if (normalizedText) {
    const fallback = normalizeSourceKeyFromText(normalizedText);
    if (fallback && SOURCE_LABELS[fallback]) {
      return SOURCE_LABELS[fallback];
    }
    return normalizedText;
  }

  if (sourceUrl) {
    try {
      const host = new URL(sourceUrl).hostname.replace(/^www\./i, "");
      if (host) {
        return host;
      }
    } catch {
      // Ignore invalid URLs and fall back below.
    }
  }

  return "其他平台";
}

function normalizeSourceKeyFromUrl(sourceUrl: string | null | undefined): string | null {
  const normalized = normalizeText(sourceUrl);
  if (!normalized) {
    return null;
  }

  try {
    const host = new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
    for (const [needle, key] of HOST_TO_SOURCE_KEY) {
      if (host === needle || host.endsWith(`.${needle}`) || host.includes(needle)) {
        return key;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeSourceKeyFromText(source: string | null | undefined): string | null {
  const normalized = normalizeText(source);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  for (const entry of SOURCE_ALIASES) {
    for (const alias of entry.aliases) {
      const normalizedAlias = alias.toLowerCase();
      if (
        lower === normalizedAlias ||
        lower.includes(normalizedAlias) ||
        normalized.includes(alias)
      ) {
        return entry.key;
      }
    }
  }

  const simplified = lower.replace(/^external[-_ ]?dev[:/\\-]*/i, "");
  if (simplified !== lower) {
    const retry = normalizeSourceKeyFromText(simplified);
    if (retry) {
      return retry;
    }
  }

  return null;
}

function normalizeText(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}
