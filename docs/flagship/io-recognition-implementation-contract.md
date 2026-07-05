# AFTERSIGN — Io recognition implementation contract

**Owner:** Diego Salcedo  
**Status:** Implementation handoff for vertical slice 1  
**Refs:** #401  
**Touchpoint:** Returning-session recognition beat at Io's Night Post kiosk

## Goal

Ship the first AFTERSIGN memory proof as a tiny authored event, not a dialogue swap. When a returning player reaches Io after the blue-packet delivery, the game should expose a harness-readable beat that proves:

1. the memory exists durably;
2. Io chooses the correct branch for the remembered packet outcome;
3. the camera, sign, packet, audio, input lock, and line timing stay inside the feel budget.

The player-facing sensation is: **the city kept the receipt.**

## Beat id

Use one canonical kind for the event:

```ts
kind: "io_packet_return"
```

This beat is only for Io's returning-session packet recognition. Do not reuse it for generic greetings, first-session route instructions, or unrelated NPC barks.

## Trigger contract

Fire the beat once per returning session when all conditions are true:

- current scene is Io's Night Post kiosk on the Silt Stair;
- current NPC is Io;
- the server-backed player memory has a first-packet outcome;
- outcome is exactly `sealed` or `opened`;
- Io's returning-session greeting is about to begin;
- this session has not already consumed the `io_packet_return` beat.

If there is no durable packet outcome, do not fire the beat. A local-only value may hydrate presentation, but it must not be enough to satisfy the harness proof.

## Public story-state shape

Expose the active or most recent beat through `window.__game.story.memoryBeat` so the harness can assert the recognition moment without pixel inspection.

```ts
type IoPacketReturnMemoryBeat = {
  kind: "io_packet_return";
  npcId: "io";
  outcome: "sealed" | "opened";
  lineId: "io_return_packet_sealed" | "io_return_packet_opened";

  // Timing, in milliseconds from the same monotonic clock.
  startedAt: number;
  endedAt: number | null;
  durationMs: number | null;
  inputLockMs: number;
  dialogueAdvanceLockedUntilMs: number;

  // Camera values are authored targets, not exact rendered pixels.
  reducedMotion: boolean;
  cameraDeltaMeters: number;
  cameraYawDegrees: number;
  cameraHoldDriftMetersMax: number;
  cameraHoldDriftDegreesMax: number;

  // Branch-readable presentation facts.
  signGlowPalette: "warm_moth_amber" | "moth_to_thin_red";
  packetEcho: "whole_blue_wax_flash" | "torn_red_edge_glint";
  audioCue: "bell_glass_major_second" | "bell_glass_with_wood_click";
};
```

During the beat, also keep:

```ts
window.__game.story.currentNpcId === "io"
```

## Branch mapping

The branch map is strict. The harness should fail if outcome and line id do not match.

| Durable packet outcome | Required line id | Io line | Sign / packet / audio treatment |
| --- | --- | --- | --- |
| `sealed` | `io_return_packet_sealed` | “You came back. So did the blue seal, unbroken. That gives me two facts to trust.” | warm moth-white/amber sign pulse; whole blue wax flash; clean bell/glass major-second sting |
| `opened` | `io_return_packet_opened` | “You came back. The seal did not. I can use one of those facts.” | moth-white sign pulse thinning to desaturated red; torn-edge packet glint; bell/glass sting plus muted wooden click 45ms after transient |

## Timing constants

Use these numbers as the initial implementation constants. They are deliberately harness-friendly ranges, not frame-perfect animation demands.

```ts
const IO_PACKET_RETURN_BEAT = {
  totalMs: 1220,
  minHarnessDurationMs: 1100,
  maxHarnessDurationMs: 1350,

  inputSoftLockMs: 1220,
  lookSensitivityScaleDuringLock: 0.35,
  dialogueStartsAtMs: 260,
  dialogueAdvanceLockedUntilMs: 760, // 500ms after line start

  cameraInMs: 120,
  cameraDeltaMeters: 0.32,
  cameraYawDegrees: 4,
  cameraEaseIn: "cubic-bezier(0.16, 1.0, 0.3, 1.0)",
  cameraHoldStartMs: 260,
  cameraHoldEndMs: 920,
  cameraHoldDriftMetersMax: 0.015,
  cameraHoldDriftDegreesMax: 0.18,
  cameraReturnMs: 300,
  cameraReturnEase: "easeInOutSine",

  signGlowStartsAtMs: 80,
  signGlowDurationMs: 140,
  signGlowFromIntensity: 0.8,
  signGlowToIntensity: 1.35,

  audioStartsAtMs: 120,
  audioTailMs: 180,
  audioDialogueRelativeDb: -9,
  openedWoodClickDelayMs: 45,

  packetEchoStartsAtMs: 160,
  packetEchoMaxDurationMs: 100,
};
```

## Reduced-motion behavior

If reduced motion is enabled:

- do not dolly the camera;
- do not yaw the camera as an authored recognition move;
- use a 160ms sign pulse and the branch audio cue;
- keep the correct line id and durable outcome requirements;
- keep the same `kind`, `npcId`, `outcome`, and branch mapping;
- expose `reducedMotion: true`, `cameraDeltaMeters: 0`, and `cameraYawDegrees: 0`.

Reduced motion changes the physical camera gesture; it does not turn the beat into a generic text greeting.

## Input rules

- Movement is soft-locked for no more than 1,220ms.
- Look input remains enabled at 35% sensitivity during the soft lock.
- Dialogue advance remains disabled until 500ms after the remembered line begins.
- No full-screen modal, achievement toast, or HUD banner may appear during the beat.

## Camera collision fallback

If the player is already inside a camera-blocking volume when the beat triggers:

- skip the 0.32m dolly;
- keep yaw/framing if it does not clip;
- never push the camera through kiosk geometry;
- expose the actual authored camera values in `memoryBeat` so the harness can distinguish fallback from the normal path.

The normal non-reduced-motion path should remain the acceptance target: 0.24-0.36m camera delta and 3-5deg yaw.

## Harness acceptance checks

The first story harness for this beat should assert:

- `window.__game.story.currentNpcId === "io"` during the beat;
- `memoryBeat.kind === "io_packet_return"`;
- `memoryBeat.npcId === "io"`;
- `memoryBeat.outcome` is `sealed` or `opened`;
- `memoryBeat.outcome` matches the durable server-backed packet record;
- `memoryBeat.durationMs` lands between 1,100ms and 1,350ms once ended;
- `memoryBeat.inputLockMs <= 1220`;
- when `reducedMotion === false`, `cameraDeltaMeters` is between 0.24 and 0.36;
- when `reducedMotion === false`, `cameraYawDegrees` is between 3 and 5;
- `sealed` outcome requires `io_return_packet_sealed`;
- `opened` outcome requires `io_return_packet_opened`;
- the test fails if sealed memory produces the opened line;
- the test fails if opened memory produces the sealed line.

## Non-goals

- No final voice acting.
- No multi-NPC memory simulation.
- No city-wide procedural memory graph.
- No new branch beyond sealed/opened.
- No cinematic longer than the 1.35s harness ceiling.
- No desktop-only control assumption.

## Implementation note

This contract can be satisfied with temporary geometry if the scene still reads as AFTERSIGN: wet paper lantern noir, Io's tram-kiosk sign as the visual anchor, and a packet object whose sealed/opened state is visible before the text finishes explaining it.
