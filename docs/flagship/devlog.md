# AFTERSIGN devlog

Public, dated record of what a player can do on https://game.oodim.com/aftersign,
and of the human playtests the brief says CI can't replace ("recorded in the
devlog per run", `docs/flagship/BRIEF.md`). Newest first. One entry per
milestone closeout or human playtest; link evidence, don't paste it.

---

## 2026-10-05 — Blind AI-stranger playtest #3 — NOT PASSED (three false memories)

**AI stranger — not a human.** A fresh agent got only the URL and played deployed
`909cd38` (after #2178 fixed #2174). **This is the first run at a real 390×844 touch
viewport.** It used a headless phone page (iPhone-13 profile, touch on) driven only by
screenshots and taps, by visible text or by screen position, with every command
logged. Nothing read the DOM state or `window.__game`.

**Replay answer (verbatim, written after round one):**
> "Next round I'll break the seal on the blue packet and take the riskier path,
> because Io kept telling me she'd remember which version of me touched the kiosk,
> and I want to see whether she actually reacts differently. I also want to try a
> blunt or evasive return instead of the kind one to test whether her tone toward me
> changes. Round one felt safe and a bit opaque — I want to know what the other
> branch costs."

**Verdict: NOT PASSED.** The operator checked each one against the screenshots.
- The replay answer is the strongest yet. The player named concrete choices to vary
  and why. In round 2 they saw the new jobs and Io's lines naming their past
  choices ("work I don't give strangers", "You brought it back whole last time").
- **Three false memories:**
  - **#2179:** the player chose *Lit stair*, then *Carry the fragile packet*, and Io
    said "You took the dark cut."
  - **#2180:** the player chose *Kind return*, and the recap said "You came back
    quiet", while the job board said "came back gentle".
  - **#2181:** in round 2, one tap on "Return to Io" committed *Blunt return*. #2178
    fixed only the round-1 path.

**Phone-only friction, non-blocking → #2182:**
- The second job ("Signed receipt") is clipped off-screen and can't be reached.
- The dialogue panel overflows the top of the screen.
- The "Offered jobs" text is squeezed into one-word columns.
- Each line is printed twice.

Other friction:
- The seal choice can't be revisited in round 2: there's no new breakable packet.
- The recap repeats the Saint Orra paragraph word for word.

**Next:** the loop fixes #2179–#2181, then playtest #4 on the same harness. Deadline
2026-10-11.

---

## 2026-10-04 — Blind AI-stranger playtest #2 — NOT PASSED (one false memory left)

**AI stranger — not a human.** A fresh agent was given only the URL and played
deployed `11aa3ef` (the gate was green; #2164–#2167 were fixed) by sight and
clicks. **Deviation again:** `resize_window(390, 844)` reported success three
times, but the viewport stayed 1451×840, so this run was also at desktop size.

**Replay answer (verbatim, written after round one):**
> "Next round I'd break the seal or take the riskier route. This round the
> 'delivery' was one button tap with no route to walk, so only the seal and two
> small choices mattered. Io did correctly remember that I skipped the
> acknowledgment and kept the seal, but 'Wanting is easier to route than
> pretending' answered a want I never said."

**Verdict: NOT PASSED. Closer than #1.**
- Playtest #1's false memories are gone. Io correctly remembered the kept seal
  and the skipped acknowledgment.
- In round 2 the player saw the two new jobs and Io's memory line naming them.
- One false memory remains: the player tapped **"Return to Io"**, then
  "Evasive return", and Io later said **"last time you told me straight."**
  Root cause: "Return to Io" and "Blunt return" are the same element, and the
  settle gate isn't stamped on the `return-to-io` path → **#2174**.

**Other friction** (not blocking):
- "Ask what changed" doesn't say what changed.
- Each Io line appears twice (big and small text).
- Delivery is one instant tap with no route to walk.
- Route Memory taps still gave no visible confirmation in this run.
- Dragging the scene closed the browser tab, probably a tooling issue.

**Next:** #2174 (loop), then playtest #3 at a real 390×844 viewport. The
browser tool can't resize here, so #3 drives a 390×844 headless page through
screenshot and tap-by-visible-text commands only. Deadline 2026-10-11.

---

## 2026-10-04 — Blind AI-stranger playtest #1 (M2 replay bar) — NOT PASSED

**AI stranger — not a human.** An agent was given only the URL, with no repo,
brief or hints, and played https://game.oodim.com/aftersign/ (deployed
`363bd7f`) by screenshots and clicks on visible controls only. Protocol: BRIEF
"M-LOOP closeout rules". **Deviation:** the phone viewport didn't apply
(resize failed), so this run was at desktop 1456×839.

**Replay answer (verbatim, written after round one):**
> "Honestly, I'm not sure. Next time I'd try breaking the seal (hold and
> pull), or the 'Cut past the bell rope' option, to see if Io reacts
> differently. I'd also actually walk with the joystick, because this round I
> delivered with a button and never moved. Io's lines did reflect my choices
> (sealed, waited for the route), but she also said I 'checked the kiosk
> twice', which I don't remember doing."

