# AFTERSIGN playability review — Ivy

**Status:** CANONICAL for the vertical-slice packet action. Supersedes and replaces `docs/flagship/ivy-packet-action-review.md` (deleted in the same PR). Where the two disagreed, the numbers in **this** doc win.

**Scope:** gameplay-feel review of `docs/flagship/concept.md`, focused on the first vertical-slice action: receiving the sealed blue packet, choosing whether to preserve or open it, delivering it to the sign box, and returning to Io.

## What changed vs the earlier draft

Three headline feel numbers were revised after re-reading the concept against a phone-portrait target. Implementers should use these, not the old draft:

| Target | old draft | canonical (this doc) | why |
|---|---|---|---|
| hold-to-break threshold | 450 ms | **650–850 ms** | 450 ms is inside the range of a fumbled long-tap on mobile; the first moral action must not be reachable by accident. The 200 ms band lets tuning breathe without another spec revision. |
| pre-break feedback onset | 120 ms | **150 ms** | 120 ms lands during the tap-vs-hold ambiguity window and can read as a bug on a quick release. 150 ms sits cleanly after the OS long-press threshold. |
| recognition beat hard-control cap | 900 ms | **12 frames (~200 ms @ 60 fps)** | 900 ms of hard control theft is a cutscene, not a beat. Control-*softening* can extend across the full 1.2–1.8 s recognition, but full input lockout stays inside 12 frames. |

Everything else from the earlier draft — the state contract, the tap-cadence separation rule, the seal-must-be-physical stance — carries forward into the sections below.

## Read of the slice

The concept has the right spine for a playable first proof: one kiosk, one packet, one nearby delivery target, one remembered consequence. The risk is that the signature choice becomes menu trivia: a prompt that says **Open / Keep sealed** before the player has felt what the seal is, what breaking it costs, or how to act deliberately on touch.

The first action needs to feel like handling an object under trust, not selecting a branch.

## Player action contract

The packet choice should be expressed as physical input with commit friction:

1. **Receive** — Io places the sealed packet where the player can inspect it.
2. **Inspect** — the player can rotate/tilt the packet close enough to read the blue wax seal and destination mark.
3. **Preserve** — backing out or carrying the packet keeps the seal intact. This path is fast and quiet.
4. **Open** — breaking the seal requires a deliberate hold, not a tap. The player must see the wax stress before commit.
5. **Deliver** — the sign box accepts either packet state, but the insertion animation must make the state visible.
6. **Return** — Io's reaction references the state the player physically created.

## Feel targets

### Interaction radius

- Kiosk packet pickup: generous radius, about **1.8 m world-space** equivalent.
- Sign box delivery: tighter radius, about **1.2 m**, because delivery should require approaching the target.
- Interactables should expose a visible focus state within **1 frame** of crossing the radius.

### Preserve path

- One tap / confirm picks up the packet.
- No confirmation modal for keeping it sealed.
- The packet's blue seal remains visible on the carried object or HUD-diegetic hand view.
- Delivering sealed should take **< 600 ms** from confirm input to sign-box acceptance feedback.

### Open path

- Opening uses a hold-to-break interaction: **650–850 ms hold** before commit.
- During the hold, wax strain appears by **150 ms** and intensifies continuously.
- Cancel window remains open until commit: releasing before the threshold preserves the seal.
- Commit frame must be unmistakable: wax snap, tiny camera impulse, dry paper sound, and seal state flips in story state on the same simulation tick.
- Never bind opening to the same tap cadence as pickup/deliver. A nervous tap should not betray the player.

### Io recognition return

- Io's returning-session line should not fire at spawn. Give the player one beat of reorientation, then trigger when they re-enter kiosk focus.
- Recognition beat budget: **1.2–1.8 s** total control-softening, not a cutscene.
- Camera can push in gently for **300–450 ms**, but player look/move input should not be fully stolen longer than **12 frames**.
- The first audible recognition sting should land within **100 ms** of the line starting.

## Harness assertions worth owning early

These are gameplay-feel regressions, not just story flags:

- `packetSealState` starts as `sealed` when Io hands over the packet.
- A tap shorter than the open threshold leaves `packetSealState === "sealed"`.
- A completed hold flips `packetSealState === "opened"` on the same tick that the open animation commits.
- Delivering the packet records the delivered state, not just `deliveryComplete`.
- On a returning session, Io's selected line matches the persisted delivered seal state.
- Recognition beat does not lock movement/look input beyond the allowed frame window.

## Playability risks

### Risk: the choice is too abstract

If the player only sees a dialogue option, the remembered line feels like the game remembering a menu click. The packet needs to be a handled object with a visible seal state.

### Risk: opening is accidental

If opening is tap-based, the player can misfire the flagship's first moral action. That is player-breaking for trust even if it is technically functional.

### Risk: the route instruction competes with the choice

Io can remember whether the player listened, but slice 1 should not overload the first minute. The route-listening memory should be passive telemetry for later, not a second obvious fork beside the seal.

### Risk: recognition steals control

The concept asks for a gentle push-in. Good. Keep it short. The player should feel noticed, not trapped.

## Recommended slice acceptance wording

Add this to the vertical-slice definition before implementation issues are cut:

> The sealed-packet fork is physical and deliberate: preserving requires no extra modal choice, opening requires a cancelable 650–850 ms hold with visible wax strain, and the harness proves short taps cannot open the packet. Io's returning-session line must reference the persisted delivered seal state, and the recognition beat must not fully lock player input for more than 12 frames.

## Bottom line

AFTERSIGN's first mechanic works if the player feels the weight of the seal before the game asks them to break it. Make the seal visible, make opening deliberate, and make Io's memory land only after the player has acted with their hands.
