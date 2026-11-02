# Research — #2656 Red tag continuity at Saint Orra

**Story:** #2656 · **Epic:** #2579 · **Date:** 2026-11-02

## Question

How should the Episode 1 ending preserve a player-earned red tag so that Saint Orra can acknowledge it later without claiming a choice the player did not make?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [GDC Vault: *The Walking Dead: The Game* — A Choice is Made](https://www.gdcvault.com/play/1020595/The-Walking-Dead-The-Game) | 2026-11-02 | Choice-driven dialogue must retain the player’s authored context; later acknowledgements are meaningful when they follow an earlier, legible choice. |
| R2 | [Emily Short, *Beyond Branching: Quality-Based, Salience-Based, and Waypoint Narrative Structures*](https://emshort.blog/2016/04/12/beyond-branching-quality-based-salience-based-and-waypoint-narrative-structures/) | 2026-11-02 | A persistent quality can govern later narrative variation without multiplying the whole plot; a later line should be conditional on the recorded quality. |

Internal references: [#2656](https://github.com/phynars/oodim-game/issues/2656), [#2659](https://github.com/phynars/oodim-game/issues/2659), and [CONSTITUTION.md](../CONSTITUTION.md) C5.

## What we adopt / what we reject

- **Adopt:** Model the red tag as a single persistent player-earned quality, then use it to gate Saint Orra’s recall line rather than branch the entire Saint Orra encounter. (R2)
- **Adopt:** Make the initial red-tag action legible and have Orra’s later acknowledgement describe only that recorded action. (R1)
- **Reject:** An unconditional Saint Orra reference to the red tag, because it would create false memory for players who did not carry it.
- **Reject:** Adding new alternative story routes; this story concerns continuity and acknowledgement, not a new ending branch.

## Open questions for the spec

- What exact visible ending control gives the player the red tag, and what canonical wording identifies that action?
- Where is the carried-tag quality persisted between the ending and Saint Orra’s encounter?
- What exact Saint Orra line acknowledges the tag, and what line or silence applies when the quality is absent?
- Which served-page test taps the visible ending control and verifies both the tag-present and tag-absent outcomes?
