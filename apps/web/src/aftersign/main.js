import { fingerprintJobOfferAction } from "@oodim/aftersign";

/**
 * Render tappable job offers with a stable, element-level action identity.
 * The attribute is intentionally derived from the offer's mechanical
 * fingerprint rather than its mutable label copy.
 */
export function renderOfferedJobs(offeredJobs, container = document.querySelector("#offeredJobs")) {
  if (!container) return;

  container.replaceChildren(
    ...offeredJobs.map((offer) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.offerFingerprint = fingerprintJobOfferAction(offer).semanticKey;
      button.textContent = offer.label;
      return button;
    }),
  );
}
