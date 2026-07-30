// Assert the envelope fixture corpus is append-only.
//
// Each fixture records what a sender actually emitted, and COMPATIBILITY.md's
// archival guarantee — "read support for stored artifacts is not part of this
// window; it never drops" — is a promise about exactly those bytes. So a fixture
// may be added, never changed and never removed: editing one to make
// envelope-archival.test.ts pass would erase the evidence of a regression
// instead of fixing it, and the test would go green having proved nothing.
//
// Compares against the MERGE BASE of the base branch and HEAD, not the base tip,
// so a fixture added on main after this branch started is not blamed on it —
// same reasoning as scripts/api-report.mjs.
//
//   node scripts/check-envelope-fixtures.mjs [--base <ref>]

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRelDir = 'packages/pg-js/tests/fixtures/envelopes';
const absDir = join(here, '..', 'tests', 'fixtures', 'envelopes');

// Every git call is rooted at the repository, not the process cwd. `pnpm
// envelope:check` runs this from packages/pg-js, where the repo-relative
// pathspec below resolved to packages/pg-js/packages/pg-js/… and matched
// nothing — so the check reported "none modified or removed" while a fixture
// had been rewritten. Same shape as the working-directory bug in the Baked URLs
// job, and caught here by mutation-testing rather than by reading it.
function git(args, cwd = repoRoot) {
  return execFileSync('git', args, { encoding: 'utf8', cwd }).trim();
}

const repoRoot = git(['rev-parse', '--show-toplevel'], process.cwd());

function fail(message) {
  console.error(`envelope fixture check could not run: ${message}`);
  process.exit(1);
}

const baseArgIndex = process.argv.indexOf('--base');
const baseRef =
  baseArgIndex !== -1
    ? process.argv[baseArgIndex + 1]
    : process.env.GITHUB_BASE_REF
      ? `origin/${process.env.GITHUB_BASE_REF}`
      : 'origin/main';

// A corpus that matched nothing would let this exit 0 having checked nothing —
// the vacuous pass this whole gate exists to avoid.
if (!existsSync(absDir)) {
  fail(`${repoRelDir} does not exist. Run this from the repository root.`);
}
const present = readdirSync(absDir).filter((f) => f.endsWith('.json'));
if (present.length === 0) {
  fail(`${repoRelDir} holds no fixtures, so there is nothing to protect`);
}

let mergeBase;
try {
  mergeBase = git(['merge-base', baseRef, 'HEAD']);
} catch {
  // Reported rather than skipped: without a base there is no way to tell an
  // addition from a rewrite, and "cannot check" must not read as "clean".
  fail(
    `no merge base between ${baseRef} and HEAD. In CI, fetch the base branch first ` +
      '(actions/checkout with fetch-depth: 0).'
  );
}

let changes;
try {
  changes = git(['diff', '--name-status', `${mergeBase}...HEAD`, '--', repoRelDir]);
} catch (err) {
  fail(`git diff against ${mergeBase} failed: ${err.message}`);
}

const violations = [];
const added = [];
for (const line of changes.split('\n').filter(Boolean)) {
  const [status, ...pathParts] = line.split('\t');
  const path = pathParts[pathParts.length - 1];
  if (status.startsWith('A')) {
    added.push(path);
  } else if (status.startsWith('M')) {
    violations.push(`${path} was MODIFIED`);
  } else if (status.startsWith('D')) {
    violations.push(`${path} was DELETED`);
  } else if (status.startsWith('R')) {
    violations.push(`${path} was RENAMED (${status})`);
  } else {
    violations.push(`${path} changed with unexpected status ${status}`);
  }
}

if (violations.length > 0) {
  console.error('The envelope fixture corpus is append-only, and this branch changed it:\n');
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    '\nA fixture records bytes some sender actually emitted. If a test against one is\n' +
      'failing, the regression is in the reader, not in the fixture. Restore it with:\n' +
      `  git checkout ${mergeBase} -- ${repoRelDir}\n` +
      'Adding new fixtures is always allowed.'
  );
  process.exit(1);
}

console.log(
  `${present.length} fixtures present, ${added.length} added on this branch, none modified or removed.`
);
