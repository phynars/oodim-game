# Research — #2849 Stale seal prompt and red-tag affordance

**Story:** #2849 · **Epic:** #2821 · **Date:** 2026-11-16

## Question

How should the served AFTERSIGN surface prevent a completed blue-seal decision from reappearing, while ensuring the red-tag label does not promise a tap action it does not provide?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [NN/G, “Beyond Blue Links: Making Clickable Elements Recognizable”](https://www.nngroup.com/articles/clickable-elements/) | 2026-11-16 | Visual cues such as shape, color, borders, and placement tell people whether an element is actionable; a non-actionable element should not resemble a control. |
| R2 | [NN/G, “Flat UI Elements Attract Less Attention and Cause Uncertainty”](https://www.nngroup.com/articles/flat-ui-less-attention-cause-uncertainty/) | 2026-11-16 | Weak or absent clickability signifiers increase user effort and uncertainty, so interaction styling must correspond to an available action. |

Internal references:

- Story #2849 requires removal of the stale blue-seal reminder after the choice and a served-page resolution for the red-tag label at 390×844.
- `docs/CONSTITUTION.md` C2 requires the served page to be driven through visible controls, not `window.__game` input hooks.

## What we adopt / what we reject

- **Adopt:** Render a non-interactive red-tag label as ordinary informational text, or provide a visible tap response when its presentation uses a control signifier. (R1, R2)
- **Adopt:** Treat the blue-seal choice as a state transition that suppresses the pre-choice reminder on later screens. (Story #2849)
- **Reject:** Leaving a button-like red-tag treatment that has no tap outcome, because it creates a false interaction promise. (R1)
- **Reject:** Validating the player outcome through a harness-only input call; the eventual test must tap a visible served-page element when behavior is interactive. (C2)

## Open questions for the spec

- Which render component currently owns the post-choice blue-seal reminder, and which later screens can reuse it?
- Does the red-tag label need a tap action for navigation or detail, or should its visual treatment become explicitly non-interactive?
- Which served Playwright flow reaches the red-tag state at 390×844 and can assert both appearance and tap outcome?
