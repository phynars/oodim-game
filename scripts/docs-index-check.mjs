#!/usr/bin/env node
// Doc-management gate (docs/CONSTITUTION.md C6, Kyoung 10-30): the studio works
// top-down — research → spec → design → tests → build — and the documents are
// how the team keeps its direction. This checks their shape, never their prose:
//
//   index    — every doc under docs/research, docs/specs and docs/design is
//              linked from docs/INDEX.md, and every local link there resolves.
//   research — at least two external (http/https) sources under "## Sources".
//   spec     — acceptance criteria "- AC-n: …" in an EARS shape (WHEN/WHILE/
//              WHERE/IF … THE … SHALL …); a "## References" section that links
//              the story's research doc or says "References: internal-only";
//              a "## Constitution check" naming every article in CONSTITUTION.md.
//   design   — a component diagram (mermaid flowchart/graph/classDiagram) and a
//              sequenceDiagram; a link to docs/plan/architecture/README.md; a
//              test-map row for every AC of the story's spec (C3, test first).
//
// Files are named <story#>-<slug>.md; the number ties research, spec and design
// together. `node scripts/docs-index-check.mjs` exits 1 and lists each problem.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

const EARS_RE = /^(?:(?:WHEN|WHILE|WHERE|IF)\b.+?,\s+(?:THEN\s+)?)*THE\b.+?\bSHALL\b/;

/** The text under a "## <title>" heading, up to the next level-2 heading. */
export function section(md, title) {
  const lines = md.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim().toLowerCase() === `## ${title}`.toLowerCase());
  if (at < 0) return null;
  const end = lines.findIndex((l, i) => i > at && /^##\s/.test(l));
  return lines.slice(at + 1, end < 0 ? undefined : end).join("\n");
}

export function storyNumber(file) {
  const m = /^(\d+)-[\w.-]+\.md$/.exec(file.split(/[\\/]/).pop() ?? "");
  return m ? Number(m[1]) : null;
}

export function acceptanceCriteria(md) {
  return [...(section(md, "Acceptance criteria") ?? "").matchAll(/^\s*-\s*(AC-\d+):\s*(.+)$/gm)].map((m) => ({ id: m[1], text: m[2].trim() }));
}

export function constitutionIds(md) {
  return [...new Set([...md.matchAll(/\*\*(C\d+)\*\*/g)].map((m) => m[1]))];
}

