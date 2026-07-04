# AFTERSIGN — `window.__game` story-state contract (slice 1)

**Status:** Spec for crew review (Soren Vask owns implementation sign-off)
**Scope:** Exactly what `docs/flagship/concept.md` § "What the system stores
per player" lists — one scene (Io's Night Post kiosk), one remembering NPC
(Io Vale), one durable proof. Nothing wider.
**Version:** The surface carries `version: 1`. Any breaking change bumps it.

## Why this exists

The vertical slice's merge gate is a headless WebGL harness that asserts
Io's memory is **server-backed**: a returning session must greet the player
with a line that correctly references the prior packet outcome, and the
harness must be able to FAIL if Io references the wrong prior action or if
the "memory" is really just local storage. This doc is the contract that
harness binds against — same discipline as
`e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` (normative field names,
call-or-read access shape, no wall-clock waits per
`docs/harness/no-wall-clock-waits.md`).

## The surface

Installed by the flagship client on `window.__game` when
`import.meta.env.MODE === 'test'` (or the equivalent harness flag). Plain
serializable data only — no class instances, Maps, or Sets.

```ts
type FlagshipStoryState = {
  version: 1;

  // ---- READ surface: read-only mirrors of SERVER state ----
  scene: {
    id: 'night-post-kiosk';       // slice 1 has exactly one scene
    beat: string;                  // current authored beat id, e.g. 'arrival', 'packet-choice', 'return-greeting'
  };
  player: {
    id: string;                    // durable player id (server-issued, survives reload)
    lastSeenBucket: 'first-visit' | 'same-day' | 'returning' | null;
  };
  delivery: {
    packetId: string | null;       // the blue packet, once received
    outcome: 'delivered' | 'opened' | 'withheld' | 'returned' | null;
  };
  io: {                            // the one remembering NPC
    trust: 'unproven' | 'earned' | 'strained';
    memorySentence: string | null; // the ONE authored memory sentence stored server-side
    lastLine: string | null;       // most recent spoken line, verbatim
    lastLineMemoryRef: 'seal-kept' | 'seal-broken' | null;
                                   // which prior outcome the last line referenced, or null if none
  };
  save: {
    revision: number;              // increments on every server persist; monotonic
    lastPersistedAt: string | null;// ISO timestamp echoed FROM THE SERVER response
    dirty: boolean;                // true iff local state has unsaved mutations
  };

  // ---- DRIVE surface: harness-writable (always functions) ----
  input: {
    choose(choiceId: string): Promise<void>;  // e.g. 'open-packet' | 'keep-seal' | 'deliver'
    advance(): Promise<void>;                 // advance one authored beat
    forceSave(): Promise<void>;               // resolves AFTER server ack (revision bumped)
    forceReload(): Promise<void>;             // full page reload preserving player identity
  };
};
```

### Read vs write rules

- **Read fields** (`scene`, `player`, `delivery`, `io`, `save`) are
  read-only mirrors of server-authoritative state. They may be exposed as
  plain values or zero-arg getters (call-or-read, same relaxation as the
  multiplayer surface). The client must never let harness writes to these
  fields alter game behavior.
- **Drive fields** (`input.*`) are always functions and are the ONLY way
  the harness mutates state. Each resolves only after the client has
  applied the result AND, where persistence is involved (`forceSave`),
  after the **server acknowledges** the write.
- No harness assertion may use a fixed sleep. Quiesce on
  `window.__game`'s own state (`page.waitForFunction`), e.g. wait for
  `save.dirty === false` or `io.lastLine !== null`.

## Assertion 1 — returning-session line references the correct prior outcome

1. Session A: `input.choose('keep-seal')` (or `'open-packet'`),
   `input.choose('deliver')`, `input.forceSave()` — assert
   `delivery.outcome` and that `save.revision` incremented.
2. `input.forceReload()` with the same durable `player.id`.
3. Wait for `io.lastLine !== null` on the greeting beat, then assert:
   - `io.lastLineMemoryRef === 'seal-kept'` when the seal was kept,
     `'seal-broken'` when it was opened — the ref must MATCH session A's
     actual choice, and
   - `io.memorySentence` is non-null and equals what session A persisted.

The `lastLineMemoryRef` field is what makes the harness able to FAIL on a
wrong reference: if Io's line cites the outcome the player did NOT choose,
the ref mismatches and the test is red. A greeting with no memory
reference (`null`) on a returning session is also red.

## Assertion 2 — memory is server-backed, not local-storage theater

Two independent proofs, both required:

1. **Storage-wipe round-trip:** after session A persists, clear ALL
   client-side storage (`localStorage`, `sessionStorage`, IndexedDB,
   cookies except the durable-identity credential) before reload. If Io
   still produces the correct `lastLineMemoryRef`, the memory came over
   the wire. If the greeting degrades to `first-visit`, red.
2. **Revision provenance:** `save.lastPersistedAt` and `save.revision`
   must come from the server's persist response, not a client clock or
   counter. The harness asserts `revision` after reload equals `revision`
   before reload (survived the round trip) and that tampering with local
   storage cannot raise it.

## Broken-mode polarity (red side)

Following the `.github/workflows/agar-multiplayer-redgreen.yml` pattern:
at least one deliberately broken mode (e.g. `FLAGSHIP_BREAK_MODE=drop-memory`,
which persists but returns a null memory on load) must make Assertions 1–2
FAIL, and an inverted red-polarity script must fail CI if the broken mode
accidentally passes. A harness that can't go red proves nothing.

## Non-goals (slice 1)

- No multi-NPC memory maps, no episode/act state, no flags dictionary
  beyond the fields above — the shape stays exactly the concept doc's
  per-player storage list.
- No prompt-transcript assertions, no visual-quality gates.
- The richer multi-NPC surface sketched in #391 (npc map, `memory[]`
  triples, `lastLineMemoryRefs[]`) is the anticipated `version: 2` growth
  path once slice 1 lands; it must not gate slice 1.

## References

- `docs/flagship/concept.md` — vertical slice definition, "What the system
  stores per player".
- `e2e-shared/multiplayer/CLIENT-TEST-SURFACE.md` — call-or-read access
  shape and normative-naming discipline this contract inherits.
- `docs/harness/no-wall-clock-waits.md` — state-quiesced waits.
- `.github/workflows/agar-multiplayer-redgreen.yml` — red/green polarity
  pattern for the broken mode.
- Refs #391 (harness implementation issue — code lands there).
