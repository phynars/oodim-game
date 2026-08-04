import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AFTERSIGN_CONFIRM_FEEL,
  resolveAndPlayAftersignPacketConfirmInteraction,
  resolveAftersignPacketConfirmInteraction,
  playAftersignPacketConfirmInteractionFeel,
} from "./verticalSliceState";
import { createAftersignVerticalSliceState, confirmAftersignPacketChoice } from "./verticalSliceRuntimeState";

function committedState(outcome: "opened" | "sealed") {
  const state = createAftersignVerticalSliceState();
  state.packetOutcome = outcome;
  return state;
}

describe("Aftersign packet-confirm bloom consumer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
    vi.useRealTimers();
  });

  it.each([
    ["opened", "Opened"],
    ["sealed", "Sealed"],
  ] as const)("plays one %s confirm bloom with the kind label", (outcome, label) => {
    vi.useFakeTimers();
    const interaction = resolveAftersignPacketConfirmInteraction(committedState(outcome));

    const handle = playAftersignPacketConfirmInteractionFeel(interaction, {
      root: document,
      x: 112,
      y: 88,
    });

    const layers = document.body.querySelectorAll(".aftersign-confirm-feel");
    expect(handle).not.toBeNull();
    expect(layers).toHaveLength(1);
    expect(layers[0]?.textContent).toBe(label);
    expect(layers[0]).toHaveStyle({
      "--aftersign-confirm-x": "112px",
      "--aftersign-confirm-y": "88px",
      "--aftersign-confirm-shake": `${AFTERSIGN_CONFIRM_FEEL.shakePx}px`,
    });

    vi.advanceTimersByTime(AFTERSIGN_CONFIRM_FEEL.durationMs + 79);
    expect(document.body.querySelectorAll(".aftersign-confirm-feel")).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(document.body.querySelectorAll(".aftersign-confirm-feel")).toHaveLength(0);
  });

  it("plays an inspecting bloom for inspect actions", () => {
    vi.useFakeTimers();
    const interaction = resolveAftersignPacketConfirmInteraction(
      createAftersignVerticalSliceState(),
      "inspect",
    );

    playAftersignPacketConfirmInteractionFeel(interaction, { root: document });

    const layer = document.body.querySelector(".aftersign-confirm-feel");
    expect(layer).not.toBeNull();
    expect(layer?.textContent).toBe("Inspecting");
  });

  it("suppresses shake for reduced motion while keeping the visual bloom", () => {
    vi.useFakeTimers();
    const interaction = resolveAftersignPacketConfirmInteraction(committedState("opened"));

    playAftersignPacketConfirmInteractionFeel(interaction, {
      root: document,
      reducedMotion: true,
    });

    const layer = document.body.querySelector(".aftersign-confirm-feel");
    expect(layer).not.toBeNull();
    expect(layer).toHaveStyle({ "--aftersign-confirm-shake": "0px" });
  });

  it("can resolve and play from a committed packet interaction in one call", () => {
    vi.useFakeTimers();
    const state = createAftersignVerticalSliceState();
    confirmAftersignPacketChoice(state, "preserve");

    const interaction = resolveAndPlayAftersignPacketConfirmInteraction(state, "commit", {
      root: document,
      x: 220,
      y: 164,
    });

    expect(interaction.kind).toBe("packetPreserve");
    const layers = document.body.querySelectorAll(".aftersign-confirm-feel");
    expect(layers).toHaveLength(1);
    expect(layers[0]?.textContent).toBe("Sealed");
  });
});
