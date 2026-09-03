// Served-surface consumer for the DEBT-HELD branch of `#offeredJobs`.
//
// Why this file exists (PR #1624 — Soren's third REQUEST_CHANGES):
//
//   The first draft added the debt-held axis inside the PRIMITIVE
//   (`packages/aftersign/src/computeOfferedJobs.ts`) and a
//   `contract.test.ts` that called `selectIoJobOffers({ debtHeld: 1 })`
//   directly. Nothing derived `debtHeld` from the durable save that
//   `aftersign/main.js` actually reads — the served derivation site
//   (`state.npcs.io.memory.length > 0 ? { priorOutcome:"completed" } : undefined`)
//   collapsed every history into the completed / safe branches, so
//   no player could ever reach the debt-repair offer.
//
//   Soren's rewrite request:
//     "wire `debtHeld` into `main.js`'s derivation (from the durable
//     save or a real player-memory axis), and add a tap-driven e2e
//     that boots the served page and clicks the rendered
//     `#job-offer-job-wax-debt-repair`."
//
//   Two changes closed the gap:
//     (a) `aftersign/src/offeredJobsMemoryFromIoMemory.js` — the pure
//         helper that maps Io's durable memory-fact stream to the
//         `PlayerMemory` bag the primitive consumes. Sealed history →
//         `{ priorOutcome: "completed" }`. Opened-only history →
//         `{ debtHeld: <count> }`. Neither → `undefined`.
//     (b) `aftersign/main.js` — replaces the collapsed inline
//         expression at the `packet-offered` render site with a
//         call to (a). The tap-driven e2e
//         `aftersign/e2e/job-offer-debt-held-played.spec.ts` proves
//         the button lands on the real page.
//
// This vitest file drives BOTH layers of the served path against the
// primitive's authored id vocabulary, without booting three.js:
//
//   Layer 1 — DERIVATION from real Io-memory-fact shapes.
//     `offeredJobsMemoryFromIoMemory(memory)` is the EXACT function
//     `aftersign/main.js` calls. Feeding it the same memory-fact
//     shapes `buildPacketOutcomeMemoryFact` mints proves the served
//     derivation reaches every branch of `PlayerMemory` (completed,
//     debtHeld, undefined) from durable save data. No mirrored
//     helper — the test and the runtime agree by import.
//
//   Layer 2 — SURFACE publish.
//     `createAftersignWindowGameSurface({ offeredJobsMemory })`
//     receives the derived bag and publishes `story.offeredJobs`.
//     This is the seam Soren blocked twice on (the guard in
//     `resolveOfferedJobsMemory` had to accept `{ debtHeld }`).
//
//   Layer 3 — RENDER + tap.
//     The debt-repair offer stamps into the shipped `#offeredJobs`
//     container with the id / tap-choice vocabulary the served
//     renderer uses, and a `.click()` fires the expected tap-choice.
//     The stamp shape is intentionally mirrored inline (matching
//     `offeredJobsTapTargetFeel.consumer.test.ts`) — a played e2e
//     that boots `main.js` is the true render pin, and lives at
//     `aftersign/e2e/job-offer-debt-held-played.spec.ts`.
//
// Scope guard:
//   - Does NOT boot `aftersign/main.js` (three.js + full scene
//     graph); the played spec above covers that seam.
//   - Does NOT re-assert the primitive `computeOfferedJobs`
//     mapping — that lives in `computeOfferedJobs.test.ts` beside
//     the primitive.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEBT_HELD_JOB_IDS,
  SAFE_DEFAULT_JOB_ID,
  type IoJobOffer,
} from "../../../../packages/aftersign/src/computeOfferedJobs";
import {
  createAftersignWindowGameSurface,
  type AftersignStoryStateSnapshot,
} from "./windowGameSurface";
import { createAftersignVerticalSliceState } from "./verticalSliceRuntimeState";
// The SHIPPED derivation main.js runs at `packet-offered` render
// time — imported by BOTH main.js and this test so any drift here
// reds the same seam the runtime consumes.
import { offeredJobsMemoryFromIoMemory } from "../../../../aftersign/src/offeredJobsMemoryFromIoMemory.js";
// The SHIPPED memory-fact builder + kind/object vocabulary main.js
// uses when Io stores a delivery outcome. Building the memory
// stream through the SAME builder proves the derivation binds to
// the durable shape, not a hand-typed fixture.
import { buildPacketOutcomeMemoryFact } from "../../../../aftersign/src/memoryFacts.js";
import {
  NPC_MEMORY_FACT_KIND,
  NPC_MEMORY_OBJECT,
} from "../../../../aftersign/src/npcMemoryFlagSchema.js";

