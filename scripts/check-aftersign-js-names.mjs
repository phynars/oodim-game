#!/usr/bin/env node
// Undefined-name guard for AFTERSIGN's plain-JS files.
//
// `aftersign/main.js` and its sibling `.js` modules are plain JavaScript,
// and `aftersign/tsconfig.json` includes only `src/`, so `tsc` never reads
// them. A name that is called but no longer imported (PR #2775 dropped the
// import of `buildIoRecognitionDialogueSnippets` and kept two calls) passes
// `typecheck:aftersign` and only fails in the browser, where the e2e lane
// spends its whole 30-minute limit finding out.
//
// This guard asks the TypeScript checker one question about those files:
// is every bare name bound to something? It reports only
//   TS2304  Cannot find name 'x'.
//   TS2552  Cannot find name 'x'. Did you mean 'y'?
// and ignores every other diagnostic, so it does not turn the JS files into
// type-checked code. It runs in seconds.
//
// Usage:
//   node scripts/check-aftersign-js-names.mjs            check aftersign/*.js
//   node scripts/check-aftersign-js-names.mjs a.js b.js  check the given files
//
// Exit 0: every name resolves. Exit 1: at least one does not (listed as
// `file:line:col  name`). Exit 2: a file to check could not be read.

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AFTERSIGN_DIR = join(REPO_ROOT, 'aftersign');

/** TS2304 and TS2552: the two "Cannot find name" diagnostics. */
export const UNDEFINED_NAME_CODES = new Set([2304, 2552]);

/** The browser-run `.js` files directly under `aftersign/` (tests excluded). */
export function defaultFiles(dir = AFTERSIGN_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
    .sort()
    .map((name) => join(dir, name));
}

/**
 * Returns one entry per unresolved bare name in `files`.
 * Only the listed files are reported on; the modules they import are loaded
 * so imports resolve, but their own diagnostics are not read.
 */
export function findUndefinedNames(files, { root = REPO_ROOT } = {}) {
  const rootNames = files.map((file) => resolve(file));
  const program = ts.createProgram({
    rootNames,
    options: {
      allowJs: true,
      checkJs: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowImportingTsExtensions: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      skipLibCheck: true,
      types: ['vite/client'],
      typeRoots: [join(root, 'node_modules', '@types'), join(root, 'node_modules')],
    },
  });

  const findings = [];
  for (const rootName of rootNames) {
    const source = program.getSourceFile(rootName);
    if (!source) {
      throw new Error(`cannot read ${rootName}`);
    }
    for (const diagnostic of program.getSemanticDiagnostics(source)) {
      if (!UNDEFINED_NAME_CODES.has(diagnostic.code) || diagnostic.start === undefined) {
        continue;
      }
      const { line, character } = source.getLineAndCharacterOfPosition(diagnostic.start);
      findings.push({
        file: relative(root, rootName).replace(/\\/g, '/'),
        line: line + 1,
        column: character + 1,
        name: source.text.slice(diagnostic.start, diagnostic.start + (diagnostic.length ?? 0)),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
      });
    }
  }
  return findings;
}

function main(argv) {
  const files = argv.length > 0 ? argv.map((file) => resolve(file)) : defaultFiles();
  const missing = files.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    for (const file of missing) {
      console.error(`check-aftersign-js-names: no such file: ${file}`);
    }
    return 2;
  }

  let findings;
  try {
    findings = findUndefinedNames(files);
  } catch (error) {
    console.error(`check-aftersign-js-names: ${error.message}`);
    return 2;
  }

  if (findings.length === 0) {
    console.log(`check-aftersign-js-names: OK (${files.length} file(s), every name resolves)`);
    return 0;
  }

  console.error(
    `check-aftersign-js-names: ${findings.length} undefined name(s). ` +
      'Each is used but never imported or declared, and throws ReferenceError in the browser:',
  );
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}:${finding.column}  ${finding.name}`);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
