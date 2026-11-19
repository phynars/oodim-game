# Research — #2895 Episode 2 continuation from the Episode 1 end screen

**Story:** #2895 · **Epic:** #2893 · **Date:** 2026-11-19

## Question

How should the Episode 1 end screen offer a player-controlled, durable transition into Episode 2 while preserving the door outcome that the player chose?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Metlivi — How to End a Game Story Gently: Give Players Closure, a Save Point, and a Choice to Continue](https://metlivi.com/blog/how-to-end-a-game-story-gently-give-players-closure-a-save-point-and-a-choice-to-continue) | 2026-11-19 | An ending can retain closure while offering optional continuation; saved progress should preserve the ending outcome so a returning player does not repeat the climax. |
| R2 | [Game Developer — How post-game screens keep us playing (or don't)](https://www.gamedeveloper.com/design/how-post-game-screens-keep-us-playing-or-don-t-) | 2026-11-19 | A post-game screen should give the player agency over what happens next rather than automatically advancing them past a stopping point. |

Internal references: [story #2895](https://github.com/phynars/oodim-game/issues/2895) requires a visible `Begin Episode 2` control on the durable Episode 1 end screen; its continuation must show the Night Post and an Io line that reflects the stored door choice. [CONSTITUTION.md](../CONSTITUTION.md) C2 requires player-visible controls and served-page taps, and C5 forbids narration that contradicts what the player did.

## What we adopt / what we reject

- **Adopt:** Keep the Episode 1 end screen as a meaningful stopping point, then provide one explicit, player-initiated `Begin Episode 2` control. (R1, R2)
- **Adopt:** Persist the transition into Episode 2 with the selected door outcome, so a later session resumes at the Night Post rather than reconstructing the Episode 1 end screen. (R1)
- **Reject:** Automatic advancement from the Episode 1 end screen; it removes the player's choice to stop after the episode. (R2)
- **Reject:** Generic continuation dialogue that does not name the stored door choice; it would fail to acknowledge the player action required by the story.

## Open questions for the spec

- Which durable save field distinguishes a completed Episode 1 end screen from the Episode 2 Night Post?
- What exact Io wording names each of the three door choices without implying an outcome the player did not choose?
- Which visible controls remain available on the end screen besides `Begin Episode 2` and `Start fresh`, and how will the served-page test prove that Episode 1 controls remain locked?
