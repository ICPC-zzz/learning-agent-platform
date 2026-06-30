export interface ProblemImportEligibilityInput {
  title: string;
  summary?: string | null;
  statement?: string | null;
  inputDescription?: string | null;
  outputDescription?: string | null;
  examples?: readonly { input?: string | null; output?: string | null }[] | null;
  constraints?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  tags?: readonly string[] | null;
}

export interface ProblemImportEligibilityResult {
  canImport: boolean;
  isInteractive: boolean;
  hasStatement: boolean;
  hasInputDescription: boolean;
  hasOutputDescription: boolean;
  hasExamples: boolean;
  blockedReason: string | null;
  missingRequirements: string[];
}

const INTERACTIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /\binteractive\b/i,
  /\binteractor\b/i,
  /\binteraction\b/i,
  /交互题/,
  /交互/,
];

export function evaluateProblemImportEligibility(
  input: ProblemImportEligibilityInput,
): ProblemImportEligibilityResult {
  const title = normalizeText(input.title);
  const summary = normalizeText(input.summary);
  const statement = normalizeText(input.statement);
  const inputDescription = normalizeText(input.inputDescription);
  const outputDescription = normalizeText(input.outputDescription);
  const constraints = normalizeText(input.constraints);
  const source = normalizeText(input.source);
  const sourceUrl = normalizeText(input.sourceUrl);
  const tags = Array.isArray(input.tags)
    ? input.tags.map((tag) => normalizeText(tag)).filter((tag): tag is string => tag.length > 0)
    : [];

  const examples = Array.isArray(input.examples)
    ? input.examples.filter((example) => {
        const exampleInput = normalizeText(example?.input);
        const exampleOutput = normalizeText(example?.output);
        return exampleInput.length > 0 && exampleOutput.length > 0;
      })
    : [];

  const hasStatement = statement.length > 0;
  const hasInputDescription = inputDescription.length > 0;
  const hasOutputDescription = outputDescription.length > 0;
  const hasExamples = examples.length > 0;
  const isInteractive = matchesInteractiveSignals([
    title,
    summary,
    statement,
    inputDescription,
    outputDescription,
    constraints,
    source,
    sourceUrl,
    tags.join(" "),
  ]);

  const missingRequirements: string[] = [];
  if (title.length === 0) {
    missingRequirements.push("题目标题");
  }
  if (sourceUrl.length === 0) {
    missingRequirements.push("来源链接");
  }
  if (!hasStatement) {
    missingRequirements.push("完整题面");
  }
  if (!hasInputDescription) {
    missingRequirements.push("输入说明");
  }
  if (!hasOutputDescription) {
    missingRequirements.push("输出说明");
  }
  if (!hasExamples) {
    missingRequirements.push("样例");
  }
  if (isInteractive) {
    missingRequirements.push("非交互题");
  }

  const blockedReason =
    missingRequirements.length > 0
      ? `仅支持非交互题且必须具备完整题面、输入说明、输出说明和样例。当前缺少：${missingRequirements.join("、")}`
      : null;

  return {
    canImport: missingRequirements.length === 0,
    isInteractive,
    hasStatement,
    hasInputDescription,
    hasOutputDescription,
    hasExamples,
    blockedReason,
    missingRequirements,
  };
}

function normalizeText(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function matchesInteractiveSignals(values: readonly string[]): boolean {
  return values.some((value) =>
    INTERACTIVE_PATTERNS.some((pattern) => pattern.test(value)),
  );
}
