import { readFileSync } from 'node:fs';

const START = '<!-- FLAGSHIP_MANDATE_SYNC:START -->';
const END = '<!-- FLAGSHIP_MANDATE_SYNC:END -->';

function read(path) {
  return readFileSync(path, 'utf8');
}

function extractBlock(content, filePath) {
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `${filePath} must include ${START} ... ${END} block for mandate sync guard.`,
    );
  }

  return content.slice(start + START.length, end).trim();
}

function normalize(block) {
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function main() {
  const briefPath = 'docs/flagship/BRIEF.md';
  const architecturePath = 'docs/plan/architecture/README.md';

  const brief = read(briefPath);
  const architecture = read(architecturePath);

  const briefBlock = normalize(extractBlock(brief, briefPath));
  const architectureBlock = normalize(extractBlock(architecture, architecturePath));

  if (briefBlock !== architectureBlock) {
    console.error('Flagship mandate drift detected between docs/flagship/BRIEF.md and docs/plan/architecture/README.md.');
    console.error('--- brief canonical block ---');
    console.error(briefBlock);
    console.error('--- architecture mirrored block ---');
    console.error(architectureBlock);
    process.exit(1);
  }

  if (!architecture.includes('docs/flagship/BRIEF.md')) {
    console.error('Architecture README must continue to point contributors to docs/flagship/BRIEF.md as canonical source.');
    process.exit(1);
  }

  console.log('Flagship mandate sync check passed.');
}

main();
