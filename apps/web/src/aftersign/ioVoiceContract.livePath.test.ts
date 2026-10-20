import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression guard for #2391 / #2408 — the live bundle shipped the old Io
// return copy because PR #2390's "new" lines were authored in modules
// that `aftersign/main.js` does not import. The player-visible return
// copy is served by two modules that ARE in the `aftersign/main.js` graph:
//
//   - `aftersign/src/ioVoice.js`             — `IO_VOICE.returned`, `ioReturnLine`
//   - `aftersign/src/story/ioMemoryLines.ts` — `IO_RETURNING_MEMORY_LINES`,
//                                              `getIoReturningMemoryLine`
//
// Both import `IO_SEALED_RETURN_LINE` / `IO_OPENED_RETURN_LINE` from
// `aftersign/src/ioSealedReturn.ts` — the single canonical source. This
// test pins:
//   (a) the canon file still holds the full canonical strings (a rename
//       that silently drops a word reds here); and
//   (b) each served module imports from `./ioSealedReturn` instead of
//       re-typing a literal (a drift back to inline strings reds here).
//
// Pattern follows `servedSurface.contract.test.ts` — assert against the
// RAW served source, not a transpiled import, so this file does not
// depend on which bundler / module resolver vitest is configured with.
describe("Io return voice contract — live-served copy", () => {
  const readServed = (rel: string) =>
    readFileSync(join(process.cwd(), "aftersign", rel), "utf8");
  // The apps/web Aftersign modules live under `apps/web/src/aftersign/`
  // relative to the repo root. The test runner's cwd depends on whether
  // vitest was invoked from the package or the repo root, so probe both.
  const readAppsWeb = (rel: string) => {
    const candidates = [
      join(process.cwd(), "apps", "web", "src", "aftersign", rel),
      join(process.cwd(), "..", "..", "src", "aftersign", rel),
      join(process.cwd(), "src", "aftersign", rel),
    ];
    for (const p of candidates) {
      try {
        return readFileSync(p, "utf8");
      } catch {
        /* try next */
      }
    }
    throw new Error(
      `Could not locate apps/web/src/aftersign/${rel} from cwd ${process.cwd()}`,
    );
  };

  const IO_SEALED_CANON =
    "You made it back. So did the blue seal, unbroken. That makes two reasons to trust you.";
  const IO_OPENED_CANON =
    "You made it back. The seal did not. I can use one of those facts.";
  // The forked PR #2390 opened-return copy. If this string reappears in
  // any served Io module, Io's return beat has drifted off canon again.
  const IO_OPENED_FORK =
    "You opened it. The name is alive elsewhere now. I will charge you for the next route.";

  it("the canonical `ioSealedReturn` module ships both full canonical strings", () => {
    const src = readServed("src/ioSealedReturn.ts");
    // Canon is authored as a 3-beat tuple joined with a single space;
    // assert each beat appears so a split-into-tuple refactor can't
    // drop a word without reddening here.
    expect(src).toContain('"You made it back."');
    expect(src).toContain('"So did the blue seal, unbroken."');
    expect(src).toContain('"That makes two reasons to trust you."');
    expect(src).toContain('"The seal did not."');
    expect(src).toContain('"I can use one of those facts."');
    expect(src).toContain("export const IO_SEALED_RETURN_LINE");
    expect(src).toContain("export const IO_OPENED_RETURN_LINE");
  });

  it("`aftersign/src/ioVoice.js` sources the return lines from `./ioSealedReturn` (no inline literal)", () => {
    const src = readServed("src/ioVoice.js");
    // (a) It imports BOTH canonical constants from the single-owner module.
    expect(src).toMatch(
      /import\s*\{[^}]*IO_OPENED_RETURN_LINE[^}]*\}\s*from\s*["']\.\/ioSealedReturn\.ts["']/,
    );
    expect(src).toMatch(
      /import\s*\{[^}]*IO_SEALED_RETURN_LINE[^}]*\}\s*from\s*["']\.\/ioSealedReturn\.ts["']/,
    );
    // (b) The `returned` table binds each outcome to the canonical constant,
    //     not to a drifted inline string. The two full canon lines must
    //     NOT appear as inline literals in this module.
    expect(src).toContain("sealed: IO_SEALED_RETURN_LINE");
    expect(src).toContain("opened: IO_OPENED_RETURN_LINE");
    expect(src).not.toContain(IO_SEALED_CANON);
    expect(src).not.toContain(IO_OPENED_CANON);
    // (c) The selector `ioReturnLine` is still exported — this is the
    //     identifier `aftersign/main.js` consumes.
    expect(src).toMatch(/export\s+function\s+ioReturnLine\s*\(/);
  });

  it("`aftersign/src/story/ioMemoryLines.ts` sources the return lines from `../ioSealedReturn`", () => {
    const src = readServed("src/story/ioMemoryLines.ts");
    expect(src).toMatch(
      /import\s*\{[^}]*IO_OPENED_RETURN_LINE[^}]*\}\s*from\s*['"]\.\.\/ioSealedReturn\.ts['"]/,
    );
    expect(src).toMatch(
      /import\s*\{[^}]*IO_SEALED_RETURN_LINE[^}]*\}\s*from\s*['"]\.\.\/ioSealedReturn\.ts['"]/,
    );
    // The memory-line table and resolver bind to the constants, not
    // inline literals.
    expect(src).toContain("sealed: IO_SEALED_RETURN_LINE");
    expect(src).toContain("opened: IO_OPENED_RETURN_LINE");
    expect(src).not.toContain(IO_SEALED_CANON);
    expect(src).not.toContain(IO_OPENED_CANON);
    expect(src).toMatch(/export\s+function\s+getIoReturningMemoryLine\s*\(/);
  });

  it("`apps/web/src/aftersign/ioVoiceContract.ts` sources openedReturn + sealedReturn from the canon module (no inline literal, no PR #2390 fork)", () => {
    const src = readAppsWeb("ioVoiceContract.ts");
    // (a) It imports BOTH canonical constants from the single-owner module.
    expect(src).toMatch(
      /import\s*\{[\s\S]*?IO_OPENED_RETURN_LINE[\s\S]*?\}\s*from\s*["'][^"']*ioSealedReturn\.js["']/,
    );
    expect(src).toMatch(
      /import\s*\{[\s\S]*?IO_SEALED_RETURN_LINE[\s\S]*?\}\s*from\s*["'][^"']*ioSealedReturn\.js["']/,
    );
    // (b) The `AFTERSIGN_IO_LINES` table binds each outcome's text to
    //     the canonical constant, not a drifted inline string.
    expect(src).toMatch(/openedReturn:\s*\{[^}]*text:\s*IO_OPENED_RETURN_LINE/);
    expect(src).toMatch(/sealedReturn:\s*\{[^}]*text:\s*IO_SEALED_RETURN_LINE/);
    // (c) Neither the full canon line NOR the forked PR #2390 copy
    //     appears inline here.
    expect(src).not.toContain(IO_SEALED_CANON);
    expect(src).not.toContain(IO_OPENED_CANON);
    expect(src).not.toContain(IO_OPENED_FORK);
  });

  it("`apps/web/src/aftersign/ioFirstSceneDialogue.ts` sources openedReturn + sealedReturn from the canon module (no inline literal, no PR #2390 fork)", () => {
    const src = readAppsWeb("ioFirstSceneDialogue.ts");
    expect(src).toMatch(
      /import\s*\{[\s\S]*?IO_OPENED_RETURN_LINE[\s\S]*?\}\s*from\s*["'][^"']*ioSealedReturn\.js["']/,
    );
    expect(src).toMatch(
      /import\s*\{[\s\S]*?IO_SEALED_RETURN_LINE[\s\S]*?\}\s*from\s*["'][^"']*ioSealedReturn\.js["']/,
    );
    // The AFTERSIGN_IO_FIRST_SCENE_DIALOGUE tuple binds openedReturn and
    // sealedReturn's `text` to the canonical constants.
    expect(src).toMatch(
      /id:\s*"openedReturn"[\s\S]{0,160}?text:\s*IO_OPENED_RETURN_LINE/,
    );
    expect(src).toMatch(
      /id:\s*"sealedReturn"[\s\S]{0,160}?text:\s*IO_SEALED_RETURN_LINE/,
    );
    expect(src).not.toContain(IO_SEALED_CANON);
    expect(src).not.toContain(IO_OPENED_CANON);
    expect(src).not.toContain(IO_OPENED_FORK);
  });
});
