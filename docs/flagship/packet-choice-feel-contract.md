# AFTERSIGN — blue packet choice feel contract

**Owner:** Ivy Tran  
**Status:** Draft for vertical-slice implementation  
**Source:** `docs/flagship/concept.md` review prompt: opening or preserving the packet must feel intentional, not like menu trivia.

## Problem

The first slice asks the player to choose whether to preserve Io's sealed blue packet or break the seal. If that choice is presented as a flat menu option, the player will read it as UI trivia instead of a physical act of trust.

The decision needs hand-feel: the player should understand, before committing, that opening the packet is a deliberate breach and keeping it sealed is active restraint.

## Feel target

The packet choice is a **press-and-hold inspection object**, not a dialogue menu.

- The packet exists in the player's hands or immediate interaction focus.
- The blue wax seal is visible before any choice is possible.
- The player can inspect without committing.
- Preserving the seal requires releasing or backing out without crossing the break threshold.
- Breaking the seal requires an intentional hold through resistance.
- The commit moment is audiovisual and stateful: once the seal breaks, the packet cannot be made sealed again in the same run.

## Interaction states

```ts
type PacketInteractionState =
  | 'idle'
  | 'inspect_focus'
  | 'seal_pressure'
  | 'seal_preserved'
  | 'seal_broken';
```

### `idle`

The packet is available near Io's kiosk after Io assigns the delivery.

- Interaction prompt: `Inspect packet`
- No moral framing in UI copy.
- Packet seal is visible in-world or in a compact inspect view.

### `inspect_focus`

The player has focused the packet but has not chosen.

- Camera/inspect view settles in **120-180ms**.
- Input remains reversible.
- Primary affordance: press/hold on the seal.
- Secondary affordance: back/release to preserve and leave.
- The UI should not say `Open` as the first word. Use physical language: `Press seal`.

### `seal_pressure`

The player is holding pressure on the wax.

- Commit threshold: **520-680ms hold**.
- Before **420ms**, releasing always returns to `inspect_focus` with no penalty.
- From **420ms** to commit, add visible wax strain and a low creak/tension layer.
- Do not soft-lock movement longer than **700ms** during this pre-commit pressure.
- Touch target minimum: **44 CSS px**.

### `seal_preserved`

The player exits inspection without breaking the seal.

- State outcome: `packetOutcome = 'sealed'` only after delivery to the sign box or return check, not merely after backing out.
- Feedback: a small wax glint / intact-seal tick, **80-140ms**.
- No congratulatory copy. Restraint should feel quiet.

### `seal_broken`

The hold crosses the commit threshold.

- State outcome immediately marks packet as opened for this run.
- Feedback stack:
  - wax crack frame within **1 frame** of threshold crossing;
  - short dry snap sound within **0-40ms**;
  - packet paper relaxes/open edge shifts within **80-140ms**;
  - interaction prompt changes away from preserving language.
- The broken state is irreversible until a new save/test identity.

## `window.__game` harness surface

The harness needs enough plain serializable state to fail if the choice becomes menu-only or ambiguous.

```ts
type PacketChoiceDebugState = {
  packet: {
    id: 'blue_packet_001';
    interactionState: PacketInteractionState;
    sealState: 'intact' | 'strained' | 'broken';
    holdMs: number;
    commitThresholdMs: number;
    outcome: null | 'sealed' | 'opened';
    irreversibleThisRun: boolean;
  };
  input: {
    movementLocked: boolean;
    movementLockedMs: number;
    activePrompt: string | null;
    touchTargetCssPx: number | null;
  };
  lastFeedback: null | {
    kind: 'seal_preserved' | 'seal_broken';
    firedAtMs: number;
    audioDelayMs: number | null;
    visualDelayFrames: number | null;
  };
};
```

## Harness assertions

Minimum regression checks for slice 1:

1. Inspecting the packet enters `inspect_focus` without setting `packet.outcome`.
2. Holding less than **420ms** and releasing does not break the seal.
3. Holding through the configured threshold sets `sealState === 'broken'`, `outcome === 'opened'`, and `irreversibleThisRun === true`.
4. Backing out from inspection leaves `sealState === 'intact'` and does not set `outcome` until the delivery/return beat resolves it as sealed.
5. The active touch target is at least **44 CSS px** when seal pressure is available.
6. The pre-commit movement/input lock never exceeds **700ms**.
7. The broken-seal feedback reports a visual response within **1 frame** and audio delay no higher than **40ms**.

## Implementation boundaries

- Do not add a branching episode tree.
- Do not add combat, chase pressure, or timing failure.
- Do not make Io explain the system before the player acts.
- Do not use a generic confirm modal for the packet outcome.
- Do not persist an opened/sealed outcome from local storage alone; the durable memory issue owns server authority.

## Why this matters

The flagship proof is not just that Io later remembers `sealed` or `opened`. The first half of that proof is the player's body understanding what they did. A remembered line only lands if the action had weight when it happened.
