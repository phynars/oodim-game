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
    // The post-choice beat is emitted via setState's `beat` field — this
    // string anchors the "packet-choice" scene wiring in the controller
    // so a stray rename cannot pass tests silently.
    expect(controller).toContain('beat: "packet-choice"');
  });

  it("route-choice controller emits a setState payload that seals/unseals the packet and advances the beat", async () => {
    const controllerModule = await import(
      /* @vite-ignore */ join(REPO_ROOT, "aftersign", "src", "interactions", "routeChoiceController.js")
    );
    type SetStatePayload = { packetSealed: boolean | null; beat: string };
    const createRouteChoiceController = controllerModule.createRouteChoiceController as (deps: {
      getState: () => { packet: { sealed: boolean } };
      setState: (payload: SetStatePayload) => void;
    }) => { input: { choose: (choiceId: string) => boolean } };

    // open-packet with a sealed packet: controller tells main.js to unseal
    // and advance to packet-choice.
    {
      const state = { packet: { sealed: true } };
      const calls: SetStatePayload[] = [];
      const controller = createRouteChoiceController({
        getState: () => state,
        setState: (payload) => calls.push(payload),
      });
      const handled = controller.input.choose("open-packet");
      expect(handled).toBe(true);
      expect(calls).toEqual([{ packetSealed: false, beat: "packet-choice" }]);
    }

    // open-packet when already unsealed: packetSealed is null (no mutation)
    // but the beat still fires so main.js can re-render.
    {
      const state = { packet: { sealed: false } };
      const calls: SetStatePayload[] = [];
      const controller = createRouteChoiceController({
        getState: () => state,
        setState: (payload) => calls.push(payload),
      });
      controller.input.choose("open-packet");
      expect(calls).toEqual([{ packetSealed: null, beat: "packet-choice" }]);
    }

    // keep-sealed on an unsealed packet: controller tells main.js to seal
    // and advance to packet-choice.
    {
      const state = { packet: { sealed: false } };
      const calls: SetStatePayload[] = [];
      const controller = createRouteChoiceController({
        getState: () => state,
        setState: (payload) => calls.push(payload),
      });
      const handled = controller.input.choose("keep-sealed");
      expect(handled).toBe(true);
      expect(calls).toEqual([{ packetSealed: true, beat: "packet-choice" }]);
    }

    // keep-packet-sealed alias behaves identically to keep-sealed — proves
    // the alias row in PACKET_SEAL_CHOICES is wired, not just declared.
    {
      const state = { packet: { sealed: false } };
      const calls: SetStatePayload[] = [];
      const controller = createRouteChoiceController({
        getState: () => state,
        setState: (payload) => calls.push(payload),
      });
      const handled = controller.input.choose("keep-packet-sealed");
      expect(handled).toBe(true);
      expect(calls).toEqual([{ packetSealed: true, beat: "packet-choice" }]);
    }

    // keep-sealed when already sealed: no mutation (packetSealed is null),
    // beat still fires so the scene re-renders.
    {
      const state = { packet: { sealed: true } };
      const calls: SetStatePayload[] = [];
      const controller = createRouteChoiceController({
        getState: () => state,
        setState: (payload) => calls.push(payload),
      });
      controller.input.choose("keep-sealed");
      expect(calls).toEqual([{ packetSealed: null, beat: "packet-choice" }]);
    }

    // Unknown choice is not handled — caller (main.js `choose`) must keep
    // dispatching. The controller must not call setState at all.
    {
      const state = { packet: { sealed: true } };
      const calls: SetStatePayload[] = [];
      const controller = createRouteChoiceController({
        getState: () => state,
        setState: (payload) => calls.push(payload),
      });
      const handled = controller.input.choose("deliver-packet");
      expect(handled).toBe(false);
      expect(calls).toEqual([]);
    }

    // Inherited keys like "constructor" / "toString" must NOT be treated
    // as handled — PACKET_SEAL_CHOICES is a plain frozen object, so a
    // bare `obj[key]` lookup would resolve to Object.prototype methods
    // and sneak a function value through setState. The own-property
    // guard is what prevents that; this assertion locks it in.
    for (const inheritedKey of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      const state = { packet: { sealed: true } };
      const calls: SetStatePayload[] = [];
      const controller = createRouteChoiceController({
        getState: () => state,
        setState: (payload) => calls.push(payload),
      });
      const handled = controller.input.choose(inheritedKey);
      expect(handled).toBe(false);
      expect(calls).toEqual([]);
    }
  });

  it("keeps job-offer press logic behind the job-offer controller boundary", () => {
    const main = readFileSync(SERVED_MAIN_PATH, "utf8");
    const controller = readFileSync(
      join(REPO_ROOT, "aftersign", "src", "interactions", "jobOfferController.js"),
      "utf8",
    );
    expect(main).toContain('import { createJobOfferController } from "./src/interactions/jobOfferController.js"');
    expect(main).toContain("const jobOfferController = createJobOfferController({");
    expect(main).toContain("jobOfferController.input.press({");
    expect(main).toContain("jobOfferController.commit();");
    // State transition must precede the DOM receipt (pre-extraction order).
    expect(main.indexOf("jobOfferController.input.press({")).toBeLessThan(
      main.indexOf('acceptedNode.id = "ioJobAcceptedLine";'),
    );
    expect(main.indexOf('acceptedNode.id = "ioJobAcceptedLine";')).toBeLessThan(
      main.indexOf("jobOfferController.commit();"),
    );
    // The inline arithmetic that used to live at the call site is now the
    // controller's job — assert the former literals are gone from main.js
    // so a drive-by edit can't restore the duplication silently.
    expect(main).not.toContain("state.interaction.lastAction = `${mloopAction.id}:${offer.id}`;");
    expect(controller).toContain("export const createJobOfferController");
    expect(controller).toContain("const press = ({ actionId, offerId }) => {");
    expect(controller).toContain("setLastAction(`${actionId}:${offerId}`);");
    expect(controller).toContain("incrementConfirmCount();");
    expect(controller).toContain("markStateDirty();");
    expect(controller).toContain("render();");
  });

  it("job-offer controller composes actionId:offerId, bumps confirmCount, persists, and publishes — in that order", async () => {
    const controllerModule = await import(
      /* @vite-ignore */ join(REPO_ROOT, "aftersign", "src", "interactions", "jobOfferController.js")
    );
    type JobOfferDeps = {
      setLastAction: (nextLastAction: string) => void;
      incrementConfirmCount: () => void;
      markStateDirty: () => void;
      render: () => void;
      getState: () => { lastAction: string; confirmCount: number };
    };
    const createJobOfferController = controllerModule.createJobOfferController as (
      deps: JobOfferDeps,
    ) => {
      input: { press: (input: { actionId: string; offerId: string }) => unknown };
      commit: () => unknown;
    };

    // Observable press: records each dep call in order, mutates a plain
    // interaction snapshot the way main.js does, and asserts the exposed
    // read-back matches.
    const interaction = { lastAction: "", confirmCount: 0 };
    const order: string[] = [];
    const controller = createJobOfferController({
      setLastAction: (nextLastAction) => {
        order.push(`setLastAction:${nextLastAction}`);
        interaction.lastAction = nextLastAction;
      },
      incrementConfirmCount: () => {
        order.push("incrementConfirmCount");
        interaction.confirmCount += 1;
      },
      markStateDirty: () => order.push("markStateDirty"),
      render: () => order.push("render"),
      getState: () => interaction,
    });

    const result = controller.input.press({ actionId: "mloop-a", offerId: "job-42" });

    // press is the state transition only — no persistence/publish yet.
    expect(order).toEqual(["setLastAction:mloop-a:job-42", "incrementConfirmCount"]);
    expect(interaction).toEqual({ lastAction: "mloop-a:job-42", confirmCount: 1 });
    expect(result).toBe(interaction);

    const committed = controller.commit();
    expect(order).toEqual([
      "setLastAction:mloop-a:job-42",
      "incrementConfirmCount",
      "markStateDirty",
      "render",
    ]);
    expect(committed).toBe(interaction);

    // Second press increments cumulatively — proves confirmCount is a
    // host-owned counter the controller advances, not reset per press.
    controller.input.press({ actionId: "mloop-b", offerId: "job-7" });
    expect(interaction).toEqual({ lastAction: "mloop-b:job-7", confirmCount: 2 });
  });
});
