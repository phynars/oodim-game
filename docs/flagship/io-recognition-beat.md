# AFTERSIGN — Io recognition beat feel spec

**Owner:** Diego Salcedo  
**Status:** Implementation-ready feel contract for vertical slice 1  
**Touchpoint:** Returning-session NPC recognition beat at Io's Night Post kiosk

## Purpose

When the player returns after the first packet delivery, Io should recognize the prior packet outcome in a way that feels authored, intimate, and physically legible before the player parses the line. The beat is short: a small camera breath, a sign response, one audio sting, and Io's remembered sentence.

The player should feel: **the city kept the receipt.**

## Trigger

The beat fires once per returning session when all conditions are true:

- the scene is Io's Night Post kiosk on the Silt Stair;
- the player has a durable memory record for the first blue packet;
- Io's returning-session greeting is about to display or play;
- the remembered packet outcome is either `sealed` or `opened`.

Do not fire this as a generic greeting flourish. It belongs only to the persistence proof.

## Timing contract

Total authored beat: **1,220ms** from trigger to full control return.

| Time | Layer | Spec |
| ---: | --- | --- |
| 0ms | Input | Soft-lock movement only; look input remains at 35% sensitivity so the player never feels frozen. |
| 0-120ms | Camera | Ease into recognition framing: dolly **0.32m** toward Io and yaw **4deg** toward the kiosk sign. Curve: `cubic-bezier(0.16, 1.0, 0.3, 1.0)` / ease-out back-loaded. |
| 80ms | Sign glow | Io's tram-car route plaque emits a moth-white pulse from **0.8x to 1.35x** emissive intensity over **140ms**. |
| 120ms | Audio | One bell/glass harmonic sting, **180ms** tail, mixed under rain ambience at **-9dB** relative to dialogue. |
| 160-260ms | Packet echo | Blue packet wax mark flashes once if sealed; if opened, the torn edge catches a thin red glint. Max duration **100ms**. |
| 260ms | Dialogue | Io's remembered line begins. Text reveal starts only after the sign pulse has peaked. |
| 260-920ms | Camera hold | Camera holds with subtle handheld drift no more than **0.015m** positional and **0.18deg** rotational amplitude. |
| 920-1,220ms | Return | Camera and input blend back to normal over **300ms** with `easeInOutSine`. |

## Branch-specific feel

### Packet delivered sealed

Io line from the concept:

> “You came back. So did the blue seal, unbroken. That gives me two facts to trust.”

Feel notes:

- Sign glow is warm-moth: `#F2E7C8` center, amber falloff.
- Packet flash should be whole and soft, like wax catching lantern light.
- Camera target lands slightly higher on Io's eyeline: trust feels like being met, not inspected.
- Audio sting uses a clean major second interval; no distortion.

### Packet opened

Io line from the concept:

> “You came back. The seal did not. I can use one of those facts.”

Feel notes:

- Sign glow starts moth-white, then thins to desaturated red at the packet edge.
- Packet flash should emphasize the broken seam, not punish the whole screen.
- Camera target lands **0.08m** lower and **2deg** more side-on than sealed, as if Io is checking the ledger before the face.
- Audio sting adds a muted wooden click **45ms** after the bell transient.

### Branch-effective camera math

The sealed values are the base; opened adds the "more side-on, slightly lower" offset. Both are authored feel targets — the harness bounds below are widened to a ±0.5° / ±0.04m tolerance around them so implementations can breathe without drifting between branches.

| Branch | Effective `cameraDeltaMeters` | Effective `cameraYawDegrees` | Vertical offset from sealed eyeline |
| --- | ---: | ---: | ---: |
| `sealed` | 0.32m (base) | 4deg (base) | 0m |
| `opened` | 0.32m (base) | 4deg + 2deg = **6deg** | -0.08m |

The `openedCameraLowerMeters` and `openedCameraSideYawDegrees` constants encode the *deltas*, not absolute values. The snapshot below reports the *branch-effective* result of applying them, so the two branches produce distinguishable numbers.

## Implementation constants

Use one named beat profile so gameplay, rendering, audio, and the harness share the same contract instead of copying timing numbers into separate systems.

```ts
export const IO_PACKET_RETURN_BEAT = {
  kind: "io_packet_return",
  totalMs: 1220,
  movementSoftLockMs: 1220,
  lookSensitivityScale: 0.35,
  cameraInMs: 120,
  cameraReturnMs: 300,
  cameraReturnStartsAtMs: 920,
  cameraDeltaMeters: 0.32,
  cameraYawDegrees: 4,
  openedCameraLowerMeters: 0.08,
  openedCameraSideYawDegrees: 2,
  signGlowStartsAtMs: 80,
  signGlowMs: 140,
  signGlowFrom: 0.8,
  signGlowTo: 1.35,
  audioStartsAtMs: 120,
  audioTailMs: 180,
  audioRelativeDb: -9,
  openedClickDelayMs: 45,
  packetEchoStartsAtMs: 160,
  packetEchoMs: 100,
  dialogueStartsAtMs: 260,
  dialogueAdvanceLockAfterLineStartMs: 500,
  handheldDriftMaxMeters: 0.015,
  handheldDriftMaxYawDegrees: 0.18,
  reducedMotionSignPulseMs: 160,
} as const;
```

