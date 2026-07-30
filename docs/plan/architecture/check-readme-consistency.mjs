import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const readmePath = path.join(__dirname, 'README.md');

const readme = fs.readFileSync(readmePath, 'utf8');
const errors = [];

function fail(message) {
  errors.push(message);
}

function isExternal(target) {
  return /^(https?:|mailto:|#)/i.test(target);
}

function checkRelativeMarkdownLinks() {
  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(readme)) !== null) {
    const rawTarget = match[1].trim();
    if (!rawTarget || isExternal(rawTarget)) continue;

    const [withoutHash] = rawTarget.split('#');
    if (!withoutHash || isExternal(withoutHash)) continue;

    const resolved = path.resolve(__dirname, withoutHash);
    if (!fs.existsSync(resolved)) {
      fail(`Broken relative link: ${rawTarget}`);
    }
  }
}

function checkTreeDirectoriesExist() {
  const treeBlockMatch = readme.match(/```[\s\S]*?```/);
  if (!treeBlockMatch) {
    fail('Missing repository tree code block.');
    return;
  }

  const treeBlock = treeBlockMatch[0];
  const dirRegex = /[├└]──\s+([a-z0-9-]+)\//gi;
  const dirs = new Set();
  let match;

  while ((match = dirRegex.exec(treeBlock)) !== null) {
    dirs.add(match[1]);
  }

  for (const dir of dirs) {
    const absolute = path.join(repoRoot, dir);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
      fail(`Missing top-level directory from tree: ${dir}/`);
    }
  }
}

function checkFlagshipMarkers() {
  const flagshipDir = path.join(repoRoot, 'aftersign');
  if (!fs.existsSync(flagshipDir)) {
    return;
  }

  if (!readme.includes('aftersign/')) {
    fail('Flagship directory exists (aftersign/) but is missing from architecture tree.');
  }

  if (readme.includes('The flagship will land as a new subdirectory')) {
    fail('Flagship already exists, but README still describes flagship as not yet landed.');
  }
}

checkRelativeMarkdownLinks();
checkTreeDirectoriesExist();
checkFlagshipMarkers();

if (errors.length > 0) {
  console.error('Architecture README consistency check failed:\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Architecture README consistency check passed.');