const readServedIndexHtml = (): string =>
  readFileSync(join(process.cwd(), "aftersign", "index.html"), "utf8");

/**
 * Mirror of the button-stamp `aftersign/main.js` runs at the
 * `packet-offered` beat (see the `for (const offer of offers)` loop
 * in main.js). Kept in lockstep with
 * `offeredJobsTapTargetFeel.consumer.test.ts::renderOfferedJobs`;
 * the played e2e (`job-offer-debt-held-played.spec.ts`) is the
 * true render pin because it boots main.js itself.
 */
function renderOfferedJobs(
  container: HTMLElement,
  offers: readonly IoJobOffer[],
): HTMLButtonElement[] {
  const doc = container.ownerDocument;
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  container.setAttribute("data-visible", "true");
  const label = doc.createElement("span");
  label.className = "route-choice-label";
  label.textContent = "Offered jobs";
  container.appendChild(label);

  const rendered: HTMLButtonElement[] = [];
  for (const offer of offers) {
    const button = doc.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("id", `job-offer-${offer.id}`);
    button.setAttribute("data-aftersign-tap-choice", `offer-${offer.id}`);
    button.setAttribute("data-offered-job-id", offer.id);
    button.setAttribute("data-offered-job-risk", offer.routeRisk);
    button.setAttribute("data-route-risk", offer.routeRisk);
    button.textContent = `${offer.label} · ${offer.routeRisk} risk`;
    container.appendChild(button);
    rendered.push(button);
  }
  return rendered;
}

const buildSealedFact = (sessionId = "session-sealed") =>
  buildPacketOutcomeMemoryFact({
    outcome: NPC_MEMORY_OBJECT.PACKET_SEALED,
    sessionId,
  });

const buildOpenedFact = (sessionId = "session-opened") =>
  buildPacketOutcomeMemoryFact({
    outcome: NPC_MEMORY_OBJECT.PACKET_OPENED,
    sessionId,
  });

const surfaceOfferIdsFor = (
  memory: Array<Record<string, unknown>> | undefined,
): string[] => {
  const derived = offeredJobsMemoryFromIoMemory(memory);
  const snapshot: AftersignStoryStateSnapshot = createAftersignWindowGameSurface(
    createAftersignVerticalSliceState(),
    {
      playerId: "aftersign.player.debt",
      playerName: "Ivy",
      offeredJobsMemory: derived,
    },
  ).getStoryState();
  return snapshot.story.offeredJobs.map((o) => o.id);
};

