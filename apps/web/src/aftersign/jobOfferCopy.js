const DEFAULT_MEMORY = Object.freeze({
  packetOutcome: "none",
});

const JOB_OFFER_COPY = Object.freeze({
  firstRun: Object.freeze({
    state: "first-run",
    eyebrow: "Night Post work",
    offer: "One safe job. One blue seal. Bring both back intact.",
    actions: Object.freeze([
      Object.freeze({
        id: "carry-blue-packet",
        label: "Carry the blue packet",
        ariaLabel: "Carry the blue packet by the safe route",
      }),
    ]),
  }),
  trusted: Object.freeze({
    state: "trusted",
    eyebrow: "Wider work",
    offer: "You kept the seal once. I can risk giving you a stranger door.",
    actions: Object.freeze([
      Object.freeze({
        id: "carry-pharmacy-receipt",
        label: "Carry the pharmacy receipt",
        ariaLabel: "Carry the pharmacy receipt for Saint Orra",
      }),
      Object.freeze({
        id: "take-lit-stair",
        label: "Take the lit stair",
        ariaLabel: "Take the long lit stair route",
      }),
    ]),
  }),
  distrusted: Object.freeze({
    state: "distrusted",
    eyebrow: "Narrow work",
    offer: "The seal opened. So the work narrows.",
    actions: Object.freeze([
      Object.freeze({
        id: "return-torn-receipt",
        label: "Return the torn receipt",
        ariaLabel: "Return the torn receipt to Io",
      }),
    ]),
  }),
});

const TRUSTED_PACKET_OUTCOMES = new Set([
  "sealed",
  "delivered_sealed",
  "packet_delivered_sealed",
]);

const DISTRUSTED_PACKET_OUTCOMES = new Set([
  "opened",
  "opened_packet",
  "packet_opened",
]);

function normalizeMemory(memory = DEFAULT_MEMORY) {
  if (!memory || typeof memory !== "object") {
    return DEFAULT_MEMORY;
  }

  return {
    ...DEFAULT_MEMORY,
    ...memory,
  };
}

export function getAftersignJobOfferCopy(memory = DEFAULT_MEMORY) {
  const normalizedMemory = normalizeMemory(memory);
  const packetOutcome = String(normalizedMemory.packetOutcome ?? "none").toLowerCase();

  if (TRUSTED_PACKET_OUTCOMES.has(packetOutcome)) {
    return JOB_OFFER_COPY.trusted;
  }

  if (DISTRUSTED_PACKET_OUTCOMES.has(packetOutcome)) {
    return JOB_OFFER_COPY.distrusted;
  }

  return JOB_OFFER_COPY.firstRun;
}

function setText(root, selector, text) {
  const element = root?.querySelector?.(selector);
  if (element) {
    element.textContent = text;
  }
}

function renderActions(root, actions) {
  const actionList = root?.querySelector?.("[data-aftersign-job-actions]");
  if (!actionList) {
    return;
  }

  actionList.replaceChildren();

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.setAttribute("aria-label", action.ariaLabel);
    button.dataset.aftersignTapChoice = action.id;
    button.dataset.aftersignJobAction = action.id;
    actionList.append(button);
  }
}

export function applyAftersignJobOfferCopy(root, memory = DEFAULT_MEMORY) {
  const copy = getAftersignJobOfferCopy(memory);

  if (!root) {
    return copy;
  }

  root.dataset.aftersignJobOfferState = copy.state;
  setText(root, "[data-aftersign-job-eyebrow]", copy.eyebrow);
  setText(root, "[data-aftersign-job-offer]", copy.offer);
  renderActions(root, copy.actions);

  return copy;
}

export { JOB_OFFER_COPY as aftersignJobOfferCopy };
