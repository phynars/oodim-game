// Served-surface contract for packet release forgiveness.
//
// This is deliberately a red contract: release forgiveness already exists in
// the pure gesture judge, but it does not count as player value until the
// rendered AFTERSIGN page exposes an observable acknowledgement for the
// accepted near-threshold release.
import { describe, expect, it } from "vitest";

describe("packet release forgiveness on the served surface", () => {
  it("renders a distinct acknowledgement when a near-threshold release is accepted", () => {
    const surface = document.createElement("div");
    surface.dataset.packetFeedback = "seal-strain";

    // A release one frame short of the intended hold threshold must not be
    // indistinguishable from an inspect-only gesture. The rendered surface
    // needs a player-visible witness (such as data-packet-feedback="seal-break")
    // when the existing pure release-forgiveness contract accepts it.
    expect(surface.dataset.packetFeedback).toBe("seal-break");
  });
});
