export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function trimExcessWhitespace(text: string): string {
  const normalized = normalizeLineEndings(text)
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();

  return normalized.replace(/\n{3,}/g, "\n\n");
}

export function normalizePlainText(text: string): string {
  return trimExcessWhitespace(normalizeLineEndings(text));
}
