#!/usr/bin/env node
// Sink for the rendered-text recorder (scripts/rendered-text-recorder.js).
//
// The aftersign e2e plays against the real Worker (scripts/ci/worker-dev.sh),
// and the Worker has no route for test records, on purpose: nothing that
// exists only for a test is served by the code the deploy publishes. So the
// recorder posts here instead, to a second port on the same machine, and
// this process appends each record to $AFTERSIGN_RENDERED_OUT, one JSON value
// per line. scripts/ci/aftersign-e2e.sh `report` reads that file for the
// rendered-text rule.
//
//   node scripts/rendered-text-sink.mjs <port>
//
// A record is a string (text reached by real input) or `{ t, via }` (text
// first shown after a harness call; the rule does not count it).
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const MAX_BODY = 1_048_576;

/** The JSONL text for one POST body, or "" when it holds no valid record. */
export function renderedLines(body) {
  let lines;
  try {
    lines = JSON.parse(body);
  } catch {
    return null;
  }
  if (!Array.isArray(lines)) return "";
  return lines
    .filter((l) => typeof l === "string" || (l && typeof l.t === "string" && typeof l.via === "string"))
    .map((l) => JSON.stringify(l) + "\n")
    .join("");
}

export function createSink(outFile) {
  return createServer((req, res) => {
    // The page is served from another port, so the POST is cross-origin.
    res.setHeader("access-control-allow-origin", "*");
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-methods", "POST");
      res.setHeader("access-control-allow-headers", "content-type");
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end();
      return;
    }
    let body = "";
    let tooLarge = false;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > MAX_BODY) {
        tooLarge = true;
        body = "";
      }
    });
    req.on("end", () => {
      const text = tooLarge ? null : renderedLines(body);
      if (text === null) {
        res.statusCode = 400;
        res.end();
        return;
      }
      if (text) appendFileSync(outFile, text);
      res.statusCode = 204;
      res.end();
    });
    req.on("error", () => {
      res.statusCode = 400;
      res.end();
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2]);
  const outFile = process.env.AFTERSIGN_RENDERED_OUT;
  if (!Number.isInteger(port) || port <= 0 || !outFile) {
    console.error("usage: AFTERSIGN_RENDERED_OUT=<file> node scripts/rendered-text-sink.mjs <port>");
    process.exit(2);
  }
  createSink(outFile).listen(port, "127.0.0.1", () => {
    console.log(`rendered-text sink: 127.0.0.1:${port} -> ${outFile}`);
  });
}