**Verdict: NOT PASSED.**
- It's partial: the player understood that choices are remembered and named
  choices to vary. It didn't name the payback (new jobs), which first appears
  at round 2's offer.
- Io stated memories the player didn't recognise, which blocks closeout:
  - "you beat the bell", when the player had chosen "Carry the fragile packet" (#2164);
  - "checked the kiosk twice", after the player tapped "Acknowledge route" (#2165).

**What round 2 showed:** Io: "You brought my blue seal back unbroken. That's
why the board shows Night transfer or Signed receipt now… And you came back
gentle with me last time." Two jobs instead of one. The player noticed the
change. But the red-tag / Saint Orra job handed out in round 1 was missing
from the board (#2166).

**Friction:**
- An instruction line overlaps the packet button.
- Route-memory buttons give no feedback (#2167).
- Round one took about 8 taps and 2–3 minutes. Nothing got stuck.

**Next:** fix #2164–#2167, then run blind playtest #2 at the 390×844 phone
viewport. Deadline 2026-10-11.

---

## 2026-10-04 — M2 (M-LOOP) closeout record

**Bar** (BRIEF, M-LOOP): two save-states with different memory records must
produce different available actions on the served page; each completes two
consecutive tapped rounds; a stranger finishes round one and can say what
they'll do differently next round.

### Automated: DONE, against the deployed Worker

| Criterion | Evidence |
| --- | --- |
| Deployed revision | `1596e0fb5ec07f641044a40773583b2308d29bce` (latest green: `363bd7f`) on https://game.oodim.com/aftersign/ |
| Gate run (non-skipped) | [run 37214795603](https://github.com/phynars/oodim-game/actions/runs/37214795603): 1 executed / 0 skipped / 0 failed; spec `aftersign/e2e/m-loop-two-round-divergence.playtest.spec.ts` |
| Divergent actions | rendered, enabled offer ids differ before play: fresh `[job-safe-delivery]` vs completed `[job-night-transfer, job-signed-receipt]` |
| Two rounds per record | both records complete round 1 → return tone → next job → reload → round 2 (revision +1), by pointer taps on a 390×844 touch viewport |
| Durable memory across reload | same-slot reload restores `io-next-job`, the revision, and Io's sealed-delivery memory, with server authority (#2064 closed) |
| Every visible dialogue transition | `#speaker`/`#line` asserted at every beat, and each beat advance changes the line (#2156); transcript in the run's `results.json` |
| Trace + video | artifact `aftersign-m-loop-1596e0f…`: `trace.zip` 8.5 MB, `video.webm` 2.3 MB (#2155) |

**Io now says what she remembers (#2158, deployed `363bd7f`,
[gate run](https://github.com/phynars/oodim-game/actions/runs/37217525381)
green).** At 1596e0f the dialogue was identical for both records, and round 2
repeated round 1's offer line, so memory paid back only in the buttons. Now
the offer line comes from the same derivation as the job tray:
- **Fresh:** "Keep it sealed if you want the city to trust you…" (unchanged).
- **Sealed delivery remembered:** "You brought my blue seal back unbroken.
  That's why the board shows Night transfer or Signed receipt now: work I don't
  give strangers. Pick one."
- **Next round:** the same line, plus how the player answered her on the way
  back (e.g. "And last time you told me straight…").

The gate asserts that the line differs by memory, names the offered jobs, and
changes from round 1 to round 2.

### Human replay: PENDING (#2071) — no longer a blocker (BRIEF, M-LOOP closeout rules); the blind AI-stranger playtest above is the bar

Protocol: a person who hasn't seen AFTERSIGN gets a physical phone with
https://game.oodim.com/aftersign open and no instructions. They play until Io
offers the next job. Then ask exactly one question: **"What will you do
differently next round?"** Write down their answer word for word, without
prompting or follow-up questions.

- Date / tester (first name or "stranger #N"):
- Device model, OS + browser version:
- Deployed revision (footer, or the latest #1819 gate comment):
- Round 1 completed without help? (y/n; where they got stuck):
- Tap-to-talk / drag-look / UI buttons: worked? (per interaction):
- **Unprompted replay answer (verbatim):**
- Did the answer name a memory-driven change (a new job, route or price)? (y/n):

M2 is DONE when this section is filled in and the answer names a
memory-driven change. If it doesn't, file the gap as one focused issue
against M2-E1. Don't close M2 on the automated evidence alone.
