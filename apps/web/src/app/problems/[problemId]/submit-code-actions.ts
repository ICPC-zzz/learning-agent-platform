"use server";

import type {
  JudgeSubmissionRequest,
  JudgeSubmissionResult,
} from "../../../lib/judge/judge-types";
import { judgeProblemCodeSubmission } from "../../../lib/judge/judge-submission";

export type ProblemCodeSubmissionActionInput = JudgeSubmissionRequest;
export type ProblemCodeSubmissionActionResult = JudgeSubmissionResult;

export async function submitProblemCodeAction(
  input: ProblemCodeSubmissionActionInput,
): Promise<ProblemCodeSubmissionActionResult> {
  return judgeProblemCodeSubmission(input);
}
