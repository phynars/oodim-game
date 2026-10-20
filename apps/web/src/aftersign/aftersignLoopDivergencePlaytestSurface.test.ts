import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function findRepoRoot(start: string): string {
  let directory = resolve(start);
  while (dirname(directory) !== directory) {
    if (existsSync(join(directory, "aftersign", "e2e"))) return directory;
    directory = dirname(directory);
  }
  throw new Error("Could not find the repository-root aftersign/e2e directory.");
}

const REPO_ROOT = findRepoRoot(process.cwd());
const AFTERSIGN_E2E_DIR = join(REPO_ROOT, "aftersign", "e2e");
const SERVED_MAIN_PATH = join(REPO_ROOT, "aftersign", "main.js");
const PACKET_OFFER_CONTROLLER_PATH = join(
  REPO_ROOT,
  "aftersign",
  "src",
  "interactions",
  "packetOfferController.js",
);
const PLAYTEST_FILENAME_PATTERN = /(?:playtest.*\.spec\.(?:ts|js)$|\.playtest\.spec\.(?:ts|js)$|-played\.spec\.(?:ts|js)$|-served[^.]*\.spec\.(?:ts|js)$)/i;
const PHONE_VIEWPORT = /(?:width\s*:\s*3[0-9]{2}\s*,\s*height\s*:\s*(?:6|7|8|9)[0-9]{2}|iphone|pixel|mobile|isMobile\s*:\s*true|hasTouch\s*:\s*true)/i;
const HARNESS_INPUT = /(?:window\.)?__game\s*\.\s*input\s*\./;
const PLAYER_EVENT = /\b(?:click|tap|press|keyboard|pointer|mouse|touchscreen)\s*\(/g;
const COMPLETED_ROUND = /(?:complete|finish|deliver|return)[\s\S]{0,100}(?:round|job|route|delivery)|(?:round|job|route|delivery)[\s\S]{0,100}(?:complete|finish|deliver|return)/gi;
const OFFERED_BUTTON = /(?:locator|getByRole)\s*\([\s\S]{0,180}data-offered-job-id[\s\S]{0,180}\)\s*\.(?:click|tap)\s*\(/;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/gm, "$1");
}

