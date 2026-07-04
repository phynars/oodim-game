# AFTERSIGN — flagship concept

**Owner:** Mara Okonkwo  
**Status:** Draft for crew review  
**Mandate:** Original story-first 3D game for the web, built in three.js, with persistent AI characters who remember each player across sessions.

## Title

**AFTERSIGN**

A sign is the mark a person leaves behind after the world forgets their name. In this game, the player becomes the person who reads those marks — and the one whose own marks begin to change the city.

## Logline

In a drowned, lantern-lit vertical city where memory is stored in living street signs, a courier with no past delivers messages between people who are slowly being erased — and every character remembers what the player chose to carry, hide, repair, or abandon across sessions.

## Player fantasy

You are not the chosen one. You are the only person people trust to cross the city after dark.

The first ten minutes should make the player feel three things:

1. **I am small in a beautiful place that has rules.**
2. **This person remembers me, and that changes what they say.**
3. **What I choose to deliver will matter later, even if I close the tab.**

## World

### The city: Vey

Vey is a coastal city built upward after the lower districts flooded. Its streets are stacked bridges, fire escapes, shrine roofs, tram cables, water towers, and market decks. At night, signs wake up: not neon billboards, but carved plaques, paper charms, canal buoys, window glyphs, and shop lanterns that whisper fragments of the people who made them.

The city does not have reliable archives. It has **aftersigns**: physical objects that hold the residue of a promise, debt, secret, route, name, or grief. A sign can remember a person more faithfully than another person can.

### The forgetting

Every week, parts of Vey lose continuity. A shopkeeper forgets why they locked a room. A bridge forgets which side it should connect to. A family shrine forgets one child's name. The city keeps functioning because couriers carry confirmations between signs and people.

The player joins the **Night Post**, a small courier guild that moves after dusk when the signs are legible.

### Core locations for Episode 1

- **The Silt Stair:** a vertical market rising from floodwater, wet stone, tarps, paper lanterns, pulley baskets.
- **The Bell Archive:** a suspended records hall where bells ring when someone is remembered correctly.
- **Moth Pier:** a foggy dock of light traps, tide engines, and boats whose names have been scratched out.
- **The Unlit Door:** a sealed apartment landing that appears only when someone lies about what they remember.

## Signature mechanic: characters who remember

The game is built around persistent, server-authoritative character memory. NPCs do not merely expose a journal flag; they speak from a compact memory record of the player's prior actions, tone, promises, failures, and returns.

### Memory principles

- **Specific beats beat generic affinity.** “You brought the blue packet back unopened” is stronger than “trust +5.”
- **NPC memory changes play.** A remembered action opens, closes, softens, or reframes an interaction.
- **Memory must be auditable.** The harness should be able to assert what an NPC is allowed to remember and whether a line references the right prior event.
- **Forgetting is also authored.** Some characters remember too much; some remember only the wrong thing; some ask the player to let a memory die.

### What the system stores per player

For the vertical slice, store only what the scene needs:

- durable player id;
- completed delivery ids;
- delivery outcome: delivered / opened / withheld / returned;
- NPC trust posture for the slice NPC;
- one authored memory sentence the NPC can reference on the next session;
- last-seen timestamp bucket, used only for greeting variation.

No sprawling simulation in slice 1. One scene. One remembering NPC. One durable proof.

## Core loop

1. **Receive a delivery** from a person, sign, or place.
2. **Read the route** through visible environmental signs.
3. **Move through a compact 3D space**: climb, cross, inspect, listen, choose.
4. **Decide what to do with the message**: deliver, open, delay, alter context, or return.
5. **Face the remembered consequence** when an NPC recognizes what the player did in a later session.

The story loop is the gameplay loop: carrying information through a city where information is alive.

## Cast

### Io Vale — Night Post dispatcher

**Role:** The player's anchor and first remembering NPC. Io runs the Night Post from a kiosk built into a broken tram car above the Silt Stair.

**Surface:** Calm, dry humor, never wastes words. Keeps a kettle on even when there is no tea left.

**Need:** Io wants proof that the player can be trusted with things that are not theirs.

**What Io remembers about the player:**

- whether the player delivered the first sealed packet unopened;
- whether the player returned after closing the game;
- whether the player listened to the route instructions or skipped away;
- whether the player chose a kind, evasive, or blunt answer when asked why they came back.

**Example returning-session line:**

> “You came back. Good. And before you ask — yes, I noticed the blue seal was still whole.”

If the player opened it:

> “You came back. That is worth something. The broken seal is also worth something. We will talk about both.”

### Saint Orra — the sign over the old pharmacy

**Role:** A living sign, half saint icon and half store plaque, who remembers illnesses people tried to hide.

**Surface:** Warm, fussy, overfamiliar. Calls everyone by names they have not used in years.

**Need:** Orra wants the player to carry a name to someone who has paid to forget it.

**What Orra remembers about the player:**

- whether the player touched the sign gently or struck it to make it speak;
- whether the player agreed to carry a name without asking who it would hurt;
- whether the player previously lied to protect someone.

### Niko Thread — rival courier

**Role:** The player’s mirror: fast, charming, careless, already known in every district.

**Surface:** Smiles first, apologizes late. Makes competition feel like friendship until something breaks.

**Need:** Niko wants to beat the player because being second means being forgotten.

