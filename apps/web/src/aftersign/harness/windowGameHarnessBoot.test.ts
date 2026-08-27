import { describe, expect, it, vi } from "vitest";

import { AFTERSIGN_IO_LINES, buildIoMemorySentence } from "../ioVoiceContract";
import { MEMORY_RECALL_FEEL } from "../memoryRecallFeel";
import { AFTERSIGN_MEMORY_RECALL_GLINT_FEEL } from "../memoryRecallGlintFeel";
import { AFTERSIGN_NEXT_JOB_OFFER_FEEL } from "../nextJobOfferFeel";
import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_KIOSK_SCENE_FEEL,
  AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
  meetOrraForAftersignSlice,
  recordAftersignPacketChoice,
} from "../verticalSliceState";
import {
  AFTERSIGN_ASK_FOR_NEXT_JOB,
  AFTERSIGN_CHOOSE_RETURN_TONE,
} from "../issue1199ChoiceHandlers";
import {
  IO_NEXT_JOB_HANDOFF,
  getIoReturnToneReply,
} from "../story/ioContinueBeats";
import {
  COMPLETED_JOB_IDS,
  SAFE_DEFAULT_JOB_ID,
  selectIoJobOffers,
} from "../../../../../packages/aftersign/src/computeOfferedJobs";
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

  // Consumer wiring for the canonical structured offer selector. The
  // shipped surface publishes `IoJobOffer[]` at `story.offeredJobs`; the
  // legacy-named harness getter reads that same array without stripping
  // metadata.
  it("projects structured IoJobOffer values through story.offeredJobs and getOfferedJobIds", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.setPlayerMemory(null);

    const freshOffers = selectIoJobOffers();
    const freshSnapshot = game?.getStoryState();
    expect(freshSnapshot?.story.offeredJobs).toEqual(freshOffers);
    expect(game?.getOfferedJobIds()).toEqual(freshOffers);
    expect(freshSnapshot?.story.offeredJobs[0]).toMatchObject({ id: SAFE_DEFAULT_JOB_ID });

    game?.setPlayerMemory({ playerName: "Returning Player", interactionCount: 2 });

    const returningOffers = selectIoJobOffers({ priorOutcome: "completed" });
    const returningSnapshot = game?.getStoryState();
    expect(returningSnapshot?.story.offeredJobs).toEqual(returningOffers);
    expect(game?.getOfferedJobIds()).toEqual(returningOffers);
    expect(returningSnapshot?.story.offeredJobs.map((offer) => offer.id)).toEqual([
      ...COMPLETED_JOB_IDS,
    ]);
    expect(returningSnapshot?.story.offeredJobs).not.toEqual(freshOffers);

    const firstRead = game!.getOfferedJobIds();
    firstRead.pop();
    expect(game?.getOfferedJobIds()).toEqual(returningOffers);

    expect(JSON.parse(JSON.stringify(returningSnapshot))).toEqual(
      returningSnapshot,
    );

    game?.setPlayerMemory(null);
    expect(game?.getOfferedJobIds()).toEqual(freshOffers);
  });

  it("handles choose-return-tone and ask-for-next-job through input.choose", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    expect(game?.input.choose).toEqual(expect.any(Function));

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        13,
      ),
    );
    game?.meetNpc("io");

    expect(game?.getSnapshot().story.beat).toBe("io-remembers-sealed-packet");

    // M-CONTINUE-E2: strike a posture BEFORE choosing, so the tone the
    // player picked flows through `setIoReturnReason` → durable
    // `rememberedTone` → `getIoContinueBeats` → the shipped-surface
    // reply LINE. The line source is `story/ioContinueBeats.ts`
    // (verbatim from `docs/flagship/vertical-slice-script.md §8`),
    // read here via `getIoReturnToneReply` so the test tracks the
    // canonical module — no local copy drift.
    game?.setIoReturnReason("kind");
    expect(() => game?.input.choose(AFTERSIGN_CHOOSE_RETURN_TONE)).not.toThrow();
    expect(game?.getSnapshot().story.beat).toBe("return-tone-choice");
    expect(game?.getSnapshot().story.completedBeats).toContain("return-tone-choice");

    const replyBeat = game?.getIoContinueBeats()?.[0];
    expect(replyBeat?.line).toBe(getIoReturnToneReply("kind"));

    expect(() => game?.input.choose(AFTERSIGN_ASK_FOR_NEXT_JOB)).not.toThrow();
    expect(game?.getSnapshot().story.beat).toBe("io-next-job");
    expect(game?.getSnapshot().story.completedBeats).toContain("io-next-job");

    const handoffBeat = game?.getIoContinueBeats()?.[1];
    expect(handoffBeat?.line).toBe(IO_NEXT_JOB_HANDOFF.line);

    // M-CONTINUE-E2 durability: save the session AFTER the next-job
    // ask, then restore to a fresh state and reload. The tone axis
    // (`rememberedTone`) must round-trip — the reply LINE resolves
    // to "kind" again — while `hasAskedForNextJob` deliberately does
    // NOT persist, landing the player back at `return-tone-choice`
    // so they re-ask Io each session.
    const savedPayload = game?.save();
    expect(typeof savedPayload).toBe("string");

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.load(savedPayload!);
    // A durable-save restore intentionally lands `ioRecognizesPlayer:
    // false` — the player re-meets Io each session to trigger the
    // recall beat. `meetNpc("io")` on a state where
    // `ioHasMetPlayer === true` (persisted) flips recognition true,
    // gating the beat resolver back into the return-tone-choice /
    // io-next-job branch.
    game?.meetNpc("io");
    // `setIoReturnReason` state lives in the harness closure, not the
    // durable envelope — clear it so the reply LINE assertion below
    // proves the tone came from `rememberedTone` restored on the
    // runtime state, not from the still-armed closure token.
    game?.setIoReturnReason(null);
    // Re-arm the harness closure so `getIoContinueBeats()` (which is
    // gated on `ioReturnReason`) returns a beat sequence at all — the
    // *content* of that sequence is what we're asserting.
    game?.setIoReturnReason("kind");

    expect(game?.getSnapshot().story.beat).toBe("return-tone-choice");
    expect(game?.getSnapshot().story.completedBeats).toContain("return-tone-choice");
    expect(game?.getSnapshot().story.completedBeats).not.toContain("io-next-job");
    expect(game?.getIoContinueBeats()?.[0].line).toBe(getIoReturnToneReply("kind"));
  });

  // Consumer wiring for the next-job offer feel envelope (#1255 review).
  // `nextJobOfferFeel.ts` was landing as a pure module with no caller —
  // exactly the "unconsumed module" pattern this file's other feel
  // assertions (recallFeel, glint, applied return-tone feel) exist to
  // prevent. This assertion drives the DOCUMENTED trigger — the
  // `io-next-job` line appearing via `input.choose("ask-for-next-job")`,
  // NOT `acceptNextJob()` — and pins the envelope's phases on either
  // side of the gate. If a refactor unwires `getAftersignNextJobOfferFeel`
  // from the harness surface OR re-couples the gate to the accept beat,
  // THIS test goes red in the blocking lane.
  it("fires the next-job offer feel envelope on ask-for-next-job (io-next-job line trigger)", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    expect(game?.nextJobOfferFeel).toEqual(expect.any(Function));

    // Fresh state, then walk to the `return-tone-choice` beat so
    // `ask-for-next-job` is legal (recordAftersignNextJobRequest guards
    // against skipping return-tone).
    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        21,
      ),
    );
    game?.meetNpc("io");
    game?.input.choose(AFTERSIGN_CHOOSE_RETURN_TONE);

    // Before the `io-next-job` line has been triggered, the feel is
    // dormant — the offer envelope is what the player sees the MOMENT
    // Io produces the red tag, not before. Accepting the job later
    // would be a separate confirm beat, not this envelope.
    expect(game?.nextJobOfferFeel({ elapsedMs: 0 })).toBeNull();
    expect(game?.nextJobOfferFeel({ elapsedMs: 200 })).toBeNull();

    // Trigger the `io-next-job` line — this is the DOCUMENTED gate
    // for the offer envelope.
    game?.input.choose(AFTERSIGN_ASK_FOR_NEXT_JOB);
    expect(game?.getSnapshot().story.beat).toBe("io-next-job");

    // Idle frame at t=0 — envelope is armed but hasn't moved yet.
    const atZero = game?.nextJobOfferFeel({ elapsedMs: 0 });
    expect(atZero).not.toBeNull();
    expect(atZero?.phase).toBe("idle");
    expect(atZero?.cameraPushMeters).toBe(0);
    expect(atZero?.cardLiftPx).toBe(0);
    expect(atZero?.cardScale).toBe(1);
    expect(atZero?.hapticMs).toBe(0);
    expect(atZero?.progress).toBe(0);

    // First frame inside the wake sub-phase — haptic tap fires in the
    // first ~8% of the wake window (per the feel module's wake gate).
    const firstFrame = game?.nextJobOfferFeel({
      elapsedMs: Math.max(1, AFTERSIGN_NEXT_JOB_OFFER_FEEL.wakeMs * 0.04),
    });
    expect(firstFrame?.phase).toBe("wake");
    expect(firstFrame?.hapticMs).toBe(AFTERSIGN_NEXT_JOB_OFFER_FEEL.hapticMs);
    expect(firstFrame!.cardLiftPx).toBeGreaterThan(0);

    // Peak of wake (t === wakeMs - 1 ms, still inside wake): the
    // card has lifted and the camera has pushed toward Io's hand.
    const wakePeak = game?.nextJobOfferFeel({
      elapsedMs: AFTERSIGN_NEXT_JOB_OFFER_FEEL.wakeMs - 1,
    });
    expect(wakePeak?.phase).toBe("wake");
    expect(wakePeak!.cameraPushMeters).toBeGreaterThan(0);
    // easeOutBackSoft overshoots slightly above 1 mid-wake; allow a
    // small tolerance above the base amplitude for the "back" bump.
    expect(wakePeak!.cameraPushMeters).toBeLessThanOrEqual(
      AFTERSIGN_NEXT_JOB_OFFER_FEEL.cameraPushMeters * 1.15,
    );
    expect(Math.abs(wakePeak!.cameraYawDegrees)).toBeLessThanOrEqual(
      AFTERSIGN_NEXT_JOB_OFFER_FEEL.cameraYawDegrees * 1.15,
    );
    expect(wakePeak!.cardScale).toBeGreaterThan(1);
    // Overscale + a modest overshoot budget for easeOutBackSoft.
    expect(wakePeak!.cardScale).toBeLessThanOrEqual(
      1 + AFTERSIGN_NEXT_JOB_OFFER_FEEL.cardOverscale * 1.15,
    );

    // Middle of settle: still moving but decaying toward hold.
    const midSettle = game?.nextJobOfferFeel({
      elapsedMs:
        AFTERSIGN_NEXT_JOB_OFFER_FEEL.wakeMs +
        AFTERSIGN_NEXT_JOB_OFFER_FEEL.settleMs / 2,
    });
    expect(midSettle?.phase).toBe("settle");
    expect(midSettle!.tagGlowAlpha).toBeGreaterThan(0);
    expect(midSettle!.hapticMs).toBe(0);

    // At durationMs: envelope has fully resolved into hold — no
    // camera/card motion left, faint glow tail permitted.
    const held = game?.nextJobOfferFeel({
      elapsedMs: AFTERSIGN_NEXT_JOB_OFFER_FEEL.durationMs,
    });
    expect(held?.phase).toBe("hold");
    expect(held?.progress).toBe(1);
    expect(held?.hapticMs).toBe(0);

    // Reduced-motion contract: camera/card motion zeroed, haptic
    // suppressed, glow trimmed but non-negative — same shape as the
    // other feel envelopes.
    const reducedWake = game?.nextJobOfferFeel({
      elapsedMs: Math.max(1, AFTERSIGN_NEXT_JOB_OFFER_FEEL.wakeMs * 0.04),
      reducedMotion: true,
    });
    expect(reducedWake?.cameraPushMeters).toBe(0);
    expect(reducedWake?.cameraYawDegrees).toBe(0);
    expect(reducedWake?.cardLiftPx).toBe(0);
    expect(reducedWake?.cardScale).toBe(1);
    expect(reducedWake?.hapticMs).toBe(0);
    expect(reducedWake!.tagGlowAlpha).toBeGreaterThanOrEqual(0);
  });

  it("clears applied tap-confirm feel on restoreDurableSave and load", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    expect(game?.getAppliedTapConfirmFeel).toEqual(expect.any(Function));

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    expect(game?.getAppliedTapConfirmFeel()).toBeNull();

    game?.input.choose("any-committing-choice");
    expect(game?.getAppliedTapConfirmFeel()).toEqual(expect.any(Object));

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 2),
    );
    expect(game?.getAppliedTapConfirmFeel()).toBeNull();

    game?.input.choose("another-committing-choice");
    expect(game?.getAppliedTapConfirmFeel()).toEqual(expect.any(Object));

    const payload = game!.save();
    game?.input.choose("stale-confirm-after-save");
    expect(game?.getAppliedTapConfirmFeel()).toEqual(expect.any(Object));

    game?.load(payload);
    expect(game?.getAppliedTapConfirmFeel()).toBeNull();
  });

  it("keeps M-CONTINUE harness choices on the generic assertion/input bridge", () => {
    const game = window.__game as
      | (typeof window.__game & {
          chooseReturnTone?: unknown;
          askForNextJob?: unknown;
        })
      | undefined;
    expect(game).toBeDefined();

    // The founder's 2026-08-15 amendment makes `window.__game` an assertion
    // surface, not the acceptance input surface. Keep the harness API narrow:
    // state-machine verbs may exist under the generic `input.choose` bridge
    // for harness-only tests, but they must not grow into bespoke public
    // player-action aliases that a Playwright spec can mistake for UI.
    expect(game?.input.choose).toEqual(expect.any(Function));
    expect(game?.chooseReturnTone).toBeUndefined();
    expect(game?.askForNextJob).toBeUndefined();
  });

  it("reaches Io's next-job offer and Orra claim tag through window.__game", () => {
    const game = window.__game;
    expect(game).toBeDefined();
    expect(game?.acceptNextJob).toEqual(expect.any(Function));
    expect(game?.input.choose).toEqual(expect.any(Function));

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        13,
      ),
    );
    game?.meetNpc("io");

    const offer = game?.input.choose("accept-next-job");
    expect(offer).toMatchObject({
      id: "io-next-job-offer",
      speaker: "io",
      jobId: "orra-name-debt",
      claimTag: "ORRA-NAME-DEBT",
      nextBeat: "orra-name-debt",
      text: expect.stringContaining("Saint Orra"),
    });

    expect(game?.getAcceptedNextJob()).toMatchObject({
      id: "orra-name-debt",
      speaker: "io",
      jobId: "orra-name-debt",
      claimTag: "ORRA-NAME-DEBT",
      text: expect.stringContaining("name"),
    });

    const snapshot = game?.getSnapshot() as
      | ({
          story: {
            nextJob?: {
              accepted: boolean;
              offer: { id: string; nextBeat?: string; claimTag: string };
              beat: { id: string; claimTag: string };
            };
          };
        } & ReturnType<NonNullable<typeof game>["getSnapshot"]>)
      | undefined;
    expect(snapshot?.story.nextJob).toMatchObject({
      accepted: true,
      offer: {
        id: "io-next-job-offer",
        nextBeat: "orra-name-debt",
        claimTag: "ORRA-NAME-DEBT",
      },
      beat: {
        id: "orra-name-debt",
        claimTag: "ORRA-NAME-DEBT",
      },
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("keeps the accepted next job durable across save/load", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(
        meetIoForAftersignSlice(
          recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
        ),
        21,
      ),
    );
    game?.meetNpc("io");
    game?.input.choose("accept-next-job");

    const savedPayload = game!.save();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    expect(game?.getSnapshot().story.nextJob).toBeUndefined();

    game?.load(savedPayload);

    expect(game?.getSnapshot().story.nextJob).toMatchObject({
      accepted: true,
      offer: {
        id: "io-next-job-offer",
        nextBeat: "orra-name-debt",
        claimTag: "ORRA-NAME-DEBT",
      },
      beat: {
        id: "orra-name-debt",
        claimTag: "ORRA-NAME-DEBT",
      },
    });
    expect(game?.getAcceptedNextJob()).toMatchObject({
      id: "orra-name-debt",
      claimTag: "ORRA-NAME-DEBT",
    });
  });

  // Consumer wiring for the NPC memory round-trip contract. The
  // shipped consumer is `getAftersignStoryState` in
  // `../windowGameSurface.ts` — it publishes `story.npcMemoryRoundTrip`
  // when its caller supplies `options.npcMemoryRoundTrip` AND the
  // referenced NPC recognizes the player on the current state. The
  // harness feeds that option from its `playerMemory` bag + captured
  // recall trigger, so this end-to-end assertion pins the wiring
  // through the shipped surface (not a harness-only projection).
  //
  // `spokenLine` is asserted against the authored copy returned by
  // `resolveAftersignRememberingNpcDialogue` — no name / count
  // interpolation. The two axes ride alongside the authored voice.
  it("publishes npcMemoryRoundTrip on the shipped surface with authored copy + player-memory axes", () => {
    const game = window.__game as
      | (typeof window.__game & {
          setPlayerMemory?: (memory: {
            playerName: string;
            interactionCount: number;
          }) => void;
        })
      | undefined;

    expect(game).toBeDefined();
    expect(game?.setPlayerMemory).toEqual(expect.any(Function));

    // Seed: sealed packet + Io first meeting, so a subsequent
    // `meetNpc("io")` promotes Io to `recognizes-player` (the
    // recall-transition gate the harness watches for).
    const seedState = meetIoForAftersignSlice(
      recordAftersignPacketChoice(createAftersignVerticalSliceState(), "sealed"),
    );
    game?.restoreDurableSave(encodeAftersignDurableSave(seedState, 34));
    game?.setPlayerMemory?.({ playerName: "Signal Runner", interactionCount: 3 });

    // Durable-save round-trip: the memory bag must survive
    // save() → fresh-boot restore → load().
    const savedPayload = game!.save();
    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.load(savedPayload);
    game?.meetNpc("io");

    const snapshot = game?.getStoryState();
    const roundTrip = snapshot?.story.npcMemoryRoundTrip;

    expect(roundTrip).toBeDefined();
    expect(roundTrip).toMatchObject({
      npcId: "io",
      playerName: "Signal Runner",
      interactionCount: 3,
    });

    // Authored-copy contract: `spokenLine` equals the first line
    // returned by the shipped dialogue resolver — no interpolation.
    // If a future rewrite of the returning-session table changes the
    // line, this assertion follows the source of truth automatically.
    const authoredLine = game?.getRememberingNpcDialogue("io").lines[0];
    expect(typeof authoredLine).toBe("string");
    expect((authoredLine ?? "").length).toBeGreaterThan(0);
    expect(roundTrip?.spokenLine).toBe(authoredLine);
    // Explicit anti-interpolation guard: the authored line must
    // NOT already contain the caller-supplied player name or
    // interaction count — that would mean the shipped table is
    // doing the interpolation the reviewer flagged.
    expect(roundTrip?.spokenLine).not.toContain("Signal Runner");
    expect(roundTrip?.spokenLine).not.toMatch(/\binteraction 3\b/);

    // Recognition-feel envelope rides alongside the spoken line —
    // pre-line hold, portrait push-in, ring flash, subtitle pop,
    // audio cue delay. Sourced verbatim from
    // `AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL` via the resolver,
    // so a renderer never has to import the constant separately.
    // If a future refactor unwires `recognitionFeel` from the
    // shipped surface, this equality goes red — closing the
    // "populated, never read, never asserted" gap from #1292.
    expect(roundTrip?.recognitionFeel).toEqual(
      AFTERSIGN_REMEMBERING_NPC_RECOGNITION_FEEL,
    );

    // Clearing the memory bag drops the beat back to absent, even
    // while Io still recognizes the player.
    game?.setPlayerMemory?.(null);
    expect(game?.getStoryState().story.npcMemoryRoundTrip).toBeUndefined();
  });

  // Played-not-driven guard for the pointer-to-render latency probe:
  // a real DOM `pointerdown` on a visible tap-choice surface must arm
  // the harness probe without a test hand-calling `markPointerIntent`.
  // The rendered marker remains explicit here because this unit harness
  // has no renderer loop; the important boundary is that player input
  // enters through the DOM event path, not `window.__game.input`.
  it("records pointer-to-render latency from a real pointerdown event", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(1000).mockReturnValue(1012);

    const button = document.createElement("button");
    button.setAttribute("data-aftersign-tap-choice", "ask-for-next-job");
    document.body.appendChild(button);

    try {
      game?.input.resetPointerToRenderLatency();

      const pointerDown = new Event("pointerdown", { bubbles: true });
      Object.defineProperty(pointerDown, "pointerId", { value: 42 });
      button.dispatchEvent(pointerDown);

      game?.input.markPointerRendered({ pointerId: 42, renderedAtMs: performance.now() });

      const report = game?.input.getPointerToRenderLatencyReport();
      expect(report?.samples).toEqual([
        {
          pointerAtMs: 1000,
          renderedAtMs: 1012,
          deltaMs: 12,
          frameBudgetMs: 16.7,
          withinBudget: true,
        },
      ]);
      expect(report?.latest).toEqual(report?.samples[0]);
      expect(report?.worst).toEqual(report?.samples[0]);
    } finally {
      button.remove();
      game?.input.resetPointerToRenderLatency();
      nowSpy.mockRestore();
    }
  });

  // Multi-sample guard for the same player-shaped latency probe. A
  // single green sample can hide the real regression the public demo
  // cares about: a later tap that misses the frame budget while the
  // latest sample is still reported. Worst-sample retention is the
  // harness's conscience here.
  it("keeps pointer-to-render latency latest and worst samples distinct", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    const nowSpy = vi.spyOn(performance, "now");
    nowSpy
      .mockReturnValueOnce(2000) // first pointerdown
      .mockReturnValueOnce(2025) // first render: over budget
      .mockReturnValueOnce(3000) // second pointerdown
      .mockReturnValueOnce(3006); // second render: latest, within budget

    const button = document.createElement("button");
    button.setAttribute("data-aftersign-tap-choice", "return-tone-kind");
    document.body.appendChild(button);

    try {
      game?.input.resetPointerToRenderLatency();

      const slowPointerDown = new Event("pointerdown", { bubbles: true });
      Object.defineProperty(slowPointerDown, "pointerId", { value: 7 });
      button.dispatchEvent(slowPointerDown);
      game?.input.markPointerRendered({ pointerId: 7, renderedAtMs: performance.now() });

      const fastPointerDown = new Event("pointerdown", { bubbles: true });
      Object.defineProperty(fastPointerDown, "pointerId", { value: 8 });
      button.dispatchEvent(fastPointerDown);
      game?.input.markPointerRendered({ pointerId: 8, renderedAtMs: performance.now() });

      const report = game?.input.getPointerToRenderLatencyReport();
      expect(report?.samples).toEqual([
        {
          pointerAtMs: 2000,
          renderedAtMs: 2025,
          deltaMs: 25,
          frameBudgetMs: 16.7,
          withinBudget: false,
        },
        {
          pointerAtMs: 3000,
          renderedAtMs: 3006,
          deltaMs: 6,
          frameBudgetMs: 16.7,
          withinBudget: true,
        },
      ]);
      expect(report?.latest).toEqual(report?.samples[1]);
      expect(report?.worst).toEqual(report?.samples[0]);
    } finally {
      button.remove();
      game?.input.resetPointerToRenderLatency();
      nowSpy.mockRestore();
    }
  });

  // Player-shaped input must mean a visible rendered choice, not any
  // bubbling pointer event the test DOM happens to dispatch. This keeps
  // the latency probe aligned with the founder's "played, not driven"
  // boundary: only visible `[data-aftersign-tap-choice]` targets can arm
  // the pointer-to-render sample.
  it("ignores hidden or non-choice pointer targets when recording pointer-to-render latency", () => {
    const game = window.__game;
    expect(game).toBeDefined();

    game?.restoreDurableSave(
      encodeAftersignDurableSave(createAftersignVerticalSliceState(), 1),
    );
    game?.input.resetPointerToRenderLatency();

    const nowSpy = vi.spyOn(performance, "now");
    nowSpy
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1012)
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(2012);

    const nonChoiceButton = document.createElement("button");
    nonChoiceButton.textContent = "decorative button";
    document.body.appendChild(nonChoiceButton);

    const hiddenChoiceButton = document.createElement("button");
    hiddenChoiceButton.setAttribute("data-aftersign-tap-choice", "ask-for-next-job");
    hiddenChoiceButton.hidden = true;
    document.body.appendChild(hiddenChoiceButton);

    try {
      const nonChoicePointerDown = new Event("pointerdown", { bubbles: true });
      Object.defineProperty(nonChoicePointerDown, "pointerId", { value: 101 });
      nonChoiceButton.dispatchEvent(nonChoicePointerDown);
      game?.input.markPointerRendered({ pointerId: 101, renderedAtMs: performance.now() });

      const hiddenChoicePointerDown = new Event("pointerdown", { bubbles: true });
      Object.defineProperty(hiddenChoicePointerDown, "pointerId", { value: 102 });
      hiddenChoiceButton.dispatchEvent(hiddenChoicePointerDown);
      game?.input.markPointerRendered({ pointerId: 102, renderedAtMs: performance.now() });

      const report = game?.input.getPointerToRenderLatencyReport();
      expect(report?.samples).toEqual([]);
      expect(report?.latest).toBeUndefined();
      expect(report?.worst).toBeUndefined();
    } finally {
      nonChoiceButton.remove();
      hiddenChoiceButton.remove();
      game?.input.resetPointerToRenderLatency();
      nowSpy.mockRestore();
    }
  });
});
