import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const AFTERSIGN_ROOT = resolve(process.cwd(), "aftersign");
const TIMER_DELAY = /,\s*1180\s*\)$/;

function readJavaScriptSources(directory: string): Array<{ path: string; source: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return readJavaScriptSources(path);
    return entry.isFile() && entry.name.endsWith(".js")
      ? [{ path, source: readFileSync(path, "utf8") }]
      : [];
  });
}

function timeoutCalls(source: string): string[] {
  const calls: string[] = [];
  for (const match of source.matchAll(/setTimeout\s*\(/g)) {
    let depth = 1;
    let index = (match.index ?? 0) + match[0].length;
    for (; index < source.length && depth > 0; index += 1) {
      if (source[index] === "(") depth += 1;
      if (source[index] === ")") depth -= 1;
    }
    if (depth === 0) calls.push(source.slice(match.index, index));
  }
  return calls;
}

describe("delivery auto-advance timer contract", () => {
  it("keeps dropDeliveryAutoAdvance safe by allowing exactly one 1180 ms setTimeout", () => {
    const sources = [
      { path: join(AFTERSIGN_ROOT, "main.js"), source: readFileSync(join(AFTERSIGN_ROOT, "main.js"), "utf8") },
      ...readJavaScriptSources(join(AFTERSIGN_ROOT, "src")),
    ];
    const callSites = sources.flatMap(({ path, source }) =>
      timeoutCalls(source)
        .filter((call) => TIMER_DELAY.test(call))
        .map((call) => `${path}:${source.indexOf(call)}`),
    );

    expect(
      callSites,
      "dropDeliveryAutoAdvance suppresses 1180 ms timers globally; keep exactly one setTimeout(..., 1180) call site",
    ).toHaveLength(1);
  });
});
