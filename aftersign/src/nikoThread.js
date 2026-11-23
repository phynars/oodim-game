export const NIKO_SHORTCUT_CHOICES = Object.freeze({
  TAKE: "take",
  REFUSE: "refuse",
});

const routeLabelFor = (routeRisk) => {
  const trusted = routeRisk?.deliveryId === "red-tag";
  if (routeRisk?.lastRoute === "safe") {
    return trusted ? "Long way — past the kiosk" : "Lit stair — under Io's window";
  }
  if (routeRisk?.lastRoute === "fast") {
    return trusted ? "Behind the shuttered pharmacy" : "Cut past the bell rope";
  }
  return null;
};

export const nikoRouteLine = (routeRisk) => {
  const routeLabel = routeLabelFor(routeRisk);
  if (!routeLabel) return "Niko Thread: I have no route from you to claim.";
  return routeRisk.lastRoute === "safe"
    ? `Niko Thread: You kept to ${routeLabel}. I noticed.`
    : `Niko Thread: You took ${routeLabel}. I noticed.`;
};

export const nikoShortcutReceipt = (answer) =>
  answer === NIKO_SHORTCUT_CHOICES.TAKE
    ? "Niko Thread: Take it, then. The shortcut is yours."
    : answer === NIKO_SHORTCUT_CHOICES.REFUSE
      ? "Niko Thread: Refuse it, then. We meet at the long way round."
      : null;
