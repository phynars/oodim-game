// Consumer test for the packet-confirm bloom wiring (#1015).
//
// `verticalSlicePacketInteraction.ts` is the runtime consumer of
// `playAftersignConfirmFeel` — this jsdom test drives the resolver on a
// committed state and asserts the `.aftersign-confirm-feel` layer is
// appended to `document.body`, labeled per resolved kind, and cleaned up
// after `durationMs + 80ms`.
//
// Scope guard (per #1015):
//   - does NOT touch the ms/px numbers in AFTERSIGN_CONFIRM_FEEL — the
//     sibling `aftersignConfirmFeel.contract.test.ts` pins those.
//   - does NOT touch `interactionConfirmFeel.ts` (shared envelope).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AFTERSIGN_INTERACTION_CONFIRM_STING,
  sampleAftersignInteractionConfirmSting,
} from "./aftersignInteractionConfirmSting";
import { sampleAftersignInteractionConfirmEnvelope } from "./interactionFeelContract";
import {
  resolveAftersignPacketConfirmInteraction,
  resolveAndPlayAftersignPacketConfirmInteraction,
} from "./verticalSlicePacketInteraction";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

const LAYER_SELECTOR = ".aftersign-confirm-feel";

// Per-kind bloom durations pinned by `PACKET_CONFIRM_BLOOM_OVERRIDES` in
// `verticalSlicePacketInteraction.ts` (they override the base
// `AFTERSIGN_CONFIRM_FEEL.durationMs`, so cleanup = override + 80ms).
const PACKET_BLOOM_DURATION_MS = {
  packetOpen: 460,
  packetPreserve: 520,
  packetInspect: 320,
} as const;

function committedState(
  packetOutcome: "opened" | "sealed",
): AftersignVerticalSliceState {
  // Only `packetOutcome` is read by the resolver; the cast keeps this
  // test decoupled from unrelated state fields.
  return { packetOutcome } as AftersignVerticalSliceState;
}

function layers(): Element[] {
  return Array.from(document.body.querySelectorAll(LAYER_SELECTOR));
}

