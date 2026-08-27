// AFTERSIGN — M-LOOP job-offer render signature.
//
// Tiny served-render helper for the packet-offered surface. The page render
// loop runs every rAF; job-offer buttons must stay DOM-stable across frames so
// a real tap can pass browser/Playwright actionability checks instead of
// chasing a replaced node.

export type MloopJobOfferSignatureInput = {
  readonly id: string;
  readonly routeRisk: string;
};

export type MloopJobOfferSignatureOptions = {
  readonly memoryGate: string;
};

export const jobOfferSignaturePart = (offer: MloopJobOfferSignatureInput): string =>
  `${offer.id}:${offer.routeRisk}`;

export const buildMloopJobOfferSignature = (
  offers: readonly MloopJobOfferSignatureInput[],
  options: MloopJobOfferSignatureOptions,
): string => {
  const parts = offers.map(jobOfferSignaturePart);
  parts.push(`gate:${options.memoryGate}`);
  return parts.join("|");
};

const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};

export const checkMloopJobOfferSignature = (): void => {
  const fresh = buildMloopJobOfferSignature(
    [{ id: "job-safe-delivery", routeRisk: "low" }],
    { memoryGate: "fresh" },
  );
  const returningSameOffer = buildMloopJobOfferSignature(
    [{ id: "job-safe-delivery", routeRisk: "low" }],
    { memoryGate: "returning" },
  );
  const completed = buildMloopJobOfferSignature(
    [
      { id: "job-night-transfer", routeRisk: "medium" },
      { id: "job-signed-receipt", routeRisk: "low" },
    ],
    { memoryGate: "returning" },
  );

  assert(
    fresh === "job-safe-delivery:low|gate:fresh",
    "fresh safe-default offer signature must include id, risk, and memory gate",
  );
  assert(
    fresh !== returningSameOffer,
    "memory-gate changes must invalidate the signature even when the offer set is unchanged",
  );
  assert(
    completed === "job-night-transfer:medium|job-signed-receipt:low|gate:returning",
    "completed-set signature must preserve offer order and risk labels",
  );
};

export const runMloopJobOfferSignatureChecks = (): void => {
  checkMloopJobOfferSignature();
};
