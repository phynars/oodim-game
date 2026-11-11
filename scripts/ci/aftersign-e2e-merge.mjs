// One Playwright JSON report from the AFTERSIGN e2e shards' reports, so the
// checks that read `results.json` (the failure summary, the PR-body CI
// evidence) see the whole run. Suites are concatenated and the totals summed.
//
// usage: node scripts/ci/aftersign-e2e-merge.mjs <out.json> <shard.json>...
//   exits 0 and writes nothing when no shard report is readable.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COUNTS = ["expected", "unexpected", "flaky", "skipped"];

export function mergeReports(reports) {
  const usable = reports.filter((r) => r && typeof r === "object" && Array.isArray(r.suites));
  if (usable.length === 0) return null;
  const stats = { duration: 0 };
  for (const key of COUNTS) stats[key] = 0;
  for (const r of usable) {
    for (const key of COUNTS) stats[key] += Number(r.stats?.[key] ?? 0);
    // Shards run side by side: the run took as long as the slowest one.
    stats.duration = Math.max(stats.duration, Number(r.stats?.duration ?? 0));
  }
  return {
    suites: usable.flatMap((r) => r.suites),
    errors: usable.flatMap((r) => (Array.isArray(r.errors) ? r.errors : [])),
    stats,
  };
}

function main() {
  const [out, ...inputs] = process.argv.slice(2);
  if (!out) {
    console.error("usage: aftersign-e2e-merge.mjs <out.json> <shard.json>...");
    process.exit(2);
  }
  const reports = inputs.map((p) => {
    try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
  });
  const merged = mergeReports(reports);
  if (!merged) {
    console.log("aftersign-e2e-merge: no readable shard report");
    return;
  }
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(merged));
  const s = merged.stats;
  console.log(`aftersign-e2e-merge: ${reports.filter(Boolean).length} of ${inputs.length} shard report(s): ${s.expected} passed, ${s.unexpected} failed, ${s.flaky} flaky, ${s.skipped} skipped`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
