# Research — #2994 titled intro, readable jobs, and Io dialogue

**Story:** #2994 · **Epic:** #2893 · **Date:** 2026-11-23

## Question

How should AFTERSIGN introduce a new player and present job choices and Io's dialogue on a 390×844 phone screen without hidden content or a non-functional action affordance?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [Baymard: Avoid Inline Scroll Areas](https://baymard.com/research-articles/inline-scroll-areas) | 2026-11-23 | Inline scrolling introduces interaction problems when content is hidden inside a scroll area; job choices should therefore be reachable through the page's normal vertical scroll rather than a card-only swipe. |
| R2 | [W3C WAI: Content Structure](https://www.w3.org/WAI/tutorials/page-structure/content/) | 2026-11-23 | Semantic content structure makes text meaningful to assistive technologies; separate Io remarks should use separate line- or paragraph-level elements rather than one undifferentiated text run. |

Internal references: #2994 requires a titled, one-sentence first screen before any job control; all second-list jobs to be visible or reachable by page scrolling at 390×844; Io remarks after the visible "Ask for next job" control to be separate lines or paragraphs; and no "Red tag — Saint Orra" button unless its tap visibly changes state. Prior research for #2848 identifies the related second-list phone constraint and rejects a fixed-height clipped list or test-only input path ([research/2848-second-job-list-phone-scroll.md](2848-second-job-list-phone-scroll.md)).

## What we adopt / what we reject

- **Adopt:** Place the title and one-sentence orientation ahead of the first job control, giving new players a stable textual start before they choose (story requirement).
- **Adopt:** Use normal page-level vertical scrolling, or fit every second-list control in the viewport, so every job remains player-reachable without a nested card swipe (R1).
- **Adopt:** Render each Io remark in its own visible line or paragraph-level element after the player taps the visible "Ask for next job" control (R2).
- **Adopt:** Render "Red tag — Saint Orra" as a button only if its pointer tap changes visible game state; otherwise present it as non-button text (story requirement).
- **Reject:** Hiding a job inside a clipped or independently scrollable card, because the required player path cannot rely on a card-only swipe (R1).
- **Reject:** Treating visually adjacent Io sentences as separate dialogue when they share one undifferentiated text element (R2).

## Open questions for the spec

- Which served screen component owns the initial title, intro sentence, first job control, second job list, and "Red tag — Saint Orra" rendering?
- Which player-driven 390×844 test taps the visible "Ask for next job" control and asserts the separate rendered Io elements?
- If the second job list exceeds the viewport, which page-level scroll assertion proves each job control is reachable without scrolling inside a card?
