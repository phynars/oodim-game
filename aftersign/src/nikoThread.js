export const NIKO_SHORTCUT_CHOICES = Object.freeze({
  TAKE: "take",
  REFUSE: "refuse",
});

export const nikoRouteLine = (routeRisk) => {
  if (routeRisk?.lastRoute === "safe") {
    return "Niko Thread: You kept to the safe route. I noticed.";
  }
  if (routeRisk?.lastRoute === "fast") {
    return "Niko Thread: You took the risky route. I noticed.";
  }
  return "Niko Thread: I have no route from you to claim.";
};

export const nikoShortcutReceipt = (answer) =>
  answer === NIKO_SHORTCUT_CHOICES.TAKE
    ? "Niko Thread: Take it, then. The shortcut is yours."
    : answer === NIKO_SHORTCUT_CHOICES.REFUSE
      ? "Niko Thread: Refuse it, then. We meet at the long way round."
      : null;
