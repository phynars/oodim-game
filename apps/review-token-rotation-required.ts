export const REVIEW_TOKEN_ROTATION_REQUIRED = true;

export function getReviewTokenRotationMessage(): string {
  return "Rotate and redeploy the GitHub review token with Actions:Read scope; this cannot be fixed in repository code.";
}
