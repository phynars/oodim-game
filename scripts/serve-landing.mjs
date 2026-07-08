// Tiny static file server for landing/ — used by the aftersign playwright lane
// as a webServer so aftersign/e2e/landing-discoverability.spec.ts can hit the
// portfolio index page over HTTP.
//
// Why this exists (2026-07-07): the aftersign playwright config previously
// invoked `npx --yes serve@14 landing -l 4375 …` as the landing webServer.
// That works locally but is fragile in CI: it fetches the `serve` package
// from the npm registry at TEST-RUN time (npx cache miss on a fresh runner),
// and a transient registry hiccup then presents as an aftersign-lane failure
// that has nothing to do with the spec under test. Replacing the network
// fetch with a script built on Node's stdlib removes the failure mode: the
// script is checked in, uses only `node:http` + `node:fs` + `node:path`, and
// starts in milliseconds with no install step.
//
// Behavior:
//   - Serves files under landing/ verbatim.
//   - `/` maps to `landing/index.html` (the portfolio index we assert on).
//   - Any missing path returns an honest 404 (no SPA fallback). The prod
//     deploy also serves landing/ as a static bucket with 404s for missing
//     paths, so this matches production behavior.
//   - No directory traversal: any resolved path outside landing/ → 403.
//
// Usage: `node scripts/serve-landing.mjs 4375`

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const landingRoot = path.join(repoRoot, "landing");
const port = Number.parseInt(process.argv[2] ?? "4375", 10);

// Minimal content-type table — the landing page uses only these types.
// Anything else falls through to application/octet-stream, which browsers
// still handle correctly for our spec (we assert on the /index.html DOM).
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    const resolved = path.resolve(landingRoot, "." + pathname);
    // Directory-traversal guard: any resolved path outside landingRoot is 403.
    if (
      resolved !== landingRoot &&
      !resolved.startsWith(landingRoot + path.sep)
    ) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const info = await stat(resolved).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404).end("Not Found");
      return;
    }
    const body = await readFile(resolved);
    const type = MIME[path.extname(resolved).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, {
      "content-type": type,
      "content-length": body.length,
      "cache-control": "no-store",
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end("Internal Server Error: " + (err instanceof Error ? err.message : String(err)));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("serve-landing: listening on http://127.0.0.1:" + port + "/  (root=" + landingRoot + ")");
});
