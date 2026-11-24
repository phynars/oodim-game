# Research — #3032 Act I end-card continuation into Act II

**Story:** #3032 · **Epic:** #3030 · **Date:** 2026-11-24

## Question

How should a player-controlled continuation from the Act I end card make the stored `take` or `refuse` shortcut answer visible in Act II, and restore the same Act II opening after reload?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Cardona-Rivera et al. — Foreseeing Meaningful Choices](https://www.cs.uky.edu/~sgware/reading/papers/cardonarivera2014foreseeing.pdf) | 2026-11-24 | A choice supports agency when it leads to meaningfully different content; Act II must therefore distinguish `take` and `refuse` in text, controls, and scene identity rather than merely retaining an internal value. |
| R2 | [MDN — Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) | 2026-11-24 | Storage objects retain key/value data through page loads; this makes durable restoration technically possible, but does not establish this game's persistence implementation. |

Internal references: [story #3032](https://github.com/phynars/oodim-game/issues/3032) requires the Act II opening to differentiate the stored `take` and `refuse` shortcut answers by text, controls, and scene id, and to restore that opening after a reload. [CONSTITUTION.md](../CONSTITUTION.md) C2 requires a visible control reached by player input; C5 requires language that reflects the action actually taken. This research does not verify the owning save schema or runtime restoration path.

## What we adopt / what we reject

- **Adopt:** Make the Act I end-card continuation an explicit player action, and map each stored shortcut answer to observably distinct Act II text, controls, and scene id. (R1)
- **Adopt:** Require the later spec to identify and verify a durable owner for the selected Act II scene id and shortcut answer before it specifies reload restoration. R2 establishes only that browser storage can support persistence. (R2)
- **Reject:** A single generic Act II opening with only hidden state differing, because it does not make the earlier choice meaningful to the player. (R1)
- **Reject:** An unverified claim that this game recomputes an Act II opening from a default after reload; the save owner and runtime behavior remain unknown. (R2)

## Open questions for the spec

- What exact visible `Continue to Act II` label and placement will the Act I end card use at the 390×844 player viewport?
- What text, controls, and stable scene ids identify the distinct `take` and `refuse` openings?
- Which existing save schema owns the shortcut answer and active scene id, and at what transition point must it persist them?
- Which served-page tests will tap the visible continuation control and reload each branch without using `window.__game` for input?
