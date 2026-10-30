# Studio constitution

The standing rules every spec, design and PR in this repo must respect. They
come from [`docs/flagship/BRIEF.md`](flagship/BRIEF.md) (founder amendments and
operator decisions). If this file and the brief disagree, the brief wins and
this file is fixed.

Each spec ends with a **Constitution check**: one line per article, `pass` or
`n/a — <why>`. `scripts/docs-index-check.mjs` fails CI when an article is
missing from a spec's check.

| ID | Article | Source |
|---|---|---|
| **C1** | **Flagship first.** All work is AFTERSIGN. Pac-Man, Galaga, Doom and agar are frozen; only a player-breaking bug may touch them. | BRIEF, Ground rules |
| **C2** | **Played, not driven.** Acceptance drives the served page the way a player does: taps on visible controls at a 390×844 phone viewport. `window.__game` is for assertions only, never for input. A beat no tap can reach is not done. | BRIEF, Played, not driven (08-15) |
| **C3** | **Test first.** Every acceptance criterion maps to a named test. The test is written before the change and fails on `main`; the change makes it pass. CI enforces it for `bug:`, `fix:`, `feature:`, `enhancement:` and `story:` work (`scripts/fail-to-pass.mjs`). | Kyoung, 10-30 |
| **C4** | **The served surface is the product.** A change is done only when a player can see or feel it at `game.oodim.com/aftersign`. `harness-only` PRs are at most one in four flagship merges. Research, spec and design PRs (only `docs/` changes) are not code: they name the story's build issue that consumes them and don't count toward that ratio. | BRIEF, Definition of Done (08-01) |
| **C5** | **No false memory.** Io, Saint Orra and the ending card say only what the player actually did, in words the player can map to the button they pressed. A false memory is a P1 and blocks any closeout. | BRIEF, M-LOOP closeout rules (10-04) |
| **C6** | **Documents first.** A story goes research → spec → design → tests → build. Research cites external sources. The spec states acceptance criteria in EARS form. The design carries diagrams and a test map. Every one of these docs is listed in [`docs/INDEX.md`](INDEX.md). | Kyoung, 10-30 |
| **C7** | **Team-doable.** A sprint story's acceptance must be checkable by the AI team through the repo, CI or the deployed page. Nothing that needs a physical device, an outside account or a human sign-off. That work goes to the operator, outside the sprint. | Kyoung, 10-30 (the #2071 lesson) |
| **C8** | **Cut scope, never the date.** Milestone deadlines bind; scope shrinks to fit. | BRIEF, M3 |

## EARS acceptance criteria (C6)

Acceptance criteria use the EARS shapes (Easy Approach to Requirements Syntax),
one per line, each with an ID:

| Shape | Form |
|---|---|
| Ubiquitous | `AC-1: THE <system> SHALL <response>.` |
| Event | `AC-2: WHEN <trigger>, THE <system> SHALL <response>.` |
| State | `AC-3: WHILE <state>, THE <system> SHALL <response>.` |
| Unwanted | `AC-4: IF <condition>, THEN THE <system> SHALL <response>.` |
| Optional | `AC-5: WHERE <feature is present>, THE <system> SHALL <response>.` |

Example: `AC-1: WHEN the player reaches the ending without tapping "Take the
second packet", THE ending card SHALL NOT say the red tag was accepted.`

## Changing this file

The operator changes it, in its own PR, citing the brief section or the
founder decision behind the change. Avatars propose changes through an issue.
