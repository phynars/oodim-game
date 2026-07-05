# AFTERSIGN — Io Vale voice bible

**Owner:** June Hallow  
**Status:** Draft for implementation and crew review  
**Source:** `docs/flagship/concept.md` and the slice script direction for Io's Night Post kiosk.

## Purpose

Io is the first proof that AFTERSIGN remembers.

The player should not feel a system flag flip. They should feel a tired dispatcher look at one small fact they thought the city missed, write it into the ledger, and decide what it makes them worth.

## Core read

Io Vale runs the Night Post from a broken tram-car kiosk above the Silt Stair. They are the player's anchor and first remembering NPC.

Io wants proof that the player can be trusted with things that are not theirs.

They speak with calm pressure: dry, exact, unsentimental until sentiment becomes operational.

## Voice rules

### Io says less than they know

Io notices everything. They do not narrate everything.

Use one concrete noun instead of a paragraph of explanation.

- Better: “Blue seal. Unbroken.”
- Worse: “I can see that you successfully resisted the temptation to open the packet.”

### Memory is evidence

Io does not say “I remember you.” Io names the evidence.

- packet seal;
- bell rung or not rung;
- route listened to or skipped;
- player returned or did not;
- answer given when asked why they came back.

### Ledger logic, human wound

Io weighs actions like entries in a ledger, but the ledger exists because the city is dying.

The line can be funny. The line can be sharp. Under it, there should be need.

### No tutorial voice

Io can instruct a route. Io cannot become a help overlay.

If a line only exists to explain the mechanic, cut it or give it to the object, sound, light, or harness.

### No grand poetry

Vey can be strange. Io should not perform strangeness.

Io's job is to keep couriers alive, not decorate the rain.

## Diction

### Favors

- facts;
- seals;
- bells;
- routes;
- debts;
- receipts;
- proof;
- names only when necessary;
- short sentences with hard turns.

### Avoids

- destiny;
- “as you know” exposition;
- overt praise;
- therapy language;
- “the system remembered” phrasing;
- lore speeches;
- soft fantasy abstraction.

## Rhythm

Io usually speaks in one to three short beats.

Pattern:

1. name the observable fact;
2. assign consequence;
3. if needed, add a dry edge.

Example:

> “Seal's whole. Bell rang. That is almost a person.”

## First-arrival lines

Use on a new player/session before the first packet choice.

### Arrival

> “You made it above the water. Good. That is the first qualification.”

### Kiosk orientation

> “Night Post is this window, that kettle, and whoever is still foolish enough to knock.”

### Player asks who Io is

> “Io Vale. Dispatcher. If I do my job well, you keep breathing and blame the stairs.”

### Player asks what happened to them

> “You arrived with no parcel and no useful memory. Vey accepts one of those conditions.”

## Blue packet handoff

### Assignment

> “Blue packet. Sign box with three moths painted on it.”

### Seal warning

> “Keep the seal closed unless you want me to know you didn't.”

### Route instruction

> “Left stair, red string, brass bell. If the stair argues with you, trust the bell.”

### Player tries to leave early

> “Fast is not the same as oriented.”

### Player waits/listens

> “Good. Listening saves more couriers than bravery. Bravery gets better songs.”

## Packet inspection copy

These are not menu labels for a generic inventory. They should feel like the packet is an object in Io's world.

### Sealed state

> “Seal intact.”

### Open prompt

> “Break the seal.”

### Keep prompt

> “Leave it closed.”

### Opened state

> “Seal broken.”

### After opening

> “The wax gives with a soft crack. Somewhere below, a bell decides not to ring.”

## Same-session Io response

Use when the player returns to Io after placing or attempting to place the packet.

### Delivered sealed

> “Bell rang. Seal held. The city prefers evidence to enthusiasm.”

### Delivered opened

> “Bell rang late. Broken wax travels slower.”

### Failed delivery / wrong box

> “No bell. Either the box lied, or you gave it something already spent.”

### Player admits opening it

> “Useful. Not clean, but useful.”

### Player lies about opening it

> “Try that on someone without a bell.”

### Player says nothing

> “Silence is a kind of answer. Usually an expensive one.”

## Returning-session recognition

The first returning line must always reference the persisted packet outcome before any softer variation. That is the story proof.

### Prior packet delivered sealed

> “You came back. So did the blue seal, unbroken. That gives me two facts to trust.”

Alternate:

> “Blue seal held. You returned. I am trying not to make a habit of optimism.”

### Prior packet opened

> “You came back. The seal did not. I can use one of those facts.”

Alternate:

> “Broken wax, same face. Good. We can start with honesty, even if it arrived late.”

### Prior route listened

Use only after the packet outcome line has landed.

> “You listened before you ran. Rare habit. Keep it.”

### Prior route skipped

Use only after the packet outcome line has landed.

> “You found the box anyway. Next time, let me finish saving your life.”

## Return-tone branch

After Io names the concrete remembered act, the player may answer why they came back.

### Player: kind answer

Prompt:

> “Someone has to carry what stays.”

Io response:

> “Careful. That sentence can become a job.”

### Player: evasive answer

Prompt:

> “I was nearby.”

Io response:

> “No one is nearby after dark. But you are here.”

### Player: blunt answer

Prompt:

> “I need work.”

Io response:

> “Clean motive. Rare enough.”

## UI copy posture

Use world verbs where possible.

- New run: **Arrive**
- Continue run: **Return**
- Loading: **Returning...**
- Saving: **Remembering...**
- Saved: **Remembered**
- Packet sealed: **Seal intact**
- Packet opened: **Seal broken**

## Harness-facing acceptance notes

The harness should be able to fail if Io's returning-session line references the wrong packet outcome.

Minimum authored assertions for Io copy:

- if prior outcome is sealed, the rendered Io line includes the blue seal returning whole/unbroken;
- if prior outcome is opened, the rendered Io line includes the seal not returning or broken wax;
- route-behavior variation must not replace the packet-outcome line;
- return-tone variation must not replace the packet-outcome line.

## Cut list

Do not ship lines like these:

- “I remember that you delivered the packet sealed.”
- “Your trust score has increased.”
- “The city stores memories in aftersigns, and this is one of them.”
- “Welcome back, courier. Your previous choices matter.”

If the line could appear in a generic branching dialogue demo, it does not belong to Io.
