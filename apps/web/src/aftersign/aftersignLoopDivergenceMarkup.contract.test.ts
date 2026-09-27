import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// M-LOOP's acceptance evidence is the offer tray a player can touch. The
// server-selected memory branch must be stamped on that tray, and every offer
// must have a stable job id on its rendered button. A fingerprint alone is not
// enough: it cannot tell the played spec which durable-memory branch supplied
// the available action.
function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (dirname(directory) !== directory) {
    if (existsSync(join(directory, "aftersign", "main.js"))) return directory;
    directory = dirname(directory);
  }
  throw new Error("Could not find repository-root aftersign/main.js.");
}

describe("AFTERSIGN M-LOOP offered-job markup contract", () => {
  it("stamps the durable-memory divergence bucket and stable job ids on the rendered offer surface", () => {
    const main = readFileSync(join(findRepoRoot(process.cwd()), "aftersign", "main.js"), "utf8");

    expect(main).toContain('offeredJobs.setAttribute("data-mloop-divergence-memory",');
    expect(main).toMatch(/data-mloop-divergence-memory[\s\S]{0,500}(?:fresh|completed|debt-held)/);
    expect(main).toContain('button.setAttribute("data-offered-job-id",');
    expect(main).toContain("offeredJobs.appendChild(button);");
  });
});
