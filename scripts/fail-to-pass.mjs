#!/usr/bin/env node
// Fail-to-pass gate for BUG-FIX PRs (oodim AIDLC round 1, item ③, 2026-10-03;
// SWT-bench's "fail on base, pass on PR" criterion).
//
// A bug-fix PR must ship a test that REPRODUCES the bug: run against the
// base branch's source it fails, and on the PR head it passes. Head-pass is
// already the aftersign lane's job; this script owns the base half.
//
//   scope   — the PR body links an issue (Closes/Fixes/Resolves #N) labeled
//             `type:bug`. Free-will and refactor PRs are out of scope.
//   exempt  — a PR-body line `f2p-exempt: <reason>` (e.g. a CSS-only fix
//             with no assertable surface). The reason is echoed to the
//             summary so review can judge it.
//   no_test — source changed, no test file changed → FAIL ("a bug fix
//             without a test can't show it fixed anything").
//   test-only PR (the bug was in a spec) → skip: base-vs-head is moot.
//   otherwise: restore the BASE version of every non-test file, keep the
//             PR's test files, run only those tests through the runner that
//             actually discovers them, with one retry (a flake that passes
//             on retry is not a reproduction). Every changed test must be
//             discovered by SOME runner — a test no runner picks up is dead
//             code and FAILS the gate (the pure-runner/vitest allow-list trap).
//             ≥1 discovered test failing on base → reproduced (pass).
//             All passing on base → no_repro (FAIL).
//             Failing only because the test can't LOAD on base (it imports
//             a module the PR adds) → inconclusive: pass with a warning;
//             a reproduction should assert behaviour, not a missing file.
//
// Modes: `plan` (classify, write outputs) and `run` (base run). The final
// line of each mode is `F2P_RESULT=<result>` for log scrapers.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, rmSync } from "node:fs";

export const TEST_RE = /\.(test|spec)\.(ts|tsx|mjs|js)$/;
const NON_SOURCE_RE = /(^docs\/|\.md$|^\.github\/|^LICENSE)/;
// Runner wiring (include lists, configs, the pure-runner registry) is TEST
// infrastructure: it stays at HEAD for the base run. Rolling it back made the
// base vitest config drop a newly-registered test ("No test files found",
// exit 1), which read as a reproduction on the #2065 replay.
export const TEST_INFRA_RE = /(vitest\.config\.[cm]?[jt]s$|playwright(\.[\w-]+)?\.config\.[cm]?[jt]s$|pure-runner\.ts$)/;

export function linkedIssues(body) {
  const out = new Set();
  for (const m of (body ?? "").matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)\b/gi)) out.add(Number(m[1]));
  return [...out];
}

export function exemptReason(body) {
  const m = (body ?? "").match(/^\s*f2p-exempt:\s*(\S.*)$/im);
  return m ? m[1].trim() : null;
}

export function classify(files) {
  const tests = files.filter((f) => TEST_RE.test(f));
  const source = files.filter((f) => !TEST_RE.test(f) && !NON_SOURCE_RE.test(f) && !TEST_INFRA_RE.test(f));
  return { tests, source };
}

/** Pure decision for the plan step. */
export function decide({ isBug, exempt, tests, source }) {
  if (!isBug) return { result: "skipped:not_bug_fix", fail: false };
  if (exempt) return { result: "skipped:exempt", fail: false };
  if (source.length > 0 && tests.length === 0) return { result: "no_test", fail: true };
  if (source.length === 0) return { result: "skipped:test_only", fail: false };
  return { result: "run", fail: false };
}

const LOAD_ERROR_RE = /(No test files found|No tests found|Cannot find module|ERR_MODULE_NOT_FOUND|Failed to load url|Failed to resolve import|does not provide an export named|is not exported by|Cannot find package)/i;

/** Pure verdict over per-test base runs. */
export function verdict(runs) {
  const undiscovered = runs.filter((r) => r.runner === null);
  if (undiscovered.length > 0) return { result: "undiscovered", fail: true };
  const failed = runs.filter((r) => r.exit !== 0);
  const realFail = failed.filter((r) => !LOAD_ERROR_RE.test(r.output ?? ""));
  if (realFail.length > 0) return { result: "reproduced", fail: false };
  if (failed.length > 0) return { result: "inconclusive:load_error", fail: false };
  return { result: "no_repro", fail: true };
}

// ---------------------------------------------------------------- I/O below

// npx is npx.cmd on Windows (local replays); CI is Linux.
const npx = (args, opts = {}) => spawnSync("npx", args, { encoding: "utf8", shell: process.platform === "win32", ...opts });
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", ...opts }).trim();
const summary = (md) => process.env.GITHUB_STEP_SUMMARY && appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
const output = (k, v) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);

function event() {
  const e = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  return { body: e.pull_request?.body ?? "", base: e.pull_request?.base?.sha, head: e.pull_request?.head?.sha };
}

