const DEFAULT_HUSTOJ_BASE_URL = "http://tk.hustoj.com";

export function buildHustojListUrl(baseUrl, search, page) {
  const url = new URL("problemset.php", normalizeBaseUrl(baseUrl));
  const normalizedSearch = normalizeText(search);

  if (normalizedSearch) {
    url.searchParams.set("search", normalizedSearch);
  }

  if (Number.isFinite(page) && Number(page) > 1) {
    url.searchParams.set("page", String(Math.trunc(Number(page))));
  } else {
    url.searchParams.set("page", "1");
  }

  return url.toString();
}

export function buildHustojProblemUrl(baseUrl, problemId) {
  const url = new URL("problem.php", normalizeBaseUrl(baseUrl));
  url.searchParams.set("id", String(problemId));
  return url.toString();
}

export function parseHustojProblemListPage(html) {
  const results = [];
  const seen = new Set();
  const anchorPattern =
    /<a\b[^>]*href=['"]problem\.php\?id=(\d+)['"][^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = anchorPattern.exec(html))) {
    const problemId = normalizeText(match[1]);
    const title = htmlFragmentToText(match[2]);
    if (!problemId || !title) {
      continue;
    }

    if (seen.has(problemId)) {
      continue;
    }

    seen.add(problemId);
    results.push({ problemId, title });
  }

  return results;
}

export function parseHustojProblemPage(html, fallbackTitle) {
  const title =
    normalizeText(fallbackTitle) ??
    extractProblemPageTitle(html) ??
    "HUSTOJ Problem";

  const descriptionHtml = extractDivInnerHtmlByAttribute(html, "id", "description");
  const inputHtml = extractDivInnerHtmlByAttribute(html, "id", "input");
  const outputHtml = extractDivInnerHtmlByAttribute(html, "id", "output");
  const hintHtml = extractDivInnerHtmlByAttribute(html, "id", "hint");
  const sourceHtml = extractDivInnerHtmlByAttribute(html, "fd", "source");
  const sampleInputHtml = extractCodeInnerHtmlById(html, "sinput");
  const sampleOutputHtml = extractCodeInnerHtmlById(html, "soutput");

  const statement = htmlFragmentToText(descriptionHtml);
  const inputDescription = htmlFragmentToText(inputHtml);
  const outputDescription = htmlFragmentToText(outputHtml);
  const hint = htmlFragmentToText(hintHtml);
  const sampleInput = htmlFragmentToText(sampleInputHtml, { preserveLineBreaks: true });
  const sampleOutput = htmlFragmentToText(sampleOutputHtml, { preserveLineBreaks: true });
  const sourceLabels = parseHustojSourceLabels(sourceHtml);
  const examples =
    sampleInput && sampleOutput
      ? [
          {
            input: sampleInput,
            output: sampleOutput,
          },
        ]
      : [];

  return {
    title,
    statement,
    inputDescription,
    outputDescription,
    hint,
    sampleInput,
    sampleOutput,
    examples,
    sourceLabels,
  };
}

export function htmlFragmentToText(html, options = {}) {
  if (typeof html !== "string") {
    return null;
  }

  const preserveLineBreaks = options.preserveLineBreaks === true;
  let text = html;

  text = text.replace(/\r\n?/g, "\n");
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  if (!preserveLineBreaks) {
    text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
    text = text.replace(/<\/\s*(p|div|li|tr|h[1-6]|pre|ul|ol)\s*>/gi, "\n");
    text = text.replace(/<\s*(p|div|li|tr|h[1-6]|pre|ul|ol)\b[^>]*>/gi, "");
    text = text.replace(/<\/\s*(table|thead|tbody|tfoot|section|article|header|footer)\s*>/gi, "\n");
    text = text.replace(/<\s*(table|thead|tbody|tfoot|section|article|header|footer)\b[^>]*>/gi, "");
  }

  text = text.replace(/<[^>]+>/g, "");
  text = decodeHtmlEntities(text);
  text = text.replace(/\u00a0/g, " ");

  if (preserveLineBreaks) {
    text = text.replace(/\r\n?/g, "\n");
    text = text.replace(/\n{3,}/g, "\n\n");
  } else {
    text = text.replace(/[ \t]+\n/g, "\n");
    text = text.replace(/[ \t]{2,}/g, " ");
    text = text.replace(/\n{3,}/g, "\n\n");
  }

  text = text.trim();
  return text.length > 0 ? text : null;
}

export function parseHustojSourceLabels(html) {
  const text = htmlFragmentToText(html);
  if (!text) {
    return [];
  }

  const labels = [];
  const seen = new Set();
  const anchorPattern = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html))) {
    const label = htmlFragmentToText(match[1]);
    if (!label) {
      continue;
    }

    if (/^https?:\/\//i.test(label)) {
      continue;
    }

    const normalized = label.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    labels.push(label);
  }

  return labels;
}

function extractProblemPageTitle(html) {
  const headingPattern =
    /<h1\b[^>]*class=['"][^'"]*\bui header\b[^'"]*['"][^>]*>([\s\S]*?)<\/h1>/i;
  const headingMatch = headingPattern.exec(html);
  const rawHeading = headingMatch ? htmlFragmentToText(headingMatch[1]) : null;
  if (!rawHeading) {
    return null;
  }

  return rawHeading.replace(/^[A-Za-z]?\d+\s*[：:]\s*/, "").trim() || rawHeading;
}

function extractCodeInnerHtmlById(html, codeId) {
  const pattern = new RegExp(
    `<code\\b[^>]*\\bid=['"]${escapeRegExp(codeId)}['"][^>]*>([\\s\\S]*?)<\\/code>`,
    "i",
  );
  const match = pattern.exec(html);
  return match ? match[1] : null;
}

function extractDivInnerHtmlByAttribute(html, attributeName, attributeValue) {
  const pattern = new RegExp(
    `<div\\b(?=[^>]*\\b${escapeRegExp(attributeName)}=['"]${escapeRegExp(attributeValue)}['"])[^>]*>`,
    "i",
  );
  const openMatch = pattern.exec(html);
  if (!openMatch) {
    return null;
  }

  const contentStart = openMatch.index + openMatch[0].length;
  const closePattern = /<!--[\s\S]*?-->|<div\b[^>]*>|<\/div\s*>/gi;
  closePattern.lastIndex = contentStart;

  let depth = 1;
  let tokenMatch;
  while ((tokenMatch = closePattern.exec(html))) {
    const token = tokenMatch[0];
    if (token.startsWith("<!--")) {
      continue;
    }

    if (/^<div\b/i.test(token)) {
      depth += 1;
    } else {
      depth -= 1;
    }

    if (depth === 0) {
      return html.slice(contentStart, tokenMatch.index);
    }
  }

  return html.slice(contentStart);
}

function decodeHtmlEntities(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "";
  }

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const parsed = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : `&${entity};`;
    }

    if (entity.startsWith("#")) {
      const parsed = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : `&${entity};`;
    }

    const named = HTML_ENTITIES[entity.toLowerCase()];
    return named ?? `&${entity};`;
  });
}

function normalizeBaseUrl(baseUrl) {
  const normalized = normalizeText(baseUrl) ?? DEFAULT_HUSTOJ_BASE_URL;
  return normalized.endsWith("/") ? normalized : `${normalized}/`;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HTML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};
