# Product plan — phynars/oodim-game

**Owner of this artifact:** spec-writer (Charlie, this cycle)
**Last updated:** 2026-07 (planning cycle, chunk 1)
**Sources of truth:** `docs/flagship/BRIEF.md` (founder mandate),
`docs/flagship/concept.md` (AFTERSIGN concept), `docs/flagship/vertical-slice-backlog.md`
(Mara's ordered slice delivery).

> This plan is the one thing no single avatar holds: **WHAT** we are building
> and **in what order**. The org's measured failure mode is locally-verifiable
> micro-increments that never add up to a shippable outcome. Milestones here are
> **user-observable outcomes** — someone plays the thing and says yes/no — never
> internal artifacts. Exactly **one** milestone is active at a time.

---

## Vision

The clone era is over. We are building **one flagship**, an original 3D
narrative game — **AFTERSIGN** — playable at `game.oodim.com/aftersign`,
static-first three.js frontend on a Workers/DO/D1 backend. Its signature is the
pillar no one-shot prompt can fake: **NPCs who remember you across sessions and
show it.** Success is a stranger who plays ten minutes, has an NPC correctly
recall what they did in a previous session, and can retell that beat to a friend
afterward. The game is operated live in public — episodes ship through a
converging, gameplay-gated backlog; patch notes are signed; feedback becomes
issues and fixes ship visibly.

---

## Milestones

Each milestone is a falsifiable, playable outcome with a definition of done and
an LoE budget. **Exactly one is active.**

### M1 — AFTERSIGN vertical slice: "Io remembers the blue packet" *(ACTIVE)*

> **Outcome (falsifiable):** A phone visitor opens `game.oodim.com/aftersign`,
> receives a sealed blue packet at Io's Night Post kiosk, chooses to keep it
> sealed or open it, delivers it, leaves — and on a **later session with the
> same identity**, Io says a line that is correct *only because* of the packet
> outcome the player chose before. The wrong-outcome line never fires.

**Definition of done:**
- The `/aftersign` route loads on a mid-range phone viewport and reaches a
  quiescent playable state with touch controls.
- The player can complete BOTH packet paths (sealed / opened) end-to-end.
- Io's returning-session recognition line survives a real reload/second session
  via **server-authoritative** persistence — it cannot be produced by local-only
  state, and the harness fails if memory is missing, stale, or mismatched.
- The scene reads as authored (wet paper-lantern noir), not placeholder cubes;
  audio bed + recognition sting present.
- A deterministic WebGL-headless harness asserts the full loop through the
  flagship state surface, including red-polarity coverage for broken memory/save.

**LoE budget:** L (multi-epic; the flagship's first shippable proof).

**Status:** IN PROGRESS. Harness state contract, kiosk scene skeleton, and the
blue-packet choice are landed (the pre-slice `story-state-contract.md` /
`window.__game` surface is now being retired in favor of the field-based
`FlagshipSceneBeat` contract — see #634, #600, #601). Remaining work is the
durable-memory round-trip, the recognition beat wiring, and the mobile/AV finish
pass. **See active epic below.**

### M2 — AFTERSIGN Episode 1 *(NOT STARTED — do not file stories)*

> **Outcome:** A stranger plays 10+ minutes of a real first chapter, meets more
> than one remembering character, and retells a story beat afterward.

Definition of done deferred until M1 ships. LoE: XL. **Locked** — no stories.

### M3 — Operate live *(NOT STARTED)*

> **Outcome:** Four consecutive weekly content drops ship with zero human code;
> a public devlog and signed patch notes exist; player feedback visibly becomes
> shipped fixes.

Locked until M2. **No stories.**

---

## Active milestone M1 — epics

### M1-E1 — Durable memory round-trip *(ACTIVE EPIC)*

**Acceptance:** After a reload/second session keyed to the same durable player
identity, Io's server-side memory contains the prior packet outcome (delivery
id, packet outcome, Io trust posture, one authored memory sentence, last-seen
bucket); local-only spoofing is rejected as the source of truth; the harness can
force-save and force-reload and fail when memory is absent or stale.

**Integration story (proves the epic end-to-end):** a headless test drives a
packet choice → force-save → force-reload with the same identity → asserts Io's
memory carries the correct outcome and that `FLAGSHIP_BREAK_MODE=drop-memory` /
`local-only-save` fail red. **This is the story that must pass for E1 to be
done** — not the individual save/load pieces.

**Status:** in progress. Soren's phase-3/phase-4 work (#566, #567) exposes the
memory/save surface; the aftersign beat-name migration (#600, #601) aligns the
contract the round-trip asserts against. Integration story tracked below.

**LoE:** L.

### M1-E2 — Recognition beat lands as a felt moment *(QUEUED)*

**Acceptance:** `io_packet_return` fires only when a durable outcome exists; the
sealed/opened line ids are distinct and never crossed; beat kind, outcome, line
id, timing, input lock, camera delta, and yaw are assertable; the beat is short
enough to feel like being noticed, not trapped. (Slice backlog issue 5; #544
wires Io's phone-ready look/sound contract into the executed e2e lane.)

**LoE:** M. Starts after E1's integration story is green.

### M1-E3 — Mobile + AV finish pass *(QUEUED)*

**Acceptance:** phone-viewport harness confirms route load, interactable
readability, stable 60fps target, authored materials/lighting/post, audio bed +
recognition sting, and **no placeholder-cube regression**. (Slice backlog issue
6.) **LoE:** M. Last, per the slice cut line.

---

## Story map — active epic M1-E1 (Durable memory round-trip)

Stories are S/M, marked with `Milestone:`/`Epic:` header lines so the backlog
picker ranks them first. Issue numbers filled as filed.

| Story | Size | Issue | Notes |
|-------|------|-------|-------|
| **INTEGRATION:** save→reload→correct-Io-memory e2e (with red break modes) | M | _to file_ | Proves E1 done; must pass before E2 starts. |
| Phase 3 — expose `npcs.io.memories`, trust posture, returning-line fragments | L | **#566** | Soren, blocked-by #565. Map only (already filed). |
| Phase 4 — expose save block (authority, lastLoadProof) + wire `FLAGSHIP_BREAK_MODE` | L | **#567** | Soren, blocked-by #566. Map only. |
| Migrate aftersign beat names in impl to `FlagshipSceneBeat` contract | L | **#600** | Charlie. Contract the round-trip asserts against. |
| Update aftersign e2e specs to `FlagshipSceneBeat` field-based assertions | L | **#601** | Charlie, blocked-by #600. |

---

## Drift — open issues serving no active epic

_(Filled in the final report; operator/human disposes — the plan does not close them.)_
