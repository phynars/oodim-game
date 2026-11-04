#!/usr/bin/env node
// Served replay (oodim RC1, 2026-11-04). After a deploy publishes
// game.oodim.com, deploy.yml re-runs the served specs that the deployed range
// added or changed against the LIVE site (AFTERSIGN_BASE_URL) and posts the
// per-spec result as a `served-replay` check run on the deployed SHA.
//
// Why: the oodim live verifier plays each merged PR by hand from the title
// screen, and 13 of 26 inconclusive checks (10-20..11-03) ran out of steps
// before the changed state. A served spec already plays straight to that
// state with real input; replayed against the deployed build, its pass/fail
// is the evidence. The verifier reads this check run and falls back to
// playing only for PRs whose specs are not in it.
//
// The check run's `output.text` is a machine-read contract (oodim
// packages/aidlc/src/core/live-verify/replay.ts parses it). Change both
// together:
//   served-replay v1
//   base <sha>
//   <passed|flaky|failed|skipped|not_run> <repo path of the spec>
//
//   node scripts/served-replay.mjs plan <changed-files.txt>
//     → the served specs to replay, one per line (at most MAX_SPECS)
//   node scripts/served-replay.mjs report --base <sha> --sha <sha> --specs <specs.txt> --results <results.json>
//     → the check-run body (JSON) for `gh api repos/<repo>/check-runs --input -`
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ignoredSpecNames, servedSpecs, SERVED_SPEC_CONFIG } from "./served-reach.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CHECK_NAME = "served-replay";
export const MAX_SPECS = 10;

/** The served specs to replay for a deployed range's changed files. Pure. */
export function replayPlan(files, ignored, max = MAX_SPECS) {
  return [...new Set(servedSpecs(files, ignored))].sort().slice(0, max);
}

/** One status per spec FILE from Playwright's JSON report. A file's status:
 *  any unexpected test → failed; else any flaky → flaky; else all skipped →
 *  skipped; else passed. Keyed by the report's file path (relative to the
 *  config's testDir). Pure. */
export function fileStatuses(report) {
  const out = new Map();
  const add = (file, st) => {
    if (!file) return;
    const prev = out.get(file) ?? [];
    prev.push(st);
    out.set(file, prev);
  };
  const walk = (suite, file) => {
    const f = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) add(spec.file ?? f, t.status ?? "unknown");
    }
    for (const s of suite.suites ?? []) walk(s, f);
  };
  for (const s of report?.suites ?? []) walk(s, s.file);
  const result = new Map();
  for (const [file, sts] of out) {
    let st = "passed";
    if (sts.some((s) => s === "unexpected" || s === "unknown")) st = "failed";
    else if (sts.some((s) => s === "flaky")) st = "flaky";
    else if (sts.every((s) => s === "skipped")) st = "skipped";
    result.set(file.split(path.sep).join("/"), st);
  }
  return result;
}

/** The served config's testDir, as a repo path: report files are relative to it. */
export const SPEC_DIR = "aftersign/e2e/";

/** Status of each planned spec (a repo path). The report names files
 *  relative to the testDir. A spec the report doesn't list → not_run. */
export function specStatuses(planned, statuses) {
  return planned.map((spec) => ({ spec, status: statuses.get(spec.startsWith(SPEC_DIR) ? spec.slice(SPEC_DIR.length) : spec) ?? "not_run" }));
}

/** The check-run body. Pure. */
export function checkRunBody({ sha, base, rows, runUrl }) {
  const failed = rows.filter((r) => r.status === "failed" || r.status === "not_run");
  const conclusion = rows.length === 0 ? "neutral" : failed.length ? "failure" : "success";
  const count = (s) => rows.filter((r) => r.status === s).length;
  const title = rows.length === 0
    ? "No served specs changed in this deploy"
    : `${count("passed") + count("flaky")}/${rows.length} served specs passed on game.oodim.com`;
  const summary = [
    `Replayed against the deployed build at https://game.oodim.com/aftersign/ (base \`${String(base).slice(0, 12)}\`).`,
    rows.length ? `passed ${count("passed")}, flaky ${count("flaky")}, failed ${count("failed")}, skipped ${count("skipped")}, not run ${count("not_run")}.` : "",
    runUrl ? `Run: ${runUrl}` : "",
  ].filter(Boolean).join("\n\n");
  const text = ["served-replay v1", `base ${base}`, ...rows.map((r) => `${r.status} ${r.spec}`)].join("\n");
  return {
    name: CHECK_NAME,
    head_sha: sha,
    status: "completed",
    conclusion,
    ...(runUrl ? { details_url: runUrl } : {}),
    output: { title, summary, text },
  };
}

function arg(a, k) {
  const i = a.indexOf(k);
  return i >= 0 ? a[i + 1] : undefined;
}

const lines = (p) => (p && existsSync(p) ? readFileSync(p, "utf8").split("\n").map((l) => l.trim()).filter(Boolean) : []);

function main() {
  const a = process.argv.slice(2);
  const ignored = ignoredSpecNames(readFileSync(path.join(REPO, SERVED_SPEC_CONFIG), "utf8"));
  if (a[0] === "plan") {
    const plan = replayPlan(lines(a[1]), ignored);
    if (plan.length) process.stdout.write(plan.join("\n") + "\n");
    return;
  }
  if (a[0] === "report") {
    const planned = lines(arg(a, "--specs"));
    const resultsPath = arg(a, "--results");
    let report = null;
    try { report = resultsPath && existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, "utf8")) : null; } catch { report = null; }
    const rows = specStatuses(planned, report ? fileStatuses(report) : new Map());
    const body = checkRunBody({ sha: arg(a, "--sha"), base: arg(a, "--base") ?? "unknown", rows, runUrl: process.env.RUN_URL });
    process.stdout.write(JSON.stringify(body));
    return;
  }
  console.error("usage: served-replay.mjs plan <files.txt> | report --base <sha> --sha <sha> --specs <specs.txt> --results <results.json>");
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
