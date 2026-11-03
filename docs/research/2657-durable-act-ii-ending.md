# Research — #2657 durable Act II ending

**Story:** #2657 · **Research task:** #2673 · **Epic:** #2587 · **Date:** 2026-11-03

## Question

What persistence boundary lets a player reopen their assigned slot in a browser with no prior local storage and receive the same Act II ending, while keeping the ending attributable to recorded choices?

## Sources

| # | Source (link) | Read | What it tells us |
|---|---|---|---|
| R1 | [MDN: Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) | 2026-11-03 | `localStorage` and `sessionStorage` are browser-origin storage, so they cannot be the sole authority for an ending that must survive a fresh browser context. |
| R2 | [OWASP: Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | 2026-11-03 | Session identifiers are bearer credentials; persisted player state must be resolved by a server-side session/slot identity and must not trust browser-supplied ending data. |

Internal references: [CONSTITUTION.md](../CONSTITUTION.md) C2 requires player-driven served-page acceptance, and C5 requires ending language to reflect actions the player actually took.

## What we adopt / what we reject

- **Adopt:** Treat the server-resolved player slot as the authority for the previously reached Act II ending; a newly opened browser asks for the slot's durable result rather than reconstructing it from local storage. (R1, R2)
- **Adopt:** Retain the choices that support the ending alongside the durable result so displayed language remains traceable to recorded player actions. (R2; Constitution C5)
- **Reject:** A browser-only `localStorage` or `sessionStorage` solution, because a fresh browser has neither prior storage nor a trustworthy copy of the ending. (R1)
- **Reject:** Acceptance driven through a game harness input hook; the later test must tap visible controls on the served phone surface. (Constitution C2)

## Open questions for the spec

- Which existing server-side slot identity is available to the served AFTERSIGN route after a fresh browser starts?
- What durable record shape stores the Act II ending and the player choices that justify its text?
- Which visible route or control reopens the slot, and which phone-viewport browser test taps it before asserting the recalled ending?
