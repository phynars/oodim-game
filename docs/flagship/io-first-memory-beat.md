# Io Vale — first memory beat

**Status:** Draft for crew review  
**Owner:** June Hallow  
**Source:** `docs/flagship/concept.md` vertical slice: Io's Night Post kiosk, sealed blue packet, second-session recognition.

## Purpose

This beat proves AFTERSIGN in one minute: the player does a small thing, leaves, returns, and Io names it like evidence.

No tutorial line should say "persistent memory." Io is the proof.

## Scene spine

1. The player arrives at Io's kiosk above the Silt Stair.
2. Io gives the player a sealed blue packet and a short route to the sign box.
3. The player may listen or walk away early.
4. The player may keep the packet sealed or open it.
5. The player places the packet in the sign box and returns.
6. Io closes the first session with a ledger line.
7. On a later session, Io greets the player with the remembered outcome.

## Io voice rules for this beat

- Short sentences. No lore lecture.
- Dry humor only when it sharpens danger.
- Io never explains how remembering works.
- Every memory line must include a concrete object or action: seal, box, route, return.
- Io weighs the player. Io does not flatter them.

## First arrival

### Trigger

Player approaches the kiosk for the first time.

### Line

> "You made it above the water. Good. That is the first qualification."

### If the player waits

> "Second qualification is moving when told. We will test that now."

### Packet handoff

> "Blue packet. Sign box with three moths painted on it. Keep the seal closed unless you want me to know you didn't."

### Route instruction

> "Left stair, red string, brass bell. If the stair argues with you, trust the bell."

### If the player listens through the full route

> "There. Now run before the rain edits the directions."

### If the player leaves before Io finishes

> "Fine. Learn loudly."

## Packet interaction copy

### Inspect sealed packet

> The blue wax is warm, as if someone has just taken their thumb away.

### Open prompt

> Break the seal

### Keep prompt

> Leave it closed

### If opened

> The wax gives with a small, guilty sound.

### If left closed

> The seal holds. For now, so do you.

## Sign box delivery

### Sign box inspect

> Three moths are painted on the lid. Their wings have been repaired in different hands.

### Deliver sealed

> The box accepts the packet without a sound. The moths brighten once.

### Deliver opened

> The box accepts the packet. One painted moth goes dark.

## First-session return to Io

### If delivered sealed

> "Closed seal. Correct box. You can follow a route without feeding it your fingerprints. Useful."

### If delivered opened

> "Correct box. Broken seal. Curiosity is not a crime. It is an invoice."

### If route was listened to

> "You let me finish. That saves time later. Sometimes blood."

### If route was skipped

> "You found it anyway. Next time, let me finish saving your life."

## Returning-session recognition

### Shared opener

> "Back again. Vey keeps odd hours for people it means to use."

### If sealed last session

> "The blue seal came back whole with you. Two arrivals. Both noted."

### If opened last session

> "You came back. The seal did not. I can still use one of those facts."

### If listened last session

> "You listened before you ran. Rare habit. Keep it."

### If skipped last session

> "You skipped the route and survived. Try not to mistake that for a method."

## Harness-facing intent

The line selected on return must be driven by persisted story state, not local presentation state.

Minimum authored memory keys this beat expects:

- `io.firstPacketOutcome`: `sealed` or `opened`
- `io.firstRouteBehavior`: `listened` or `skipped`
- `io.hasReturned`: `true` after a later session begins with prior Io memory

The harness should fail if Io says a sealed-packet line after `opened`, or an opened-packet line after `sealed`.

## Cut lines

These are rejected because they explain the mechanic instead of proving it:

- "I remember what you did last time."
- "Your choices persist here."
- "The city stores memories in signs."
- "Trust increased."

## Review questions

- Does Io feel severe enough without becoming cold?
- Does the opened-packet path feel like consequence, not punishment?
- Are the prompts plain enough for mobile without losing the world's voice?
- Which single returning line should be the vertical-slice trailer moment?
