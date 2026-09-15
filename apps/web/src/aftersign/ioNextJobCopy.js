const NEXT_JOB_COPY = {
  sealed: {
    heading: "The seal held.",
    lead: "That buys you a harder errand.",
    jobs: [
      {
        id: "bell-archive-ledger",
        label: "Take the Bell Archive ledger",
        detail: "Lit stairs. A name that wants proof.",
      },
      {
        id: "moth-pier-confirmation",
        label: "Carry a confirmation to Moth Pier",
        detail: "Long route. No one waiting is patient.",
      },
    ],
  },
  opened: {
    heading: "The seal broke.",
    lead: "So the city gets the work that needs looking at.",
    jobs: [
      {
        id: "unlit-door-receipt",
        label: "Return a receipt to the Unlit Door",
        detail: "Short route. Keep the lamp behind you.",
      },
      {
        id: "silt-stair-apology",
        label: "Carry an apology up the Silt Stair",
        detail: "Public route. The words are already late.",
      },
    ],
  },
};

export function chooseIoNextJobCopy(packetOutcome) {
  return packetOutcome === "opened" ? NEXT_JOB_COPY.opened : NEXT_JOB_COPY.sealed;
}