async function issueLabels(n) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues/${n}`, {
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "User-Agent": "oodim-f2p", Accept: "application/vnd.github+json" },
  });
  if (!r.ok) return [];
  const j = await r.json();
  return (j.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));
}

function changedFiles(base, head) {
  return sh("git", ["diff", "--name-only", "--diff-filter=AMR", `${base}...${head}`]).split("\n").filter(Boolean);
}

async function plan() {
  const { body, base, head } = event();
  const issues = linkedIssues(body);
  const labels = (await Promise.all(issues.map(issueLabels))).flat();
  const isBug = labels.includes("type:bug");
  const exempt = exemptReason(body);
  const { tests, source } = classify(changedFiles(base, head));
  const d = decide({ isBug, exempt, tests, source });
  output("result", d.result);
  output("needs_browser", tests.some((t) => t.includes("/e2e/")) ? "true" : "false");
  summary(`### fail-to-pass gate\n- linked issues: ${issues.map((n) => "#" + n).join(", ") || "none"}; type:bug: ${isBug}\n- changed tests: ${tests.length}, source files: ${source.length}${exempt ? `\n- **exempt:** ${exempt}` : ""}\n- plan: \`${d.result}\``);
  if (d.result === "no_test") {
    console.log(`::error title=fail-to-pass: bug fix without a test::This PR closes a type:bug issue and changes ${source.length} source file(s) but no *.test.* / *.spec.* file. Add a test that fails on main and passes here (or add a 'f2p-exempt: <reason>' line to the PR body if the fix truly has no assertable surface).`);
  }
  console.log(`F2P_RESULT=${d.result}`);
  if (d.fail) process.exit(1);
}

const PW_CONFIGS = ["aftersign/playwright.pure.config.ts", "aftersign/playwright.config.ts"];
const VITEST_CONFIG = "apps/web/src/aftersign/vitest.config.ts";

function discover(file) {
  const vit = npx(["vitest", "list", "--config", VITEST_CONFIG, file]);
  if (vit.status === 0 && vit.stdout.trim()) return { runner: "vitest", args: ["vitest", "run", "--config", VITEST_CONFIG, "--retry=1", file] };
  for (const cfg of PW_CONFIGS) {
    const pw = npx(["playwright", "test", "--config", cfg, "--list", file]);
    if (pw.status === 0 && /Total: [1-9]/.test(pw.stdout)) return { runner: `playwright:${cfg}`, args: ["playwright", "test", "--config", cfg, "--retries=1", "--workers=1", file] };
  }
  const base = file.split("/").pop();
  if (existsSync("aftersign/pure-runner.ts") && readFileSync("aftersign/pure-runner.ts", "utf8").includes(base)) {
    return { runner: "pure-runner", node: ["--experimental-strip-types", "aftersign/pure-runner.ts"] };
  }
  return { runner: null };
}

function run() {
  const { base, head } = event();
  const { tests, source } = classify(changedFiles(base, head));
  // Discovery happens at HEAD config (a new test may only be registered by
  // this PR), then the source half is rolled back to base.
  const plans = tests.map((t) => ({ file: t, ...discover(t) }));
  const baseHas = (f) => spawnSync("git", ["cat-file", "-e", `${base}:${f}`]).status === 0;
  for (const f of source) {
    if (baseHas(f)) sh("git", ["checkout", base, "--", f]);
    else rmSync(f, { force: true });
  }
  const runs = plans.map((p) => {
    if (!p.runner) return { ...p, exit: null, output: "" };
    const r = p.node
      ? spawnSync("node", p.node, { encoding: "utf8", env: { ...process.env, CI: "1" } })
      : npx(p.args, { env: { ...process.env, CI: "1" } });
    const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    console.log(`::group::${p.file} on BASE source (${p.runner}) → exit ${r.status}`);
    console.log(out.slice(-6000));
    console.log("::endgroup::");
    return { ...p, exit: r.status, output: out };
  });
  sh("git", ["checkout", head, "--", "."]);
  const v = verdict(runs);
  summary(runs.map((r) => `- \`${r.file}\` — ${r.runner ?? "**no runner discovers it**"}: ${r.exit === null ? "not run" : r.exit === 0 ? "passed on base" : "**failed on base**"}`).join("\n") + `\n- verdict: \`${v.result}\``);
  if (v.result === "undiscovered") {
    const dead = runs.filter((r) => !r.runner).map((r) => r.file).join(", ");
    console.log(`::error title=fail-to-pass: test is never run::No runner discovers ${dead} (vitest include list, playwright configs, aftersign/pure-runner.ts). Register it where CI runs it — an unrun test proves nothing.`);
  } else if (v.result === "no_repro") {
    console.log(`::error title=fail-to-pass: test does not reproduce the bug::Every changed test PASSES against main's source, so it would not have caught this bug. Strengthen the assertion so it fails on main and passes with your fix. (A flaky-test fix can't reproduce deterministically: say so with an 'f2p-exempt: flake fix — <evidence>' line in the PR body.)`);
  } else if (v.result.startsWith("inconclusive")) {
    console.log(`::warning title=fail-to-pass: inconclusive::The changed test(s) fail on main only because they can't load or aren't collected there (e.g. they import something this PR adds). Prefer a test that asserts the buggy BEHAVIOUR through an existing entry point.`);
  }
  console.log(`F2P_RESULT=${v.result}`);
  if (v.fail) process.exit(1);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const mode = process.argv[2];
  if (mode === "plan") await plan();
  else if (mode === "run") run();
  else { console.error("usage: fail-to-pass.mjs plan|run"); process.exit(2); }
}
