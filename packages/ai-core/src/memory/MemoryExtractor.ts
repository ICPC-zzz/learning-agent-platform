import type { MemoryExtractionCandidate, WorkingMemoryMessage } from "./types.ts";
import { normalizeMemoryText } from "./utils.ts";

const MAX_CANDIDATES = 5;

const EXTRACTION_RULES: Array<{
  kind: MemoryExtractionCandidate["kind"];
  patterns: RegExp[];
  confidence: number;
}> = [
  {
    kind: "preference",
    patterns: [/\b(prefer|like|love|favorite)\b/i, /我.*喜欢/, /我.*偏好/, /我.*更喜欢/, /我.*习惯/],
    confidence: 0.9,
  },
  {
    kind: "goal",
    patterns: [/\b(goal|plan|want to|need to)\b/i, /我.*目标/, /我.*想要/, /我.*计划/, /我.*打算/, /我.*希望/],
    confidence: 0.86,
  },
  {
    kind: "learning",
    patterns: [/\b(learn|study|practice|review)\b/i, /我.*学习/, /我.*练习/, /我.*刷题/, /我.*复习/, /我.*掌握/],
    confidence: 0.82,
  },
  {
    kind: "project",
    patterns: [/\b(project|workspace|repo|repository)\b/i, /我.*项目/, /我的.*项目/, /我.*工程/, /我.*代码库/, /我.*仓库/],
    confidence: 0.78,
  },
  {
    kind: "reference",
    patterns: [/\b(reference|link|doc|documentation)\b/i, /我.*参考/, /我的.*链接/, /我.*文档/, /我.*资料/],
    confidence: 0.72,
  },
];

export function extractMemoryCandidates(
  messages: readonly WorkingMemoryMessage[],
  options: {
    limit?: number;
  } = {},
): MemoryExtractionCandidate[] {
  const limit = normalizeLimit(options.limit);
  const candidates: MemoryExtractionCandidate[] = [];

  for (const message of messages.slice().reverse()) {
    if (message.role !== "user") {
      continue;
    }

    const text = normalizeText(message.content);
    if (text.length === 0) {
      continue;
    }

    for (const rule of EXTRACTION_RULES) {
      if (!rule.patterns.some((pattern) => pattern.test(text))) {
        continue;
      }

      const excerpt = extractExcerpt(text);
      candidates.push({
        kind: rule.kind,
        content: excerpt,
        confidence: rule.confidence,
        sourceMessageIds: [message.id],
        sourceExcerpt: excerpt,
      });
      break;
    }

    if (candidates.length >= limit) {
      break;
    }
  }

  return dedupeCandidates(candidates).slice(0, limit);
}

export function isForgetRequest(text: string): boolean {
  const normalized = normalizeText(text);
  return normalized.includes("忘记")
    || normalized.includes("不要记住")
    || normalized.includes("别记住")
    || normalized.includes("forget");
}

function dedupeCandidates(
  candidates: readonly MemoryExtractionCandidate[],
): MemoryExtractionCandidate[] {
  const seen = new Set<string>();
  const deduped: MemoryExtractionCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.kind}|${normalizeMemoryText(candidate.content)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

function extractExcerpt(text: string): string {
  const sentence = text
    .split(/[。！？!?;\n]/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  const normalized = sentence ?? text;
  return normalized.slice(0, 240);
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return MAX_CANDIDATES;
  }

  return Math.max(1, Math.trunc(limit));
}

function normalizeText(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