describe("aftersignConfirmFeel consumer (packet-confirm wiring)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("resolves packetOpen for an opened outcome and appends exactly one bloom layer", () => {
    const interaction = resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("opened"),
      "commit",
      { x: 120, y: 240 },
    );

    expect(interaction.kind).toBe("packetOpen");
    expect(layers()).toHaveLength(1);
    expect(layers()[0]!.textContent).toContain("Opened");
  });

  it("resolves packetPreserve for a sealed outcome with the 'Sealed' label", () => {
    const interaction = resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("sealed"),
      "commit",
      { x: 60, y: 80 },
    );

    expect(interaction.kind).toBe("packetPreserve");
    expect(layers()).toHaveLength(1);
    expect(layers()[0]!.textContent).toContain("Sealed");
  });

  it("resolves packetInspect for the inspect action with the 'Inspecting' label", () => {
    const interaction = resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("opened"),
      "inspect",
      { x: 10, y: 20 },
    );

    expect(interaction.kind).toBe("packetInspect");
    expect(layers()).toHaveLength(1);
    expect(layers()[0]!.textContent).toContain("Inspecting");
  });

  it("appends exactly one layer per confirm and cleans up on durationMs + 80ms", () => {
    resolveAndPlayAftersignPacketConfirmInteraction(committedState("opened"));
    expect(layers()).toHaveLength(1);

    const durationMs = PACKET_BLOOM_DURATION_MS.packetOpen;

    // Just before the cleanup deadline the layer must still exist.
    vi.advanceTimersByTime(durationMs + 79);
    expect(layers()).toHaveLength(1);

    // At durationMs + 80ms it must be removed.
    vi.advanceTimersByTime(1);
    expect(layers()).toHaveLength(0);
  });

  it("keeps sequential packet-confirm blooms isolated after the cleanup deadline", () => {
    const durationMs = PACKET_BLOOM_DURATION_MS.packetOpen;

    resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("opened"),
      "commit",
      { x: 120, y: 240 },
    );
    vi.advanceTimersByTime(durationMs + 80);
    expect(layers()).toHaveLength(0);

    const secondInteraction = resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("sealed"),
      "commit",
      { x: 60, y: 80 },
    );

    expect(secondInteraction.kind).toBe("packetPreserve");
    expect(layers()).toHaveLength(1);
    expect(layers()[0]!.textContent).toContain("Sealed");
  });

  it("keeps rapid double-confirms visibly distinct until each one's own cleanup deadline", () => {
    const openMs = PACKET_BLOOM_DURATION_MS.packetOpen;
    const preserveMs = PACKET_BLOOM_DURATION_MS.packetPreserve;

    const firstInteraction = resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("opened"),
      "commit",
      { x: 120, y: 240 },
    );
    const secondInteraction = resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("sealed"),
      "commit",
      { x: 60, y: 80 },
    );

    expect(firstInteraction.kind).toBe("packetOpen");
    expect(secondInteraction.kind).toBe("packetPreserve");
    expect(layers()).toHaveLength(2);
    expect(layers().map((layer) => layer.textContent)).toEqual([
      expect.stringContaining("Opened"),
      expect.stringContaining("Sealed"),
    ]);

    vi.advanceTimersByTime(openMs + 79);
    expect(layers()).toHaveLength(2);

    // The open bloom (shorter) clears first; the preserve bloom stays.
    vi.advanceTimersByTime(1);
    expect(layers()).toHaveLength(1);
    expect(layers()[0]!.textContent).toContain("Sealed");

    vi.advanceTimersByTime(preserveMs - openMs - 1);
    expect(layers()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(layers()).toHaveLength(0);
  });

  it("stamps a sampled packet-confirm envelope onto the live bloom layer", () => {
    const interaction = resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("opened"),
      "commit",
      { reducedMotion: false },
    );

    const layer = layers()[0] as HTMLElement | undefined;
    expect(layer).toBeDefined();

    // Peak = 35% of the bloom layer's own duration. packetOpen's bloom
    // override pins 460ms (see PACKET_CONFIRM_BLOOM_OVERRIDES); the layer
    // publishes it as `--aftersign-confirm-duration`.
    expect(layer!.style.getPropertyValue("--aftersign-confirm-duration")).toBe("460ms");
    const peakMs = 460 * 0.35;
    expect(Number.isFinite(Number(layer!.dataset.confirmEnvelopePeakMs))).toBe(true);
    const peak = sampleAftersignInteractionConfirmEnvelope(
      interaction.kind,
      peakMs,
      false,
    );

    expect(layer!.dataset.confirmEnvelopeKind).toBe("packetOpen");
    expect(layer!.dataset.confirmEnvelopePeakMs).toBe(String(peakMs));
    expect(layer!.dataset.confirmEnvelopePeak).toBe(JSON.stringify(peak));
    expect(layer!.dataset.confirmEnvelopeReducedMotion).toBeUndefined();
  });

  it("stamps the audio-visual sting numbers onto the live bloom layer", () => {
    resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("opened"),
      "commit",
      { reducedMotion: false },
    );

    const layer = layers()[0] as HTMLElement | undefined;
    expect(layer).toBeDefined();

    const spec = AFTERSIGN_INTERACTION_CONFIRM_STING;
    const peak = sampleAftersignInteractionConfirmSting(spec.durationMs * 0.35);

    expect(layer!.dataset.stingDurationMs).toBe(String(spec.durationMs));
    expect(layer!.dataset.stingChirpDurationMs).toBe(
      String(spec.chirpDurationMs),
    );
    expect(layer!.dataset.stingChirpStartHz).toBe(String(spec.chirpStartHz));
    expect(layer!.dataset.stingChirpEndHz).toBe(String(spec.chirpEndHz));
    expect(layer!.dataset.stingBloomPopScale).toBe(String(spec.bloomPopScale));
    expect(layer!.dataset.stingSettlePx).toBe(String(spec.settlePx));
    expect(layer!.dataset.stingEasing).toBe(spec.easing);
    expect(layer!.dataset.stingPeakBloomScale).toBe(String(peak.bloomScale));
    expect(layer!.dataset.stingPeakChirpHz).toBe(String(peak.chirpHz));
    expect(layer!.dataset.stingPeakChirpGain).toBe(String(peak.chirpGain));
    expect(layer!.dataset.stingReducedMotion).toBeUndefined();
  });

  it("suppresses the shake CSS variable under reducedMotion but still shows the layer", () => {
    resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("sealed"),
      "commit",
      { reducedMotion: true },
    );

    const layer = layers()[0] as HTMLElement | undefined;
    expect(layer).toBeDefined();

    // The DOM player writes `--aftersign-confirm-shake` (see
    // aftersignConfirmFeel.ts). reducedMotion pins shakePx to 0, so the
    // written value must be exactly "0px" — an empty string here would
    // mean the variable wasn't written at all, which is a regression.
    const shake = layer!.style
      .getPropertyValue("--aftersign-confirm-shake")
      .trim();
    expect(shake).toBe("0px");
    expect(layer!.dataset.confirmEnvelopeReducedMotion).toBe("true");
    expect(layer!.dataset.stingPeakChirpGain).toBe("0");
    expect(layer!.dataset.stingReducedMotion).toBe("true");
  });

  it("throws when resolving a commit on an uncommitted packetOutcome", () => {
    expect(() =>
      resolveAftersignPacketConfirmInteraction(
        { packetOutcome: "pending" } as unknown as AftersignVerticalSliceState,
        "commit",
      ),
    ).toThrow(/packetOutcome is not committed/);
    expect(layers()).toHaveLength(0);
  });
});
