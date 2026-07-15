# AFTERSIGN — Io first memory beat delivery plan

> **HISTORICAL — superseded.** References to `window.__game.version === 1`
> and `story.memoryBeat.*` describe the pre-slice runtime deleted in
> PR #630. The current runtime surface is the slim `__game` exposed by
> `aftersign/index.html`. Kept for design provenance only. See issue #634.

**Owner:** Mara Okonkwo  
**Status:** Draft plan for crew review  
**Source:** `docs/flagship/concept.md`, `docs/flagship/BRIEF.md`, #391, #401

## Decision

The first shippable AFTERSIGN vertical slice is **Io remembers the blue packet outcome across sessions**.

Everything in slice 1 should prove one player-facing sentence:

> The player returns, and Io says something specific that could only be true because of what the player did last session.

If a feature does not make that sentence stronger, more reliable, or more beautiful, it is out of scope for this slice.

## Player beat

1. The player arrives at Io's Night Post kiosk on the Silt Stair.
2. Io gives the player a sealed blue packet and a short route to a nearby sign box.
3. The player chooses one of two outcomes:
   - deliver the packet sealed;
   - open the packet before delivery.
4. The game persists that outcome server-authoritatively for the durable player identity.
5. On a later session, Io recognizes the prior outcome and speaks the correct line.

### Required returning-session lines

Sealed packet:

> “You came back. So did the blue seal, unbroken. That gives me two facts to trust.”

Opened packet:

> “You came back. The seal did not. I can use one of those facts.”

These are the first two lines the entire product must protect. The harness should fail if the wrong line is reachable for the saved outcome.

## Ordered delivery sequence

### 1. Harness-first story/state contract — #391

Ship before gameplay. This is the merge gate that lets every later slice prove story correctness without relying on screenshots or vibes.

Minimum product requirement:

- `window.__game.version === 1` exists under Playwright.
- `window.__game` exposes serializable scene, player, NPC memory, and save metadata.
- Tests can choose one packet outcome, force save, reload with the same player identity, and assert Io references the correct memory id.
- A red-polarity broken mode proves the test can fail for a wrong memory/load path.

Mara product constraint:

- The contract should name story facts in player-facing terms: `packet_outcome: sealed | opened`, `line_id`, `memory_ref`, `save_revision`.
- Do not create an abstract affinity/trust system first. Io needs one remembered fact, not a simulation.

### 2. Io returning-session recognition feel contract — #401

Ship once #391 gives the harness a surface to assert against.

Minimum product requirement:

- Returning with a durable packet outcome fires `io_packet_return`.
- The beat uses the correct line id:
  - `io_return_packet_sealed` for sealed;
  - `io_return_packet_opened` for opened.
- `window.__game.story.memoryBeat` exposes enough data for the harness to assert timing, input lock, camera motion, yaw, outcome, and line id.

Mara product constraint:

- The recognition beat is short, authored, and specific. The player should feel noticed, not paused.
- Wrong-line failure is a blocker. A beautiful beat with the wrong memory is worse than no beat.

### 3. Minimal playable kiosk scene

Ship after the harness can catch the two regressions above.

Minimum product requirement:

- One compact 3D kiosk space.
- One interactable sealed blue packet.
- One nearby sign box delivery target.
- One visible packet state change if opened.
- One return interaction with Io.
- Phone-first controls and readable interaction radius.

Mara product constraint:

- The first action cannot feel like menu trivia. Opening the packet must be an intentional, embodied choice: inspect, hesitate, break seal.
- Temporary geometry is allowed only if it obeys the art direction: wet paper lantern noir, not placeholder cubes.

### 4. Durable save/load implementation

Ship as the smallest server-authoritative proof needed for Io's beat.

Minimum product requirement:

- Stable durable player identity.
- Saved packet outcome.
- Saved Io memory sentence/id.
- Save revision visible to the harness.
- Reload proves local-only tampering cannot fake the remembered outcome.

Mara product constraint:

- Store only the slice needs: no city-wide memory graph, no generic NPC mind, no multi-NPC chat.

### 5. Look and sound pass for the same beat

Ship only after the memory cannot lie.

Minimum product requirement:

- Lantern/fog/wet-surface lighting pass for the kiosk.
- Blue packet visual state: sealed vs opened.
- Sign or packet echo at recognition.
- Short audio sting coupled to Io's recognition.

Mara product constraint:

- Polish must clarify the remembered fact. If an effect does not help the player understand “Io noticed what I did,” cut it.

## Review asks by discipline

### June — words

Lock Io's first-session and returning-session copy around the two packet outcomes.

Acceptance lens:

- Io should never explain the memory system.
- Io should sound like a dispatcher weighing facts, not a tutorial character.
- Each remembered line must point to the concrete prior action.

### Ivy — playability

Pressure-test whether preserving/opening the packet feels intentional.

Acceptance lens:

- The player understands the packet is sealed before acting.
- Opening the packet requires a deliberate action, not an accidental tap.
- Delivering sealed remains as satisfying as opening it.

### Soren — harness

Own #391 as the first gate.

Acceptance lens:

- No story beat exists unless `window.__game` can prove it.
- The broken mode fails for the right reason.
- Tests wait on quiescent story state, not fixed sleeps.

### Diego — recognition feel

Own #401 as the authored beat target.

Acceptance lens:

- The beat is felt in camera, sign/packet treatment, and sound.
- Movement lock is short enough to feel authored, not stolen.
- Sealed/opened outcomes are distinct without becoming two different cutscenes.

## Non-goals for this plan

- No Episode 1 branching tree.
- No Saint Orra, Niko, Maud, or Unaddressed Child implementation.
- No generalized AI dialogue system.
- No procedural city memory simulation.
- No desktop-first interaction design.
- No visual polish that outruns the memory proof.

## Shippable definition

This plan is ready to convert into implementation issues when the crew has reviewed the Io beat and agrees that:

1. the packet outcome is the first durable player memory;
2. #391 is the first engineering gate;
3. #401 is the first feel gate;
4. the kiosk scene stays small enough to finish before Episode 1 expands.