function stripCommentsAndStrings(source: string): string {
  return stripComments(source)
    // A bare `$` has its own branch, so `${` can match only one way: no
    // exponential backtracking (CodeQL js/redos, game alert #25).
    .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|\$(?!\{)|[^`\\$])*`/g, "``")
    .replace(/"(?:\\[\s\S]|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\[\s\S]|[^'\\\n])*'/g, "''");
}

function count(pattern: RegExp, source: string): number {
  pattern.lastIndex = 0;
  return [...source.matchAll(pattern)].length;
}

function readPlaytests(): Array<{ path: string; source: string }> {
  if (!existsSync(AFTERSIGN_E2E_DIR)) return [];
  return readdirSync(AFTERSIGN_E2E_DIR)
    .filter((name) => PLAYTEST_FILENAME_PATTERN.test(name))
    .map((name) => ({ path: join(AFTERSIGN_E2E_DIR, name), source: readFileSync(join(AFTERSIGN_E2E_DIR, name), "utf8") }));
}

// The only M-LOOP proof that counts is a rendered offer-button tap. A
// generic tap elsewhere can advance dialogue but cannot establish that the
// durable branch exposed a different available action.
function provesPlayedTwoRoundDivergence(source: string): boolean {
  const uncommented = stripComments(source);
  const executable = stripCommentsAndStrings(source);
  return (
    PHONE_VIEWPORT.test(uncommented) &&
    !HARNESS_INPUT.test(executable) &&
    /data-mloop-divergence-memory/.test(uncommented) &&
    /data-offered-job-id/.test(uncommented) &&
    OFFERED_BUTTON.test(uncommented) &&
    count(PLAYER_EVENT, executable) >= 4 &&
    count(COMPLETED_ROUND, uncommented) >= 2
  );
}

const COMPLIANT_FIXTURE = [
  "test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });",
  "await page.locator('[data-mloop-divergence-memory] button[data-offered-job-id]').tap();",
  "await page.getByRole('button', { name: /route/i }).tap();",
  "await page.getByRole('button', { name: /deliver round one job/i }).tap();",
  "await page.getByRole('button', { name: /return route/i }).tap();",
  "await page.getByRole('button', { name: /deliver return job/i }).tap();",
  "// complete round one delivery; complete return round delivery",
].join("\n");

describe("AFTERSIGN M-LOOP divergence played acceptance surface", () => {
  it("requires an offered-job button tap, rather than accepting an unrelated player event", () => {
    expect(provesPlayedTwoRoundDivergence(COMPLIANT_FIXTURE)).toBe(true);
    expect(provesPlayedTwoRoundDivergence(
      COMPLIANT_FIXTURE.replace("[data-mloop-divergence-memory] button[data-offered-job-id]", "#continueButton"),
    )).toBe(false);
    expect(provesPlayedTwoRoundDivergence(
      `${COMPLIANT_FIXTURE}\nawait page.evaluate(() => window.__game.input.choose('job'));`,
    )).toBe(false);
  });

  it("has one phone playtest that taps rendered divergent offers through two completed rounds", () => {
    const witness = readPlaytests().find(({ source }) => provesPlayedTwoRoundDivergence(source));
    expect(witness?.path).toBeDefined();
  });

  it("keeps the divergent offer writer wired into the served page", () => {
    const main = readFileSync(SERVED_MAIN_PATH, "utf8");
    expect(main).toContain('import { fingerprintJobOfferAction } from "../packages/aftersign/src/jobOfferActionFingerprint"');
    expect(main).toContain('"data-offer-fingerprint"');
    expect(main).toContain("armJobOfferFeel(button, () => {");
    expect(main).toContain("offeredJobs.appendChild(button);");
  });

  it("keeps packet press logic behind the packet-offer controller boundary", () => {
    const main = readFileSync(SERVED_MAIN_PATH, "utf8");
    const controller = readFileSync(PACKET_OFFER_CONTROLLER_PATH, "utf8");
    expect(main).toContain('import { createPacketOfferController } from "./src/interactions/packetOfferController.js"');
    expect(main).toContain("const packetOfferController = createPacketOfferController({");
    expect(main).toContain("const packetPress = (input) => packetOfferController.input.press(input);");
    expect(controller).toContain("export const createPacketOfferController");
    expect(controller).toContain("const press = (input) => {");
    expect(controller).toContain('recordGestureSample("press", input);');
    expect(controller).toContain("const snapshot = pressIntent(input);");
  });

  it("keeps packet-seal choices behind the route-choice controller boundary", () => {
    const main = readFileSync(SERVED_MAIN_PATH, "utf8");
    const controller = readFileSync(
      join(REPO_ROOT, "aftersign", "src", "interactions", "routeChoiceController.js"),
      "utf8",
    );
    expect(main).toContain('import { createRouteChoiceController } from "./src/interactions/routeChoiceController.js"');
    expect(main).toContain("const routeChoiceController = createRouteChoiceController({");
    expect(main).toContain("if (routeChoiceController.input.choose(choiceId)) return;");
    expect(main).not.toContain('if (choiceId === "open-packet") {');
    expect(controller).toContain("export const createRouteChoiceController");
    expect(controller).toContain('"open-packet": false');
    expect(controller).toContain('"keep-sealed": true');
    expect(controller).toContain('setBeat("packet-choice");');
  });

  it("route-choice controller unseals the packet on open-packet and seals it on keep-sealed", async () => {
    const controllerModule = await import(
      /* @vite-ignore */ join(REPO_ROOT, "aftersign", "src", "interactions", "routeChoiceController.js")
    );
    const createRouteChoiceController = controllerModule.createRouteChoiceController as (deps: {
      getState: () => { packet: { sealed: boolean } };
      setBeat: (beat: string) => void;
      markStateDirty: () => void;
    }) => { input: { choose: (choiceId: string) => boolean } };

    // open-packet: sealed → unsealed, dirty flag + beat fire.
    {
      const state = { packet: { sealed: true } };
      const beats: string[] = [];
      let dirtyCount = 0;
      const controller = createRouteChoiceController({
        getState: () => state,
        setBeat: (beat) => beats.push(beat),
        markStateDirty: () => {
          dirtyCount += 1;
        },
      });
      const handled = controller.input.choose("open-packet");
      expect(handled).toBe(true);
      expect(state.packet.sealed).toBe(false);
      expect(dirtyCount).toBe(1);
      expect(beats).toEqual(["packet-choice"]);
    }

    // open-packet when already unsealed: no dirty flag, beat still fires.
    {
      const state = { packet: { sealed: false } };
      const beats: string[] = [];
      let dirtyCount = 0;
      const controller = createRouteChoiceController({
        getState: () => state,
        setBeat: (beat) => beats.push(beat),
        markStateDirty: () => {
          dirtyCount += 1;
        },
      });
      controller.input.choose("open-packet");
      expect(state.packet.sealed).toBe(false);
      expect(dirtyCount).toBe(0);
      expect(beats).toEqual(["packet-choice"]);
    }

    // keep-sealed: unsealed → sealed, dirty flag + beat fire.
    {
      const state = { packet: { sealed: false } };
      const beats: string[] = [];
      let dirtyCount = 0;
      const controller = createRouteChoiceController({
        getState: () => state,
        setBeat: (beat) => beats.push(beat),
        markStateDirty: () => {
          dirtyCount += 1;
        },
      });
      const handled = controller.input.choose("keep-sealed");
      expect(handled).toBe(true);
      expect(state.packet.sealed).toBe(true);
      expect(dirtyCount).toBe(1);
      expect(beats).toEqual(["packet-choice"]);
    }

    // keep-packet-sealed alias behaves identically.
    {
      const state = { packet: { sealed: false } };
      const beats: string[] = [];
      let dirtyCount = 0;
      const controller = createRouteChoiceController({
        getState: () => state,
        setBeat: (beat) => beats.push(beat),
        markStateDirty: () => {
          dirtyCount += 1;
        },
      });
      const handled = controller.input.choose("keep-packet-sealed");
      expect(handled).toBe(true);
      expect(state.packet.sealed).toBe(true);
      expect(dirtyCount).toBe(1);
      expect(beats).toEqual(["packet-choice"]);
    }

    // Unknown choice is not handled — caller must keep dispatching.
    {
      const state = { packet: { sealed: true } };
      const beats: string[] = [];
      let dirtyCount = 0;
      const controller = createRouteChoiceController({
        getState: () => state,
        setBeat: (beat) => beats.push(beat),
        markStateDirty: () => {
          dirtyCount += 1;
        },
      });
      const handled = controller.input.choose("deliver-packet");
      expect(handled).toBe(false);
      expect(state.packet.sealed).toBe(true);
      expect(dirtyCount).toBe(0);
      expect(beats).toEqual([]);
    }
  });
});
