import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "vite";

const repoRoot = process.cwd();
const testRoot = path.join(repoRoot, "aftersign", "src");

async function findTestFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findTestFiles(fullPath);
      }
      return entry.isFile() && entry.name.endsWith(".test.ts") ? [fullPath] : [];
    }),
  );

  return files.flat().sort();
}

const testFiles = await findTestFiles(testRoot);

if (testFiles.length === 0) {
  console.error("No AFTERSIGN src .test.ts files found under aftersign/src");
  process.exit(1);
}

const server = await createServer({
  configFile: false,
  root: repoRoot,
  logLevel: "error",
  server: {
    middlewareMode: true,
  },
  optimizeDeps: {
    noDiscovery: true,
  },
});

let failed = 0;

try {
  for (const testFile of testFiles) {
    const relativePath = path.relative(repoRoot, testFile);
    try {
      await server.ssrLoadModule(pathToFileURL(testFile).href);
      console.log(`✓ ${relativePath}`);
    } catch (error) {
      failed += 1;
      console.error(`✗ ${relativePath}`);
      console.error(error?.stack ?? error);
    }
  }
} finally {
  await server.close();
}

if (failed > 0) {
  console.error(`${failed} AFTERSIGN src test file(s) failed.`);
  process.exit(1);
}

console.log(`${testFiles.length} AFTERSIGN src test file(s) passed.`);
