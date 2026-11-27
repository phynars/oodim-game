// Reject newly added executable modules that no production source or package script consumes.
// Called by check-product-wiring.mjs so its fixtures and live check run in the CI wiring job.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const executableExtension = /\.(?:[cm]?[jt]sx?)$/;
const testPath = /(?:\.test\.|\.spec\.|__tests__|(?:^|\/)e2e(?:\/|$))/;

export function isSourceModule(file) {
  return executableExtension.test(file) && !testPath.test(file);
}

function walk(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(root, absolute);
    return [path.relative(root, absolute).replaceAll(path.sep, "/")];
  });
}

function referencesModule(consumer, modulePath) {
  const consumerDir = path.posix.dirname(consumer.path);
  const relative = path.posix.relative(consumerDir, modulePath).replace(executableExtension, "");
  const specifier = relative.startsWith(".") ? relative : `./${relative}`;
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:from\\s*["']|import\\s*\\(\\s*["']|import\\s*(?:[^"']*?from\\s*)?["']|require\\s*\\(\\s*["'])${escaped}(?:["']|\\.)`).test(consumer.content);
}

export function unconsumedModules({ added, consumers, packageScripts = [] }) {
  return added.filter(isSourceModule).filter((modulePath) => !consumers.some((consumer) => isSourceModule(consumer.path) && referencesModule(consumer, modulePath)) && !packageScripts.some((script) => script.includes(modulePath)));
}

export function addedModules(repoRoot, baseRef) {
  const range = `${baseRef}...HEAD`;
  return execFileSync("git", ["diff", "--name-only", "--diff-filter=A", range], { cwd: repoRoot, encoding: "utf8" })
    .split("\n").filter(Boolean);
}

export function check(repoRoot, baseRef, added = addedModules(repoRoot, baseRef)) {
  const consumers = walk(repoRoot)
    .filter(isSourceModule)
    .map((file) => ({ path: file, content: readFileSync(path.join(repoRoot, file), "utf8") }));
  const packageScripts = Object.values(JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).scripts ?? {});
  return unconsumedModules({ added, consumers, packageScripts });
}

function main() {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const baseRef = process.env.SOURCE_CONSUMPTION_BASE ?? "origin/main";
  if (!existsSync(path.join(repoRoot, ".git"))) return;
  try {
    const missing = check(repoRoot, baseRef);
    if (!missing.length) return console.log("OK source-consumption guard — all added source modules are consumed");
    console.error("FAIL source-consumption guard:");
    for (const file of missing) console.error(`  - ${file} is added but has no production consumer`);
    console.error("Consume each module from non-test source with an import/require/dynamic import, or register its path in a package script.");
    process.exitCode = 1;
  } catch (error) {
    console.error(`FAIL source-consumption guard could not compare ${baseRef}...HEAD: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
