export type VerticalSliceMilestoneStatus = "queued" | "in-flight" | "merged";

export type VerticalSliceMilestone = {
  readonly id: string;
  readonly playerProof: string;
  readonly harnessProof: string;
  readonly status: VerticalSliceMilestoneStatus;
};

export const aftersignVerticalSliceMilestones = [
  {
    id: "story-state-contract",
    playerProof:
      "The slice exposes the current build, packet outcome, route attention, and Io recognition state through one stable story-state surface.",
    harnessProof:
      "An e2e contract can read the story-state surface before and after the first packet choice without relying on DOM copy.",
    status: "merged",
  },
  {
    id: "kiosk-packet-choice",
    playerProof:
      "The player can inspect the kiosk packet, choose whether to seal or open it, and see immediate in-world confirmation.",
    harnessProof:
      "An e2e contract can drive both packet outcomes and observe the resulting state transition.",
    status: "merged",
  },
  {
    id: "io-remembers-prior-session",
    playerProof:
      "On return, Io says a line that depends on what this player did with the blue packet in a prior session.",
    harnessProof:
      "An e2e contract can seed a prior session, reload, and assert Io's remembered line is outcome-specific.",
    status: "in-flight",
  },
  {
    id: "durable-save-load",
    playerProof:
      "The remembered packet outcome survives a fresh page load without asking the player to repeat the choice.",
    harnessProof:
      "An e2e contract can persist, reload, and prove the restored state belongs to the active save slot only.",
    status: "merged",
  },
  {
    id: "phone-ready-look-sound",
    playerProof:
      "The memory beat reads clearly on a phone viewport with legible framing, restrained motion, and a sound cue that supports the recognition moment.",
    harnessProof:
      "An e2e contract can assert the phone viewport, reduced-motion fallback, and sound-cue timing without snapshot fragility.",
    status: "in-flight",
  },
] as const satisfies readonly VerticalSliceMilestone[];

export function getNextVerticalSliceMilestone(
  milestones: readonly VerticalSliceMilestone[] = aftersignVerticalSliceMilestones,
): VerticalSliceMilestone | undefined {
  return milestones.find((milestone) => milestone.status !== "merged");
}
