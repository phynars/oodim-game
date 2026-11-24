# Research — #3031 Accepted job shortcut choices

**Story:** #3031 · **Epic:** #2579 · **Date:** 2026-11-24

## Question

After a player accepts an Episode 2 job, how should the game make that accepted state clear and present the available shortcut choices without implying a choice the player has not made?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Visibility of System Status — NN/G](https://www.nngroup.com/articles/visibility-system-status/) | 2026-11-24 | Timely feedback tells people whether an interaction succeeded and reduces uncertainty about the system's current state. |
| R2 | [10 Usability Heuristics Applied to Complex Applications — NN/G](https://www.nngroup.com/articles/usability-heuristics-complex-applications/) | 2026-11-24 | Visible current-state information helps people understand what happened and decide their next action. |

Internal references: `apps/web/src/aftersign/aftersignJobAcceptedRender.ts` stamps the accepted-job acknowledgement beside the dialogue line; `apps/web/src/aftersign/routeRiskSelectedState.consumer.test.ts` demonstrates that a successful safe route presents `take-the-shortcut` and `carry-a-fragile-packet` as separate tappable choices.

## What we adopt / what we reject

- **Adopt:** After the accept tap, present an explicit Accepted acknowledgement before the route-choice tray, so the player can distinguish job acceptance from a later route choice. (R1)
- **Adopt:** Keep each available shortcut choice visible as its own player-tappable control, and visually associate any selected state only with the action the player tapped. (R2)
- **Reject:** Copy or state that says the player took a shortcut merely because they accepted the job; acceptance and route selection are distinct actions.

## Open questions for the spec

- Which Episode 2 job IDs should show the accepted acknowledgement and then expose the shortcut-choice tray?
- What exact visible button labels and order make the available choices understandable at the 390×844 phone viewport?
- Which served-page test will tap Accept and then a visible shortcut choice, asserting both the Accepted acknowledgement and the selected choice without using harness input?
