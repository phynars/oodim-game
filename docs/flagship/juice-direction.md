# AFTERSIGN juice direction — memory recognition beats

**Owner:** Diego Salcedo  
**Status:** Slice-1 feel spec  
**Applies to:** Io returning-session recognition beat in `docs/flagship/concept.md`

The flagship's signature mechanic is not only that an NPC remembers a prior player action; it is that the player's body notices the room change when the memory lands. Memory should read as social contact, not as a database lookup.

## Tactile pillars

### 1. Recognition: "Io saw what I did"

A correct remembered line gets a small authored focus envelope: the camera, scene light, ambience, and input timing all acknowledge the same 50ms window.

Recognition should feel like Io briefly has the player's full attention, not like a cutscene stealing control. The player stays oriented and can continue immediately after the line begins.

### 2. Trust change: "The relationship moved"

Trust changes should be readable even before the UI explains them.

- Positive trust: warmer lantern response, softer audio transient, and a tiny forward camera bias.
- Negative trust: cooler sign reflection, shorter bell tail, and a held mid-distance composition.
- Neutral/complicated trust: split cue — warm Io key light, cold sign rim — so the moment can say "good that you returned, bad that you broke the seal."

Trust feedback must never imply a binary morality score. It marks posture: open, guarded, impressed, disappointed, or conflicted.

### 3. Memory recall: "The world can replay a mark"

When the player inspects an aftersign or hears a remembered action echoed, the cue should originate in-world first: sign glow, bell tremor, paper movement, rain duck, then optional UI text.

The recall stack should use pale moth-white and amber, not achievement-green. The game is confirming continuity, not awarding points.

### 4. Failure and repair: "I can come back from this"

When the NPC remembers a harmful or failed action, the sting should be precise, not punitive.

- No long hitstop, no full-screen red flash, no failure modal.
- Use a short dry bell, small camera non-settle, and cooler lighting.
- Always leave a repair affordance visible within 1.0s: a reply option, object highlight, route mark, or Io line that implies the relationship can still move.

Failure memory should tighten the chest for a breath, then put the player's hand back on the door.

## Slice-1 recognition envelope: Io remembers the packet

Trigger: second session greeting begins and Io references the prior sealed-packet outcome.

### Timing budget

All primary channels start inside the same **50ms recognition window** measured from the first audible/visible frame of the remembered line.

| Channel | Spec |
| --- | --- |
| Camera settle | 180ms `easeOutCubic`; max 3.5deg yaw correction; max 0.25m dolly toward Io |
| Dialogue/input hold | Input advance is ignored for 2 frames after the memory line starts |
| Vignette/focus | Rise to 0.18 opacity over 120ms; decay to 0 over 420ms |
| Ambience duck | -2.5dB for 350ms total; 40ms attack; 310ms release |
| Io key-light kiss | +8% warm intensity for 180ms; decay over 300ms |
| Sign shimmer | Pale moth-white shimmer on the packet/sign prop for 24 frames, exponential alpha decay ×0.86/frame |
| Recognition sting | One soft bell partial + paper tick, peak under dialogue, starts inside the same 50ms window as camera/vignette/duck |

### Easing definitions

```ts
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
```

Camera settle uses ease-out cubic so the attention shift arrives quickly and then breathes into place. Vignette rise is linear for clarity; vignette decay is ease-out cubic so the scene releases softly instead of popping off.

### Variant mapping

#### Packet sealed

Io line tone: dry approval.  
Feel: warm trust, intact promise.

- Camera uses full settle envelope.
- Bell tail is clean and round, 280ms tail.
- Wax/blue-packet sign shimmer reaches 100% of configured intensity.
- Io key light warms by +8%.

#### Packet opened

Io line tone: restrained disappointment plus continued interest.  
Feel: the return matters, but the breach matters too.

- Camera yaw correction caps at 2.0deg, dolly caps at 0.12m.
- Bell transient is shorter, 160ms tail, with a dry paper tick.
- Wax/sign shimmer reaches 70% intensity and splits pale-white edge + cool-blue interior.
- Io key light warms by only +3%; sign rim cools by +6% for 300ms.

## Repeat-memory restraint

The same remembered fact must not fire at full ceremony twice in one session.

If Io references the same packet memory again before a new session starts:

- skip camera settle entirely;
- reduce vignette peak from 0.18 to at most 0.072;
- reduce shimmer/focus intensity by at least 60%;
- skip ambience duck unless a new trust posture changes in the same line;
- allow input advance immediately, with no 2-frame hold.

Rule of thumb: first recall is a hand on the shoulder; second recall is eye contact.

## Deterministic harness acceptance

Expose the recognition envelope through the story-state harness rather than testing pixels.

A passing headless slice test should be able to:

1. seed a durable player identity with the first packet outcome;
2. start a returning session;
3. trigger Io's first remembered greeting;
4. read `window.__game` or the equivalent harness surface for the active recognition channels;
5. assert all primary channels begin within the same 50ms window:
   - camera settle active and target offset <= 3.5deg yaw, <= 0.25m dolly;
   - vignette/focus envelope active with peak opacity 0.18;
   - ambience duck active at -2.5dB with 40ms attack and 310ms release;
6. trigger a second reference to the same packet memory in the same session;
7. assert repeat restraint:
   - no camera settle;
   - shimmer/focus intensity <= 40% of first-trigger intensity;
   - vignette peak <= 0.072.

The harness does not need to know the renderer's bloom math. It needs to prove that story memory and feedback choreography are coupled, deterministic, and regressible.

## Reduced-motion and accessibility

Reduced-motion mode keeps the social information and removes the bodily shove.

- Camera settle becomes a static composition cut capped at 1 frame, with no dolly animation.
- Vignette peak caps at 0.09.
- Ambience duck and bell/paper sting remain, because they carry recognition meaning.
- Repeat restraint still applies.

No memory beat may rely on color alone. The line text, audio cue, and object response must each independently imply that Io remembered a concrete prior action.
