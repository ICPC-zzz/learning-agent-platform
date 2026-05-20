export interface DetectedChapterHeading {
  title: string;
  level: number;
  rawLine: string;
}

const MAX_HEADING_CHARS = 120;
const CHINESE_NUMERAL_CHARS =
  "\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e24\u96f6\u3007";

const englishChapterPattern =
  /^chapter\s+\d+[a-z]?(?:\s*[:\-\u2013\u2014]\s*\S.+)?$/i;
const dottedNumberPattern = /^\d{1,3}\.\s+\S.+$/;
const spacedNumberPattern = /^\d{1,3}\s+[A-Za-z][\w\s,'"():/\-\u2013\u2014]+$/;
const chineseChapterPattern = new RegExp(
  `^\\u7b2c\\s*(?:\\d+|[${CHINESE_NUMERAL_CHARS}]+)\\s*[\\u7ae0\\u8282\\u7bc7\\u56de](?:\\s*[:\\uFF1A\\u3001\\-]\\s*\\S.+|\\s+\\S.+)?$`,
  "u",
);
const chineseEnumerationPattern = new RegExp(
  `^(?:[${CHINESE_NUMERAL_CHARS}]+|\\d{1,3})[\\u3001.\\uFF0E]\\s*\\S.+$`,
  "u",
);

export function detectChapterHeading(line: string): DetectedChapterHeading | undefined {
  const rawLine = line.trim();

  if (!isHeadingCandidate(rawLine)) {
    return undefined;
  }

  const normalizedLine = rawLine.replace(/[ \t]+/g, " ");
  const matchesHeading =
    englishChapterPattern.test(normalizedLine) ||
    dottedNumberPattern.test(normalizedLine) ||
    spacedNumberPattern.test(normalizedLine) ||
    chineseChapterPattern.test(normalizedLine) ||
    chineseEnumerationPattern.test(normalizedLine);

  if (!matchesHeading) {
    return undefined;
  }

  return {
    title: normalizedLine,
    level: 1,
    rawLine,
  };
}

export function isLikelyChapterHeading(line: string): boolean {
  return detectChapterHeading(line) !== undefined;
}

function isHeadingCandidate(line: string): boolean {
  return line.length > 0 && line.length <= MAX_HEADING_CHARS;
}
