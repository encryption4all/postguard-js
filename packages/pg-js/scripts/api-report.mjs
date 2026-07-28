// Public API surface report: generate, verify, and gate the version bump.
//
//   node scripts/api-report.mjs --update        rewrite etc/pg-js.api.md
//   node scripts/api-report.mjs --check         fail if the report is stale
//   node scripts/api-report.mjs --gate [--base <ref>]
//                                               --check, then require the
//                                               pending changeset to cover the
//                                               API diff against the merge base
//                                               with <ref>
//
// All three need dist/index.d.mts, so run `pnpm build` first. `--check` is
// wired into `postbuild`, which is how CI gets it for free.
//
// The comparison logic lives in lib/api-surface.mjs and is unit-tested; this
// file is only file and git I/O.

import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import {
  BUMP_RANK,
  classify,
  comparisonBase,
  parseReport,
  pendingBump,
  renderReport,
} from './lib/api-surface.mjs';

const PACKAGE_NAME = '@e4a/pg-js';
const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DTS_PATH = join(PACKAGE_DIR, 'dist', 'index.d.mts');
const REPORT_PATH = join(PACKAGE_DIR, 'etc', 'pg-js.api.md');

function fail(message) {
  console.error(`\napi-report: ${message}\n`);
  process.exit(1);
}

function git(...args) {
  return execFileSync('git', args, { cwd: PACKAGE_DIR, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function readBuiltReport() {
  if (!existsSync(DTS_PATH)) {
    fail('dist/index.d.mts is missing. Run `pnpm build` first.');
  }
  return renderReport(readFileSync(DTS_PATH, 'utf8'));
}

function update() {
  writeFileSync(REPORT_PATH, readBuiltReport());
  console.log('api-report: wrote etc/pg-js.api.md');
}

function check() {
  const built = readBuiltReport();
  if (!existsSync(REPORT_PATH)) {
    fail('etc/pg-js.api.md is missing. Run `pnpm api:update` and commit the result.');
  }
  if (readFileSync(REPORT_PATH, 'utf8') !== built) {
    fail(
      'the public API surface changed but etc/pg-js.api.md was not updated.\n' +
        'Run `pnpm api:update`, read the diff, and commit it together with a changeset.'
    );
  }
  console.log('api-report: etc/pg-js.api.md matches the build');
}

/** Repo-relative path of the report, so `git show <ref>:<path>` resolves. */
function reportPathInRepo() {
  return join(git('rev-parse', '--show-prefix').trim(), 'etc/pg-js.api.md');
}

function readChangesets() {
  const dir = join(git('rev-parse', '--show-toplevel').trim(), '.changeset');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
    .map((name) => ({ name, content: readFileSync(join(dir, name), 'utf8') }));
}

/** Resolve the merge base, turning both git failures into advice. */
function resolveComparisonBase(baseRef) {
  const branch = baseRef.replace(/^origin\//, '');
  try {
    git('rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`);
  } catch {
    fail(
      `cannot resolve the base ref \`${baseRef}\`.\n` +
        `Fetch it first, e.g. \`git fetch --no-tags origin ${branch}\`,\n` +
        'or pass a different ref with --base.'
    );
  }
  try {
    return comparisonBase(git, baseRef);
  } catch {
    fail(
      `\`${baseRef}\` and HEAD have no common ancestor in this clone.\n` +
        'The checkout is probably too shallow to find one. Deepen it, e.g.\n' +
        `\`git fetch --no-tags --unshallow origin ${branch}\` (in CI: \`fetch-depth: 0\`).`
    );
  }
}

function gate(baseRef) {
  check();

  const mergeBase = resolveComparisonBase(baseRef);
  const against = `${baseRef} (merge base ${mergeBase.slice(0, 7)})`;

  const path = reportPathInRepo();
  let baseReport;
  try {
    baseReport = git('show', `${mergeBase}:${path}`);
  } catch {
    console.log(`api-report: ${against} has no ${path} yet, nothing to compare against`);
    return;
  }

  const { level, changes } = classify(parseReport(baseReport), parseReport(readFileSync(REPORT_PATH, 'utf8')));

  if (changes.length === 0) {
    console.log(`api-report: no public API change against ${against}`);
    return;
  }

  console.log(`api-report: public API changes against ${against}:`);
  for (const change of changes) console.log(`  ${change.level.padEnd(5)} ${change.detail}`);

  const declared = pendingBump(readChangesets(), PACKAGE_NAME);
  console.log(`api-report: required bump ${level}, pending changesets declare ${declared}`);

  if (BUMP_RANK[declared] < BUMP_RANK[level]) {
    fail(
      `this diff needs a ${level} release of ${PACKAGE_NAME} but the pending changesets declare ${declared}.\n` +
        `Run \`pnpm changeset\` and pick ${level}, or narrow the API change.\n` +
        'If a listed change is not actually breaking, say so on the PR. The check is deliberately conservative.'
    );
  }

  console.log('api-report: the pending changeset covers the API diff');
}

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const baseRef = baseIndex === -1 ? `origin/${process.env.GITHUB_BASE_REF || 'main'}` : args[baseIndex + 1];

if (args.includes('--update')) update();
else if (args.includes('--gate')) gate(baseRef);
else if (args.includes('--check')) check();
else fail('expected one of --update, --check, --gate');
