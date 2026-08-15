import { describe, expect, it } from "vitest";

import { AFTERSIGN_IO_LINES, buildIoMemorySentence } from "../ioVoiceContract";
import { MEMORY_RECALL_FEEL } from "../memoryRecallFeel";
import { AFTERSIGN_MEMORY_RECALL_GLINT_FEEL } from "../memoryRecallGlintFeel";
import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_KIOSK_SCENE_FEEL,
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignPacketChoice,
} from "../verticalSliceState";
import "./bootWindowGame";

// #918: this file carries the ONLY assertion the aftersign vitest lane runs
// in CI today. It is deliberately isolated from the pre-existing
// `../durableSave.contract.test.ts` (and the other ~22 sibling test files)
// because those have never been executed in CI (they lived under
// `continue-on-error: true` since #836) and an unknown subset is red on
// drift. Widening the lane's `include` back to the full glob is tracked in
// #841 — until then, this file is the whole surface of the blocking lane.
describe("Aftersign window.__game harness (#918)", () => {
  // Public-surface guard for the `../verticalSliceState` barrel. The three
  // feel constants (`AFTERSIGN_KIOSK_SCENE_FEEL`,
  // `AFTERSIGN_IO_RECOGNITION_FEEL`, `AFTERSIGN_INTERACTION_CONFIRM_FEEL`)
  // are re-exported from the barrel but are not otherwise touched by the
  // boot-through-harness assertions below. Folding the assertion here —
  // rather than a standalone `*.consumer.test.ts` at the aftersign root —
  // is deliberate: the aftersign vitest lane pins
  // `include: ["harness/windowGameHarnessBoot.test.ts"]` (see
  // `../vitest.config.ts`), so any test file placed outside `harness/`
  // never runs in CI. Widening the glob is gated by the #841 drift
  // triage. Co-locating the surface guard with the boot test keeps the
  // barrel exports consumed by something CI actually executes.
  it("re-exports the vertical-slice feel contracts from a single barrel", () => {
    expect(AFTERSIGN_KIOSK_SCENE_FEEL).toEqual(expect.any(Object));
    expect(AFTERSIGN_IO_RECOGNITION_FEEL).toEqual(expect.any(Object));
    expect(AFTERSIGN_INTERACTION_CONFIRM_FEEL).toEqual(expect.any(Object));
  });

  it("boots window.__game and projects durable Io memory through the harness surface", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    expect(game?.version).toBe(1);

    const payload = encodeAftersignDurableSave(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
      ),
      7,
    );

    game?.restoreDurableSave(payload);
    game?.meetNpc("io");

    expect(game?.getStoryState()).toMatchObject({
      story: {
        beat: "io-remembers-sealed-packet",
      },
      state: {
        npcs: [
          {
            id: "io",
            disposition: "recognizes-player",
            memory: {
              recognizesPlayer: true,
              packetOutcome: "sealed",
            },
          },
        ],
      },
    });
  });

  it("projects durable Orra recognition through the story/state snapshot", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const savedAtTurn = 17;
    const payload = encodeAftersignDurableSave(
      meetOrraForAftersignSlice(createAftersignVerticalSliceState()),
      savedAtTurn,
    );

    game?.restoreDurableSave(payload);
    game?.meetNpc("orra");

    const snapshot = game?.getStoryState();
    const orraNpc = Array.isArray(snapshot?.state.npcs)
      ? snapshot!.state.npcs.find((npc) => npc?.id === "orra")
      : null;

    expect(snapshot).toMatchObject({
      story: {
        beat: expect.any(String),
      },
      state: {
        save: {
          key: "aftersign.verticalSlice.v1",
          savedAtTurn,
        },
      },
    });
    expect(orraNpc).toMatchObject({
      id: "orra",
      disposition: "recognizes-player",
      memory: {
        recognizesPlayer: true,
      },
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("keeps durable save metadata visible after restored story progression", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const savedAtTurn = 31;
    const payload = encodeAftersignDurableSave(
      meetIoForAftersignSlice(
        recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
      ),
      savedAtTurn,
    );

    game?.restoreDurableSave(payload);
    game?.meetNpc("io");
    game?.meetNpc("orra");

    expect(game?.getStoryState()).toMatchObject({
      story: {
        // With orraRecognizesPlayer=false and orraAction=null, the
        // resolver falls through orra branches and lands on the io
        // recognition beat driven by the restored sealed packet.
        beat: "io-remembers-sealed-packet",
      },
      state: {
        save: {
          key: "aftersign.verticalSlice.v1",
          savedAtTurn,
        },
      },
    });
    expect(JSON.parse(JSON.stringify(game?.getStoryState()))).toEqual(game?.getStoryState());
  });

  it("round-trips the served-page snapshot verbs through durable save/load", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    expect(game?.getSnapshot).toEqual(expect.any(Function));
    expect(game?.save).toEqual(expect.any(Function));
    expect(game?.load).toEqual(expect.any(Function));

    // Seed the harness with a state that HAS a committed sealed
    // packet + prior Io meeting, so the round-trip actually reaches
    // the "io-remembers-sealed-packet" beat the assertion below pins.
    // Prior draft (#1148) restored a fresh state, called meetNpc("io")
    // twice, then asserted the sealed-recognition beat — but a fresh
    // state has `packetOutcome: null`, so the beat resolver falls
    // through to "io-first-meeting" regardless of ioRecognizesPlayer.
    // That never held; the aftersign vitest lane just wasn't triggered
    // for #1148 because the paths-filter only watches `aftersign/**`,
    // not `apps/web/src/aftersign/**`. This PR touches
    // `aftersign/e2e/**`, which DOES trip the lane, so the pre-existing
    // red surfaces here.
    const seedState = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    game?.restoreDurableSave(encodeAftersignDurableSave(seedState, 4));
    game?.meetNpc("io");

    const savedPayload = game!.save();
    expect(typeof savedPayload).toBe("string");

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    expect(game?.getSnapshot().story.beat).not.toBe("io-remembers-sealed-packet");

    game?.load(savedPayload);
    game?.meetNpc("io");

    expect(game?.getSnapshot()).toMatchObject({
      story: {
        beat: "io-remembers-sealed-packet",
      },
      state: {
        save: {
          key: "aftersign.verticalSlice.v1",
        },
        npcs: [
          {
            id: "io",
            disposition: "recognizes-player",
            memory: {
              recognizesPlayer: true,
              packetOutcome: "sealed",
            },
          },
        ],
      },
    });
    // `save()` uses the harness's monotonic turn counter; asserting a
    // literal value here would be fragile against test ordering. Guard
    // the SHAPE (positive safe integer) instead.
    const roundTrippedTurn = game?.getSnapshot().state.save?.savedAtTurn;
    expect(Number.isSafeInteger(roundTrippedTurn)).toBe(true);
    expect((roundTrippedTurn ?? 0) > 0).toBe(true);
    expect(JSON.parse(JSON.stringify(game?.getSnapshot()))).toEqual(game?.getSnapshot());
  });

  // Consumer wiring for the memory-recall feel envelope (PR #1020
  // follow-up). `getMemoryRecallFeel` used to live only inside its
  // sibling contract test — an unconsumed pure module. It is now wired
  // into `bootWindowGame.ts` so `window.__game.recallFeel(elapsedMs)`
  // samples the envelope keyed off the recognition trigger captured
  // when `meetNpc` promotes a previously-met NPC to `recognizes-player`.
  // These assertions run in the aftersign blocking lane, so the wiring
  // is guarded end-to-end.
  it("fires the memory-recall envelope only on the second meet (recognition transition)", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // First contact: no durable memory, no recall trigger.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.meetNpc("io");
    expect(game?.getRecallTrigger()).toBeNull();
    expect(game?.recallFeel({ elapsedMs: 120 })).toBeNull();

    // Return session: Io has already met the player, so this meet
    // promotes her to `recognizes-player`. That transition fires the
    // recall trigger, and `recallFeel` samples the shared envelope.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        9,
      ),
    );
    game?.meetNpc("io");

    const trigger = game?.getRecallTrigger();
    expect(trigger?.npcId).toBe("io");
    expect(typeof trigger?.firedAtMs).toBe("number");

    const recognition = game?.recallFeel({ elapsedMs: MEMORY_RECALL_FEEL.recognizeMs });
    expect(recognition?.phase).toBe("recognize");
    expect(recognition?.captionOpacity).toBeCloseTo(1, 5);
    expect(recognition?.haloScale).toBeCloseTo(MEMORY_RECALL_FEEL.haloScalePeak, 5);

    const held = game?.recallFeel({ elapsedMs: MEMORY_RECALL_FEEL.durationMs });
    expect(held?.phase).toBe("held");
    expect(held?.captionOpacity).toBeCloseTo(0, 5);
  });

  // Player-visible feel contract for the FIRST *returning* Io recognition
  // beat, driven through the shipped `AftersignWindowGameHarness`. This
  // block used to live as a Playwright e2e (`aftersign/e2e/
  // io-recognition-player-visible-feel.spec.ts`) that drove
  // `window.__game.meetNpc('io')` on the served `/aftersign/` page. That
  // never worked: the served page loads `aftersign/main.js`, which
  // publishes its own `window.__game` (input.choose/getSnapshot/forceSave/
  // forceReload) — none of the four methods the spec calls
  // (meetNpc, recallFeel, getRecallTrigger, getStoryState) exist on the
  // shipped surface. `bootAftersignWindowGame` is only bundled by this
  // vitest file (see servedSurface.contract.test.ts:12 / main.js is a
  // hand-authored, separate surface). The e2e spec's own guard returned
  // `{ok:false}` and failed on the first assertion.
  //
  // Moved here (per PR #1048 REQUEST_CHANGES — reviewer's Path B) so the
  // journey runs against the in-memory harness where the surface actually
  // exists. The three semantically-meaningful additions over the
  // pre-existing recall assertions above:
  //   1. TWO meets from a fresh state (no durable-save shortcut) — locks
  //      in that first contact does NOT arm a trigger; only the
  //      recognition transition does. The earlier tests reach recognition
  //      via `restoreDurableSave(meetIoForAftersignSlice(...))`, which
  //      hides the `meetNpc → meetNpc` transition path.
  //   2. Four frame samples covering all four phases (dormant / recognize
  //      peak / mid-settle / tail-of-held), with the bounded numeric
  //      constants from `MEMORY_RECALL_FEEL` as assertion ceilings.
  //   3. First-frame haptic (12 ms at t=8) and reduced-motion delta
  //      confirming the yaw & haptic contract from a single trigger.
  //
  // `getStoryState` shape guard: `state.npcs.find(id==='io').memory
  // .recognizesPlayer` — matches `windowGameSurface.ts:54-90`, NOT the
  // top-level `story.io.recognizesPlayer` an earlier draft assumed.
  it("locks in the returning Io recognition beat feel envelope via the harness surface", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Start from a truly fresh slice so we exercise the meetNpc→meetNpc
    // recognition transition (rather than the durable-save shortcut used
    // by the other tests in this file).
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );

    // Step 1: first contact — no trigger arms, recallFeel is null.
    game?.meetNpc("io");
    expect(game?.getRecallTrigger()).toBeNull();
    expect(game?.recallFeel({ elapsedMs: 100 })).toBeNull();

    // Step 2: return meet — the `!prev.recognizes && next.recognizes`
    // transition arms the recall trigger for Io.
    game?.meetNpc("io");
    const returnTrigger = game?.getRecallTrigger();
    expect(returnTrigger).not.toBeNull();
    expect(returnTrigger?.npcId).toBe("io");
    expect(typeof returnTrigger?.firedAtMs).toBe("number");
    expect(Number.isFinite(returnTrigger?.firedAtMs ?? NaN)).toBe(true);

    // Story-state reflects that Io recognizes the player — path via
    // `state.npcs.find(id==='io').memory.recognizesPlayer`.
    const snapshot = game?.getStoryState();
    const ioNpc = Array.isArray(snapshot?.state.npcs)
      ? snapshot!.state.npcs.find((npc) => npc?.id === "io")
      : null;
    expect(ioNpc?.memory.recognizesPlayer).toBe(true);

    // Step 3: sample the envelope at four semantically-meaningful points
    // inside the 760 ms duration.
    const atZero = game?.recallFeel({ elapsedMs: 0 });
    const atRecognizePeak = game?.recallFeel({ elapsedMs: 220 }); // end of recognize
    const atSettle = game?.recallFeel({ elapsedMs: 380 }); // middle of settle
    const atHeldEnd = game?.recallFeel({ elapsedMs: 760 }); // tail of held

    // Dormant frame at t=0: nothing has moved yet.
    expect(atZero?.phase).toBe("dormant");
    expect(atZero?.captionLiftPx).toBe(0);
    expect(atZero?.cameraYawDeg).toBe(0);
    expect(atZero?.haloScale).toBe(1);

    // End of the recognize sub-phase: peak entrance energy.
    expect(atRecognizePeak?.phase).toBe("recognize");
    expect(atRecognizePeak?.captionOpacity).toBeGreaterThan(0.9);
    expect(atRecognizePeak?.hapticMs).toBe(0); // haptic only fires in the first ~16ms

    // Mid-settle: caption lift real but bounded by the feel constant.
    expect(atSettle?.phase).toBe("settle");
    expect(atSettle!.captionLiftPx).toBeGreaterThan(0);
    expect(atSettle!.captionLiftPx).toBeLessThanOrEqual(
      MEMORY_RECALL_FEEL.captionLiftPx,
    );
    expect(Math.abs(atSettle!.cameraYawDeg)).toBeLessThanOrEqual(
      MEMORY_RECALL_FEEL.cameraYawDeg,
    );
    expect(atSettle!.haloScale).toBeGreaterThan(1);
    expect(atSettle!.haloScale).toBeLessThanOrEqual(
      MEMORY_RECALL_FEEL.haloScalePeak,
    );

    // Tail of held: the beat is winding down; caption & halo fade to 0.
    expect(atHeldEnd?.phase).toBe("held");
    expect(atHeldEnd!.captionOpacity).toBeLessThanOrEqual(0.05);
    expect(atHeldEnd!.haloOpacity).toBeLessThanOrEqual(0.05);

    // First-frame haptic: 12 ms tap, fires only inside the first ~16 ms.
    const firstFrame = game?.recallFeel({ elapsedMs: 8 });
    expect(firstFrame?.hapticMs).toBe(MEMORY_RECALL_FEEL.hapticMs);

    // Reduced-motion contract: yaw trimmed, haptic suppressed.
    const reducedMotionFrame = game?.recallFeel({ elapsedMs: 8, reducedMotion: true });
    expect(reducedMotionFrame?.hapticMs).toBe(0);
    expect(Math.abs(reducedMotionFrame!.cameraYawDeg)).toBeLessThan(
      Math.abs(firstFrame!.cameraYawDeg) + 1e-6,
    );
  });

  // Consumer wiring for the glint sub-envelope (#1069 review): the
  // shimmer must reach the harness surface, not sit as an unconsumed
  // pure module. `frame.glint` is composited by
  // `getMemoryRecallFeel`, so any harness caller that already samples
  // `recallFeel({elapsedMs})` gets the shimmer for free — and this
  // assertion pins that wiring end-to-end in the blocking lane.
  //
  // Sanity checks:
  //   1. The glint's duration & camera-yaw ceiling equal the base beat's
  //      — one source of truth, no drift.
  //   2. At the peak-visible instant (glintLead + half the remaining
  //      window), opacity and bloomLift ride the shimmer's ceiling.
  //   3. At durationMs the shimmer has resolved (opacity, bloom, duck,
  //      yaw all zero) — the beat leaves no leftover motion.
  it("composes the recall glint sub-envelope through the harness recall frame", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        5,
      ),
    );
    game?.meetNpc("io");

    // (1) Duration & camera-yaw ceiling equal the wired beat.
    expect(AFTERSIGN_MEMORY_RECALL_GLINT_FEEL.durationMs).toBe(
      MEMORY_RECALL_FEEL.durationMs,
    );
    expect(AFTERSIGN_MEMORY_RECALL_GLINT_FEEL.cameraYawDegrees).toBeCloseTo(
      MEMORY_RECALL_FEEL.cameraYawDeg,
      5,
    );

    // (2) Peak-visible: glintLead + half the remaining window.
    const peakMs =
      AFTERSIGN_MEMORY_RECALL_GLINT_FEEL.glintLeadMs +
      (AFTERSIGN_MEMORY_RECALL_GLINT_FEEL.durationMs -
        AFTERSIGN_MEMORY_RECALL_GLINT_FEEL.glintLeadMs) /
        2;
    const peakFrame = game?.recallFeel({ elapsedMs: peakMs });
    expect(peakFrame?.glint).toBeDefined();
    expect(peakFrame!.glint.glintProgress).toBeCloseTo(0.5, 5);
    expect(peakFrame!.glint.opacity).toBeCloseTo(
      AFTERSIGN_MEMORY_RECALL_GLINT_FEEL.maxOpacity,
      3,
    );
    expect(peakFrame!.glint.bloomLift).toBeCloseTo(
      AFTERSIGN_MEMORY_RECALL_GLINT_FEEL.bloomLift,
      3,
    );
    expect(peakFrame!.glint.audioDuckDb).toBe(0);

    // (3) At durationMs the shimmer has fully resolved.
    const tailFrame = game?.recallFeel({ elapsedMs: MEMORY_RECALL_FEEL.durationMs });
    expect(tailFrame?.glint.progress).toBe(1);
    expect(tailFrame?.glint.opacity).toBe(0);
    expect(tailFrame?.glint.bloomLift).toBe(0);
    expect(tailFrame?.glint.audioDuckDb).toBe(0);
    expect(tailFrame?.glint.cameraYawDegrees).toBe(0);
    expect(tailFrame?.glint.cameraDollyCm).toBe(0);
  });

  it("honours reducedMotion when sampling the recall envelope through the harness", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        3,
      ),
    );
    game?.meetNpc("io");

    const full = game?.recallFeel({ elapsedMs: MEMORY_RECALL_FEEL.recognizeMs });
    const reduced = game?.recallFeel({
      elapsedMs: MEMORY_RECALL_FEEL.recognizeMs,
      reducedMotion: true,
    });

    expect(full).not.toBeNull();
    expect(reduced).not.toBeNull();
    expect(reduced!.captionLiftPx).toBeLessThan(full!.captionLiftPx);
    expect(reduced!.cameraYawDeg).toBeLessThan(full!.cameraYawDeg);
    expect(reduced!.hapticMs).toBe(0);
  });

  // Consumer wiring for the Io VOICE contract (#1131 review): the
  // `ioVoiceContract.ts` selectors had only test consumers on the
  // prior submission, so the reviewer's "no runtime surface" grep
  // was correct. `windowGameSurface.ts` now composes them into a
  // live `ioDialogue.memoryThread` field on the shipped snapshot,
  // and the harness exposes `setIoReturnReason` so a caller can
  // exercise the full three-line thread through `getStoryState()`.
  //
  // This assertion runs in the aftersign blocking lane, so the
  // wiring is guarded end-to-end — if a future refactor unwires
  // `ioPacketReturnLine` / `buildIoReturnMemoryThread` /
  // `ioReturnReasonLine` from the surface, THIS test goes red.
  it("projects the Io voice contract memory thread through the harness surface", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    // Sealed-packet return, no return-reason committed yet: the
    // single-line packetReturn memory is present (contract's
    // `ioPacketReturnLine` picked the sealed line), and the full
    // three-line `thread` is intentionally omitted because the
    // return-reason posture hasn't been recorded.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        11,
      ),
    );
    game?.meetNpc("io");

    const sealedSnapshot = game?.getStoryState();
    const sealedThread = sealedSnapshot?.story.ioDialogue.memoryThread;
    expect(sealedThread?.packetReturn).toBe(
      buildIoMemorySentence(AFTERSIGN_IO_LINES.sealedReturn),
    );
    expect(sealedThread?.thread).toBeUndefined();

    // Setting a return-reason activates the full three-line thread
    // via `buildIoReturnMemoryThread`. Default harness route is
    // `listenedToRoute: false` (see HARNESS_PLAYER), so route
    // memory reads "skipped". Reason "blunt" hits `ioReturnReasonLine`.
    game?.setIoReturnReason("blunt");
    const bluntSnapshot = game?.getStoryState();
    const bluntThread = bluntSnapshot?.story.ioDialogue.memoryThread;
    expect(bluntThread?.packetReturn).toBe(
      buildIoMemorySentence(AFTERSIGN_IO_LINES.sealedReturn),
    );
    expect(bluntThread?.thread).toEqual([
      buildIoMemorySentence(AFTERSIGN_IO_LINES.routeSkipped),
      buildIoMemorySentence(AFTERSIGN_IO_LINES.sealedReturn),
      buildIoMemorySentence(AFTERSIGN_IO_LINES.bluntReturn),
    ]);

    // Snapshot must still be JSON-serialisable — memory sentences
    // are plain strings, so a `window.__game` consumer can render
    // them without importing the contract module.
    expect(JSON.parse(JSON.stringify(bluntSnapshot))).toEqual(bluntSnapshot);

    // Clearing the reason drops the thread back to the single-line
    // shape; the harness state model is honest about what it knows.
    game?.setIoReturnReason(null);
    const clearedThread = game?.getStoryState().story.ioDialogue.memoryThread;
    expect(clearedThread?.thread).toBeUndefined();
    expect(clearedThread?.packetReturn).toBe(
      buildIoMemorySentence(AFTERSIGN_IO_LINES.sealedReturn),
    );

    // Fresh state (no committed packet) has no memoryThread at all —
    // the surface only emits it when there's an actual memory to name.
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    expect(game?.getStoryState().story.ioDialogue.memoryThread).toBeUndefined();
  });

  // M-CONTINUE extent (return-tone-choice → io-next-job) — the two
  // beat IDs live in `AftersignStoryBeatId` (windowGameSurface.ts:35-36)
  // but nothing derives them and no harness verb advances the state
  // into them. Landing a real assertion here requires three coupled
  // landings, already tracked:
  //   • #1198 — `AftersignVerticalSliceState` gains the `returnTone` +
  //     `nextJobAccepted` axes with encoder round-trip coverage.
  //   • #1199 — served-page choice handlers (`choose-return-tone`,
  //     `ask-for-next-job`) advance those axes and drive the beat
  //     transitions.
  //   • #1200 — flip this `it.todo` to a live `it(...)` once the two
  //     handlers exist and `bootWindowGame.ts` exposes the harness
  //     verbs (`chooseReturnTone(tone)`, `acceptNextJob()`).
  // Kept as a failing-first todo (not a green assertion) so the
  // aftersign blocking lane stays honest about what has actually
  // shipped. See PR #1207 review for the wiring gap this pins.
  it.todo(
    "M-CONTINUE extent: chooseReturnTone → return-tone-choice → acceptNextJob → io-next-job beats through the harness (see #1198, #1199, #1200)",
  );
});
