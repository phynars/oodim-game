# Research — #2726 durable Act II ending

**Story:** #2726 · **Epic:** #2587 · **Date:** 2026-11-10

## Question

What boundary must preserve an Act II ending when a player reopens the same slot in a fresh browser, and how can the story distinguish that recovery from browser-local state?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [MDN: Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) | 2026-11-10 | `localStorage` is origin-partitioned and can survive closing and reopening the browser, while `sessionStorage` is destroyed with the tab; neither proves recovery from an authority outside the browser. |
| R2 | [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) | 2026-11-10 | `localStorage` is browser-session durable in ordinary browsing but is cleared after the final private-browsing tab closes, and policy can deny storage access. A story contract cannot require it as the save authority. |

Internal references:

- `aftersign/docs/ARCHITECTURE.md` states that player identity, save/load state, and NPC memory are authoritative beyond the browser; browser-local storage is not a player-save boundary.
- `aftersign/e2e/aftersign-failed-route-played-fresh-context.contract.spec.ts` demonstrates the required shape: play a visible tap flow, close the first browser context, make a new context with no copied storage, reopen the same `?slot=`, then assert a restored server fact on the rendered surface.

## What we adopt / what we reject

- **Adopt:** Define durable Act II recovery as a same-slot reload in a newly created browser context with no copied cookies or storage; recovery must render a fact read from the backend authority. (R1, R2)
- **Adopt:** Treat the chosen ending as an explicit saved payload field and restore it before rendering the returning ending surface, so a fresh browser can make the same visible decision outcome. (R1)
- **Reject:** `localStorage`, `sessionStorage`, or a reload in the original browser context as acceptance evidence, because they can retain client state and `localStorage` availability/lifetime varies in private or policy-restricted browsing. (R1, R2)
- **Reject:** requiring a physical-device replay in this sprint story: Constitution C7 excludes acceptance that needs a physical device or human sign-off. The served-device evidence remains an operator release gate, not a code-story acceptance criterion.

## Open questions for the spec

- Which Act II ending field and renderer text form the minimum player-visible restored fact?
- At which ending transition must the authoritative save be forced so a close immediately after the final visible tap is recoverable?
- Which same-slot route reaches the restored ending surface after cold boot without test-only input?
- What failure state should render if authoritative ending recovery is unavailable, without inventing an ending the player did not choose?
