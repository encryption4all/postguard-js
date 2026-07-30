// Generate the envelope fixture corpus.
//
// Run once per new format, then commit the output. The corpus is APPEND-ONLY:
// an existing fixture records what some sender actually put on the wire, and
// COMPATIBILITY.md's archival guarantee ("read support for stored artifacts is
// not part of this window; it never drops") is a promise about exactly those
// bytes. Editing one to make a failing test pass would erase the evidence
// rather than fix the regression, which is why check-envelope-fixtures.mjs
// refuses a modification.
//
//   node scripts/generate-envelope-fixtures.mjs [--force]
//
// Without --force it writes only fixtures that do not exist yet, so re-running
// after a change to createEnvelope cannot silently rewrite history.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, '..');
const outDir = join(pkgDir, 'tests', 'fixtures', 'envelopes');
const force = process.argv.includes('--force');

// Actual provenance for the `producedBy` field. This used to be a constant
// string, which answered nothing the fixture's own fields did not — and because
// the corpus is append-only, whatever goes in here is permanent for that file.
// The dirty marker matters: without it a fixture generated from uncommitted work
// would name a commit whose tree never produced these bytes.
function provenance() {
  const { version } = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const git = (args) => execFileSync('git', args, { cwd: pkgDir, encoding: 'utf8' }).trim();
  let commit = 'unknown commit';
  let dirty = '';
  try {
    commit = git(['rev-parse', 'HEAD']);
    if (git(['status', '--porcelain', '--', pkgDir]) !== '') dirty = ', working tree dirty';
  } catch {
    // Generating outside a checkout is legitimate; recording a commit that is a
    // guess is not.
  }
  return `@e4a/pg-js ${version} createEnvelope, generated at postguard-js ${commit}${dirty}`;
}

const producedBy = provenance();

// From dist/, not src/: the TS sources use `.js` specifiers that bare node does
// not resolve, and the built package is what consumers actually receive — so the
// corpus records what shipped rather than what compiled.
if (!existsSync(join(here, '..', 'dist', 'index.mjs'))) {
  console.error('dist/index.mjs is missing. Run `pnpm build` in packages/pg-js first.');
  process.exit(1);
}
const { createEnvelope } = await import('../dist/index.mjs');

// Deterministic stand-in for a Sealed: fixed bytes, fixed uuid. Nothing here
// may depend on wall-clock time or randomness, or the corpus would churn on
// every run and stop being diffable.
function makeSealed(bytes, uuid = 'fixture-uuid-0000') {
  return {
    mode: 'data',
    canUpload: true,
    async toBytes() {
      return bytes;
    },
    async upload() {
      return { uuid };
    },
  };
}

// Filled deterministically rather than randomly so the bytes are reproducible.
function payload(size) {
  const out = new Uint8Array(size);
  for (let i = 0; i < size; i++) out[i] = (i * 31 + 7) % 251;
  return out;
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function envelopeFixture({ name, description, bytes, uploadToCryptify = true }) {
  const sealed = makeSealed(bytes);
  const result = await createEnvelope({
    sealed,
    from: 'sender@example.com',
    unencryptedMessage: 'A fixture message.',
    websiteUrl: 'https://postguard.eu',
    uploadToCryptify,
  });

  const attachment = result.attachment
    ? {
        name: result.attachment.name,
        contentType: result.attachment.type,
        dataBase64: toBase64(new Uint8Array(await result.attachment.arrayBuffer())),
      }
    : null;

  return {
    name,
    description,
    // Recorded so a later reader can tell what produced these bytes without
    // guessing from the shape.
    producedBy,
    tier: result.tier,
    subject: result.subject,
    htmlBody: result.htmlBody,
    plainTextBody: result.plainTextBody,
    attachment,
    uploadUuid: result.uploadUuid,
    // What a reader must be able to recover. A digest rather than a second copy
    // of the ciphertext: the attachment already holds those bytes, and storing
    // them twice doubled every tier-2 fixture for no extra assurance.
    expect: {
      ciphertextSha256: attachment ? sha256(bytes) : null,
      ciphertextLength: attachment ? bytes.length : null,
      uploadUuid: result.uploadUuid,
    },
  };
}

const fixtures = [
  await envelopeFixture({
    name: 'tier1-url-fragment',
    description:
      'Small payload: ciphertext fits the recipient-side URL fragment, and the ' +
      'postguard.encrypted attachment is also present.',
    bytes: payload(512),
  }),
  await envelopeFixture({
    name: 'tier2-attachment-and-link',
    description:
      'Mid-size payload: postguard.encrypted attachment plus a Cryptify /decrypt?uuid= link ' +
      'in the body. The common path. Sized just past the tier-1 boundary — the tier is what ' +
      'this records, and a larger payload only inflates the corpus.',
    bytes: payload(76_000),
  }),
  await envelopeFixture({
    name: 'tier2-upload-declined',
    description:
      'Tier 2 with uploadToCryptify false: attachment only, no uuid link. Exercises the ' +
      'branch where a reader must fall back to the attachment.',
    bytes: payload(76_000),
    uploadToCryptify: false,
  }),
  await envelopeFixture({
    name: 'tier3-cryptify-link-only',
    description:
      'Payload past PG_MAX_ATTACHMENT_SIZE: no local attachment at all, so the recipient has ' +
      'only the Cryptify link. A reader that keys on the attachment alone finds nothing here, ' +
      'which is the asymmetry that broke the website uuid path (#39).',
    bytes: payload(10 * 1024 * 1024 + 1),
  }),
];

mkdirSync(outDir, { recursive: true });
let written = 0;
let skipped = 0;
for (const fixture of fixtures) {
  const path = join(outDir, `${fixture.name}.json`);
  if (existsSync(path) && !force) {
    skipped++;
    continue;
  }
  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
  written++;
  console.log(`  wrote ${fixture.name}.json (${fixture.tier})`);
}
console.log(`${written} written, ${skipped} left alone (already present).`);
if (skipped > 0 && !force) {
  console.log('Existing fixtures are never rewritten. Pass --force only to rebuild deliberately.');
}
