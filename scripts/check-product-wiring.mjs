// Product-wiring guard (2026-06-20). Every game in this portfolio repo is a
// top-level dir with its own `vite.config.ts`. Launching one means registering
// it in several places — and the failure mode we keep hitting is a product that
// builds but isn't wired everywhere, so it silently doesn't ship:
//   - agar/ shipped to the repo but the deploy didn't stage it -> /agar/ 404'd
//   - agar/ had no CI lane -> its PRs weren't gameplay-gated
// This guard fails CI if a product dir exists without its full wiring, so the
// gap is caught on the PR that adds the product — not in prod.
//
// Checks, for each `<name>/vite.config.ts` product:
//   1. package.json has scripts build:<name>, typecheck:<name>, test:e2e:<name>
//   2. the aggregate build/typecheck/test:e2e scripts each include <name>
//   3. .github/workflows/ci.yml has a paths-filter entry + a job lane for <name>
// (Deploy staging is auto-derived from dist-*/ in deploy.yml, so it needs no
//  per-product entry — that's why it isn't checked here.)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(path.join(repoRoot, p), "utf8");

const products = readdirSync(repoRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
  .filter((e) => existsSync(path.join(repoRoot, e.name, "vite.config.ts")) || e.name === "aftersign")
  .map((e) => e.name)
  .sort();

const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts ?? {};
const ci = existsSync(path.join(repoRoot, ".github/workflows/ci.yml")) ? read(".github/workflows/ci.yml") : "";

const errors = [];
const FLAGSHIP_SYNC_START = "<!-- FLAGSHIP_MANDATE_SYNC:START -->";
const FLAGSHIP_SYNC_END = "<!-- FLAGSHIP_MANDATE_SYNC:END -->";

function extractSyncBlock(content, filePath) {
  const start = content.indexOf(FLAGSHIP_SYNC_START);
  const end = content.indexOf(FLAGSHIP_SYNC_END);
  if (start === -1 || end === -1 || end <= start) {
    errors.push(filePath + " missing flagship mandate sync markers (" + FLAGSHIP_SYNC_START + " ... " + FLAGSHIP_SYNC_END + ")");
    return "";
  }
  return content
    .slice(start + FLAGSHIP_SYNC_START.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

for (const name of products) {
  for (const kind of ["build", "typecheck", "test:e2e"]) {
    const perGame = kind + ":" + name;
    if (!scripts[perGame]) errors.push('package.json missing script "' + perGame + '"');
    if (!(scripts[kind] ?? "").includes(perGame)) {
      errors.push('package.json aggregate "' + kind + '" does not run "' + perGame + '" (a ' + name + ' regression would ship unchecked)');
    }
  }
  if (ci) {
    if (!new RegExp("\\n\\s+" + name + ":").test(ci)) errors.push('.github/workflows/ci.yml has no paths-filter / job entry for "' + name + '" — its PRs would not be gameplay-gated');
    if (!ci.includes("test:e2e:" + name)) errors.push('.github/workflows/ci.yml never runs "test:e2e:' + name + '" — no gameplay gate for ' + name);
  }
}
if (products.length === 0) errors.push("no products found (no <dir>/vite.config.ts) — guard misconfigured?");

const briefPath = "docs/flagship/BRIEF.md";
const architecturePath = "docs/plan/architecture/README.md";
const brief = read(briefPath);
const architecture = read(architecturePath);
const briefBlock = extractSyncBlock(brief, briefPath);
const architectureBlock = extractSyncBlock(architecture, architecturePath);

if (briefBlock && architectureBlock && briefBlock !== architectureBlock) {
  errors.push("flagship mandate drift: " + architecturePath + " block differs from canonical " + briefPath + " block");
}

if (!architecture.includes("docs/flagship/BRIEF.md")) {
  errors.push(architecturePath + " must point contributors to docs/flagship/BRIEF.md as canonical source");
}

if (errors.length) {
  console.error("FAIL product-wiring guard (" + products.length + " products: " + products.join(", ") + "):");
  for (const e of errors) console.error("  - " + e);
  console.error("\nA new product must be wired into package.json (per-game + aggregate scripts) and ci.yml (filter + lane). Deploy staging auto-derives from dist-*/, so it needs no manual entry. See docs onboarding-a-repo.md.");
  process.exit(1);
}
console.log("OK product-wiring guard — " + products.length + " products fully wired: " + products.join(", "));
