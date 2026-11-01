#!/usr/bin/env node
// Served-reach gate (oodim AIDLC stabilization, root cause 1, 2026-10-20).
//
// Why: over 28 days, 50 of 135 live checks of merged agent PRs could not
// confirm the change on game.oodim.com. AFTERSIGN's source lives in three
// trees (aftersign/, apps/web/src/aftersign/, packages/aftersign/) joined by
// one large aftersign/main.js, and 38 of 68 modules in apps/web/src/aftersign
// were not imported by it. A PR could edit such a module, pass its own unit
// test (even one named *.livePath.test.ts) and merge, and players saw nothing
// (#2390, #2392, #2396). Unit tests prove a module works; they don't prove the
// game uses it. This gate checks the shipped artifact instead.
//
//   reach — every changed SOURCE file under a product root must be in the
//           module graph of a served entry: the AFTERSIGN client build
//           (aftersign/vite.config.ts) or the Worker (src/server.ts).
//           Unreachable → FAIL: the edit can never reach a player.
//   text  — every new player-facing string literal the PR adds to a
//           reachable file must appear in the built output. Missing → FAIL:
//           it was tree-shaken (exported but never called on the live path).
//   exempt — a PR-body line `served-exempt: <kind> <detail>` (e.g.
//            `followup #N` for a module wired in by a later PR on purpose).
//            Counts only with an approver's APPROVE on the head commit, never
//            the author's own (scripts/gate-exempt.mjs, 2026-11-01).
//
// Local / sandbox use (agents: run this before opening a PR):
//   node scripts/served-reach.mjs --base origin/main
//   node scripts/served-reach.mjs --files apps/web/src/aftersign/x.ts
// Last line is `SERVED_REACH_RESULT=<result>` for log scrapers.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXEMPT_KINDS, exemptFromEvent, exemptLine, exemptNote, exemptTag } from "./gate-exempt.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PRODUCT_ROOTS = ["aftersign/", "apps/web/src/aftersign/", "packages/aftersign/", "src/"];
const SOURCE_RE = /\.(m?js|cjs|ts|tsx|jsx)$/;
// Test, harness and tooling files are never served by design.
const NOT_SERVED_RE =
  /(\.(test|spec|playtest)\.[cm]?[jt]sx?$|\.d\.ts$|(^|\/)(e2e|harness|tests?|__tests__|fixtures|scripts)\/|\.config\.[cm]?[jt]s$|(^|\/)pure-runner\.ts$|\.acceptance\.mjs$|-qa\.mjs$)/;
// `-qa.mjs`: standalone QA harnesses run via package.json scripts (e.g.
// aftersign/production-save-qa.mjs → `npm run test:aftersign:production-save`).

export function exemptReason(body) {
  return exemptLine(body, "served");
}

const EXEMPT_HINT = `or ask for an exemption: a 'served-exempt: <kind> <detail>' line in the PR body (kinds: ${Object.keys(EXEMPT_KINDS).join(", ")}) plus an approver's APPROVE on this head commit`;

/** Only an approved exemption reaches the verdict; the rest is reported. */
function applyExempt(ex) {
  if (ex.state !== "none") console.log(`GATE_EXEMPT=${exemptTag("served", ex)}`);
  if (ex.state === "invalid" || ex.state === "unapproved") console.log(`::notice title=served-reach: exemption not applied::${exemptNote(ex)}`);
  return ex.state === "approved" ? ex.reason : null;
}

/** Changed files that must be served: source, under a product root, not test/tooling. */
export function servedCandidates(files) {
  return files.filter((f) => SOURCE_RE.test(f) && !NOT_SERVED_RE.test(f) && PRODUCT_ROOTS.some((r) => f.startsWith(r)));
}

/** New player-facing string literals on the `+` lines of a unified diff.
 *  Heuristic on purpose: a sentence-like literal (≥16 chars, a space, a
 *  letter), no interpolation, not on a comment line, not an import path. */
const CSS_VALUE_RE = /^[a-zA-Z-]+\([^()]*\)(\s+[a-zA-Z-]+\([^()]*\))*$/;

