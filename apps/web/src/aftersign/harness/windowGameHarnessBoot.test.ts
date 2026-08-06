import { describe, expect, it } from "vitest";

import { MEMORY_RECALL_FEEL } from "../memoryRecallFeel";
import {
  AFTERSIGN_INTERACTION_CONFIRM_FEEL,
  AFTERSIGN_IO_RECOGNITION_FEEL,
  AFTERSIGN_KIOSK_SCENE_FEEL,
  createAftersignVerticalSliceState,
  encodeAftersignDurableSave,
  meetIoForAftersignSlice,
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
});
