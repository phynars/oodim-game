# AFTERSIGN packet action playability review

**Reviewer:** Ivy Tran  
**Scope:** Concept review for the vertical-slice packet choice: open the sealed blue packet or preserve it.  
**Source:** `docs/flagship/concept.md` draft and `docs/flagship/BRIEF.md` flagship mandate.

## Read

The concept has the right playable spine: one small place, one NPC, one object, one remembered consequence. The risk is that the first signature choice becomes a dialogue-menu fork instead of a physical action the player owns.

The packet decision needs to feel like handling a real object under trust pressure. The player should know exactly when they are about to cross the line, and the input should make the choice feel deliberate rather than accidental.

## Player action audit

### What the player does

1. Receives the sealed packet from Io.
2. Holds or inspects it in hand.
3. Sees the intact blue seal as a clear physical state.
4. Chooses one of two embodied actions:
   - preserve the seal and place the packet in the sign box;
   - break the seal, then place the opened packet in the sign box.
5. Returns to Io and sees the consequence later through Io's remembered line.

### What must not happen

- The choice must not be a modal prompt: `Open packet? Yes / No`.
- The open action must not share the same tap cadence as inspect, advance dialogue, or pick up.
- The player must not be able to break the seal by a stray tap while moving.
- The game must not hide the seal state in UI text only. The packet model/material needs to carry it.

## Recommended interaction model

### Mobile-first input

Use a two-step commit for breaking the seal:

1. **Tap packet / interact button:** raise packet into inspect pose.
2. **Press-and-hold on the wax seal for 450 ms:** seal strains, wax creaks, red string tightens.
3. **Release after threshold:** seal breaks with a small snap, visual tear, and one-frame controller-safe hit pause in the inspect animation.
4. **Release before threshold:** cancel cleanly; seal remains intact.

Preserving the packet should be equally intentional but lighter:

1. Carry the packet normally.
2. Approach sign box.
3. Tap interact once while the packet is still sealed.
4. The character places the packet in the box with the seal visible for the first 300 ms of the animation.

### Desktop parity

- Inspect: `E` or primary interact.
- Break seal: hold primary interact while in inspect pose for the same 450 ms threshold.
- Cancel: release early or press back/escape.

## Feel numbers

These are starting targets, not lore:

- Inspect pose response: first visible packet movement within **2 frames at 60fps** after input.
- Seal hold threshold: **450 ms**; long enough to reject accidents, short enough to avoid drag.
- Seal pre-break feedback: begin by **120 ms** into hold with wax/string deformation or glow.
- Irreversible break moment: one crisp event at threshold; no mushy partial-open ambiguity.
- Input lockout after break: maximum **250 ms** before the player can move/confirm again.
- Sign-box placement animation: **500-700 ms**, with the seal state readable in the first half.
- Returning Io recognition beat: player control can soften, but hard control theft should stay under **900 ms**.

## Camera and readability

- Inspect camera should push in enough that the seal fills at least **12% of viewport width** on a phone portrait target.
- The packet should rotate only under explicit inspect drag/axis input; no idle spin that hides the seal at decision time.
- The sign box should preview whether it will accept a sealed or opened packet before commit through object state, not text-only UI.
- If the packet is opened, the broken wax/string silhouette must remain visible after returning to carry mode.

## State contract Soren can test

Minimum fields exposed through `window.__game` for this interaction:

```ts
type PacketSealState = 'sealed' | 'opened';
type PacketInteractionPhase =
  | 'unassigned'
  | 'carried'
  | 'inspect'
  | 'seal_hold'
  | 'delivered'
  | 'reported';

interface SliceStoryState {
  packetSealState: PacketSealState;
  packetInteractionPhase: PacketInteractionPhase;
  packetOpenedAtMs?: number;
  packetDeliveredAtMs?: number;
  ioMemoryLineId?: 'return_sealed' | 'return_opened';
}
```

Harness assertions worth having before content polish:

- A tap into inspect does not change `packetSealState`.
- A hold shorter than 450 ms does not change `packetSealState`.
- A completed hold changes `packetSealState` to `opened` exactly once.
- Delivering while sealed persists `packetSealState: 'sealed'` server-side.
- Delivering after the completed hold persists `packetSealState: 'opened'` server-side.
- On the next session, Io's line id matches the persisted seal state.

## Design pressure on the concept

The concept says Io remembers whether the player delivered the first sealed packet unopened. That is strong. The playable pressure should be: **I could open this, but I know I am doing it.**

The first action should create guilt, restraint, or curiosity through the player's hands. If the player later hears Io mention the seal, they should remember the 450 ms hold, not a menu selection.

## Recommendation

Keep the vertical slice choice exactly this small. Do not add a second mechanical fork until this one object feels right on a phone: inspect, hesitate, break or preserve, deliver, return, be remembered.
