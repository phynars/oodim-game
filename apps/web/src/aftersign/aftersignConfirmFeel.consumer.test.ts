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
import { AFTERSIGN_CONFIRM_FEEL } from "./aftersignConfirmFeel";
import {
  resolveAftersignPacketConfirmInteraction,
  resolveAndPlayAftersignPacketConfirmInteraction,
} from "./verticalSlicePacketInteraction";
import type { AftersignVerticalSliceState } from "./verticalSliceRuntimeState";

const LAYER_SELECTOR = ".aftersign-confirm-feel";

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

    const { durationMs } = AFTERSIGN_CONFIRM_FEEL;

    // Just before the cleanup deadline the layer must still exist.
    vi.advanceTimersByTime(durationMs + 79);
    expect(layers()).toHaveLength(1);

    // At durationMs + 80ms it must be removed.
    vi.advanceTimersByTime(1);
    expect(layers()).toHaveLength(0);
  });

  it("suppresses the shake CSS variable under reducedMotion but still shows the layer", () => {
    resolveAndPlayAftersignPacketConfirmInteraction(
      committedState("sealed"),
      "commit",
      { reducedMotion: true },
    );

    const layer = layers()[0] as HTMLElement | undefined;
    expect(layer).toBeDefined();

    const shake = layer!.style.getPropertyValue("--aftersign-confirm-shake-px");
    // reducedMotion pins shakePx to 0 — accept "0", "0px", or unset.
    expect(["", "0", "0px"]).toContain(shake.trim());
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