export function addedStrings(diffText) {
  const out = new Set();
  for (const line of (diffText ?? "").split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    const code = line.slice(1).trim();
    if (/^(\/\/|\/?\*|import\b|export\s+\*|console\.(debug|log))/.test(code)) continue;
    for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      const s = m[2];
      if (m[1] === "`" && s.includes("${")) continue;
      if (s.length < 16 || !/\s/.test(s) || !/[A-Za-z]/.test(s)) continue;
      // CSS function values (`translateY(0) scale(1)`) are not copy; the
      // rendered-rule replay flagged one (10-26).
      if (CSS_VALUE_RE.test(s.trim())) continue;
      out.add(unescapeJs(s));
    }
  }
  return [...out];
}

function unescapeJs(s) {
  return s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (_, e) => {
    if (e[0] === "u") return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ""), 16));
    if (e[0] === "x") return String.fromCharCode(parseInt(e.slice(1), 16));
    return { n: "\n", t: "\t", r: "\r" }[e] ?? e;
  });
}

/** Is the literal present in bundled code? Minifiers re-quote and re-escape,
 *  so check the raw text and its common escaped spellings. */
export function inBundle(s, bundle) {
  const bs = s.replace(/\\/g, "\\\\");
  const forms = new Set([s, JSON.stringify(s).slice(1, -1), bs.replace(/'/g, "\\'"), bs.replace(/`/g, "\\`")]);
  // Non-ASCII may be emitted as \uXXXX.
  forms.add(s.replace(/[^\x20-\x7e]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")));
  for (const f of forms) if (bundle.includes(f)) return true;
  return false;
}

/** Files whose strings a player could see in the AFTERSIGN client (the
 *  Worker's strings are not rendered by the client build). */
export function clientCandidates(files) {
  return servedCandidates(files).filter((f) => !f.startsWith("src/"));
}

const squash = (s) => s.replace(/\s+/g, " ").trim();

/** Did a served playtest render the literal? `rendered` = the recorder's
 *  lines (element text + aria-label/title/placeholder/alt). A literal can be
 *  part of a longer line (a sentence inside Io's paragraph), so substring. */
export function inRendered(s, rendered) {
  const t = squash(s);
  return rendered.some((line) => line.includes(t));
}

/** Split the recorder's JSONL into lines reached by real input (`ui`) and
 *  lines first shown after a harness call (`harness`: `{ text, via }`).
 *  A plain string is a real-input line; `{ t, via }` is harness (#2529). */
export function parseRendered(jsonl) {
  const ui = [];
  const harness = [];
  for (const l of (jsonl ?? "").split("\n")) {
    if (!l) continue;
    let v;
    try { v = JSON.parse(l); } catch { continue; }
    if (typeof v === "string") { if (squash(v)) ui.push(squash(v)); }
    else if (v && typeof v.t === "string" && squash(v.t)) harness.push({ text: squash(v.t), via: String(v.via ?? "harness") });
  }
  return { ui, harness };
}

/** Pure verdict for the `rendered` rule. `mode` warn = report only.
 *  `text_harness_only`: every unrendered literal was shown, but only after
 *  harness input no player can send (#2529). */
export function renderedVerdict({ exempt, checked, unrendered, mode }) {
  if (checked === 0) return { result: "skipped:no_new_text", fail: false };
  if (exempt) return { result: "skipped:exempt", fail: false };
  if (unrendered.length === 0) return { result: "rendered", fail: false };
  const result = unrendered.every((u) => u.via) ? "text_harness_only" : "text_not_rendered";
  return { result, fail: mode === "fail" };
}

/** Pure verdict. `files` distinguishes no diff from a non-served diff. */
export function decide({ exempt, files, candidates, unreachable, missingText }) {
  if (files.length === 0) return { result: "skipped:no_changes", fail: false };
  if (candidates.length === 0) return { result: "skipped:no_served_source", fail: false };
  if (exempt) return { result: "skipped:exempt", fail: false };
  if (unreachable.length > 0) return { result: "unreachable", fail: true };
  if (missingText.length > 0) return { result: "text_not_shipped", fail: true };
  return { result: "served", fail: false };
}

// ---------------------------------------------------------------- I/O ------

const rel = (abs) => path.relative(REPO, abs).split(path.sep).join("/");

/** Module graph + emitted code of the AFTERSIGN client build. */
async function clientGraph() {
  const { build } = await import("vite");
  const ids = new Set();
  const out = await build({
    configFile: path.join(REPO, "aftersign/vite.config.ts"),
    logLevel: "error",
    build: { write: false, emptyOutDir: false },
    // Record every module the build loads. Vite 8 (Rolldown) leaves some
    // imported modules out of getModuleIds(), so collect at transform time.
    plugins: [{
      name: "served-reach",
      enforce: "pre",
      transform(_code, id) { if (!id.startsWith("\0")) ids.add(path.resolve(id.split("?")[0])); return null; },
      generateBundle() { for (const id of this.getModuleIds()) if (!id.startsWith("\0")) ids.add(path.resolve(id.split("?")[0])); },
    }],
  });
  const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output ?? []);
  const code = outputs.map((o) => (o.type === "chunk" ? o.code : typeof o.source === "string" ? o.source : "")).join("\n");
  return { ids, code };
}

/** Module graph + bundle of the Worker entry (what wrangler deploys). */
async function workerGraph() {
  const esbuild = await import("esbuild");
  const r = await esbuild.build({
    entryPoints: [path.join(REPO, "src/server.ts")],
    bundle: true, write: false, metafile: true, format: "esm", platform: "neutral",
    mainFields: ["module", "main"], conditions: ["workerd", "worker", "browser"],
    external: ["cloudflare:*", "node:*"], logLevel: "silent",
  });
  const ids = new Set(Object.keys(r.metafile.inputs).map((p) => path.resolve(REPO, p)));
  return { ids, code: r.outputFiles.map((f) => f.text).join("\n") };
}

export async function servedGraph() {
  const [c, w] = await Promise.all([clientGraph(), workerGraph()]);
  const files = new Set([...c.ids, ...w.ids].filter((id) => id.startsWith(REPO) && !id.includes("node_modules")).map(rel));
  return { files, code: c.code + "\n" + w.code };
}

function args() {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  return { base: get("--base"), files: get("--files"), list: a.includes("--list-unserved"), rendered: get("--rendered"), mode: get("--mode") ?? "warn" };
}

/** `--rendered <file>`: run after the aftersign e2e step, against the text
 *  its served playtests showed (scripts/rendered-text-recorder.js). Every new
 *  player-facing literal in a client file must have been rendered by at least
 *  one served playtest. Bundled is not enough (#2499: the copy was bundled
 *  but its selector was never called). Only lines a spec reached through
 *  real input count: a line first shown after a `window.__game` harness
 *  call (e.g. `input.choose`) does not (#2529). */
async function renderedRule(opt, base, ev) {
  const { ui, harness } = parseRendered(existsSync(opt.rendered) ? readFileSync(opt.rendered, "utf8") : "");
  const files = git("diff", "--name-only", "--diff-filter=AMR", `${base}...HEAD`).split("\n").filter(Boolean);
  const added = clientCandidates(files).flatMap((f) => addedStrings(git("diff", "-U0", `${base}...HEAD`, "--", f)).map((text) => ({ file: f, text })));
  const unrendered = added
    .filter((a) => !inRendered(a.text, ui))
    .map((a) => ({ ...a, via: harness.find((h) => h.text.includes(squash(a.text)))?.via }));
  const ex = await exemptFromEvent(ev?.pr, "served");
  const exempt = applyExempt(ex);
  const d = renderedVerdict({ exempt, checked: added.length, unrendered, mode: opt.mode });
  const lines = [
    `### served-reach: rendered text (${opt.mode === "fail" ? "blocking" : "report only"})`,
    `- recorded lines from served playtests: ${ui.length} by real input, ${harness.length} only after harness input${ui.length + harness.length === 0 ? " (none: did the e2e step run with AFTERSIGN_RENDERED_OUT?)" : ""}`,
    `- new player-facing strings: ${added.length}, rendered ${added.length - unrendered.length}, not rendered ${unrendered.length}`,
    ...unrendered.map((u) => u.via
      ? `  - shown only after harness \`window.__game.${u.via}\`, which no player can send (\`${u.file}\`): "${u.text.slice(0, 120)}"`
      : `  - never rendered by a served playtest (\`${u.file}\`): "${u.text.slice(0, 120)}"`),
    ex.state !== "none" ? `- ${exemptNote(ex)}` : "",
    `- result: \`${d.result}\``,
  ].filter(Boolean);
  console.log(lines.join("\n"));
  summary(lines.join("\n"));
  if (d.result === "text_not_rendered" || d.result === "text_harness_only") {
    const level = d.fail ? "error" : "warning";
    const u = unrendered[0];
    const what = u.via
      ? `no served playtest reached them through real input (the first was shown only after harness \`window.__game.${u.via}\`)`
      : "no served playtest rendered them";
    console.log(`::${level} title=served-reach: new text never shown in play::${unrendered.length} new string(s) are in the build but ${what}, e.g. "${u.text.slice(0, 80)}" in ${u.file}. Bundled is not shown: wire the line into the live render path and add a served playtest (aftersign/e2e/) that plays to it with visible input (click, key, reload), ${EXEMPT_HINT}.`);
  }
  console.log(`RENDERED_REACH_RESULT=${d.result}`);
  if (d.fail) process.exitCode = 1;
}

function prEvent() {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !existsSync(p)) return null;
  const e = JSON.parse(readFileSync(p, "utf8"));
  return e.pull_request ? { body: e.pull_request.body ?? "", base: e.pull_request.base?.sha, pr: e.pull_request } : null;
}

const git = (...a) => execFileSync("git", a, { cwd: REPO, encoding: "utf8", maxBuffer: 64 << 20 });
const summary = (md) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");

async function main() {
  const opt = args();
  if (opt.rendered) {
    const ev = prEvent();
    const base = opt.base ?? ev?.base;
    if (!base) { console.log("RENDERED_REACH_RESULT=skipped:no_base"); return; }
    await renderedRule(opt, base, ev);
    return;
  }
  const graph = await servedGraph();

  if (opt.list) {
    // Inventory: product-root source files no served entry imports.
    const all = git("ls-files", ...PRODUCT_ROOTS).split("\n").filter(Boolean);
    const unserved = servedCandidates(all).filter((f) => !graph.files.has(f));
    console.log(unserved.join("\n"));
    console.log(`\n${unserved.length} of ${servedCandidates(all).length} product source files are not reachable from a served entry.`);
    return;
  }

  const ev = prEvent();
  const base = opt.base ?? ev?.base;
  let files;
  if (opt.files) files = opt.files.split(",").map((f) => f.trim()).filter(Boolean);
  else if (base) files = git("diff", "--name-only", "--diff-filter=AMR", `${base}...HEAD`).split("\n").filter(Boolean);
  else {
    console.log("served-reach: no PR base (pass --base <ref> or --files a,b); nothing to check.");
    console.log("SERVED_REACH_RESULT=skipped:no_base");
    return;
  }

  const candidates = servedCandidates(files);
  const unreachable = candidates.filter((f) => !graph.files.has(f));
  const reachable = candidates.filter((f) => graph.files.has(f));
  const missingText = [];
  if (base && reachable.length > 0 && unreachable.length === 0) {
    for (const f of reachable) {
      for (const s of addedStrings(git("diff", "-U0", `${base}...HEAD`, "--", f))) {
        if (!inBundle(s, graph.code)) missingText.push({ file: f, text: s });
      }
    }
  }
  const ex = await exemptFromEvent(ev?.pr, "served");
  const exempt = applyExempt(ex);
  const d = decide({ exempt, files, candidates, unreachable, missingText });

  const lines = [
    `### served-reach gate`,
    `- served source files changed: ${candidates.length} (reachable ${reachable.length}, unreachable ${unreachable.length})`,
    ...(opt.base && files.length === 0 ? ["- no changed files were found; if edits are uncommitted, re-run with `--files <paths>`."] : []),
    ...unreachable.map((f) => `  - not reachable from a served entry: \`${f}\``),
    ...missingText.map((m) => `  - new text not in the built game (\`${m.file}\`): "${m.text.slice(0, 120)}"`),
    ex.state !== "none" ? `- ${exemptNote(ex)}` : "",
    `- result: \`${d.result}\``,
  ].filter(Boolean);
  console.log(lines.join("\n"));
  summary(lines.join("\n"));

  if (d.result === "unreachable") {
    console.log(`::error title=served-reach: change never reaches players::${unreachable.join(", ")} ${unreachable.length === 1 ? "is" : "are"} not imported (directly or indirectly) by aftersign/main.js or src/server.ts, so this edit never ships. Wire it into the live code path in this PR (and assert it in an e2e that loads the built game), ${EXEMPT_HINT}.`);
  } else if (d.result === "text_not_shipped") {
    console.log(`::error title=served-reach: new text is not in the built game::${missingText.length} new string(s) are missing from the production bundle, e.g. "${missingText[0].text.slice(0, 80)}" in ${missingText[0].file}. The code that uses them is never called on the live path, so the bundler dropped it. Call it from the live path, ${EXEMPT_HINT}.`);
  }
  console.log(`SERVED_REACH_RESULT=${d.result}`);
  if (d.fail) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err); console.log("SERVED_REACH_RESULT=error"); process.exitCode = 1; });
}
