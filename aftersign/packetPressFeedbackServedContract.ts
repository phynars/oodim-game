// Served-HTML contract for the #packetButton logic-side press-feedback
// envelope (PR #1879).
//
// Lives at the `aftersign/` level — OUTSIDE `aftersign/tsconfig.json`'s
// `include: ["src"]`, so it can use `node:fs` / `node:path` without
// widening the tsconfig's `types` (which is intentionally scoped to
// `["vite/client"]` to keep the browser-source strict-mode gate green).
// Executed by the plain-Node pure-runner (`aftersign/pure-runner.ts`)
// under `node --experimental-strip-types`, which handles TS-in-Node
// without going through the aftersign tsconfig.
//
// This is the drift alarm that closes PR #1879's "zero importers" gap.
// `PACKET_PRESS_FEEDBACK_MS` in `aftersign/src/packet-press-feedback.ts`
// is mirrored on the served surface in two places that cannot
// cross-import TS:
//
//   1. `:root { --aftersign-packet-press-feedback-hold-ms }` in
//      `aftersign/index.html` — the CSS variable the consumer rule
//      reads to time the paint envelope.
//
//   2. `#packetButton[data-packet-press-feedback="pressed"]` CSS rule
//      in `aftersign/index.html` — the consumer that turns the
//      stamped `data-packet-press-feedback` marker into paint on
//      `#packetButton` when `packetPress(input)` fires.
//
// If a maintainer edits `PACKET_PRESS_FEEDBACK_MS` without updating
// the CSS var (or vice versa), or drops the consumer rule, the pure
// lane reds here — the same discipline
// `aftersign/routeChoicePressServedContract.ts` uses for the #1806
// route-choice envelope.
//
// Extension-resolution contract: this file's sole relative import
// (`./src/packet-press-feedback.ts`) is `.ts`-extensioned; the leaf
// itself has zero relative imports. `node:fs` / `node:path` are
// built-ins that bypass the extension resolver.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PACKET_PRESS_FEEDBACK_MS } from "./src/packet-press-feedback.ts";

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

export function checkPacketPressFeedbackServedContract(): void {
  const htmlPath = join(process.cwd(), "aftersign", "index.html");
  const html = readFileSync(htmlPath, "utf8");

  // (a) :root variable — value must match the TS constant exactly.
  //     A `MS: 92 → 108` edit that forgets to update the CSS var reds
  //     here.
  assertMatches(
    html,
    new RegExp(
      `--aftersign-packet-press-feedback-hold-ms:\\s*${PACKET_PRESS_FEEDBACK_MS}ms\\s*;`,
    ),
    "index.html must author --aftersign-packet-press-feedback-hold-ms matching PACKET_PRESS_FEEDBACK_MS",
  );

  // (b) CSS consumer rule — must select #packetButton carrying the
  //     `pressed` marker AND reference the hold-ms variable so the
  //     transition timing is actually driven by the TS constant.
  //     Bounded `[\s\S]{0,600}?` so a runaway match can't swallow
  //     the whole file.
  const consumerRule =
    /#packetButton\[data-packet-press-feedback="pressed"\]\s*\{[\s\S]{0,600}?\}/;
  const consumerMatch = html.match(consumerRule);
  if (!consumerMatch) {
    throw new Error(
      "index.html must ship a #packetButton[data-packet-press-feedback=\"pressed\"] consumer rule",
    );
  }
  const rule = consumerMatch[0];
  assertMatches(
    rule,
    /var\(--aftersign-packet-press-feedback-hold-ms/,
    "consumer rule must read --aftersign-packet-press-feedback-hold-ms so the TS constant drives paint timing",
  );

  // (c) #packetButton must exist as a real served button — a rename
  //     would silently orphan the stamp target.
  assertMatches(
    html,
    /<button\s+id="packetButton"/,
    "index.html must ship #packetButton for packetPress feedback to stamp onto",
  );
}

export function runPacketPressFeedbackServedContractChecks(): void {
  checkPacketPressFeedbackServedContract();
}
