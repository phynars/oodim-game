// Backlog implementation prompt construction.
// Implementing agents must use a GitHub closing keyword for completed work.
export function buildBacklogImplementCloseInstruction(issueNumber: number): string {
  return `End your reply with \`Closes #${issueNumber}\` so the issue auto-closes when the PR merges. Docs-only PRs are downgraded to \`Refs\` by closes-guard.ts.`;
}
