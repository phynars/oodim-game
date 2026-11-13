// node --test scripts/rendered-text-sink.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSink, renderedLines } from "./rendered-text-sink.mjs";

test("renderedLines keeps strings and { t, via } records, one JSON value per line", () => {
  const body = JSON.stringify(["Deliver the packet", { t: "Orra nods", via: "input.choose" }, 7, null, { t: "no via" }]);
  assert.equal(renderedLines(body), '"Deliver the packet"\n{"t":"Orra nods","via":"input.choose"}\n');
});

test("renderedLines: a non-array is empty, a non-JSON body is null", () => {
  assert.equal(renderedLines('{"t":"x"}'), "");
  assert.equal(renderedLines("not json"), null);
});

async function withSink(fn) {
  const out = join(mkdtempSync(join(tmpdir(), "rendered-sink-")), "rendered.jsonl");
  const server = createSink(out);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    await fn(url, out);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("a POST appends its records; a second POST appends after them", async () => {
  await withSink(async (url, out) => {
    const first = await fetch(url, { method: "POST", body: JSON.stringify(["first line"]), headers: { "content-type": "text/plain" } });
    assert.equal(first.status, 204);
    assert.equal(first.headers.get("access-control-allow-origin"), "*");
    await fetch(url, { method: "POST", body: JSON.stringify([{ t: "second", via: "advance" }]) });
    assert.equal(readFileSync(out, "utf8"), '"first line"\n{"t":"second","via":"advance"}\n');
  });
});

test("a bad body is refused and writes nothing; other methods are refused", async () => {
  await withSink(async (url, out) => {
    assert.equal((await fetch(url, { method: "POST", body: "{" })).status, 400);
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(url, { method: "OPTIONS" })).status, 204);
    assert.equal(existsSync(out), false);
  });
});
