#!/usr/bin/env node
// CI-evidence block for PR bodies (oodim AIDLC, 2026-10-27).
//
// A PR body is the implementing session's pre-CI note ("no served run
// verified"), and nothing wrote CI's result back. Readers who only see the
// body (review agents, the auditor, Muse, humans) read "unverified" after CI
// had passed. This step writes the aftersign lane's result into the body
// between two markers, replacing the previous run's block, so the body always
// carries the newest run's evidence with the head SHA it ran on.
//
// Inputs (all optional; a missing file is reported, never fatal):
//   --results <playwright results.json>  --rendered <served-reach --rendered log>
//   --e2e <success|failure|...>          env GITHUB_TOKEN, GITHUB_REPOSITORY,
//   GITHUB_EVENT_PATH, GITHUB_SERVER_URL, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT.
// Never fails the job: evidence is a report, not a gate.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const START = "<!-- ci-evidence:start -->";
export const END = "<!-- ci-evidence:end -->";

/** Replace the block between the markers, or append it. */
export function upsertEvidence(body, block) {
  const b = body ?? "";
  const s = b.indexOf(START);
  const e = s === -1 ? -1 : b.indexOf(END, s);
  if (s !== -1 && e !== -1) return b.slice(0, s) + block + b.slice(e + END.length);
  return (b.trimEnd() ? b.trimEnd() + "\n\n" : "") + block;
}

/** Playwright json-reporter totals, or null when the report is unusable. */
export function e2eStats(report) {
  const s = report?.stats;
  if (!s || typeof s.expected !== "number") return null;
  return { passed: s.expected, failed: s.unexpected ?? 0, flaky: s.flaky ?? 0, skipped: s.skipped ?? 0 };
}

/** The served-reach --rendered markdown section and its result, from the step log. */
export function renderedSummary(log) {
  const lines = (log ?? "").split("\n").map((l) => l.replace(/\r$/, ""));
  const result = lines.map((l) => l.match(/^RENDERED_REACH_RESULT=(\S+)/)?.[1]).filter(Boolean).pop() ?? null;
  const from = lines.findIndex((l) => l.startsWith("### served-reach: rendered text"));
  const to = lines.findIndex((l, i) => i > from && /^- result: /.test(l));
  const section = from === -1 ? [] : lines.slice(from + 1, to === -1 ? undefined : to);
  return { result, section };
}

export function renderEvidence({ sha, runUrl, e2e, stats, rendered, at }) {
  const out = [
    START,
    "### CI evidence (written by CI, replaced on each run)",
    `- head: \`${sha ? sha.slice(0, 7) : "?"}\` · run: ${runUrl ?? "?"} · ${at}`,
    `- aftersign served e2e: **${e2e ?? "not run"}**` +
      (stats ? ` (${stats.passed} passed, ${stats.failed} failed, ${stats.flaky} flaky, ${stats.skipped} skipped)` : " (no results.json)"),
    `- rendered rule: \`${rendered?.result ?? "not run"}\``,
  ];
  // Fenced so quoted game text can never read as a PR-body directive
  // (served-exempt:, f2p-exempt:, closing keywords).
  if (rendered?.section?.length) out.push("", "```text", ...rendered.section, "```");
  out.push(END);
  return out.join("\n");
}

const arg = (a, k) => { const i = a.indexOf(k); return i === -1 ? undefined : a[i + 1]; };
const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

async function main() {
  const a = process.argv.slice(2);
  const env = process.env;
  const ev = env.GITHUB_EVENT_PATH && existsSync(env.GITHUB_EVENT_PATH) ? readJson(env.GITHUB_EVENT_PATH) : null;
  const pr = ev?.pull_request;
  if (!pr || !env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) { console.log("pr-ci-evidence: not a PR run; nothing to write."); return; }

  const results = arg(a, "--results"), log = arg(a, "--rendered");
  const block = renderEvidence({
    sha: pr.head?.sha,
    runUrl: env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}${env.GITHUB_RUN_ATTEMPT > 1 ? `/attempts/${env.GITHUB_RUN_ATTEMPT}` : ""}` : null,
    e2e: arg(a, "--e2e"),
    stats: results && existsSync(results) ? e2eStats(readJson(results)) : null,
    rendered: log && existsSync(log) ? renderedSummary(readFileSync(log, "utf8")) : null,
    at: new Date().toISOString().slice(0, 16).replace("T", " ") + "Z",
  });
  console.log(block);

  // Read the body fresh: the event's copy is stale if anyone edited it mid-run.
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/pulls/${pr.number}`;
  const headers = { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
  const cur = await fetch(url, { headers });
  if (!cur.ok) { console.log(`::warning title=pr-ci-evidence::read PR #${pr.number} → ${cur.status}`); return; }
  const live = await cur.json();
  if (live.head?.sha && pr.head?.sha && live.head.sha !== pr.head.sha) { console.log("pr-ci-evidence: PR head moved; the newer run writes its own block."); return; }
  const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify({ body: upsertEvidence(live.body, block) }) });
  if (!res.ok) console.log(`::warning title=pr-ci-evidence::update PR #${pr.number} → ${res.status}`);
  else console.log(`pr-ci-evidence: wrote the block to PR #${pr.number}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => console.log(`::warning title=pr-ci-evidence::${err.message}`));
}
