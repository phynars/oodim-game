// The AFTERSIGN WebGL e2e failure summary (was inline `node -e` in ci.yml and
// main-e2e.yml, moved 11-09 when the workflows became rendered from the oodim
// repo profile). Prints markdown: every failing spec (one line each) and the
// first failing spec + error from
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

/** Every spec whose test ended failed, in report order: `{ title, where,
 *  message }`. A test Playwright marks `flaky` (failed, then passed on a
 *  retry) or `skipped`/`expected` is left out; a test with no status counts
 *  when one of its results carries an error. Pure.
 *
 *  Why: the summary named one spec, so a change that broke six read as one
 *  failure. #2748 (11-10) took seven review rounds, one spec per round. */
export function findFailingSpecs(node, out = []) {
  if (!node || typeof node !== "object") return out;
  for (const spec of Array.isArray(node.specs) ? node.specs : []) {
    for (const test of spec.tests || []) {
      if (test.status && test.status !== "unexpected") continue;
      let message = null;
      for (const result of test.results || []) {
        message = errorMessage(result.errors);
        if (message) break;
      }
      if (!message) continue;
      const where = spec.file ? `${spec.file}${spec.line ? `:${spec.line}` : ""}` : "";
      out.push({ title: spec.title || spec.file || "(unknown spec)", where, message });
      break;
    }
  }
  for (const suite of node.suites || []) findFailingSpecs(suite, out);
  return out;
}

/** Most specs the list names. */
export const FAILING_SPECS_MAX = 30;

/** The first failing spec, else a collection/global error, else null. Pure.
 *  A spec that ended failed is named before one that passed on a retry. */
export function findFailure(report) {
  const failed = findFailingSpecs(report)[0];
  if (failed) return { title: failed.title, message: failed.message };
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
    const failing = findFailingSpecs(report);
    if (failing.length > 1) {
      const firstLine = (message) => message.split("\n").find((l) => l.trim()) || "";
      out.push(
        `### every failing spec: ${failing.length} (fix them together; the detail below covers only the first)`,
        ...failing.slice(0, FAILING_SPECS_MAX).map((f) => `- ${f.where ? `${f.where} › ` : ""}${f.title} :: ${firstLine(f.message).trim().slice(0, 200)}`),
        ...(failing.length > FAILING_SPECS_MAX ? [`- (+${failing.length - FAILING_SPECS_MAX} more)`] : []),
        "",
      );
    }
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
