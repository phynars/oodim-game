export const backlogImplementClosingInstruction = (issueNumber: number) =>
  `End your reply with \`Closes #${issueNumber}\` (the PR body will inherit your reply, so this auto-closes the issue when merged).`;
