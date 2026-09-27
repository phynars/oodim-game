import {
  playRouteRiskConfirmFeedback,
  ROUTE_RISK_CONFIRM_FEEL,
} from "./routeRiskConfirmFeedback.js";

describe("route-risk confirmation feedback", () => {
  it("plays the 180ms acknowledgement on the route tray", () => {
    const surface = document.createElement("div");
    const animate = vi.fn();
    Object.defineProperty(surface, "animate", { value: animate });

    expect(playRouteRiskConfirmFeedback(surface)).toBe(true);
    expect(animate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          transform: `translate3d(0, -${ROUTE_RISK_CONFIRM_FEEL.liftPx}px, 0) scale(${ROUTE_RISK_CONFIRM_FEEL.scalePeak})`,
          offset: 0.35,
        }),
      ]),
      expect.objectContaining({
        duration: ROUTE_RISK_CONFIRM_FEEL.durationMs,
        composite: "replace",
      }),
    );
  });

  it("does not claim feedback when Web Animations is unavailable", () => {
    expect(playRouteRiskConfirmFeedback(document.createElement("div"))).toBe(false);
  });
});
