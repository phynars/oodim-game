export const MIN_AGENT_REVIEW_BODY_LENGTH = 10;
export const MAX_REQUEST_CHANGES_PER_REVIEWER = 3;

export type AgentReviewVerdict = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export type ReviewGuardrailResult =
  | { ok: true }
  | { ok: false; reason: string; parkForHuman: boolean };

/**
 * Validates agent-authored review submissions before a verdict is persisted.
 * Callers must apply the returned `parkForHuman` signal by labeling the PR
 * `agent-needs-human`; this module deliberately does not handle human reviews.
 */
export function validateAgentReviewSubmission({
  body,
  verdict,
  priorRequestChangesByReviewer,
}: {
  body: string;
  verdict: AgentReviewVerdict;
  priorRequestChangesByReviewer: number;
}): ReviewGuardrailResult {
  if (body.trim().length < MIN_AGENT_REVIEW_BODY_LENGTH) {
    return {
      ok: false,
      reason: `Agent review bodies must contain at least ${MIN_AGENT_REVIEW_BODY_LENGTH} non-whitespace characters.`,
      parkForHuman: false,
    };
  }

  if (
    verdict === "REQUEST_CHANGES" &&
    priorRequestChangesByReviewer >= MAX_REQUEST_CHANGES_PER_REVIEWER
  ) {
    return {
      ok: false,
      reason: `An agent reviewer may submit at most ${MAX_REQUEST_CHANGES_PER_REVIEWER} REQUEST_CHANGES verdicts on one PR; park this PR with agent-needs-human.`,
      parkForHuman: true,
    };
  }

  return { ok: true };
}
