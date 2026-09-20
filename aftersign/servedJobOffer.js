// Player-facing job-offer control factory for the served AFTERSIGN scene.
// `main.js` owns mounting and selection; this module keeps the rendered
// control's player contract explicit and touch-friendly.

/**
 * Render one job the player can actually take from the served page.
 *
 * @param {{ id: string, label: string, routeRisk: string, action: string }} job
 * @returns {HTMLButtonElement}
 */
export function createServedJobOffer(job) {
  const button = document.createElement("button");
  button.type = "button";
  button.id = `job-offer-${job.id}`;
  button.className = "job-offer";
  button.textContent = `${job.label} · ${job.routeRisk} risk`;
  button.setAttribute("data-aftersign-job-take", "ready");
  button.setAttribute("data-job-id", job.id);
  button.setAttribute("data-route-risk", job.routeRisk);
  button.setAttribute("data-job-action", job.action);
  button.setAttribute("aria-label", `Take ${job.label}, ${job.routeRisk} risk`);
  return button;
}