export function mermaidKinds(md) {
  // Skip `%%` comment and `%%{init: …}%%` directive lines before the diagram type.
  return [...md.matchAll(/```mermaid\s*\n(?:\s*%%[^\n]*\n)*\s*(\w+)/g)].map((m) => m[1]);
}

/** Article ids a Constitution check names: "C1: pass", "- **C1**: pass" or a
 *  table row "| C1 | pass |". */
export function checkedArticles(check) {
  return new Set([...check.matchAll(/(?:^|[\s|*-])(C\d+)\**\s*[:|]/gm)].map((m) => m[1]));
}

export function checkResearch(file, md) {
  const urls = new Set((section(md, "Sources") ?? "").match(/https?:\/\/[^\s)>|]+/g) ?? []);
  return urls.size >= 2 ? [] : [`${file}: "## Sources" needs at least 2 external links (found ${urls.size})`];
}

export function checkSpec(file, md, articles) {
  const errors = [];
  const n = storyNumber(file);
  const acs = acceptanceCriteria(md);
  if (acs.length === 0) errors.push(`${file}: no "- AC-n: …" lines under "## Acceptance criteria"`);
  for (const ac of acs) if (!EARS_RE.test(ac.text)) errors.push(`${file}: ${ac.id} is not in an EARS shape (WHEN/WHILE/WHERE/IF …, THE … SHALL …)`);
  const refs = section(md, "References");
  if (refs === null) errors.push(`${file}: missing "## References"`);
  else if (!/References:\s*internal-only/i.test(refs) && !new RegExp(`research/${n}-`).test(refs)) errors.push(`${file}: "## References" must link docs/research/${n}-….md or say "References: internal-only"`);
  const check = section(md, "Constitution check") ?? "";
  const named = checkedArticles(check);
  const missing = articles.filter((id) => !named.has(id));
  if (missing.length) errors.push(`${file}: "## Constitution check" is missing ${missing.join(", ")}`);
  return errors;
}

export function checkDesign(file, md, specMd) {
  const errors = [];
  const kinds = mermaidKinds(md);
  if (!kinds.some((k) => ["flowchart", "graph", "classDiagram"].includes(k))) errors.push(`${file}: needs a component diagram (mermaid flowchart, graph or classDiagram)`);
  if (!kinds.includes("sequenceDiagram")) errors.push(`${file}: needs a mermaid sequenceDiagram`);
  if (!/plan\/architecture\/README\.md/.test(md)) errors.push(`${file}: must link docs/plan/architecture/README.md`);
  if (specMd === null) {
    errors.push(`${file}: no spec docs/specs/${storyNumber(file)}-….md for this design`);
  } else {
    const map = section(md, "Test map") ?? "";
    const mapped = new Set([...map.matchAll(/^\|\s*(AC-\d+)\s*\|/gm)].map((m) => m[1]));
    const missing = acceptanceCriteria(specMd).map((a) => a.id).filter((id) => !mapped.has(id));
    if (missing.length) errors.push(`${file}: "## Test map" has no row for ${missing.join(", ")}`);
  }
  return errors;
}

/** Local link targets in INDEX.md that don't exist, and indexed-doc coverage. */
export function checkIndex(indexMd, indexDir, docs, exists) {
  const errors = [];
  const targets = [...indexMd.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)].map((m) => m[1]).filter((t) => !/^https?:/.test(t));
  const resolved = new Set(targets.map((t) => normalize(join(indexDir, t))));
  for (const t of targets) if (!exists(normalize(join(indexDir, t)))) errors.push(`docs/INDEX.md: link ${t} points nowhere`);
  for (const d of docs) if (!resolved.has(normalize(d))) errors.push(`docs/INDEX.md: ${d.replace(/\\/g, "/")} is not listed`);
  return errors;
}

// ---------------------------------------------------------------- I/O below

function listMd(dir) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => join(dir, f)) : [];
}

export function run(root) {
  const docsDir = join(root, "docs");
  const read = (p) => readFileSync(p, "utf8");
  const research = listMd(join(docsDir, "research"));
  const specs = listMd(join(docsDir, "specs"));
  const designs = listMd(join(docsDir, "design"));
  const rel = (p) => relative(root, p).replace(/\\/g, "/");
  const errors = [];
  for (const f of [...research, ...specs, ...designs]) if (storyNumber(f) === null) errors.push(`${rel(f)}: name it <story#>-<slug>.md`);
  const articles = constitutionIds(read(join(docsDir, "CONSTITUTION.md")));
  for (const f of research) errors.push(...checkResearch(rel(f), read(f)));
  for (const f of specs) errors.push(...checkSpec(rel(f), read(f), articles));
  for (const f of designs) {
    const spec = specs.find((s) => storyNumber(s) === storyNumber(f));
    errors.push(...checkDesign(rel(f), read(f), spec ? read(spec) : null));
  }
  const indexPath = join(docsDir, "INDEX.md");
  if (!existsSync(indexPath)) errors.push("docs/INDEX.md is missing");
  else errors.push(...checkIndex(read(indexPath), docsDir, [...research, ...specs, ...designs], existsSync));
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const errors = run(join(dirname(fileURLToPath(import.meta.url)), ".."));
  for (const e of errors) console.log(`::error title=docs-index::${e}`);
  console.log(errors.length ? `DOCS_INDEX=fail (${errors.length})` : "DOCS_INDEX=ok");
  process.exit(errors.length ? 1 : 0);
}
