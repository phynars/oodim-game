// Served-HTML contract for the #routeChoice press envelope (PR #1806).
//
// Lives at the `aftersign/` level — OUTSIDE `aftersign/tsconfig.json`'s
// `include: ["src"]`, so it can use `node:fs` / `node:path` without
// widening the tsconfig's `types` (which is intentionally scoped to
// `["vite/client"]` to keep the browser-source strict-mode gate green).
// Executed by the plain-Node pure-runner
// (`aftersign/pure-runner.ts`) under `node --experimental-strip-types`,
// which handles TS-in-Node without going through the aftersign tsconfig.
//
// This is the drift alarm that closes PR #1806's "zero importers" gap.
// The four `ROUTE_CHOICE_PRESS_*` numeric constants declared in
// `aftersign/src/routeChoicePressFeedback.ts` are mirrored on the
// served surface in three places that cannot cross-import TS:
//
//   1. `:root { --aftersign-route-choice-press-* }` in
//      `aftersign/index.html` — the four CSS variables the consumer
//      rule reads to paint the compressed transform + hold-ms.
//
//   2. `#routeChoice button[data-aftersign-route-choice-press="pressing"]`
//      CSS rule in `aftersign/index.html` — the consumer that turns
//      the stamped `data-aftersign-route-choice-press` marker into
//      paint on the two committing buttons.
//
//   3. `<script type="module" src="./routeChoicePressing.js">` tag in
//      `aftersign/index.html` — loads the module that owns the
//      pointerdown → marker → setTimeout(hold-ms) → release cycle,
//      so a touch tap paints for the full envelope regardless of
//      finger contact duration.
//
// Every assertion below pins one of those three against the TS
// constants. If a maintainer edits `--aftersign-route-choice-press-scale-from`
// from 0.972 → 0.95 without updating `ROUTE_CHOICE_PRESS_SCALE` (or
// vice versa), or removes the `<script>` tag, or renames the two
// committing button ids, the pure lane reds here — the same discipline
// the sibling `apps/web/src/aftersign/servedSurface.contract.test.ts`
// uses for the shipped tap-choice surface.
//
// Extension-resolution contract: this file's sole relative import
// (`./src/routeChoicePressFeedback.ts`) is `.ts`-extensioned; the
// leaf itself has zero relative imports. `node:fs` / `node:path` are
// built-ins that bypass the extension resolver. The subgraph satisfies
// the pure-runner extension-resolution contract documented in
// `aftersign/pure-runner.ts`.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ROUTE_CHOICE_PRESS_LIFT_PX,
  ROUTE_CHOICE_PRESS_OUT_MS,
  ROUTE_CHOICE_PRESS_SCALE,
} from "./src/routeChoicePressFeedback.ts";

function assertMatches(
  haystack: string,
  pattern: RegExp,
  message: string,
): void {
  if (!pattern.test(haystack)) {
    throw new Error(
      `${message}: pattern ${pattern.source} not found in served index.html`,
    );
  }
}

// Escape decimals when interpolating a numeric constant into a
// RegExp source so a `.` matches a literal dot, not any character.
function escapeForRegExp(value: number): string {
  return String(value).replace(/[.]/g, "\\.");
}

export function checkRouteChoicePressServedContract(): void {
  const htmlPath = join(process.cwd(), "aftersign", "index.html");
  const html = readFileSync(htmlPath, "utf8");

  // (a) :root variables — value must match the TS constants exactly.
  assertMatches(
    html,
    new RegExp(
      `--aftersign-route-choice-press-scale-from:\\s*${escapeForRegExp(ROUTE_CHOICE_PRESS_SCALE)}\\s*;`,
    ),
    "index.html must author --aftersign-route-choice-press-scale-from matching ROUTE_CHOICE_PRESS_SCALE",
  );
  assertMatches(
    html,
    new RegExp(
      `--aftersign-route-choice-press-lift-px:\\s*${escapeForRegExp(ROUTE_CHOICE_PRESS_LIFT_PX)}px\\s*;`,
    ),
    "index.html must author --aftersign-route-choice-press-lift-px matching ROUTE_CHOICE_PRESS_LIFT_PX",
  );
  assertMatches(
    html,
    new RegExp(
      `--aftersign-route-choice-press-hold-ms:\\s*${escapeForRegExp(ROUTE_CHOICE_PRESS_OUT_MS)}ms\\s*;`,
    ),
    "index.html must author --aftersign-route-choice-press-hold-ms matching ROUTE_CHOICE_PRESS_OUT_MS",
  );
  assertMatches(
    html,
    /--aftersign-route-choice-press-easing:\s*cubic-bezier\(\.2,\s*\.8,\s*\.2,\s*1\)\s*;/,
    "index.html must author --aftersign-route-choice-press-easing (cubic-bezier juice curve)",
  );

  // (b) CSS consumer rule — must select #routeChoice buttons carrying
  //     the pressing marker, and must reference the three variable
  //     channels the JS press-marker owner keys the paint off (scale,
  //     lift, easing). Bounded `[\s\S]{0,600}?` so a runaway match
  //     can't swallow the whole file.
  const consumerRule =
    /#routeChoice button\[data-aftersign-route-choice-press="pressing"\]\s*\{[\s\S]{0,600}?\}/;
  const consumerMatch = html.match(consumerRule);
  if (!consumerMatch) {
    throw new Error(
      "index.html must ship a #routeChoice pressing consumer rule that paints the press envelope",
    );
  }
  const rule = consumerMatch[0];
  assertMatches(
    rule,
    /var\(--aftersign-route-choice-press-scale-from/,
    "consumer rule must read --aftersign-route-choice-press-scale-from",
  );
  assertMatches(
    rule,
    /var\(--aftersign-route-choice-press-lift-px/,
    "consumer rule must read --aftersign-route-choice-press-lift-px",
  );
  assertMatches(
    rule,
    /var\(--aftersign-route-choice-press-easing/,
    "consumer rule must read --aftersign-route-choice-press-easing",
  );

  // (c) <script> tag — the JS press-marker owner must be loaded so
  //     pointerdown actually stamps the marker the CSS rule keys off.
  //     Order matters relative to main.js (before, so the module-level
  //     MutationObserver in routeChoicePressing.js is armed before
  //     main.js starts injecting DOM).
  assertMatches(
    html,
    /<script[^>]+src="\.\/routeChoicePressing\.js"[^>]*>\s*<\/script>/,
    "index.html must load ./routeChoicePressing.js so the pressing marker gets stamped",
  );

  // (d) The two committing route-choice buttons must exist inside
  //     `#routeChoice` — a rename would silently orphan the press
  //     module's selector. Pin the shipped ids the press module targets.
  assertMatches(
    html,
    /<div\s+id="routeChoice"[\s\S]{0,1200}?<button\s+id="acknowledgeRouteButton"/,
    "#routeChoice must host #acknowledgeRouteButton (route-choice press target)",
  );
  assertMatches(
    html,
    /<div\s+id="routeChoice"[\s\S]{0,1200}?<button\s+id="skipRouteButton"/,
    "#routeChoice must host #skipRouteButton (route-choice press target)",
  );
}

export function runRouteChoicePressServedContractChecks(): void {
  checkRouteChoicePressServedContract();
}