## `window.__game` story-state contract

During and after the beat, expose a compact, serializable memory-beat record for the story harness. This is not renderer debug sludge; it is the public proof that the recognition moment matched durable story state.

**Snapshot semantics — branch-effective, not base.** `cameraDeltaMeters` and `cameraYawDegrees` in the snapshot always report the *final applied* values for the branch that ran, after `openedCameraLowerMeters` / `openedCameraSideYawDegrees` have been folded in. For a `sealed` outcome the snapshot yaw is `4`; for an `opened` outcome the snapshot yaw is `6` and the delta reflects any opened-branch vertical offset. This is what makes the two branches distinguishable to the harness — a snapshot that always echoed the base constants would erase the opened branch's camera cue.

```ts
type IoPacketReturnBeatSnapshot = {
  kind: "io_packet_return";
  currentNpcId: "io";
  outcome: "sealed" | "opened";
  durableMemoryId: string;
  lineId: "io_return_packet_sealed" | "io_return_packet_opened";
  startedAt: number;
  endedAt: number | null;
  inputLockMs: number;
  lookSensitivityScale: number;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  reducedMotion: boolean;
  signGlowColor: "warm_moth" | "moth_to_red";
  packetEcho: "whole_wax_flash" | "torn_edge_red_glint";
  audioCueId: "io_return_sealed_bell" | "io_return_opened_bell_click";
};
```

### Branch mapping

The branch mapping is deliberately tiny and hard-edged:

| Durable packet outcome | Line id | Sign glow | Packet echo | Audio cue |
| --- | --- | --- | --- | --- |
| `sealed` | `io_return_packet_sealed` | `warm_moth` | `whole_wax_flash` | `io_return_sealed_bell` |
| `opened` | `io_return_packet_opened` | `moth_to_red` | `torn_edge_red_glint` | `io_return_opened_bell_click` |

If any row is crossed — for example, `opened` with `io_return_packet_sealed` — the harness should fail even if the dialogue text itself is present.

## Interaction rules

- No full-screen modal, achievement toast, or HUD banner during this beat.
- Do not remove player agency longer than **1,220ms**.
- Dialogue advance is disabled until **500ms** after line start, then allowed.
- If the player is already inside a camera-blocking collision volume, skip the dolly and use yaw/framing only; never clip through kiosk geometry.
- If reduced-motion mode exists, replace dolly/yaw with a **160ms** sign pulse and audio sting only.

## Harness acceptance checks

The slice harness should be able to assert the beat without testing pixels exactly:

- `window.__game.story.currentNpcId === "io"` during the beat.
- `window.__game.story.memoryBeat.kind === "io_packet_return"`.
- `window.__game.story.memoryBeat.outcome` is `"sealed"` or `"opened"` and matches the durable server-backed memory record.
- `window.__game.story.memoryBeat.startedAt` and `endedAt` show a duration between **1,100ms and 1,350ms**.
- `window.__game.story.memoryBeat.cameraDeltaMeters` is between **0.28m and 0.36m** when reduced motion is off (both branches share the base dolly).
- `window.__game.story.memoryBeat.cameraYawDegrees` is branch-conditional when reduced motion is off:
  - `sealed` outcome: between **3.5deg and 4.5deg** (base 4deg ± 0.5deg tolerance).
  - `opened` outcome: between **5.5deg and 6.5deg** (base 4deg + 2deg side-on offset, ± 0.5deg tolerance).
- The opened branch's snapshot yaw must be strictly greater than the sealed branch's — i.e. `openedYaw - sealedYaw >= 1.5deg` — so the branch-effective difference is provable from the snapshot alone.
- `window.__game.story.memoryBeat.inputLockMs <= 1,220`.
- `window.__game.story.memoryBeat.lookSensitivityScale === 0.35` while movement is soft-locked.
- `window.__game.story.memoryBeat.lineId` is one of:
  - `io_return_packet_sealed`
  - `io_return_packet_opened`
- The line id must correspond to the same packet outcome; the harness should fail if Io says the sealed line after an opened-packet record or vice versa.
- The branch-specific cue ids must match the branch mapping table above.
- With reduced motion on, `cameraDeltaMeters === 0`, `cameraYawDegrees === 0`, and the sign/audio cues still fire.

## Implementation boundaries

This spec does not require final animation, voice acting, or exact authored camera splines. It defines the first shippable feel contract so implementation can use temporary geometry while preserving the timing, branch clarity, and memory correctness of the recognition beat.

## Review checklist

- The recognition beat is readable on a phone viewport without UI chrome.
- The player sees or hears the city respond before reading Io's line.
- Sealed and opened branches feel meaningfully different without moralizing through heavy-handed effects.
- The beat proves durable memory; it is not a local-only flourish.
- The whole gesture is under **1.35s** in harness timing.
