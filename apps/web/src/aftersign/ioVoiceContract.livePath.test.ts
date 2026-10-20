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

  const IO_SEALED_CANON =
    "You made it back. So did the blue seal, unbroken. That makes two reasons to trust you.";
  const IO_OPENED_CANON =
    "You made it back. The seal did not. I can use one of those facts.";

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
});