**What Niko remembers about the player:**

- whether the player took the safe route or risky route;
- whether the player helped Niko after a fall;
- whether the player accepted a shortcut that cost someone else time.

### Maud Underbell — archive keeper

**Role:** Gatekeeper of the Bell Archive and moral pressure point for Episode 1.

**Surface:** Severe, exact, exhausted. Hears lies as off-key bells.

**Need:** Maud wants the city preserved even if individual people suffer.

**What Maud remembers about the player:**

- whether the player corrected a false record;
- whether the player concealed a compassionate lie;
- which name the player chose to ring in the archive.

### The Unaddressed Child

**Role:** A recurring figure who appears near wrong doors and missing staircases.

**Surface:** Direct, eerie, not cute. Asks questions adults avoid.

**Need:** Unknown in Episode 1.

**What the child remembers about the player:**

- whether the player admits not knowing something;
- whether the player follows when called;
- whether the player has delivered a message to someone who did not want it.

## Act structure

### Act I — The Seal

The player arrives at the Night Post with no reliable memory of why they came. Io gives them a sealed blue packet and a short route across the Silt Stair. The player learns how to read environmental signs, move through the first compact scene, and make the first trust choice: deliver the packet unopened or break the seal.

**End beat:** Io reacts to the state of the packet. The game writes the player memory record.

### Act II — The Name That Hurts

The city introduces the cost of remembering. Saint Orra asks the player to carry a forgotten name to Maud Underbell. Niko offers a faster route and a reason not to trust Io. The player learns that every delivery has a beneficiary and a victim.

**End beat:** A bell rings for the wrong name, and one district light goes out.

### Act III — The Door That Lies

The Unlit Door appears. The player must choose whether to preserve an official memory, protect a private lie, or create a new sign that makes both people remember the player's intervention.

**End beat:** The first episode closes with an NPC recalling the player's first-session behavior in a way that changes the final conversation.

## Vertical slice definition

### Slice promise

One beautiful, finished 3D scene where Io remembers the player across sessions.

### Scope

- **Scene:** Io's Night Post kiosk on the Silt Stair at night.
- **Player action:** receive a sealed blue packet, inspect the kiosk, choose whether to open or keep the packet sealed, deliver it to a nearby sign box, return to Io.
- **Persistence beat:** close/reopen or start a second session; Io greets the player with a line that correctly references the prior packet outcome.
- **State:** server-authoritative save keyed to durable player identity.
- **Harness:** headless WebGL test exposes `window.__game` story state and asserts the memory round-trip.
- **Visual bar:** authored lighting, fog, wet surfaces, emissive signs, postprocessing, generated texture pass, phone viewport supported.
- **Audio bar:** ambient rain/water, sign hum, packet interaction, Io recognition sting.

### Done means

- The scene is playable on a mid-range phone target at 60fps budget.
- Io has at least two returning-session memory lines: sealed and opened.
- The persisted memory cannot be faked by only changing local storage.
- The harness can fail if Io references the wrong prior action.
- The scene has no placeholder cube aesthetic: even temporary geometry follows the art direction.

## Art direction

### Visual phrase

**Wet paper lantern noir.**

The game should look contemporary, not nostalgic: stylized realism with strong silhouettes, fog depth, soft emissive color, reflective wet materials, and readable interactables.

### Palette

- Deep water blacks and blue-greens for distance.
- Warm amber lanterns for safety.
- Desaturated red string and wax for promises, warnings, and sealed messages.
- Pale moth-white for supernatural memory events.

### Materials

- Wet stone, lacquered wood, waxed paper, oxidized brass, rope, ceramic tile, dark water.
- Signs should feel handmade: carved, painted, folded, stitched, repaired.

### Camera

Third-person, close and slightly above shoulder for navigation; gentle push-in for recognition beats. Touch-first movement with a small, readable interaction radius. Avoid cinematic control theft except for very short authored beats.

### UI

Diegetic where possible: route marks glow on signs, packet seal state is visible on the object, memory confirmations appear as brief bell/light responses rather than large modal text. Menus stay minimal and legible on phone.

## Narrative design rules

- The player must act before the game explains too much.
- Every remembered line must point to a concrete prior player action.
- Do not write “as you know” exposition. Let objects and routes teach the world.
- A choice is only real if at least one character later treats it as real.
- Keep the first slice intimate. One kiosk can prove the whole game.

## Open review questions for the crew

- **June:** sharpen Io's voice and the first returning-session lines until they are unforgettable without becoming overwritten.
- **Soren:** define the smallest `window.__game` story-state contract that proves Io's memory is server-backed.
- **Ivy:** pressure-test the first action: opening or preserving the packet must feel intentional, not like menu trivia.
- **Diego:** specify the recognition beat: camera, timing, sting, sign glow, and haptic-scale visual feedback.

## Non-goals for slice 1

- No city-wide procedural memory simulation.
- No combat.
- No branching episode tree beyond the first authored memory fork.
- No multi-NPC AI chat in the first slice.
- No desktop-first controls that are later patched for mobile.

## Why this can be remembered

AFTERSIGN gives the studio one clear proof: a player returns, and a character says something only that character could know because of what the player did before. If that moment lands, the flagship has a soul. Everything else earns its place by serving that beat.
