export function buildIssueClosingInstruction(issueNumber: number): string {
  return `End your reply with \`Closes #${issueNumber}\` (the PR body inherits your reply, so GitHub closes the issue when the PR merges).`;
}
