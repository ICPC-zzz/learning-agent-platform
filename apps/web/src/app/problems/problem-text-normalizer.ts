type ProblemTextMode = "prose" | "code";

const TEX_WRAPPERS = [
  "boxed",
  "emph",
  "mathbb",
  "mathrm",
  "mathbf",
  "mathit",
  "mathtt",
  "operatorname",
  "text",
  "underline",
  "overline",
] as const;

export function normalizeProblemProseText(
  value: string | null | undefined,
): string | null {
  return normalizeProblemText(value, "prose");
}

export function normalizeProblemCodeText(
  value: string | null | undefined,
): string | null {
  return normalizeProblemText(value, "code");
}

function normalizeProblemText(
  value: string | null | undefined,
  mode: ProblemTextMode,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  let normalized = normalizeLineEndings(value);
  normalized = decodeHtmlEntities(normalized);
  normalized = normalizeMarkdownFences(normalized, mode);
  normalized = normalizeMarkdownLines(normalized, mode);

  if (mode === "prose") {
    normalized = simplifyLatexMarkup(normalized);
    normalized = normalizeProseSpacing(normalized);
    normalized = normalized.replace(/\n{3,}/g, "\n\n").trim();
  } else {
    normalized = normalized.replace(/[ \t]+$/gm, "");
    normalized = trimOuterBlankLines(normalized);
  }

  return normalized.length > 0 ? normalized : null;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const parsed = Number.parseInt(hex, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    });
}

function normalizeMarkdownFences(text: string, mode: ProblemTextMode): string {
  const lines = normalizeLineEndings(text).split("\n");
  const result: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      continue;
    }

    if (mode === "prose" && line.startsWith("~~~")) {
      continue;
    }

    result.push(rawLine);
  }

  return result.join("\n");
}

function normalizeMarkdownLines(text: string, mode: ProblemTextMode): string {
  const lines = normalizeLineEndings(text).split("\n");
  const result: string[] = [];

  for (const rawLine of lines) {
    let line = rawLine.replace(/[ \t]+$/g, "");

    if (mode === "prose") {
      line = line
        .replace(/^\s{0,3}#{1,6}\s+/u, "")
        .replace(/^\s{0,3}>\s?/u, "")
        .replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/u, "");
    }

    result.push(mode === "prose" ? line.trim() : line);
  }

  return result.join("\n");
}

function simplifyLatexMarkup(text: string): string {
  let normalized = text;

  for (let pass = 0; pass < 4; pass += 1) {
    const next = normalized
      .replace(/\$\$([\s\S]+?)\$\$/g, "$1")
      .replace(/\$([^$\n]+?)\$/g, "$1")
      .replace(/\\left\b/g, "")
      .replace(/\\right\b/g, "")
      .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
      .replace(/\\text\{([^{}]+)\}/g, "$1")
      .replace(/\\mathrm\{([^{}]+)\}/g, "$1")
      .replace(/\\mathbf\{([^{}]+)\}/g, "$1")
      .replace(/\\mathit\{([^{}]+)\}/g, "$1")
      .replace(/\\mathtt\{([^{}]+)\}/g, "$1")
      .replace(/\\operatorname\{([^{}]+)\}/g, "$1")
      .replace(/\\boxed\{([^{}]+)\}/g, "$1")
      .replace(/\\underline\{([^{}]+)\}/g, "$1")
      .replace(/\\overline\{([^{}]+)\}/g, "$1")
      .replace(/\\leq\b/g, "<=")
      .replace(/\\geq\b/g, ">=")
      .replace(/\\le\b/g, "<=")
      .replace(/\\ge\b/g, ">=")
      .replace(/\\neq\b/g, "!=")
      .replace(/\\times\b/g, "*")
      .replace(/\\cdot\b/g, "*")
      .replace(/\\pm\b/g, "±")
      .replace(/\\ldots\b/g, "...")
      .replace(/\\dots\b/g, "...")
      .replace(/\\%/g, "%")
      .replace(/\\_/g, "_")
      .replace(/\\#/g, "#")
      .replace(/\\&/g, "&")
      .replace(/\\{/g, "{")
      .replace(/\\}/g, "}")
      .replace(/\\,/g, " ")
      .replace(/\\;/g, " ")
      .replace(/\\:/g, " ")
      .replace(/\\!/g, "")
      .replace(/\\ /g, " ");

    if (next === normalized) {
      break;
    }

    normalized = next;
  }

  return normalized;
}

function normalizeProseSpacing(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]*([，。！？；：、])[ \t]*/g, "$1");
}

function trimOuterBlankLines(text: string): string {
  return text
    .replace(/^(?:[ \t]*\n)+/g, "")
    .replace(/(?:\n[ \t]*)+$/g, "");
}
