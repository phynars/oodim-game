import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJsonUrl = new URL("../package.json", import.meta.url);

test("production durable-authority command supplies its deployed URL", async () => {
  const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
  const command = packageJson.scripts["test:e2e:aftersign:production-durable-authority"];

  assert.match(command, /AFTERSIGN_PRODUCTION_URL=/);
  assert.match(command, /AFTERSIGN_BASE_URL=/);
  assert.match(command, /https:\/\/game\.oodim\.com\/aftersign\//);
  assert.match(command, /aftersign-production-durable-authority\.playtest\.spec\.ts/);
});
