# AFTERSIGN — vertical slice script

**Owner:** June Hallow  
**Status:** Draft script for slice 1 implementation  
**Source:** `docs/flagship/concept.md`

## Purpose

This is the narrative source of truth for the first playable slice: Io's Night Post kiosk, the sealed blue packet, the sign box, and the returning-session recognition beat.

The scene proves the flagship promise in one small way: the player does something, leaves, returns, and Io names the thing they did without explaining the machinery behind it.

## Voice lock: Io Vale

Io is calm, exact, and dry. They do not comfort the player unless comfort is useful. They do not explain the memory system. They notice concrete actions and turn them into working facts.

Io's line shape:

- short sentences;
- physical nouns over abstractions;
- ledger logic: action noticed, action weighed, action put to use;
- no lore lecture before the player acts.

Avoid:

- “as you know” exposition;
- “I remember that you...” phrasing;
- affinity language such as trust points, reputation, bond, relationship level;
- jokes that make Io careless.

## Story-state keys this script expects

These names are script-facing and may be adjusted by Soren's harness contract, but the authored beats depend on these distinctions.

```ts
type IoFirstPacketOutcome = 'sealed' | 'opened';
type IoFirstRouteBehavior = 'listened' | 'skipped';
type IoReturnTone = 'kind' | 'evasive' | 'blunt';

interface IoSliceMemory {
  firstPacketOutcome?: IoFirstPacketOutcome;
  firstRouteBehavior?: IoFirstRouteBehavior;
  hasReturned?: boolean;
  returnTone?: IoReturnTone;
}
```

Harness bar: a returning-session line must reference the correct `firstPacketOutcome`. Route-behavior and return-tone lines are secondary variation, never substitutes for the packet memory proof.

## Scene beats

### 1. First arrival

**Trigger:** Player reaches Io's kiosk for the first time.

**Io:** “You made it above the water. Good. That is the first qualification.”

**Player response choices:**

- “I was sent here.”
- “I think I was.”
- “Do you know me?”

**Io response, any choice:** “No. That saves us both time.”

### 2. The job

**Io:** “Blue packet. Sign box with three moths painted on it.”

**Io:** “Keep the seal closed unless you want me to know you didn't.”

**Player response choices:**

- “What's inside?”
- “Who is it for?”
- “Fine.”

**Io if asked what's inside:** “Not yours yet.”

**Io if asked who it is for:** “A sign that still answers to paint.”

**Io if player says fine:** “Efficient. Suspicious, but efficient.”

### 3. Route instruction

**Trigger:** Player accepts the packet. Io offers route instructions. Player can stay in range long enough to hear them or leave early.

**Io full route line:** “Left stair, red string, brass bell. If the stair argues with you, trust the bell.”

**If player leaves before route completes:**

**Io:** “Or guess. The city enjoys that.”

Set `firstRouteBehavior = 'skipped'`.

**If player waits until route completes:**

Set `firstRouteBehavior = 'listened'`.

### 4. Packet inspection

**Trigger:** Player inspects the packet before delivery.

**Examine text, sealed:** “Blue wax. Tram ash in the fold. The packet is warm, as if it has been held too long by someone afraid to let go.”

**Interaction prompt, sealed:** “Break the seal” / “Leave it closed”

**If player breaks the seal:**

Set `firstPacketOutcome = 'opened'`.

**Examine text, opened:** “The wax gives with a soft crack. Inside: a blank card, except where your thumb touches it. One wet word appears, then dries before you can read it.”

**If player leaves it closed:**

Set `firstPacketOutcome = 'sealed'` when delivered unopened.

### 5. Sign box delivery

**Trigger:** Player reaches the sign box with three moths painted on it.

**Sign box, idle:** “Three painted moths circle a brass mouth. The mouth is shut.”

**Interaction prompt:** “Place packet”

**On delivery if sealed:**

**Sign box:** “The brass mouth opens just enough. Something inside rings once.”

**On delivery if opened:**

**Sign box:** “The brass mouth opens. No bell answers.”

### 6. First-session return to Io

**Trigger:** Player returns to Io after delivery in the same session.

**If delivered sealed:**

**Io:** “The bell rang. Good. The city prefers evidence to enthusiasm.”

**If delivered opened:**

**Io:** “No bell. So either the box lied, or you gave it something already spent.”

**Player response choices after opened:**

- “I had to know.”
- “It opened by accident.”
- “Does it matter?”

**Io if had to know:** “Curiosity is not a crime. It is an invoice.”

**Io if accident:** “Then you and accidents are already close.”

**Io if does it matter:** “Yes. Not always to you.”

**Player response choices after sealed:**

- “I didn't open it.”
- “You doubted me?”
- “What's next?”

**Io if didn't open it:** “I noticed. That is the point of sealed things.”

**Io if doubted me:** “I doubt stairs, weather, locks, and charming strangers. You are new enough to qualify.”

**Io if what's next:** “You come back later. That is where most couriers fail.”

Persist the authored memory sentence for the next session:

- sealed: “The blue seal came back whole.”
- opened: “The blue seal came back broken.”

### 7. Returning session recognition

**Trigger:** New session begins with durable Io memory present.

Packet outcome is the primary recognition line.

**If previous packet outcome was sealed:**

**Io:** “You came back. So did the blue seal, unbroken. That gives me two facts to trust.”

**If previous packet outcome was opened:**

**Io:** “You came back. The seal did not. I can use one of those facts.”

If there is no remembered packet outcome and no remembered route behavior:

**Io:** “You came back. Good. We can start from that.”

Optional route-behavior follow-up, only after the packet line:

**If player skipped route instructions:**

**Io:** “You found the box anyway. Next time, let me finish saving your life.”

**If player listened before leaving:**

**Io:** “You listened before you ran. Rare habit. Keep it.”

### 8. Return-tone choice

**Trigger:** After Io recognizes the prior packet outcome.

**Player response choices:**

- Kind: “I came back because you asked.”
- Evasive: “I needed work.”
- Blunt: “I want to know what was in it.”

**Io if kind:** “Careful. Say that too often and people will start handing you breakable things.”

**Io if evasive:** “Work is a clean word. We can use it until it stains.”

**Io if blunt:** “Good. Wanting is easier to route than pretending.”

Set `returnTone` from this choice for later episode use.

## UI copy for the slice

Use world-facing verbs where the UI can stay clear without sounding like a settings panel.

- New run: “Arrive”
- Continue run: “Return”
- Saving: “Remembering...”
- Saved: “Remembered”
- Loading: “Returning...”
- Packet sealed state: “Seal intact”
- Packet opened state: “Seal broken”

If these labels ever obscure player understanding on phone, clarity wins. The fallback is plain language, not cleverness.

## Implementation notes for writers and engineers

- Do not randomize the primary recognition line. The harness must be able to assert it.
- Secondary variation may branch by route behavior or return tone, but only after the packet outcome has landed.
- The player should act before the game explains aftersigns, the Night Post, or the broader forgetting.
- Io never says the system remembered. Io treats the remembered act as evidence.

## Acceptance checks

- A first-session sealed delivery produces the sealed same-session Io response and persists the sealed memory sentence.
- A first-session opened delivery produces the opened same-session Io response and persists the opened memory sentence.
- A returning session after sealed delivery displays: “You came back. So did the blue seal, unbroken. That gives me two facts to trust.”
- A returning session after opened delivery displays: “You came back. The seal did not. I can use one of those facts.”
- A returning-session line fails harness validation if it references the wrong packet outcome.
- Route-behavior lines never replace the packet outcome line.
