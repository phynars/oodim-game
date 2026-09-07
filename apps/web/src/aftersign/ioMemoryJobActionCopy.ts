export type IoMemoryJobBranch = "firstRun" | "trusted" | "opened";

export type IoMemoryJobActionCopy = {
  id: string;
  branch: IoMemoryJobBranch;
  label: string;
  route: string;
  risk: string;
  ioLine: string;
};

export const IO_MEMORY_JOB_ACTION_COPY: Record<IoMemoryJobBranch, IoMemoryJobActionCopy[]> = {
  firstRun: [
    {
      id: "take-job-blue-seal-safe-run",
      branch: "firstRun",
      label: "Take the lit stair",
      route: "Keep to the amber lamps. Let every sign see the seal stay whole.",
      risk: "Safe route. Slow enough for Io to know whether you listened.",
      ioLine: "First job. Small packet. Bright stair. Bring back the same seal you leave with."
    }
  ],
  trusted: [
    {
      id: "take-job-underbell-shortcut",
      branch: "trusted",
      label: "Take the dark cut",
      route: "Cross under the dead lanterns before the bell changes its mind.",
      risk: "Fast route. Higher risk. Io offers it because the last seal came home whole.",
      ioLine: "You kept one promise. That buys you a worse staircase."
    },
    {
      id: "take-job-blue-seal-safe-run",
      branch: "trusted",
      label: "Take the lit stair",
      route: "Keep to the amber lamps. Let every sign see the seal stay whole.",
      risk: "Safe route. Slower, cleaner, watched.",
      ioLine: "Safe work is still work. Do not let Niko sell you shame for speed."
    }
  ],
  opened: [
    {
      id: "take-job-blue-seal-safe-run",
      branch: "opened",
      label: "Take the watched route",
      route: "Stay in the amber lamps. Let every sign watch the packet.",
      risk: "Low route risk. Low trust. Io keeps the job visible.",
      ioLine: "You came back. The seal did not. I can use one of those facts."
    }
  ]
};
