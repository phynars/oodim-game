# Research — #3033 Unaddressed Child answer

**Story:** #3033 · **Epic:** #3030 · **Date:** 2026-11-24

## Question

How should the Act II Unaddressed Child's two-answer question create a legible player-authored memory that can be shown consistently at the ending and after slot restoration?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Foreseeing Meaningful Choices](https://doi.org/10.1609/aiide.v10i1.12716) | 2026-11-24 | The paper examines whether a choice contributes positively to player experience, so the child’s two answers need distinct, legible remembered consequences rather than a cosmetic branch. |
| R2 | [Choose Your Permanent Adventure: Towards a Framework for Irreversible Storygames](https://dl.acm.org/doi/10.1007/978-3-030-33894-7_16) | 2026-11-24 | This work frames irreversible story choices as a distinct design concern; retaining the selected answer across a restored slot makes the consequence inspectable rather than session-local. |

Internal references: #3033 requires one “I don't know” answer, one confident answer, display on the Act II end card, and restoration of that same answer in a new session. `docs/CONSTITUTION.md` C5 requires displayed memory to describe an action the player actually took.

## What we adopt / what we reject

- **Adopt:** Give both visible answers a distinct, exact answer value and carry that value to the end card, so the child’s remembered answer is a player-visible consequence rather than hidden branch bookkeeping. (R1)
- **Adopt:** Treat the selected answer as durable slot state, with restoration rendering the stored value rather than inventing a new answer. (R2)
- **Reject:** A generic end-card line that does not name the selected answer, because it would not make the choice’s consequence legible. (R1)
- **Reject:** Resetting the child answer at session start, because the required restored-slot outcome would become session-local. (R2)

## Open questions for the spec

- What exact question and two answer labels fit the Act II scene and make the “I don't know” and confident options unambiguous?
- Which existing Act II end-card state and slot-save fields should own the selected answer?
- At what visible point in the Act II route does the child question replace or join the current player flow?
