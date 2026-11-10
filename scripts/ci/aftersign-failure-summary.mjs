// The AFTERSIGN WebGL e2e failure summary (was inline `node -e` in ci.yml and
// main-e2e.yml, moved 11-09 when the workflows became rendered from the oodim
// repo profile). Prints markdown: the first failing spec + error from
// aftersign/playwright-report/results.json, or the raw runner-log tail when
// the report is missing or has no usable error (a pre-spec crash such as a
// webServer boot failure writes no JSON report, #1065).
//
// The aftersign/ prefix is not optional: Playwright resolves a reporter's
// relative outputFile against the CONFIG FILE's directory (#1555: reading the
// repo-root path sent 7 review rounds chasing a boot failure that never
// happened).
//
// usage: node scripts/ci/aftersign-failure-summary.mjs [runner-log] [results.json]
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function errorMessage(errors) {
  if (!Array.isArray(errors)) return null;
  for (const err of errors) {
    if ((err && err.message) || err) return String((err && err.message) || err);
  }
  return null;
}

export function findFirstFailingSpec(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node.specs)) {
    for (const spec of node.specs) {
      const title = spec.title || spec.file || "(unknown spec)";
      for (const test of spec.tests || []) {
        for (const result of test.results || []) {
          const message = errorMessage(result.errors);
          if (message) return { title, message };
        }
      }
    }
  }
  for (const suite of node.suites || []) {
    const found = findFirstFailingSpec(suite);
    if (found) return found;
  }
  return null;
}

/** The first failing spec, else a collection/global error, else null. Pure. */
export function findFailure(report) {
  const spec = findFirstFailingSpec(report);
  if (spec) return spec;
  const message = errorMessage(report && report.errors);
  return message ? { title: "(collection or global failure)", message } : null;
}

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/** The summary markdown. `report` is the parsed results.json or null when
 *  missing; `logTail` the runner log's last lines or null. Pure. */
export function renderSummary(report, logTail) {
  const out = ["## aftersign WebGL e2e — failure summary", ""];
  const tail = () => {
    if (logTail === null) return ["(runner log not captured — the e2e step may not have started)"];
    return ["", "### raw e2e runner log (last 80 lines)", "```", logTail, "```"];
  };
  if (report === null) {
    out.push("(aftersign/playwright-report/results.json not found — the run crashed BEFORE any spec ran, e.g. a webServer boot failure. Raw runner log tail below — #1065.)", ...tail());
  } else {
    const found = findFailure(report);
    if (found) {
      out.push("### first failing spec (from aftersign/playwright-report/results.json)", "```", `spec: ${found.title}`, "error:", found.message.split("\n").slice(0, 20).join("\n"), "```");
    } else {
      out.push("(no usable error in aftersign/playwright-report/results.json; raw runner log tail below)", ...tail());
    }
  }
  return out.join("\n").replace(ANSI, "") + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [logPath = "/tmp/aftersign-e2e-runner.log", reportPath = "aftersign/playwright-report/results.json"] = process.argv.slice(2);
  let report = null;
  if (existsSync(reportPath)) {
    try {
      report = JSON.parse(readFileSync(reportPath, "utf8"));
    } catch {
      report = {};
    }
  }
  const logTail = existsSync(logPath) ? readFileSync(logPath, "utf8").split("\n").slice(-80).join("\n") : null;
  process.stdout.write(renderSummary(report, logTail));
}
