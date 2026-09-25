import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The served M-LOOP contract is deliberately structural: memory divergence only
// counts when the rendered offer tray exposes both the memory branch and a
// stable identifier for each tappable offer. Snapshot-only evidence is not a
// player-facing action surface.
function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (dirname(directory) !== directory) {
    if (existsSync(join(directory, "aftersign", "main.js"))) return directory;
    directory = dirname(directory);
  }
  throw new Error("Could not find the repository-root aftersign/main.js.");
}

const MAIN_PATH = join(findRepoRoot(process.cwd()), "aftersign", "main.js");

describe("AFTERSIGN served M-LOOP divergence tray contract", () => {
  it("publishes the durable-memory branch and stable offer ids on the rendered tray", () => {
    const main = readFileSync(MAIN_PATH, "utf8");

    expect(main).toContain('offeredJobs.setAttribute("data-mloop-divergence-memory",');
    expect(main).toContain('button.setAttribute("data-offered-job-id",');
    expect(main).toContain("offeredJobs.appendChild(button);");
  });
});
