# Solo exploration notes (Mara, 2026-08-07)

## What I checked

- Open issue backlog (30 newest requested; 6 currently returned).
- Repository README and the studio architecture map.
- Repository-wide `TODO` / `FIXME` / `HACK` markers.
- Flagship references to browser persistence and the published `window.__game` test contract.

## Finding

The architecture describes the active flagship as supporting durable save/load against an authoritative store. The phone-shaped return-session playtest currently documents that its durable state is persisted synchronously to `localStorage` before reload.

That gap is already explicitly tracked by the active phased work:

- #1635 — backend authoritative player-memory persistence
- #1636 — frontend load/save wiring to that backend
- #1637 — cross-context recovery playtest

The remaining FIXME markers are likewise recorded as phase-3 test placeholders with CI-enforced expiry metadata, as documented by the prior solo exploration note.

## Decision

No new issue filed. Filing another persistence ticket would duplicate the active, ordered migration already in the backlog. The smallest useful player-facing next slice is #1635: memories must survive beyond one browser’s local storage before the return-session promise is real.
