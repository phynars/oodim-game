# Research — #2656 Red tag continuity at Saint Orra

**Story:** #2656 · **Epic:** #2587 · **Date:** 2026-11-04

## Question

How should the Episode 1 ending preserve a player-earned red tag so that Saint Orra can acknowledge it later without claiming a choice the player did not make?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [GDC Vault: Jake Rodkin & Sean Vanaman, *Saving Doug: Empathy, Character, and Choice in The Walking Dead* (GDC 2013)](https://www.gdcvault.com/play/1019053/Saving-Doug-Empathy-Character-and) | 2026-11-04 | Choices land when the player understands the character and their own role in the moment; empathy for a character is what gives a moral choice its weight. |
| R2 | [Emily Short, *Beyond Branching: Quality-Based, Salience-Based, and Waypoint Narrative Structures*](https://emshort.blog/2016/04/12/beyond-branching-quality-based-salience-based-and-waypoint-narrative-structures/) | 2026-11-02 | A persistent quality can govern later narrative variation without multiplying the whole plot; a later line should be conditional on the recorded quality. |

Internal references: [#2656](https://github.com/phynars/oodim-game/issues/2656), [#2659](https://github.com/phynars/oodim-game/issues/2659), and [CONSTITUTION.md](../CONSTITUTION.md) C5.

## What we adopt / what we reject

- **Adopt:** Model the red tag as a single persistent player-earned quality, then use it to gate Saint Orra’s recall line rather than branch the entire Saint Orra encounter. (R2)
- **Adopt:** Treat the ending's red-tag action as content whose *effect* sets the world-state flag. Treat Orra's recall line as separate content whose *prerequisite* is that flag. Do not key the line to the exact route the player took. (R2)
- **Adopt:** Make the red-tag moment a deliberate, visible player action tied to a character the player has come to care about, so Orra's later recall reads as acknowledging the player's own act. (R1)
- **Reject:** An unconditional Saint Orra reference to the red tag, because it would create false memory for players who did not carry it.
- **Reject:** Adding new alternative story routes; this story concerns continuity and acknowledgement, not a new ending branch.

## Open questions for the spec

- What exact visible ending control gives the player the red tag, and what canonical wording identifies that action?
- Where is the first-tap value (`took-at-once` / `asked-first`) persisted between the ending and Saint Orra's encounter, and how is it written once only?
- What exact Saint Orra wording is used for the "took the red tag at once" line and for the "asked first" line? What line or silence applies when no value was recorded?
- Which served-page tests at 390×844 cover each first-tap path? One taps "Take the second packet" first and expects the at-once line. The other taps "Ask what changed" first and expects the asked-first line and no at-once line.
