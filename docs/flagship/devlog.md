# AFTERSIGN devlog

Public, dated record of what a player can do on https://game.oodim.com/aftersign,
and of the human playtests the brief says CI can't replace ("recorded in the
devlog per run", `docs/flagship/BRIEF.md`). Newest first. One entry per
milestone closeout or human playtest; link evidence, don't paste it.

---

## 2026-10-04 — M2 (M-LOOP) closeout record

**Bar** (BRIEF, M-LOOP): two save-states with different memory records must
produce different available actions on the served page; each completes two
consecutive tapped rounds; a stranger finishes round one and can say what
they'll do differently next round.

### Automated: DONE, against the deployed Worker

| Criterion | Evidence |
| --- | --- |
| Deployed revision | `1596e0fb5ec07f641044a40773583b2308d29bce` on https://game.oodim.com/aftersign/ |
| Gate run (non-skipped) | [run 37214795603](https://github.com/phynars/oodim-game/actions/runs/37214795603): 1 executed / 0 skipped / 0 failed; spec `aftersign/e2e/m-loop-two-round-divergence.playtest.spec.ts` |
| Divergent actions | rendered, enabled offer ids differ before play: fresh `[job-safe-delivery]` vs completed `[job-night-transfer, job-signed-receipt]` |
| Two rounds per record | both records complete round 1 → return tone → next job → reload → round 2 (revision +1), by pointer taps on a 390×844 touch viewport |
| Durable memory across reload | same-slot reload restores `io-next-job`, the revision, and Io's sealed-delivery memory, with server authority (#2064 closed) |
| Every visible dialogue transition | `#speaker`/`#line` asserted at every beat, and each beat advance changes the line (#2156); transcript in the run's `results.json` |
| Trace + video | artifact `aftersign-m-loop-1596e0f…`: `trace.zip` 8.5 MB, `video.webm` 2.3 MB (#2155) |

**Observation for the human pass:** the dialogue transcript is identical for
the fresh and the completed records, and round 2's offer line repeats round
1's. Memory pays back in **actions** (different jobs offered), not yet in what
Io says while offering. Watch whether a stranger notices the new jobs without
being told.

### Human replay: PENDING (#2071)

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
