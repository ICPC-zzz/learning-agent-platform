export interface JudgeOutputComparisonResult {
  accepted: boolean;
  normalizedExpectedOutput: string;
  normalizedActualOutput: string;
}

export function normalizeJudgeOutput(output: string): string {
  return output
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n+$/g, "");
}

export function compareJudgeOutput(
  expectedOutput: string,
  actualOutput: string,
): JudgeOutputComparisonResult {
  const normalizedExpectedOutput = normalizeJudgeOutput(expectedOutput);
  const normalizedActualOutput = normalizeJudgeOutput(actualOutput);

  return {
    accepted: normalizedExpectedOutput === normalizedActualOutput,
    normalizedExpectedOutput,
    normalizedActualOutput,
  };
}

export function previewJudgeText(value: string, maxChars = 240): string {
  const text = value.replace(/\r\n?/g, "\n");

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}...`;
}