describe("#offeredJobs debt-held served-surface wiring (derives from Io memory + publishes through windowGameSurface)", () => {
  describe("layer 1 — offeredJobsMemoryFromIoMemory (the derivation aftersign/main.js runs)", () => {
    it("returns undefined for empty memory (fresh player → primitive's safe default)", () => {
      expect(offeredJobsMemoryFromIoMemory([])).toBeUndefined();
      expect(offeredJobsMemoryFromIoMemory(undefined)).toBeUndefined();
    });

    it("returns { priorOutcome:\"completed\" } when Io remembers a sealed delivery", () => {
      expect(offeredJobsMemoryFromIoMemory([buildSealedFact()])).toEqual({
        priorOutcome: "completed",
      });
    });

    it("returns { debtHeld:N } when Io remembers ONLY opened deliveries — N is the count", () => {
      expect(offeredJobsMemoryFromIoMemory([buildOpenedFact("s1")])).toEqual({
        debtHeld: 1,
      });
      expect(
        offeredJobsMemoryFromIoMemory([
          buildOpenedFact("s1"),
          buildOpenedFact("s2"),
        ]),
      ).toEqual({ debtHeld: 2 });
    });

    it("prefers the sealed override when Io remembers BOTH — a proven courier is not demoted by a stale wax debt", () => {
      // Override order pin — must match `selectedJobIds` in
      // computeOfferedJobs.ts: trusted > completed > guarded > failed
      // > debtHeld > default.
      expect(
        offeredJobsMemoryFromIoMemory([
          buildOpenedFact("s1"),
          buildSealedFact("s2"),
        ]),
      ).toEqual({ priorOutcome: "completed" });
    });

    it("ignores non-delivery-outcome facts (route-attention alone → undefined)", () => {
      // Belt-and-braces: the served state persists route-attention
      // facts alongside delivery-outcome facts. Those must not fire
      // either branch — only delivery-outcome facts carry the debt
      // signal.
      const routeAttentionOnly = [
        {
          id: "io-remembers-kiosk-second-action-done",
          kind: NPC_MEMORY_FACT_KIND.ROUTE_ATTENTION,
          subject: "player",
          predicate: "kiosk-second-action",
          object: NPC_MEMORY_OBJECT.ROUTE_DONE,
        },
      ];
      expect(offeredJobsMemoryFromIoMemory(routeAttentionOnly)).toBeUndefined();
    });
  });

  describe("layer 2 — surface publish (createAftersignWindowGameSurface consumes the derived bag)", () => {
    it("publishes the debt-repair offer for an opened-only Io memory", () => {
      const openedMemory = [buildOpenedFact()];
      expect(surfaceOfferIdsFor(openedMemory)).toEqual([...DEBT_HELD_JOB_IDS]);
    });

    it("publishes the completed set for a sealed Io memory", () => {
      const sealedMemory = [buildSealedFact()];
      expect(surfaceOfferIdsFor(sealedMemory)).not.toContain(
        "job-wax-debt-repair",
      );
      expect(surfaceOfferIdsFor(sealedMemory)).not.toEqual([
        SAFE_DEFAULT_JOB_ID,
      ]);
    });

    it("publishes the safe default for an empty Io memory", () => {
      expect(surfaceOfferIdsFor([])).toEqual([SAFE_DEFAULT_JOB_ID]);
    });

    it("diverges: opened-only vs empty vs sealed all publish DIFFERENT offer sets — the seam actually splits", () => {
      const opened = surfaceOfferIdsFor([buildOpenedFact()]);
      const empty = surfaceOfferIdsFor([]);
      const sealed = surfaceOfferIdsFor([buildSealedFact()]);
      expect(opened).not.toEqual(empty);
      expect(opened).not.toEqual(sealed);
      expect(empty).not.toEqual(sealed);
      // And specifically: only the opened-only history reaches the
      // debt-repair route.
      expect(opened).toContain("job-wax-debt-repair");
      expect(empty).not.toContain("job-wax-debt-repair");
      expect(sealed).not.toContain("job-wax-debt-repair");
    });
  });

  describe("layer 3 — render + tap on shipped aftersign/index.html #offeredJobs", () => {
    let dom: JSDOM;
    let offeredJobs: HTMLElement;

    beforeEach(() => {
      dom = new JSDOM(readServedIndexHtml());
      const container = dom.window.document.querySelector("#offeredJobs");
      if (!(container instanceof dom.window.HTMLElement)) {
        throw new Error(
          "served aftersign/index.html must host a #offeredJobs container",
        );
      }
      offeredJobs = container as unknown as HTMLElement;
    });

    afterEach(() => {
      dom.window.close();
    });

    it("stamps #job-offer-job-wax-debt-repair with the shipped tap-choice vocabulary", () => {
      const derived = offeredJobsMemoryFromIoMemory([buildOpenedFact()]);
      const snapshot = createAftersignWindowGameSurface(
        createAftersignVerticalSliceState(),
        {
          playerId: "aftersign.player.debt",
          playerName: "Ivy",
          offeredJobsMemory: derived,
        },
      ).getStoryState();
      const buttons = renderOfferedJobs(offeredJobs, snapshot.story.offeredJobs);

      expect(buttons).toHaveLength(1);
      const debtButton = offeredJobs.querySelector(
        "#job-offer-job-wax-debt-repair",
      );
      expect(debtButton).not.toBeNull();
      expect(debtButton?.getAttribute("data-aftersign-tap-choice")).toBe(
        "offer-job-wax-debt-repair",
      );
      expect(debtButton?.getAttribute("data-route-risk")).toBe("medium");
      expect(debtButton?.textContent).toContain("Wax-debt repair run");
      expect(debtButton?.textContent).toContain("medium risk");

      // Safe-default button MUST be absent — proves the divergence
      // landed on the rendered DOM, not just in the snapshot.
      expect(offeredJobs.querySelector(`#job-offer-${SAFE_DEFAULT_JOB_ID}`))
        .toBeNull();
    });

    it("routes a real .click() on the debt-repair button through its offer-job-wax-debt-repair tap-choice", () => {
      // Two opened deliveries — proves the count rides through
      // without changing the id vocabulary.
      const derived = offeredJobsMemoryFromIoMemory([
        buildOpenedFact("s1"),
        buildOpenedFact("s2"),
      ]);
      expect(derived).toEqual({ debtHeld: 2 });
      const snapshot = createAftersignWindowGameSurface(
        createAftersignVerticalSliceState(),
        {
          playerId: "aftersign.player.debt",
          playerName: "Ivy",
          offeredJobsMemory: derived,
        },
      ).getStoryState();
      const [debtButton] = renderOfferedJobs(
        offeredJobs,
        snapshot.story.offeredJobs,
      );

      const taps: string[] = [];
      debtButton.addEventListener("click", (event) => {
        const target = event.currentTarget as HTMLElement;
        taps.push(target.getAttribute("data-aftersign-tap-choice") ?? "");
      });

      debtButton.click();

      // Tap-choice landed with the shipped vocabulary — a player
      // who taps this button through the served renderer hits the
      // debt-repair offer.
      expect(taps).toEqual(["offer-job-wax-debt-repair"]);
    });
  });

  describe("primitive override sanity (surface-layer)", () => {
    it("trusted-courier posture outranks debt-held at the surface — matches the primitive's selectedJobIds order", () => {
      const debtOnly = createAftersignWindowGameSurface(
        createAftersignVerticalSliceState(),
        {
          playerId: "p1",
          playerName: "Ivy",
          offeredJobsMemory: { debtHeld: 3 },
        },
      )
        .getStoryState()
        .story.offeredJobs.map((o) => o.id);
      const trustedOverridesDebt = createAftersignWindowGameSurface(
        createAftersignVerticalSliceState(),
        {
          playerId: "p2",
          playerName: "Ivy",
          offeredJobsMemory: { trustPosture: "trusted-courier", debtHeld: 3 },
        },
      )
        .getStoryState()
        .story.offeredJobs.map((o) => o.id);

      expect(debtOnly).toEqual(["job-wax-debt-repair"]);
      expect(trustedOverridesDebt).not.toContain("job-wax-debt-repair");
      expect(trustedOverridesDebt).not.toEqual(debtOnly);
    });
  });
});
